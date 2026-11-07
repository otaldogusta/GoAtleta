package com.goatleta.cameraprobe;

import android.annotation.SuppressLint;
import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebMessage;
import android.webkit.WebMessagePort;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.camera.view.PreviewView;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.ByteBuffer;
import java.nio.channels.FileChannel;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

/** Pairs the local hardware fixture with the existing camera-only studio transport. */
final class NativeStudioBridge implements AutoCloseable {
  interface Listener {
    void onCommand(JSONObject command);
    void onStatus(String state);
  }

  private static final String PAGE = "/native-camera";
  private static final String HANDSHAKE = "goatleta-native-studio-v1";
  private static final int FRAME_INTERVAL_MS = 83;
  private static final int FRAME_SIDE = 640;
  private static final int MAX_JPEG_BYTES = 128 * 1024;
  // One native read feeds multiple acknowledged 8 KiB network parts.
  private static final int CHUNK_BYTES = 256 * 1024;
  private static final long MAX_ORIGINAL_BYTES = 64L * 1024 * 1024;
  private static final int MAX_ORIGINALS = 4;
  private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");
  private static final Pattern ROOM = Pattern.compile("[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}");
  private static final Pattern TOKEN = Pattern.compile("[0-9a-fA-F]{64}");
  private final Handler main = new Handler(Looper.getMainLooper());
  private final ExecutorService frameWorker = Executors.newSingleThreadExecutor();
  private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
  private final LinkedHashMap<String, Original> originals = new LinkedHashMap<>();
  private final Runnable capture = this::capturePreview;
  private final ContentResolver resolver;
  private final String pageUrl, documentUrl;
  private final Uri origin;
  private final String roomPath;
  private final PreviewView preview;
  private final WebView web;
  private final Listener listener;
  private WebMessagePort port;
  private String cameraState, recordingState;
  private boolean started, closed, pageFailed, ready, previewEnabled, compressing, reading;
  private long previewGeneration, nextFrame, pendingFrame;

  private record Original(Uri uri, long bytes) {}

