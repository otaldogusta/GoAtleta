package com.goatleta.cameraprobe;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.display.DisplayManager;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.Range;
import android.view.Gravity;
import android.view.Surface;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.ComponentActivity;
import androidx.camera.camera2.interop.Camera2CameraInfo;
import androidx.camera.camera2.interop.Camera2Interop;
import androidx.camera.core.Camera;
import androidx.camera.core.CameraInfo;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.CameraState;
import androidx.camera.core.DynamicRange;
import androidx.camera.core.Preview;
import androidx.camera.core.SessionConfig;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.MediaStoreOutputOptions;
import androidx.camera.video.PendingRecording;
import androidx.camera.video.Quality;
import androidx.camera.video.QualitySelector;
import androidx.camera.video.Recorder;
import androidx.camera.video.Recording;
import androidx.camera.video.VideoCapture;
import androidx.camera.video.VideoRecordEvent;
import androidx.camera.view.PreviewView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.Observer;

import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONObject;
import org.json.JSONException;

import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** CameraX proof with an optional local Studio connection in the debug fixture. */
@SuppressLint("UnsafeOptInUsageError")
public final class CameraProbeActivity extends ComponentActivity {
  private static final int CAMERA_PERMISSION = 61;
  private static final int NAVY = Color.rgb(14, 23, 41);
  private static final int DEEP = Color.rgb(10, 19, 34);
  private static final int PANEL = Color.rgb(22, 32, 51);
  private static final int GREEN = Color.rgb(61, 220, 132);
  private static final int MUTED = Color.rgb(138, 154, 179);
  private static final int WARNING = Color.rgb(242, 160, 61);
  private static final int DANGER = Color.rgb(229, 72, 77);
  private static final Range<Integer> FPS = new Range<>(60, 60);
  private static final String PREFS = "go-atleta-camera-probe";

  private final Handler main = new Handler(Looper.getMainLooper());
  private final ExecutorService inspection = Executors.newSingleThreadExecutor();
  private ProcessCameraProvider provider;
  private Camera camera;
  private Preview preview;
  private PreviewView previewView;
  private VideoCapture<Recorder> videoCapture;
  private Recording recording;
  private TextView status, result, source;
  private Button recordButton, stopButton, shareButton;
  private CheckBox lensCheck;
  private boolean binding, previewStreaming, zoomReady, starting, finalizing, stopRequested, destroyed;
  private boolean lensConfirmed, captureLensConfirmed, retryAvailable;
  private boolean displayListenerRegistered;
  private long generation, startedMonoMs, captureWallMs;
  private volatile long cameraGeneration;
  private Runnable previewDeadline;
  private LiveData<CameraState> cameraStates;
  private Observer<CameraState> cameraObserver;
  private String captureName = "", stopReason = "";
  private Uri lastVideo;
  private volatile boolean collectSensor;
  private volatile FrameStats sensorFrames = new FrameStats();
  private DisplayManager displayManager;
  private NativeStudioBridge studio;
  private boolean cameraWanted = true;
  private String studioRecordingId = "", studioPhase = "";
  private long studioElapsedMs, activeSinceMonoMs, activeSinceEpochMs;
  private int studioSegment;

