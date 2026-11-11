package com.goatleta.cameraprobe;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Handler;
import android.os.Looper;
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
import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
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

  private static final String PAGE = StudioPairingLink.NATIVE_PATH;
  private static final String HANDSHAKE = "goatleta-native-studio-v1";
  private static final int FRAME_INTERVAL_MS = 83;
  private static final int RECORDING_FRAME_INTERVAL_MS = 150;
  private static final int HOT_FRAME_INTERVAL_MS = 300;
  private static final int FRAME_SIDE = 640;
  private static final int HOT_FRAME_SIDE = 480;
  private static final int MAX_JPEG_BYTES = 128 * 1024;
  private static final int MAX_RESTORED_ORIGINALS = 256;
  private static final int MAX_FILE_REQUESTS = 4;
  private static final Pattern ID = Pattern.compile("[A-Za-z0-9_-]{1,128}");
  private final Handler main = new Handler(Looper.getMainLooper());
  private final ExecutorService frameWorker = Executors.newSingleThreadExecutor();
  private final ExecutorService fileWorker = Executors.newSingleThreadExecutor();
  private final LinkedHashMap<String, StudioOriginalFile.Source> originals = new LinkedHashMap<>();
  private final Runnable capture = this::capturePreview;
  private final File sourceDirectory;
  private final String pageUrl, documentUrl;
  private final Uri origin;
  private final String roomPath;
  private final PreviewView preview;
  private final WebView web;
  private final Listener listener;
  private WebMessagePort port;
  private String cameraState, recordingState;
  private boolean started, closed, pageFailed, ready, previewEnabled, compressing;
  private int fileRequests;
  private int frameIntervalMs = FRAME_INTERVAL_MS, frameSide = FRAME_SIDE;
  private long previewGeneration, nextFrame, pendingFrame;

  @SuppressLint("SetJavaScriptEnabled")
  NativeStudioBridge(Context context, String pairUrl, PreviewView preview, Listener listener) {
    StudioPairingLink pair = StudioPairingLink.parse(pairUrl);
    URI link = pair.address();
    origin = Uri.parse("https://" + link.getRawAuthority());
    documentUrl = origin + PAGE;
    pageUrl = documentUrl + "#" + link.getRawFragment();
    roomPath = "/rooms/" + pair.room() + "/";
    this.preview = preview;
    this.listener = listener;
    sourceDirectory = StudioOriginalFile.roomDirectory(context.getFilesDir(), pageUrl);
    restoreOriginals();
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
              schedulePreview(frameIntervalMs);
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
          case "hash-range" -> hashRange(source, message);
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

  void setPreviewLoad(boolean recording, boolean hot) {
    int interval = hot ? HOT_FRAME_INTERVAL_MS : recording ? RECORDING_FRAME_INTERVAL_MS : FRAME_INTERVAL_MS;
    int side = hot ? HOT_FRAME_SIDE : FRAME_SIDE;
    if (closed || interval == frameIntervalMs && side == frameSide) return;
    frameIntervalMs = interval;
    frameSide = side;
    previewGeneration++;
    schedulePreview(frameIntervalMs);
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
      schedulePreview(frameIntervalMs);
      return;
    }
    Bitmap captured = bitmap;
    int side = frameSide;
    long generation = previewGeneration;
    long frameId = ++nextFrame;
    compressing = true;
    frameWorker.execute(() -> {
      String jpeg = encodePreview(captured, side);
      main.post(() -> {
        compressing = false;
        if (jpeg != null && generation == previewGeneration && previewEnabled
            && post(json("preview", "jpeg", jpeg, "frameId", frameId, "capturedEpochMs", capturedEpochMs))) {
          pendingFrame = frameId;
        } else {
          schedulePreview(frameIntervalMs);
        }
      });
    });
  }

  private static String encodePreview(Bitmap bitmap, int frameSide) {
    Bitmap scaled = bitmap;
    try {
      float factor = Math.min(1f, frameSide / (float) Math.max(bitmap.getWidth(), bitmap.getHeight()));
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

  File reserveOriginal(String id) throws IOException {
    return StudioOriginalFile.pending(sourceDirectory, id);
  }

  void updateOriginal(String id, StudioOriginalFile.Source original) {
    if (closed) return;
    if (!original.equals(originals.put(id, original))) publishOriginal(id, original);
  }

  void discardOffer(String id) { originals.remove(id); }

  private void restoreOriginals() {
    File[] files = sourceDirectory.listFiles();
    if (files == null) return;
    Arrays.sort(files, Comparator.comparingLong(File::lastModified).reversed());
    for (File file : files) {
      String id = StudioOriginalFile.finalizedId(file);
      if (id == null) continue;
      long bytes = file.length();
      if (bytes <= 0 || bytes > StudioOriginalFile.MAX_BYTES) continue;
      originals.put(id, new StudioOriginalFile.Source(file, bytes, true));
      if (originals.size() == MAX_RESTORED_ORIGINALS) break;
    }
  }

  private void publishOriginal(String id, StudioOriginalFile.Source original) {
    post(json("source", "recordingId", id, "bytes", original.bytes(), "finalized", original.finalized()));
  }

  private void readChunk(WebMessagePort source, JSONObject request) {
    String requestId = request.optString("requestId");
    if (!ID.matcher(requestId).matches()) return;
    String id = request.optString("recordingId");
    StudioOriginalFile.Source original = originals.get(id);
    Object rawIndex = request.opt("index");
    int index = request.optInt("index", -1);
    long offset = (long) index * StudioOriginalFile.CHUNK_BYTES;
    if (original == null || !(rawIndex instanceof Number number)
        || number.doubleValue() != index || index < 0 || offset >= original.bytes()) {
      postFileError(requestId);
      return;
    }
    int length = (int) Math.min(StudioOriginalFile.CHUNK_BYTES, original.bytes() - offset);
    readOriginal(source, requestId, original, offset, length, bytes ->
        json("chunk", "requestId", requestId, "recordingId", id, "index", index,
            "data", Base64.encodeToString(bytes, Base64.NO_WRAP)));
  }

  private void hashRange(WebMessagePort source, JSONObject request) {
    String requestId = request.optString("requestId");
    if (!ID.matcher(requestId).matches()) return;
    String id = request.optString("recordingId");
    StudioOriginalFile.Source original = originals.get(id);
    long offset = request.optLong("offset", -1);
    int length = request.optInt("bytes", -1);
    if (original == null || !original.finalized()
        || !(request.opt("offset") instanceof Number position) || position.doubleValue() != offset
        || !(request.opt("bytes") instanceof Number size) || size.doubleValue() != length
        || offset < 0 || offset >= original.bytes() || offset % StudioOriginalFile.HASH_BYTES != 0
        || length != Math.min(StudioOriginalFile.HASH_BYTES, original.bytes() - offset)) {
      postFileError(requestId);
      return;
    }
    readOriginal(source, requestId, original, offset, length, bytes ->
        json("range-hash", "requestId", requestId, "recordingId", id, "offset", offset,
            "bytes", length, "sha256", StudioOriginalFile.sha256(bytes)));
  }

  private void readOriginal(WebMessagePort source, String requestId, StudioOriginalFile.Source original,
      long offset, int length, java.util.function.Function<byte[], String> response) {
    if (fileRequests >= MAX_FILE_REQUESTS) { postFileError(requestId); return; }
    fileRequests++;
    fileWorker.execute(() -> {
      String result;
      try {
        result = response.apply(StudioOriginalFile.read(original, offset, length));
      } catch (IOException | SecurityException error) {
        result = null;
      }
      String reply = result;
      main.post(() -> {
        fileRequests--;
        if (closed || port != source) return;
        if (reply == null) postFileError(requestId); else post(reply);
      });
    });
  }

  private void postFileError(String requestId) { post(json("chunk-error", "requestId", requestId)); }

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