  @SuppressLint("SetJavaScriptEnabled")
  NativeStudioBridge(Context context, String pairUrl, PreviewView preview, Listener listener) {
    URI link;
    try {
      link = URI.create(pairUrl == null ? "" : pairUrl);
    } catch (IllegalArgumentException error) {
      // URI parser errors can include the full camera capability.
      throw new IllegalArgumentException("Link local da câmera inválido.");
    }
    String host = link.getHost();
    int portNumber = link.getPort();
    if (!"https".equals(link.getScheme()) || !privateIp(host) || portNumber < 1 || portNumber > 65535
        || !link.getRawAuthority().equals(host + ":" + portNumber) || link.getRawQuery() != null
        || !("/camera".equals(link.getRawPath()) || PAGE.equals(link.getRawPath()))) {
      throw new IllegalArgumentException("Endereço local da câmera inválido.");
    }
    String fragment = link.getRawFragment();
    String room = pairRoom(fragment);
    origin = Uri.parse("https://" + host + ":" + portNumber);
    documentUrl = origin + PAGE;
    pageUrl = documentUrl + "#" + fragment;
    roomPath = "/rooms/" + room + "/";
    this.preview = preview;
    this.listener = listener;
    resolver = context.getContentResolver();
    web = new WebView(context);
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    settings.setSupportMultipleWindows(false);
    settings.setJavaScriptCanOpenWindowsAutomatically(false);
    settings.setMediaPlaybackRequiresUserGesture(true);
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onPermissionRequest(PermissionRequest request) { request.deny(); }
    });
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return true;
      }

      @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri target = request.getUrl();
        String path = target.getEncodedPath();
        boolean allowed = sameOrigin(target) && path != null && (request.isForMainFrame()
            ? PAGE.equals(path) && target.getEncodedQuery() == null
            : "/native-camera.js".equals(path) || "/camera.js".equals(path) || roomRequest(path));
        if (allowed) return null;
        return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden", Collections.emptyMap(),
            new ByteArrayInputStream(new byte[0]));
      }

      @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
        disconnectPort();
        pageFailed = !matchesPage(url);
        if (pageFailed) view.stopLoading();
      }

      @Override public void onPageFinished(WebView view, String url) {
        if (!closed && !pageFailed && matchesPage(url) && matchesPage(view.getUrl()) && port == null) attachPort();
      }

      @Override public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
        handler.cancel();
        connectionError();
      }

      @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (request.isForMainFrame()) connectionError();
      }

      @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
        if (request.isForMainFrame()) connectionError();
      }

      @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        close();
        listener.onStatus("error");
        return true;
      }
    });
  }

  private static boolean privateIp(String host) {
    if (host == null) return false;
    String[] pieces = host.split("\\.", -1);
    if (pieces.length != 4) return false;
    int[] bytes = new int[4];
    for (int i = 0; i < pieces.length; i++) {
      if (!pieces[i].matches("0|[1-9][0-9]{0,2}")) return false;
      bytes[i] = Integer.parseInt(pieces[i]);
      if (bytes[i] > 255) return false;
    }
    return bytes[0] == 10 || bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31
        || bytes[0] == 192 && bytes[1] == 168;
  }

  private static String pairRoom(String fragment) {
    String room = null;
    String token = null;
    if (fragment != null && fragment.length() == 112) {
      for (String field : fragment.split("&", -1)) {
        if (field.startsWith("room=") && room == null) room = field.substring(5);
        else if (field.startsWith("token=") && token == null) token = field.substring(6);
        else throw new IllegalArgumentException("Pareamento local inválido.");
      }
    }
    if (room == null || token == null || !ROOM.matcher(room).matches() || !TOKEN.matcher(token).matches()) {
      throw new IllegalArgumentException("Pareamento local inválido.");
    }
    return room;
  }

  private boolean sameOrigin(Uri target) {
    return "https".equals(target.getScheme()) && origin.getEncodedAuthority().equals(target.getEncodedAuthority());
  }

  private boolean roomRequest(String path) {
    if (!path.startsWith(roomPath)) return false;
    return switch (path.substring(roomPath.length())) {
      case "join", "signals", "heartbeat" -> true;
      default -> false;
    };
  }

  private boolean matchesPage(String url) { return pageUrl.equals(url) || documentUrl.equals(url); }

  WebView view() { return web; }

  void start() {
    if (started || closed) return;
    started = true;
    web.loadUrl(pageUrl);
  }

  private void connectionError() {
    pageFailed = true;
    disconnectPort();
    if (!closed) listener.onStatus("error");
  }

  private void attachPort() {
    WebMessagePort[] channel = web.createWebMessageChannel();
    port = channel[0];
    port.setWebMessageCallback(new WebMessagePort.WebMessageCallback() {
      @Override public void onMessage(WebMessagePort source, WebMessage message) {
        if (!closed && port == source && matchesPage(web.getUrl())) receive(source, message.getData());
      }
    });
    try {
      // Transfers a capability to the validated top-level page only. The exact
      // target origin also protects against a navigation racing the post.
      web.postWebMessage(new WebMessage(HANDSHAKE, new WebMessagePort[]{channel[1]}), origin);
    } catch (IllegalStateException error) {
      channel[1].close();
      connectionError();
    }
  }

  private void disconnectPort() {
    ready = false;
    pendingFrame = 0;
    previewGeneration++;
    main.removeCallbacks(capture);
    WebMessagePort previous = port;
    port = null;
    if (previous != null) previous.close();
  }

  private void receive(WebMessagePort source, String data) {
    if (data == null || data.length() > 1024) return;
    try {
      JSONObject message = new JSONObject(data);
      String kind = message.optString("kind");
      if (!ready && "ready".equals(kind)) {
        ready = true;
        post(cameraState);
        post(recordingState);
        originals.forEach(this::publishOriginal);
        listener.onStatus("ready");
        schedulePreview(0);
      } else if (ready) {
        switch (kind) {
          case "preview-ack" -> {
            if (pendingFrame != 0 && message.optLong("frameId", -1) == pendingFrame) {
              pendingFrame = 0;
              schedulePreview(FRAME_INTERVAL_MS);
            }
          }
          case "connection" -> {
            String state = message.optString("state");
            switch (state) {
              case "connecting", "connected", "offline", "unsupported", "error" -> listener.onStatus(state);
              default -> { }
            }
          }
          case "command" -> {
            String action = message.optString("action");
            String commandId = message.optString("commandId");
            if (!ID.matcher(commandId).matches()) return;
            switch (action) {
              case "start-recording", "pause-recording", "resume-recording", "stop-recording",
                  "camera-on", "camera-off", "new-recording" -> listener.onCommand(message);
              default -> { }
            }
          }
          case "read-chunk" -> readChunk(source, message);
          default -> { }
        }
      }
    } catch (JSONException ignored) { /* Invalid port messages have no effect. */ }
  }

  void send(JSONObject message) {
    if (closed) return;
    String data = message.toString();
    switch (message.optString("kind")) {
      case "camera" -> {
        cameraState = data;
        if (message.optBoolean("resetRecording")) recordingState = null;
      }
      case "recording" -> recordingState = data;
      default -> { }
    }
    post(data);
  }

  private boolean post(String data) {
    if (data == null || closed || !ready || port == null || !matchesPage(web.getUrl())) return false;
    try {
      port.postMessage(new WebMessage(data));
      return true;
    } catch (IllegalStateException error) {
      connectionError();
      return false;
    }
  }

  void setPreviewEnabled(boolean enabled) {
    if (closed || previewEnabled == enabled) return;
    previewEnabled = enabled;
    previewGeneration++;
    main.removeCallbacks(capture);
    if (enabled) schedulePreview(0);
  }

  private void schedulePreview(long delayMs) {
    if (closed || !ready || !previewEnabled || compressing || pendingFrame != 0) return;
    main.removeCallbacks(capture);
    main.postDelayed(capture, delayMs);
  }

  private void capturePreview() {
    if (closed || !ready || !previewEnabled || compressing || pendingFrame != 0) return;
    Bitmap bitmap;
    long capturedEpochMs = System.currentTimeMillis();
    try {
      bitmap = preview.getBitmap();
    } catch (IllegalStateException error) {
      bitmap = null; // The preview surface can briefly vanish on a rotation.
    }
    if (bitmap == null) {
      schedulePreview(FRAME_INTERVAL_MS);
      return;
    }
    Bitmap captured = bitmap;
    long generation = previewGeneration;
    long frameId = ++nextFrame;
    compressing = true;
    frameWorker.execute(() -> {
      String jpeg = encodePreview(captured);
      main.post(() -> {
        compressing = false;
        if (jpeg != null && generation == previewGeneration && previewEnabled
            && post(json("preview", "jpeg", jpeg, "frameId", frameId, "capturedEpochMs", capturedEpochMs))) {
          pendingFrame = frameId;
        } else {
          schedulePreview(FRAME_INTERVAL_MS);
        }
      });
    });
  }

  private static String encodePreview(Bitmap bitmap) {
    Bitmap scaled = bitmap;
    try {
      float factor = Math.min(1f, FRAME_SIDE / (float) Math.max(bitmap.getWidth(), bitmap.getHeight()));
      if (factor < 1f) {
        scaled = Bitmap.createScaledBitmap(bitmap, Math.max(1, Math.round(bitmap.getWidth() * factor)),
            Math.max(1, Math.round(bitmap.getHeight() * factor)), true);
      }
      ByteArrayOutputStream output = new ByteArrayOutputStream(24 * 1024);
      if (!scaled.compress(Bitmap.CompressFormat.JPEG, 60, output) || output.size() > MAX_JPEG_BYTES) return null;
      return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
    } catch (RuntimeException error) {
      return null;
    } finally {
      if (scaled != bitmap) scaled.recycle();
      bitmap.recycle();
    }
  }

  void offerOriginal(String id, Uri uri, long bytes) {
    // Only the activity can register its own finalized MediaStore output.
    if (closed || !ID.matcher(id).matches() || uri == null || !"content".equals(uri.getScheme())
        || !"media".equals(uri.getAuthority()) || bytes <= 0 || bytes > MAX_ORIGINAL_BYTES) return;
    Original original = new Original(uri, bytes);
    if (originals.putIfAbsent(id, original) != null) return;
    if (originals.size() > MAX_ORIGINALS) originals.remove(originals.keySet().iterator().next());
    publishOriginal(id, original);
  }

  private void publishOriginal(String id, Original original) {
    post(json("finalized", "recordingId", id, "bytes", original.bytes(), "chunkSize", CHUNK_BYTES));
  }

  private void readChunk(WebMessagePort source, JSONObject request) {
    String requestId = request.optString("requestId");
    if (!ID.matcher(requestId).matches()) return;
    String id = request.optString("recordingId");
    Original original = originals.get(id);
    Object rawIndex = request.opt("index");
    int index = request.optInt("index", -1);
    long offset = (long) index * CHUNK_BYTES;
    if (reading || original == null || !(rawIndex instanceof Number number)
        || number.doubleValue() != index || index < 0 || offset >= original.bytes()) {
      post(json("chunk-error", "requestId", requestId));
      return;
    }
    int length = (int) Math.min(CHUNK_BYTES, original.bytes() - offset);
    reading = true;
    fileWorker.execute(() -> {
      String data = readOriginal(original, offset, length);
      main.post(() -> {
        reading = false;
        if (!closed && port == source) post(data == null ? json("chunk-error", "requestId", requestId)
            : json("chunk", "requestId", requestId, "recordingId", id, "index", index, "data", data));
      });
    });
  }

  private String readOriginal(Original original, long offset, int length) {
    try (ParcelFileDescriptor descriptor = resolver.openFileDescriptor(original.uri(), "r")) {
      if (descriptor == null || descriptor.getStatSize() != original.bytes()) return null;
      ByteBuffer bytes = ByteBuffer.allocate(length);
      try (FileChannel file = new ParcelFileDescriptor.AutoCloseInputStream(descriptor).getChannel()) {
        while (bytes.hasRemaining()) if (file.read(bytes, offset + bytes.position()) <= 0) return null;
      }
      return Base64.encodeToString(bytes.array(), Base64.NO_WRAP);
    } catch (IOException | SecurityException error) {
      return null;
    }
  }

  private static String json(String kind, Object... fields) {
    JSONObject object = new JSONObject();
    try {
      object.put("kind", kind);
      for (int i = 0; i < fields.length; i += 2) object.put((String) fields[i], fields[i + 1]);
    } catch (JSONException error) {
      throw new IllegalArgumentException("Mensagem local inválida.");
    }
    return object.toString();
  }

  @Override public void close() {
    if (closed) return;
    closed = true;
    disconnectPort();
    originals.clear();
    frameWorker.shutdown();
    fileWorker.shutdown();
    web.stopLoading();
    if (web.getParent() instanceof android.view.ViewGroup parent) parent.removeView(web);
    web.destroy();
  }
}