  private final Runnable autoStop = () -> requestStop("Tempo de teste concluído.");
  private final Runnable hardStop = () -> {
    requestStop("Limite de segurança de 30 s atingido.");
    if (recording != null) recording.close();
  };
  private final Runnable clock = new Runnable() {
    @Override public void run() {
      if (destroyed || recording == null || stopRequested) return;
      if (!starting) status.setText(String.format(Locale.getDefault(), "Gravando · %02d s",
          (studio == null ? Math.max(0, SystemClock.elapsedRealtime() - startedMonoMs) : studioTime()) / 1000));
      if ("paused".equals(studioPhase)) status.setText("Gravação pausada");
      publishStudioRecording();
      main.postDelayed(this, 250);
    }
  };
  private final DisplayManager.DisplayListener displayListener = new DisplayManager.DisplayListener() {
    @Override public void onDisplayAdded(int id) { }
    @Override public void onDisplayRemoved(int id) { }
    @Override public void onDisplayChanged(int id) {
      if (previewView.getDisplay() != null && previewView.getDisplay().getDisplayId() == id) updateRotation();
    }
  };

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    createUi(readStudioPair());
    displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
    SharedPreferences saved = getSharedPreferences(PREFS, MODE_PRIVATE);
    String uri = saved.getString("lastVideo", "");
    if (!uri.isEmpty()) lastVideo = Uri.parse(uri);
    result.setText(saved.getString("lastResult", "O resultado aparece depois da gravação."));
    updateButtons();
    if (hasCameraPermission()) openProvider();
    else ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
  }

  private String readStudioPair() {
    if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return "";
    File pair = new File(getFilesDir(), "studio-pair.url");
    long length = pair.length();
    if (length <= 0 || length > 512) return "";
    try (FileInputStream input = new FileInputStream(pair)) {
      byte[] bytes = new byte[(int) length];
      int offset = 0;
      while (offset < bytes.length) {
        int count = input.read(bytes, offset, bytes.length - offset);
        if (count < 0) return "";
        offset += count;
      }
      return new String(bytes, StandardCharsets.US_ASCII).trim();
    } catch (Exception failure) { return ""; }
  }

  private void createUi(String pair) {
    FrameLayout root = new FrameLayout(this); root.setBackgroundColor(DEEP);
    previewView = new PreviewView(this); previewView.setBackgroundColor(DEEP);
    previewView.setScaleType(PreviewView.ScaleType.FIT_CENTER);
    previewView.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
    root.addView(previewView, new FrameLayout.LayoutParams(-1, -1));
    LinearLayout header = column(); header.setBackgroundColor(0xE60E1729); header.setPadding(dp(16), dp(12), dp(16), dp(12));
    TextView title = text("Teste da câmera", 18, Color.WHITE); title.setTypeface(null, android.graphics.Typeface.BOLD);
    header.addView(title); header.addView(text("Full HD · alvo 60 fps · sem áudio", 12, MUTED));
    if (!pair.isEmpty()) {
      try {
        studio = new NativeStudioBridge(this, pair, previewView, new NativeStudioBridge.Listener() {
          @Override public void onCommand(JSONObject message) { handleStudioCommand(message); }
          @Override public void onStatus(String value) {
            if ("ready".equals(value)) { publishStudioCamera(false); publishStudioRecording(); }
            else if ("error".equals(value)) setStatus("Estúdio indisponível. O vídeo fica salvo no celular.", WARNING);
          }
        });
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        header.addView(studio.view(), new LinearLayout.LayoutParams(-1, dp(52)));
      } catch (IllegalArgumentException ignored) {
        header.addView(text("Pareamento local inválido.", 12, WARNING));
      }
    }
    source = text("Câmera traseira · enquadramento 1×", 12, MUTED); header.addView(source);
    lensCheck = new CheckBox(this); lensCheck.setText("Este é o enquadramento 1× correto"); lensCheck.setTextSize(12); lensCheck.setTextColor(Color.WHITE); lensCheck.setMinHeight(dp(48));
    lensCheck.setButtonTintList(ColorStateList.valueOf(GREEN)); lensCheck.setOnCheckedChangeListener((button, checked) -> { lensConfirmed = checked; updateButtons(); }); header.addView(lensCheck);
    root.addView(header, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
    LinearLayout footer = column(); footer.setBackgroundColor(0xF2162033); footer.setPadding(dp(12), dp(10), dp(12), dp(12));
    status = text("Preparando a câmera…", 14, Color.WHITE); footer.addView(status);
    result = text("", 12, MUTED); result.setTextIsSelectable(true); result.setMaxLines(6);
    LinearLayout.LayoutParams resultLayout = new LinearLayout.LayoutParams(-1, -2); resultLayout.setMargins(0, dp(5), 0, dp(8)); footer.addView(result, resultLayout);
    LinearLayout actions = new LinearLayout(this); actions.setOrientation(LinearLayout.HORIZONTAL); actions.setGravity(Gravity.CENTER_VERTICAL);
    recordButton = button("Gravar 10 s", true); stopButton = button("Parar", false); shareButton = button("Compartilhar último", false);
    actions.addView(recordButton, weighted()); actions.addView(stopButton, weighted()); actions.addView(shareButton, weighted()); footer.addView(actions);
    recordButton.setOnClickListener(v -> { if (!hasCameraPermission()) ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION); else if (retryAvailable && !busy()) { releaseCamera(); retryAvailable = false; setStatus("Preparando a câmera…", Color.WHITE); openProvider(); } else startRecording(); });
    stopButton.setOnClickListener(v -> requestStop("Gravação encerrada pelo usuário."));
    shareButton.setOnClickListener(v -> shareLast());
    root.addView(footer, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
    setContentView(root);
    WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightStatusBars(false);
    WindowCompat.getInsetsController(getWindow(), root).setAppearanceLightNavigationBars(false);
    ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
      Insets safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom); return insets;
    });
    ViewCompat.requestApplyInsets(root);
    previewView.getPreviewStreamState().observe(this, value -> {
      previewStreaming = value == PreviewView.StreamState.STREAMING;
      if (previewStreaming && zoomReady && camera != null && !busy()) setStatus("Pronta. Confirme o enquadramento 1× acima.", Color.WHITE);
      updateButtons();
    });
    if (studio != null) studio.start();
  }

  private LinearLayout column() { LinearLayout view = new LinearLayout(this); view.setOrientation(LinearLayout.VERTICAL); return view; }
  private TextView text(String value, int sp, int color) { TextView view = new TextView(this); view.setText(value); view.setTextSize(sp); view.setTextColor(color); return view; }
  private Button button(String label, boolean primary) {
    Button button = new Button(this); button.setText(label); button.setAllCaps(false); button.setTextSize(12); button.setMinHeight(dp(48));
    button.setPadding(dp(4), 0, dp(4), 0); button.setTextColor(primary ? NAVY : Color.WHITE);
    android.graphics.drawable.GradientDrawable background = new android.graphics.drawable.GradientDrawable(); background.setColor(primary ? GREEN : NAVY); background.setCornerRadius(dp(12)); button.setBackground(background); return button;
  }
  private LinearLayout.LayoutParams weighted() { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, dp(48), 1); p.setMargins(dp(3), 0, dp(3), 0); return p; }
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
  private boolean hasCameraPermission() { return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }
  private boolean foreground() { return !destroyed && getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED); }
  private boolean busy() { return starting || recording != null || finalizing; }
  private void setStatus(String value, int color) { if (!destroyed) { status.setText(value); status.setTextColor(color); } }
  private void updateButtons() {
    if (destroyed || recordButton == null) return;
    recordButton.setText(!hasCameraPermission() ? "Permitir câmera" : retryAvailable ? "Tentar novamente" : studio == null ? "Gravar 10 s" : "Gravar 20 s");
    recordButton.setEnabled(!busy() && foreground() && (!hasCameraPermission() || retryAvailable || camera != null && previewStreaming && zoomReady && lensConfirmed));
    lensCheck.setEnabled(!busy() && foreground() && camera != null && previewStreaming && zoomReady);
    if (!busy() && camera != null && foreground()) {
      if (previewStreaming && zoomReady) cancelPreviewDeadline(); else watchPreview(camera, cameraGeneration);
    }
    stopButton.setEnabled(recording != null && !stopRequested); shareButton.setEnabled(lastVideo != null && !busy());
    for (Button button : new Button[]{recordButton, stopButton, shareButton}) button.setAlpha(button.isEnabled() ? 1f : .55f);
    publishStudioCamera(false);
  }

  private void publishStudioCamera(boolean resetRecording) {
    if (studio == null) return;
    boolean active = foreground() && cameraWanted && camera != null && previewStreaming && zoomReady;
    studio.setPreviewEnabled(active);
    try {
      studio.send(new JSONObject().put("kind", "camera").put("active", active)
          .put("state", finalizing || stopRequested && recording != null ? "finalizing" : active ? "preview" : "off")
          .put("controlsVersion", 2).put("readyToRecord", active && lensConfirmed).put("resetRecording", resetRecording)
          .put("width", 1920).put("height", 1080).put("frameRate", 60).put("zoom", 1));
    } catch (JSONException failure) { throw new IllegalStateException(failure); }
  }

  private long studioTime() {
    return studioElapsedMs + ("recording".equals(studioPhase) ? Math.max(0, SystemClock.elapsedRealtime() - activeSinceMonoMs) : 0);
  }

  private void publishStudioRecording() {
    if (studio == null || studioRecordingId.isEmpty() || studioPhase.isEmpty()) return;
    long sampleEpochMs = System.currentTimeMillis(), elapsedMs = studioTime();
    try {
      JSONObject sample = new JSONObject().put("kind", "recording").put("recordingId", studioRecordingId)
          .put("state", studioPhase).put("startEpochMs", captureWallMs).put("elapsedMs", elapsedMs)
          .put("segmentId", studioRecordingId + "-" + studioSegment).put("sampleEpochMs", sampleEpochMs)
          .put("pausedMs", Math.max(0, sampleEpochMs - captureWallMs - elapsedMs));
      if ("recording".equals(studioPhase)) sample.put("activeSinceEpochMs", activeSinceEpochMs);
      studio.send(sample);
    } catch (JSONException failure) { throw new IllegalStateException(failure); }
  }

  private void handleStudioCommand(JSONObject message) {
    String action = message.optString("action"), id = message.optString("recordingId");
    boolean matches = !studioRecordingId.isEmpty() && studioRecordingId.equals(id);
    if ("snapshot".equals(action)) { publishStudioCamera(false); publishStudioRecording(); return; }
    try {
      switch (action) {
        case "start-recording":
          if (startRecording()) return;
          break;
        case "pause-recording":
          if (matches && recording != null && !starting && !stopRequested && "recording".equals(studioPhase)) { recording.pause(); return; }
          break;
        case "resume-recording":
          if (matches && recording != null && !stopRequested && "paused".equals(studioPhase)) { recording.resume(); return; }
          break;
        case "stop-recording":
          if (matches && recording != null && !stopRequested) { requestStop("Encerrada pelo Estúdio."); return; }
          break;
        case "camera-on":
          if (foreground() && !busy() && hasCameraPermission()) { cameraWanted = true; openProvider(); publishStudioCamera(false); return; }
          break;
        case "camera-off":
          if (!busy()) { cameraWanted = false; releaseCamera(); setStatus("Câmera desligada", MUTED); updateButtons(); return; }
          break;
        case "new-recording":
          if (matches && !busy() && foreground() && hasCameraPermission()) {
            studioRecordingId = ""; studioPhase = ""; cameraWanted = true; openProvider(); publishStudioCamera(true); return;
          }
          break;
        default: return;
      }
    } catch (IllegalStateException ignored) { /* The actual recorder state owns command success. */ }
    try {
      studio.send(new JSONObject().put("kind", "command-result").put("commandId", message.optString("commandId"))
          .put("action", action).put("ok", false).put("reason", foreground() ? "source-unavailable" : "camera-hidden"));
    } catch (JSONException failure) { throw new IllegalStateException(failure); }
  }

  private void openProvider() {
    if (provider != null) { bindCamera(); return; }
    ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(this);
    future.addListener(() -> {
      if (destroyed) return;
      try { provider = future.get(); bindCamera(); }
      catch (Exception error) { cameraFailed("Não foi possível abrir a câmera. Feche outros apps e tente novamente."); }
    }, ContextCompat.getMainExecutor(this));
  }

  private void bindCamera() {
    if (provider == null || !cameraWanted || !foreground() || !hasCameraPermission() || busy() || binding || camera != null) return;
    binding = true; retryAvailable = false; lensConfirmed = false; lensCheck.setChecked(false); long cameraToken = ++cameraGeneration;
    try {
      CameraSelector selector = CameraSelector.DEFAULT_BACK_CAMERA;
      List<CameraInfo> candidates = selector.filter(provider.getAvailableCameraInfos());
      if (candidates.isEmpty()) throw new IllegalStateException("Sem câmera traseira");
      CameraInfo info = candidates.get(0);
      if (!Recorder.getVideoCapabilities(info).getSupportedQualities(DynamicRange.SDR).contains(Quality.FHD))
        throw new IllegalStateException("Full HD indisponível");
      Preview.Builder previewBuilder = new Preview.Builder().setTargetRotation(rotation());
      new Camera2Interop.Extender<>(previewBuilder).setSessionCaptureCallback(new CameraCaptureSession.CaptureCallback() {
        @Override public void onCaptureCompleted(CameraCaptureSession session, CaptureRequest request,
            TotalCaptureResult captureResult) {
          FrameStats sampleOwner = sensorFrames;
          if (!collectSensor || cameraGeneration != cameraToken) return;
          Long timestampNs = captureResult.get(CaptureResult.SENSOR_TIMESTAMP);
          if (timestampNs != null && collectSensor && cameraGeneration == cameraToken && sensorFrames == sampleOwner)
            sampleOwner.addMicroseconds(timestampNs / 1000L);
        }
      });
      preview = previewBuilder.build(); preview.setSurfaceProvider(previewView.getSurfaceProvider());
      Recorder recorder = new Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.FHD)).setTargetVideoEncodingBitRate(16_000_000).build();
      videoCapture = new VideoCapture.Builder<>(recorder).setTargetRotation(rotation()).build();
      SessionConfig combination = new SessionConfig.Builder(Arrays.asList(preview, videoCapture)).build();
      if (!info.getSupportedFrameRateRanges(combination).contains(FPS)) throw new IllegalStateException("60 fps fixos indisponíveis nesta combinação");
      SessionConfig fixed = new SessionConfig.Builder(Arrays.asList(preview, videoCapture)).setFrameRateRange(FPS).build();
      Camera boundCamera = provider.bindToLifecycle(this, selector, fixed); camera = boundCamera;
      setStatus("Preparando a prévia…", Color.WHITE); watchPreview(boundCamera, cameraToken);
      cameraStates = boundCamera.getCameraInfo().getCameraState();
      cameraObserver = state -> {
        if (destroyed || camera != boundCamera || cameraGeneration != cameraToken || state == null || state.getError() == null) return;
        int code = state.getError().getCode();
        String message = code == CameraState.ERROR_CAMERA_IN_USE || code == CameraState.ERROR_MAX_CAMERAS_IN_USE
            ? "A câmera está em uso. Feche outros apps e tente novamente." : "A câmera ficou indisponível. Tente novamente.";
        if (busy()) { requestStop(message); setStatus(message, WARNING); }
        else cameraFailed(message);
      };
      cameraStates.observe(this, cameraObserver);
      if (camera != boundCamera || cameraGeneration != cameraToken) return;
      ListenableFuture<Void> zoom = boundCamera.getCameraControl().setZoomRatio(1f);
      zoom.addListener(() -> {
        if (destroyed || camera != boundCamera || cameraGeneration != cameraToken) return;
        try { zoom.get(); zoomReady = true; source.setText("Traseira lógica · 1× configurado · confirme o enquadramento"); if (previewStreaming && !busy()) setStatus("Pronta. Confirme o enquadramento 1× acima.", Color.WHITE); }
        catch (Exception failure) { cameraFailed("Não foi possível ajustar esta câmera para 1×. Tente novamente."); }
        updateButtons();
      }, ContextCompat.getMainExecutor(this));
    } catch (Exception error) {
      cameraFailed("Esta câmera não abriu Full HD a 60 fps. Tente novamente.");
      result.setText("Nenhuma gravação iniciada. Detalhe: " + shortMessage(error));
    } finally { binding = false; updateButtons(); }
  }

  private int rotation() { return previewView != null && previewView.getDisplay() != null ? previewView.getDisplay().getRotation() : Surface.ROTATION_0; }
  private void updateRotation() { if (preview != null) preview.setTargetRotation(rotation()); if (videoCapture != null) videoCapture.setTargetRotation(rotation()); }
  private void cancelPreviewDeadline() { if (previewDeadline != null) main.removeCallbacks(previewDeadline); previewDeadline = null; }
  private void watchPreview(Camera owner, long token) {
    if (previewDeadline != null) return;
    previewDeadline = () -> {
      previewDeadline = null;
      if (!destroyed && camera == owner && cameraGeneration == token && !busy() && (!previewStreaming || !zoomReady))
        cameraFailed("A câmera não mostrou imagem. Feche outros apps e tente novamente.");
    };
    main.postDelayed(previewDeadline, 10_000L);
  }
  private void cameraFailed(String message) {
    releaseCamera(); retryAvailable = true; setStatus(message, WARNING); updateButtons();
  }
  private void releaseCamera() {
    cancelPreviewDeadline(); ++cameraGeneration;
    if (cameraStates != null && cameraObserver != null) cameraStates.removeObserver(cameraObserver);
    cameraStates = null; cameraObserver = null;
    Preview ownedPreview = preview; VideoCapture<Recorder> ownedVideo = videoCapture;
    camera = null; preview = null; videoCapture = null; previewStreaming = false; zoomReady = false; lensConfirmed = false;
    if (lensCheck != null) lensCheck.setChecked(false);
    if (provider != null) {
      if (ownedPreview != null) provider.unbind(ownedPreview);
      if (ownedVideo != null) provider.unbind(ownedVideo);
    }
  }

  @SuppressLint("MissingPermission")
  private boolean startRecording() {
    if (!foreground() || busy() || camera == null || videoCapture == null || !previewStreaming || !zoomReady || !lensConfirmed || !hasCameraPermission()) return false;
    starting = true; stopRequested = false; collectSensor = false; stopReason = "";
    sensorFrames = new FrameStats(); captureWallMs = System.currentTimeMillis(); long token = ++generation;
    captureLensConfirmed = lensConfirmed;
    if (studio != null) { studioRecordingId = UUID.randomUUID().toString(); studioPhase = ""; studioElapsedMs = 0; studioSegment = 1; }
    captureName = "go-atleta-teste-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date(captureWallMs)) + "-" + UUID.randomUUID().toString().substring(0, 8);
    ContentValues values = new ContentValues(); values.put(MediaStore.Video.Media.DISPLAY_NAME, captureName + ".mp4"); values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4"); values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/GoAtletaTeste");
    MediaStoreOutputOptions output = new MediaStoreOutputOptions.Builder(getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
        .setContentValues(values).setDurationLimitMillis(30_000L).build();
    updateRotation(); setStatus("Iniciando gravação…", Color.WHITE); result.setText("Alvo: Full HD a 60 fps. A taxa real ainda será medida."); updateButtons();
    main.postDelayed(hardStop, 30_000L);
    try {
      PendingRecording pending = videoCapture.getOutput().prepareRecording(this, output);
      // Intentionally do not call withAudioEnabled: the harness has no microphone permission.
      recording = pending.start(ContextCompat.getMainExecutor(this), event -> handleRecording(token, event));
    } catch (Exception error) {
      starting = false; recording = null; stopRequested = false; main.removeCallbacks(hardStop);
      setStatus("Não foi possível iniciar a gravação. Tente novamente.", DANGER); result.setText(shortMessage(error));
      updateButtons(); return false;
    }
    updateButtons(); return true;
  }

  private void handleRecording(long token, VideoRecordEvent event) {
    if (token != generation) return;
    if (event instanceof VideoRecordEvent.Start) {
      starting = false; startedMonoMs = SystemClock.elapsedRealtime(); sensorFrames = new FrameStats(); collectSensor = !stopRequested;
      if (studio != null) { captureWallMs = System.currentTimeMillis(); activeSinceEpochMs = captureWallMs; activeSinceMonoMs = startedMonoMs; studioPhase = "recording"; }
      if (!stopRequested && foreground()) { main.postDelayed(autoStop, studio == null ? 10_000L : 20_000L); main.post(clock); }
      else requestStop("Gravação encerrada ao sair da câmera.");
      updateButtons();
    } else if (event instanceof VideoRecordEvent.Pause && !stopRequested) {
      studioElapsedMs = studioTime(); studioPhase = "paused"; collectSensor = false; publishStudioRecording();
    } else if (event instanceof VideoRecordEvent.Resume && !stopRequested) {
      studioSegment++; activeSinceMonoMs = SystemClock.elapsedRealtime(); activeSinceEpochMs = System.currentTimeMillis();
      studioPhase = "recording"; collectSensor = true; publishStudioRecording();
    } else if (event instanceof VideoRecordEvent.Finalize) {
      collectSensor = false; starting = false; main.removeCallbacks(autoStop); main.removeCallbacks(hardStop); main.removeCallbacks(clock);
      Recording finished = recording; recording = null; if (finished != null) finished.close();
      VideoRecordEvent.Finalize end = (VideoRecordEvent.Finalize) event;
      Uri uri = end.getOutputResults().getOutputUri();
      studioElapsedMs = end.getRecordingStats().getRecordedDurationNanos() / 1_000_000L;
      if (uri == null || Uri.EMPTY.equals(uri)) { studioPhase = "error"; publishStudioRecording(); finalizing = false; setStatus("Não foi gerado um arquivo de vídeo. O modo não foi confirmado.", DANGER); updateButtons(); shutdownIfFinished(); return; }
      lastVideo = uri; finalizing = true; FrameStats.Result sensor = sensorFrames.snapshot();
      final String name = captureName, reason = stopReason; final long capturedAt = captureWallMs; final int error = end.getError(); final boolean confirmed = captureLensConfirmed;
      setStatus("Conferindo o arquivo original…", Color.WHITE); updateButtons();
      inspection.execute(() -> inspectVideo(uri, name, capturedAt, reason, error, sensor, confirmed));
    }
  }

  private void requestStop(String reason) {
    if (recording == null || stopRequested) return;
    stopRequested = true; stopReason = reason; collectSensor = false; main.removeCallbacks(autoStop); main.removeCallbacks(clock);
    setStatus("Finalizando o vídeo…", Color.WHITE); updateButtons(); recording.stop();
  }

  private void inspectVideo(Uri uri, String name, long capturedAt, String reason, int error, FrameStats.Result sensor, boolean confirmed) {
    String summary; boolean verified = false; MediaExtractor extractor = new MediaExtractor();
    try {
      extractor.setDataSource(getApplicationContext(), uri, null); MediaFormat format = null;
      for (int index = 0; index < extractor.getTrackCount(); index++) {
        MediaFormat candidate = extractor.getTrackFormat(index); String mime = candidate.getString(MediaFormat.KEY_MIME);
        if (mime != null && mime.startsWith("video/")) { format = candidate; extractor.selectTrack(index); break; }
      }
      if (format == null) throw new IllegalStateException("Arquivo sem faixa de vídeo");
      int codedWidth = format.getInteger(MediaFormat.KEY_WIDTH), codedHeight = format.getInteger(MediaFormat.KEY_HEIGHT);
      int width = codedWidth, height = codedHeight;
      // Honor an explicit valid display crop; never guess that 1088 means 1080.
      if (format.containsKey(MediaFormat.KEY_CROP_LEFT) && format.containsKey(MediaFormat.KEY_CROP_RIGHT)
          && format.containsKey(MediaFormat.KEY_CROP_TOP) && format.containsKey(MediaFormat.KEY_CROP_BOTTOM)) {
        int left = format.getInteger(MediaFormat.KEY_CROP_LEFT), right = format.getInteger(MediaFormat.KEY_CROP_RIGHT);
        int top = format.getInteger(MediaFormat.KEY_CROP_TOP), bottom = format.getInteger(MediaFormat.KEY_CROP_BOTTOM);
        if (left < 0 || top < 0 || right < left || bottom < top || right >= codedWidth || bottom >= codedHeight)
          throw new IllegalStateException("Área visível do vídeo inválida");
        width = right - left + 1; height = bottom - top + 1;
      }
      Number nominal = format.containsKey(MediaFormat.KEY_FRAME_RATE) ? format.getNumber(MediaFormat.KEY_FRAME_RATE) : null;
      FrameStats file = new FrameStats(); int samples = 0;
      while (extractor.getSampleTime() >= 0) {
        if (extractor.getSampleSize() > 0) { file.addMicroseconds(extractor.getSampleTime()); if (++samples > FrameStats.MAX_SAMPLES) break; }
        if (!extractor.advance()) break;
      }
      FrameStats.Result measured = file.snapshot();
      boolean cleanFinalize = error == VideoRecordEvent.Finalize.ERROR_NONE || error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED;
      verified = cleanFinalize && confirmed && FrameStats.proves1080p60(width, height, measured, sensor);
      summary = String.format(Locale.getDefault(), "%d × %d · arquivo %.2f fps\nSensor: %.2f fps · %d quadros únicos · %.2f s\nMetadado do arquivo: %s\n%s", width, height, measured.framesPerSecond,
          sensor.framesPerSecond, measured.uniqueSamples, measured.durationUs / 1_000_000d,
          nominal == null ? "não informado" : String.format(Locale.getDefault(), "%.2f fps", nominal.doubleValue()),
          verified ? "60 fps confirmados neste teste." : "60 fps não confirmados. Original preservado.");
      JSONObject report = new JSONObject(); report.put("version", 1); report.put("file", name + ".mp4"); report.put("capturedAtEpochMs", capturedAt); report.put("requestedWidth", 1920); report.put("requestedHeight", 1080); report.put("requestedFpsMin", 60); report.put("requestedFpsMax", 60); report.put("requestedZoomRatio", 1); report.put("audio", false); report.put("width", width); report.put("height", height); report.put("finalizeError", error); report.put("stopReason", reason); report.put("verified1080p60", verified);
      report.put("camera", "default-back-logical"); report.put("lensConfirmationRequired", true); report.put("lensConfirmed", confirmed); report.put("codedWidth", codedWidth); report.put("codedHeight", codedHeight); report.put("nominalFileFps", nominal == null ? JSONObject.NULL : nominal); report.put("filePts", statsJson(measured)); report.put("sensorTimestamps", statsJson(sensor));
      saveReport(name, report.toString(2));
    } catch (Exception failure) {
      summary = "Não foi possível conferir o vídeo. Original preservado.\n" + shortMessage(failure);
    } finally { extractor.release(); }
    SharedPreferences saved = getSharedPreferences(PREFS, MODE_PRIVATE);
    if (capturedAt >= saved.getLong("lastCapturedAt", 0)) saved.edit().putString("lastVideo", uri.toString()).putString("lastResult", summary).putLong("lastCapturedAt", capturedAt).apply();
    long originalBytes = 0;
    if (error == VideoRecordEvent.Finalize.ERROR_NONE || error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED) {
      try (var file = getContentResolver().openFileDescriptor(uri, "r")) { if (file != null) originalBytes = file.getStatSize(); }
      catch (Exception ignored) { /* The video remains available on the phone. */ }
    }
    final String output = summary; final boolean success = verified; final long bytes = originalBytes;
    main.post(() -> {
      finalizing = false;
      if (!destroyed) {
        if (studio != null) {
          studioPhase = bytes > 0 ? "stopped" : "error";
          publishStudioRecording();
          if (bytes > 0) studio.offerOriginal(studioRecordingId, uri, bytes);
        }
        result.setText(output); result.setTextColor(success ? GREEN : MUTED); setStatus(success ? "Teste concluído." : "Teste concluído sem confirmar 60 fps.", success ? GREEN : WARNING);
        updateButtons(); if (foreground() && camera == null) bindCamera();
      }
      shutdownIfFinished();
    });
  }

  private JSONObject statsJson(FrameStats.Result value) throws Exception {
    JSONObject json = new JSONObject(); json.put("samples", value.samples); json.put("uniqueSamples", value.uniqueSamples); json.put("duplicateSamples", value.duplicateSamples); json.put("outOfOrderSamples", value.outOfOrderSamples); json.put("invalidSamples", value.invalidSamples); json.put("ignoredSamples", value.ignoredSamples); json.put("firstTimestampUs", value.firstTimestampUs); json.put("lastTimestampUs", value.lastTimestampUs); json.put("spanUs", value.durationUs); json.put("measuredFps", value.framesPerSecond); json.put("medianIntervalUs", value.medianIntervalUs); json.put("p95IntervalUs", value.p95IntervalUs); json.put("maxIntervalUs", value.maxIntervalUs); return json;
  }

  private void saveReport(String name, String json) {
    Uri uri = null;
    try {
      ContentValues values = new ContentValues(); values.put(MediaStore.Downloads.DISPLAY_NAME, name + ".json"); values.put(MediaStore.Downloads.MIME_TYPE, "application/json"); values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/GoAtletaTeste"); values.put(MediaStore.Downloads.IS_PENDING, 1);
      uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
      if (uri == null) return;
      try (OutputStream stream = getContentResolver().openOutputStream(uri)) { if (stream != null) stream.write(json.getBytes(StandardCharsets.UTF_8)); }
    } catch (Exception ignored) { /* The video and in-app result remain available without a report file. */ }
    finally { if (uri != null) try { ContentValues visible = new ContentValues(); visible.put(MediaStore.Downloads.IS_PENDING, 0); getContentResolver().update(uri, visible, null, null); } catch (Exception ignored) { } }
  }

  private void shareLast() {
    if (lastVideo == null || busy()) return;
    try {
      Intent send = new Intent(Intent.ACTION_SEND).setType("video/mp4").putExtra(Intent.EXTRA_STREAM, lastVideo).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
      send.setClipData(android.content.ClipData.newRawUri("Vídeo original", lastVideo)); startActivity(Intent.createChooser(send, "Compartilhar vídeo original"));
    } catch (Exception error) { setStatus("Não foi possível compartilhar o vídeo. Ele continua salvo em Movies/GoAtletaTeste.", WARNING); }
  }

  private String shortMessage(Throwable error) { String message = error.getMessage(); if (message == null || message.isEmpty()) return error.getClass().getSimpleName(); return message.length() <= 150 ? message : message.substring(0, 150); }

  @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
    super.onRequestPermissionsResult(request, permissions, results);
    if (request != CAMERA_PERMISSION) return;
    if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) openProvider();
    else setStatus("Permita o acesso à câmera para fazer o teste.", WARNING);
    updateButtons();
  }
  @Override protected void onResume() {
    super.onResume();
    if (displayManager != null && !displayListenerRegistered) { displayManager.registerDisplayListener(displayListener, main); displayListenerRegistered = true; }
    // ComponentActivity reaches RESUMED after onResume returns on API 29+.
    main.post(() -> { if (!foreground()) return; if (provider != null) bindCamera(); updateRotation(); updateButtons(); });
  }
  @Override protected void onPause() {
    requestStop("Gravação encerrada ao sair da câmera.");
    if (displayManager != null && displayListenerRegistered) { displayManager.unregisterDisplayListener(displayListener); displayListenerRegistered = false; }
    super.onPause();
  }
  @Override protected void onStop() { requestStop("Gravação encerrada ao sair da câmera."); if (studio != null) studio.setPreviewEnabled(false); releaseCamera(); updateButtons(); super.onStop(); }
  @Override public void onConfigurationChanged(Configuration configuration) { super.onConfigurationChanged(configuration); main.post(this::updateRotation); }
  private void shutdownIfFinished() { if (destroyed && recording == null && !finalizing) inspection.shutdown(); }
  @Override protected void onDestroy() {
    destroyed = true; collectSensor = false; main.removeCallbacks(autoStop); main.removeCallbacks(hardStop); main.removeCallbacks(clock);
    if (recording != null) { recording.stop(); recording.close(); }
    if (studio != null) studio.close();
    releaseCamera(); shutdownIfFinished(); super.onDestroy();
  }
}
