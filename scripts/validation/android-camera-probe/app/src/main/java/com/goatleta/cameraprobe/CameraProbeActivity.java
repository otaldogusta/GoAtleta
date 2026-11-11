package com.goatleta.cameraprobe;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.AlertDialog;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.ColorStateList;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Rect;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCaptureSession;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.hardware.camera2.CaptureRequest;
import android.hardware.camera2.CaptureResult;
import android.hardware.camera2.TotalCaptureResult;
import android.hardware.display.DisplayManager;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.provider.MediaStore;
import android.util.AtomicFile;
import android.util.Range;
import android.util.SizeF;
import android.view.Gravity;
import android.view.Surface;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

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
import androidx.camera.core.resolutionselector.AspectRatioStrategy;
import androidx.camera.core.resolutionselector.ResolutionSelector;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.video.FileOutputOptions;
import androidx.camera.video.MediaStoreOutputOptions;
import androidx.camera.video.OutputOptions;
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
import androidx.core.content.FileProvider;
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
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
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
  private static final double SAMSUNG_FRAMING_ZOOM = 1.26;
  private static final String PREFS = "go-atleta-camera-probe";
  private static final long PROBE_LIMIT_MS = 30_000L;
  private static final long STUDIO_LIMIT_MS = 2 * 60 * 60 * 1000L;
  private static final long STORAGE_RESERVE_BYTES = 512L * 1024 * 1024;
  private static final long LOW_STORAGE_STOP_BYTES = STORAGE_RESERVE_BYTES / 2;
  private static final long MIN_STUDIO_BYTES = 64L * 1024 * 1024;
  private static final long ESTIMATED_BYTES_PER_SECOND = 2_500_000L; // Observed on the S25, not a recorder guarantee.

  private final Handler main = new Handler(Looper.getMainLooper());
  private final ExecutorService inspection = Executors.newSingleThreadExecutor();
  private ProcessCameraProvider provider;
  private Camera camera;
  private Preview preview;
  private PreviewView previewView;
  private VideoCapture<Recorder> videoCapture;
  private SessionConfig boundSession;
  private Recording recording;
  private TextView status, result, lastResult, source, thermalWarning;
  private Runnable layoutControls;
  private Button recordButton, stopButton, shareButton;
  private CheckBox lensCheck;
  private boolean binding, previewStreaming, starting, finalizing, stopRequested, destroyed;
  private boolean lensConfirmed, lensStreamVerified, captureLensConfirmed, lensMismatch, retryAvailable;
  private volatile boolean zoomReady;
  private RearLensSelection.Lens selectedLens, captureLens;
  private double selectedZoomRatio = 1, captureZoomRatio = 1;
  private boolean displayListenerRegistered, thermalListenerRegistered;
  private long generation, startedMonoMs, captureWallMs;
  private volatile long cameraGeneration;
  private Runnable previewDeadline;
  private LiveData<CameraState> cameraStates;
  private Observer<CameraState> cameraObserver;
  private String captureName = "", stopReason = "";
  private Uri lastVideo;
  private File studioOutput;
  private PowerManager powerManager;
  private long lastSourceRefreshMs;
  private int thermalStatus = -1, maxThermalStatus;
  private volatile boolean collectSensor;
  private volatile FrameStats sensorFrames = new FrameStats();
  private volatile FramingEvidence framingEvidence;
  private DisplayManager displayManager;
  private NativeStudioBridge studio;
  private String activeStudioPair;
  private AlertDialog pairingDialog;
  private boolean cameraWanted = true;
  private String studioRecordingId = "", studioPhase = "";
  private long studioElapsedMs, activeSinceMonoMs, activeSinceEpochMs;
  private int studioSegment;

  private record FramingEvidence(FrameStats frames, Rect crop, Float logicalZoomRatio, boolean fromPhysicalMetadata) {}

  private final Runnable autoStop = () -> requestStop("Tempo de teste concluído.");
  private final Runnable hardStop = () -> {
    requestStop(studioOutput == null ? "Limite de segurança de 30 s atingido." : "Limite de duas horas atingido.");
    if (recording != null) recording.close();
  };
  private final Runnable clock = new Runnable() {
    @Override public void run() {
      if (destroyed || recording == null || stopRequested) return;
      long now = SystemClock.elapsedRealtime();
      long seconds = (studioOutput == null ? Math.max(0, now - startedMonoMs) : studioTime()) / 1000;
      if (!starting) status.setText("Gravando · " + captureTime(seconds));
      if ("paused".equals(studioPhase)) status.setText("Gravação pausada");
      publishStudioRecording();
      if (studioOutput != null && now - lastSourceRefreshMs >= 1000) {
        lastSourceRefreshMs = now;
        studio.updateOriginal(studioRecordingId, StudioOriginalFile.growing(studioOutput));
        refreshThermalStatus();
        if (stopRequested) return;
        if (getFilesDir().getUsableSpace() < LOW_STORAGE_STOP_BYTES) {
          requestStop("Vídeo encerrado por falta de espaço no celular.");
          return;
        }
      }
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
  private final PowerManager.OnThermalStatusChangedListener thermalListener = this::updateThermalStatus;

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    powerManager = getSystemService(PowerManager.class);
    activeStudioPair = readStudioPair();
    createUi(activeStudioPair);
    displayManager = (DisplayManager) getSystemService(Context.DISPLAY_SERVICE);
    SharedPreferences saved = getSharedPreferences(PREFS, MODE_PRIVATE);
    String uri = saved.getString("lastVideo", "");
    if (!uri.isEmpty()) lastVideo = Uri.parse(uri);
    lastResult.setText(saved.getString("lastResult", "Sem gravação finalizada."));
    updateButtons();
    Intent launch = getIntent();
    boolean confirmingPair = false;
    if (launch != null && Intent.ACTION_VIEW.equals(launch.getAction())) {
      setIntent(new Intent());
      confirmingPair = offerStudioPair(launch);
    }
    if (hasCameraPermission()) openProvider();
    else if (!confirmingPair) ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION);
  }

  @Override protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    offerStudioPair(intent);
  }

  private boolean debugBuild() {
    return (getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
  }

  private AtomicFile studioPairFile() {
    return new AtomicFile(new File(getFilesDir(), "studio-pair.url"));
  }

  private String readStudioPair() {
    if (!debugBuild()) return "";
    try (FileInputStream input = studioPairFile().openRead()) {
      long length = input.getChannel().size();
      if (length <= 0 || length > StudioPairingLink.MAX_BYTES) return "";
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

  private boolean offerStudioPair(Intent intent) {
    if (!debugBuild() || intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())
        || !StudioPairingLink.BROWSER_URI.equals(intent.getDataString()) || pairingDialog != null) {
      return false;
    }
    final String candidate;
    try {
      candidate = StudioPairingLink.forBrowser(getString(R.string.native_studio_pair_host),
          intent.getStringExtra(StudioPairingLink.BROWSER_EXTRA));
    } catch (RuntimeException ignored) {
      pairingMessage("Este link não corresponde ao notebook deste piloto.");
      return false;
    }
    if (candidate.equals(activeStudioPair)) return false;
    if (busy()) {
      pairingMessage("Encerre a gravação antes de trocar de sala.");
      return false;
    }
    pairingDialog = new AlertDialog.Builder(this)
        .setTitle("Conectar ao Estúdio")
        .setMessage(studio == null ? "Vincular esta câmera ao notebook configurado?"
            : "A nova sala vai substituir a conexão atual.")
        .setNegativeButton("Cancelar", null)
        .setPositiveButton("Conectar", (dialog, button) -> saveStudioPair(candidate))
        .create();
    pairingDialog.setOnDismissListener(dialog -> pairingDialog = null);
    pairingDialog.show();
    return true;
  }

  private void saveStudioPair(String candidate) {
    if (busy()) {
      pairingMessage("Encerre a gravação antes de trocar de sala.");
      return;
    }
    AtomicFile file = studioPairFile();
    FileOutputStream output = null;
    try {
      output = file.startWrite();
      output.write(candidate.getBytes(StandardCharsets.US_ASCII));
      file.finishWrite(output);
    } catch (IOException ignored) {
      file.failWrite(output);
    }
    if (candidate.equals(readStudioPair())) recreate();
    else pairingMessage("Não foi possível salvar a conexão do Estúdio.");
  }

  private void pairingMessage(String text) {
    Toast.makeText(this, text, Toast.LENGTH_SHORT).show();
  }

  private void createUi(String pair) {
    LinearLayout root = column();
    root.setBackgroundColor(DEEP);
    previewView = new PreviewView(this); previewView.setBackgroundColor(DEEP);
    previewView.setScaleType(PreviewView.ScaleType.FIT_CENTER);
    previewView.setImplementationMode(PreviewView.ImplementationMode.PERFORMANCE);
    FrameLayout stage = new FrameLayout(this) {
      @Override protected void onMeasure(int widthSpec, int heightSpec) {
        int width = MeasureSpec.getSize(widthSpec), height = MeasureSpec.getSize(heightSpec);
        setMeasuredDimension(width, height);
        int horizontal = landscape() ? 16 : 9;
        int vertical = landscape() ? 9 : 16;
        int units = Math.min(width / horizontal, height / vertical);
        previewView.measure(MeasureSpec.makeMeasureSpec(units * horizontal, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(units * vertical, MeasureSpec.EXACTLY));
      }
    };
    stage.addView(previewView, new FrameLayout.LayoutParams(-1, -1, Gravity.CENTER));
    root.addView(stage);

    ScrollView controls = new ScrollView(this) {
      @Override protected void onMeasure(int widthSpec, int heightSpec) {
        if (!landscape()) {
          int available = MeasureSpec.getMode(heightSpec) == MeasureSpec.UNSPECIFIED
              ? dp(getResources().getConfiguration().screenHeightDp) : MeasureSpec.getSize(heightSpec);
          heightSpec = MeasureSpec.makeMeasureSpec(Math.min(dp(248), available * 2 / 5), MeasureSpec.AT_MOST);
        }
        super.onMeasure(widthSpec, heightSpec);
      }
    };
    controls.setBackgroundColor(PANEL);
    LinearLayout panel = column();
    panel.setPadding(dp(10), dp(8), dp(10), dp(8));
    controls.addView(panel, new ScrollView.LayoutParams(-1, -2));
    root.addView(controls);

    status = text("Preparando a câmera…", 14, Color.WHITE);
    status.setTypeface(null, android.graphics.Typeface.BOLD);
    panel.addView(status);
    source = text("Selecionando a lente traseira principal…", 12, MUTED);
    panel.addView(source);
    if (!pair.isEmpty()) {
      try {
        studio = new NativeStudioBridge(this, pair, previewView, new NativeStudioBridge.Listener() {
          @Override public void onCommand(JSONObject message) { handleStudioCommand(message); }
          @Override public void onStatus(String value) {
            if ("ready".equals(value)) { publishStudioCamera(false); publishStudioRecording(); }
            else if ("error".equals(value) && !busy()) setStatus("Estúdio indisponível. A câmera continua disponível neste celular.", WARNING);
          }
        });
        previewView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
      } catch (IllegalArgumentException ignored) {
        panel.addView(text("Pareamento local inválido.", 12, WARNING));
      }
    }
    if (studio != null) {
      thermalWarning = text("", 12, WARNING);
      thermalWarning.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
      thermalWarning.setVisibility(View.GONE);
      panel.addView(thermalWarning);
    }
    lensCheck = new CheckBox(this); lensCheck.setText("Este é o enquadramento 1× correto"); lensCheck.setTextSize(12); lensCheck.setTextColor(Color.WHITE); lensCheck.setMinHeight(dp(48));
    lensCheck.setButtonTintList(ColorStateList.valueOf(GREEN));
    lensCheck.setOnCheckedChangeListener((button, checked) -> { lensConfirmed = checked; showReadyStatus(); updateButtons(); });
    panel.addView(lensCheck);

    LinearLayout actions = new LinearLayout(this);
    LinearLayout captureActions = new LinearLayout(this);
    LinearLayout utilityActions = new LinearLayout(this);
    recordButton = button("Gravar 10 s", true);
    stopButton = button("Parar", false);
    shareButton = button("Compartilhar", false);
    shareButton.setContentDescription("Compartilhar última gravação");
    Button detailsButton = button("Detalhes", false);
    detailsButton.setContentDescription("Detalhes do teste");
    captureActions.addView(recordButton, weighted());
    captureActions.addView(stopButton, weighted());
    utilityActions.addView(shareButton, weighted());
    utilityActions.addView(detailsButton, weighted());
    actions.addView(captureActions);
    actions.addView(utilityActions);
    panel.addView(actions);
    if (studio != null) panel.addView(studio.view());

    LinearLayout diagnostics = column();
    diagnostics.setVisibility(View.GONE);
    diagnostics.setPadding(dp(3), dp(8), dp(3), 0);
    diagnostics.addView(text("Full HD · alvo 60 fps · sem áudio", 12, MUTED));
    result = text("", 12, MUTED); result.setTextIsSelectable(true);
    diagnostics.addView(result);
    diagnostics.addView(text("Última gravação", 12, Color.WHITE));
    lastResult = text("", 12, MUTED); lastResult.setTextIsSelectable(true);
    diagnostics.addView(lastResult);
    panel.addView(diagnostics);
    detailsButton.setOnClickListener(v -> {
      boolean expanded = diagnostics.getVisibility() != View.VISIBLE;
      diagnostics.setVisibility(expanded ? View.VISIBLE : View.GONE);
      detailsButton.setText(expanded ? "Ocultar" : "Detalhes");
      detailsButton.setContentDescription(expanded ? "Ocultar detalhes do teste" : "Detalhes do teste");
      if (expanded) controls.post(() -> controls.smoothScrollTo(0, diagnostics.getTop()));
    });
    recordButton.setOnClickListener(v -> { if (!hasCameraPermission()) ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION); else if (retryAvailable && !busy()) { releaseCamera(); retryAvailable = false; setStatus("Preparando a câmera…", Color.WHITE); openProvider(); } else startRecording(); });
    stopButton.setOnClickListener(v -> requestStop("Gravação encerrada pelo usuário."));
    shareButton.setOnClickListener(v -> shareLast());
    layoutControls = () -> {
      boolean wide = landscape();
      root.setOrientation(wide ? LinearLayout.HORIZONTAL : LinearLayout.VERTICAL);
      stage.setLayoutParams(wide ? new LinearLayout.LayoutParams(0, -1, 1) : new LinearLayout.LayoutParams(-1, 0, 1));
      controls.setLayoutParams(wide ? new LinearLayout.LayoutParams(dp(208), -1) : new LinearLayout.LayoutParams(-1, -2));
      actions.setOrientation(wide ? LinearLayout.VERTICAL : LinearLayout.HORIZONTAL);
      captureActions.setLayoutParams(wide ? new LinearLayout.LayoutParams(-1, -2) : new LinearLayout.LayoutParams(0, -2, 1));
      LinearLayout.LayoutParams utilities = wide ? new LinearLayout.LayoutParams(-1, -2) : new LinearLayout.LayoutParams(0, -2, 1);
      if (wide) utilities.topMargin = dp(4);
      utilityActions.setLayoutParams(utilities);
      if (studio != null) {
        LinearLayout.LayoutParams connection = new LinearLayout.LayoutParams(-1, dp(wide ? 90 : 72));
        connection.topMargin = dp(6);
        studio.view().setLayoutParams(connection);
      }
    };
    layoutControls.run();
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
      showReadyStatus();
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
  private LinearLayout.LayoutParams weighted() { LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(0, -2, 1); p.setMargins(dp(3), 0, dp(3), 0); return p; }
  private boolean landscape() { return getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE; }
  private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
  private boolean hasCameraPermission() { return ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED; }
  private boolean foreground() { return !destroyed && getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED); }
  private boolean busy() { return starting || recording != null || finalizing; }
  private boolean cameraReady() { return camera != null && previewStreaming && zoomReady && lensStreamVerified; }
  private boolean thermallyBlocked() { return thermalStatus >= PowerManager.THERMAL_STATUS_SEVERE; }

  private void refreshThermalStatus() {
    if (powerManager != null) updateThermalStatus(powerManager.getCurrentThermalStatus());
  }

  private void updateThermalStatus(int value) {
    if (destroyed || studio == null) return;
    if (studioOutput != null) maxThermalStatus = Math.max(maxThermalStatus, value);
    if (thermalStatus == value) return;
    thermalStatus = value;
    if (value >= PowerManager.THERMAL_STATUS_CRITICAL && recording != null && !stopRequested) {
      requestStop("Vídeo encerrado por aquecimento do celular.");
    } else {
      updateButtons();
    }
  }

  private void updateThermalWarning() {
    if (thermalWarning == null) return;
    if (!thermallyBlocked()) {
      thermalWarning.setVisibility(View.GONE);
      return;
    }
    String message = recording != null && !stopRequested
        ? "Celular aquecido. Prévia do notebook reduzida."
        : "Celular aquecido. Aguarde esfriar para gravar.";
    if (!message.contentEquals(thermalWarning.getText())) thermalWarning.setText(message);
    thermalWarning.setVisibility(View.VISIBLE);
  }

  private void setStatus(String value, int color) { if (!destroyed) { status.setText(value); status.setTextColor(color); } }
  private void showReadyStatus() {
    if (cameraReady() && !busy()) setStatus(lensConfirmed ? "Pronta para gravar." : "Confira o enquadramento 1×.", Color.WHITE);
  }
  private static String captureTime(long seconds) { return String.format(Locale.getDefault(), "%02d:%02d", seconds / 60, seconds % 60); }
  private void updateButtons() {
    if (destroyed || recordButton == null) return;
    recordButton.setText(!hasCameraPermission() ? "Permitir câmera" : retryAvailable ? "Tentar novamente" : studio == null ? "Gravar 10 s" : "Gravar");
    recordButton.setEnabled(!busy() && foreground() && !thermallyBlocked()
        && (!hasCameraPermission() || retryAvailable || cameraReady() && lensConfirmed));
    lensCheck.setEnabled(!busy() && foreground() && cameraReady());
    if (!busy() && camera != null && foreground()) {
      if (cameraReady()) cancelPreviewDeadline(); else watchPreview(camera, cameraGeneration);
    }
    stopButton.setEnabled(recording != null && !stopRequested); shareButton.setEnabled(lastVideo != null && !busy());
    for (Button button : new Button[]{recordButton, stopButton, shareButton}) button.setAlpha(button.isEnabled() ? 1f : .55f);
    updateThermalWarning();
    publishStudioCamera(false);
  }

  private void publishStudioCamera(boolean resetRecording) {
    if (studio == null) return;
    boolean active = foreground() && cameraWanted && cameraReady();
    studio.setPreviewLoad(busy(), thermallyBlocked());
    studio.setPreviewEnabled(active);
    try {
      JSONObject message = new JSONObject().put("kind", "camera").put("active", active)
          .put("state", stopRequested && recording != null ? "finalizing" : active ? "preview" : "off")
          .put("controlsVersion", 2).put("readyToRecord", active && lensConfirmed && !busy() && !thermallyBlocked()).put("resetRecording", resetRecording)
          .put("thermalBlocked", thermallyBlocked())
          .put("width", 1920).put("height", 1080).put("frameRate", 60).put("zoom", selectedZoomRatio);
      if (active) message.put("lensLabel", "Traseira principal");
      studio.send(message);
    } catch (JSONException failure) { throw new IllegalStateException(failure); }
  }

  private long studioTime() {
    return Math.min(STUDIO_LIMIT_MS, studioElapsedMs + ("recording".equals(studioPhase)
        ? Math.max(0, SystemClock.elapsedRealtime() - activeSinceMonoMs) : 0));
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

  private RearLensSelection.Lens findMainRearLens() throws CameraAccessException {
    CameraManager manager = getSystemService(CameraManager.class);
    if (manager == null) return null;
    List<RearLensSelection.Lens> lenses = new ArrayList<>();
    for (CameraInfo info : CameraSelector.DEFAULT_BACK_CAMERA.filter(provider.getAvailableCameraInfos())) {
      String id = Camera2CameraInfo.from(info).getCameraId();
      CameraCharacteristics logical = manager.getCameraCharacteristics(id);
      Set<String> physicalIds = logical.getPhysicalCameraIds();
      if (physicalIds.isEmpty()) {
        int[] capabilities = logical.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES);
        if (capabilities != null && Arrays.stream(capabilities).noneMatch(
            value -> value == CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)) {
          addStandardLens(lenses, id, null, logical);
        }
      } else {
        for (String physicalId : physicalIds) {
          addStandardLens(lenses, id, physicalId, manager.getCameraCharacteristics(physicalId));
        }
      }
    }
    return RearLensSelection.choose(lenses);
  }

  private static void addStandardLens(List<RearLensSelection.Lens> lenses, String id, String physicalId,
      CameraCharacteristics characteristics) {
    Integer facing = characteristics.get(CameraCharacteristics.LENS_FACING);
    SizeF sensor = characteristics.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE);
    if (facing == null || facing != CameraCharacteristics.LENS_FACING_BACK || sensor == null) return;
    RearLensSelection.Lens lens = RearLensSelection.standard(id, physicalId,
        characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS),
        sensor.getWidth(), sensor.getHeight());
    if (lens != null) lenses.add(lens);
  }

  private void bindCamera() {
    if (provider == null || !cameraWanted || !foreground() || !hasCameraPermission() || busy() || binding || camera != null) return;
    binding = true; retryAvailable = false; lensConfirmed = false; lensCheck.setChecked(false); long cameraToken = ++cameraGeneration;
    try {
      RearLensSelection.Lens lens = findMainRearLens();
      if (lens == null) {
        cameraFailed("Lente traseira principal não identificada.");
        result.setText("O Android não informou uma única lente padrão compatível.");
        return;
      }
      String physicalId = lens.physicalId();
      CameraSelector.Builder selectorBuilder = new CameraSelector.Builder()
          .requireLensFacing(CameraSelector.LENS_FACING_BACK)
          .addCameraFilter(infos -> {
            List<CameraInfo> matching = new ArrayList<>();
            for (CameraInfo info : infos) {
              if (lens.cameraId().equals(Camera2CameraInfo.from(info).getCameraId())) matching.add(info);
            }
            return matching;
          });
      if (physicalId != null) selectorBuilder.setPhysicalCameraId(physicalId);
      CameraSelector selector = selectorBuilder.build();
      CameraInfo info = provider.getCameraInfo(selector);
      if (!Recorder.getVideoCapabilities(info).getSupportedQualities(DynamicRange.SDR).contains(Quality.FHD))
        throw new IllegalStateException("Full HD indisponível");
      Preview.Builder previewBuilder = new Preview.Builder().setTargetRotation(rotation())
          .setResolutionSelector(new ResolutionSelector.Builder()
              .setAspectRatioStrategy(AspectRatioStrategy.RATIO_16_9_FALLBACK_AUTO_STRATEGY).build());
      Camera2Interop.Extender<Preview> previewInterop = new Camera2Interop.Extender<>(previewBuilder);
      AtomicBoolean lensConfirmedByCamera = new AtomicBoolean();
      AtomicBoolean contradictoryLens = new AtomicBoolean();
      previewInterop.setSessionCaptureCallback(new CameraCaptureSession.CaptureCallback() {
        @Override public void onCaptureCompleted(CameraCaptureSession session, CaptureRequest request,
            TotalCaptureResult captureResult) {
          if (!zoomReady || cameraGeneration != cameraToken || contradictoryLens.get()) return;
          CaptureResult lensResult = captureResult;
          String activeId = captureResult.get(CaptureResult.LOGICAL_MULTI_CAMERA_ACTIVE_PHYSICAL_ID);
          if (physicalId != null) {
            Map<String, ? extends CaptureResult> results = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? captureResult.getPhysicalCameraTotalResults() : captureResult.getPhysicalCameraResults();
            CaptureResult physicalResult = results.get(physicalId);
            if (physicalResult != null) {
              lensResult = physicalResult;
            } else if (!results.isEmpty() || activeId != null && !physicalId.equals(activeId)) {
              if (contradictoryLens.compareAndSet(false, true)) main.post(() -> rejectLens(cameraToken));
              return;
            } else if (activeId == null) {
              return;
            }
          } else if (activeId != null && !lens.cameraId().equals(activeId)) {
            if (contradictoryLens.compareAndSet(false, true)) main.post(() -> rejectLens(cameraToken));
            return;
          }
          if (lensConfirmedByCamera.compareAndSet(false, true)) main.post(() -> confirmLens(cameraToken));
          FrameStats sampleOwner = sensorFrames;
          if (!collectSensor || cameraGeneration != cameraToken) return;
          Long timestampNs = lensResult.get(CaptureResult.SENSOR_TIMESTAMP);
          if (timestampNs != null && collectSensor && cameraGeneration == cameraToken && sensorFrames == sampleOwner) {
            sampleOwner.addMicroseconds(timestampNs / 1000L);
            FramingEvidence prior = framingEvidence;
            if (prior == null || prior.frames() != sampleOwner) {
              Rect crop = lensResult.get(CaptureResult.SCALER_CROP_REGION);
              Float logicalZoom = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                  ? captureResult.get(CaptureResult.CONTROL_ZOOM_RATIO) : null;
              framingEvidence = new FramingEvidence(sampleOwner, crop == null ? null : new Rect(crop),
                  logicalZoom, lensResult != captureResult);
            }
          }
        }
      });
      Recorder recorder = new Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.FHD)).setTargetVideoEncodingBitRate(16_000_000).build();
      VideoCapture.Builder<Recorder> videoBuilder = new VideoCapture.Builder<>(recorder).setTargetRotation(rotation());
      if (physicalId != null) {
        // CameraX 1.6 may propagate the selector to Preview alone. The Camera2
        // session option pins the encoder surface to the same physical sensor.
        previewInterop.setPhysicalCameraId(physicalId);
        new Camera2Interop.Extender<>(videoBuilder).setPhysicalCameraId(physicalId);
      }
      preview = previewBuilder.build(); preview.setSurfaceProvider(previewView.getSurfaceProvider());
      videoCapture = videoBuilder.build();
      SessionConfig combination = new SessionConfig.Builder(Arrays.asList(preview, videoCapture)).build();
      if (!info.getSupportedFrameRateRanges(combination).contains(FPS)) throw new IllegalStateException("60 fps fixos indisponíveis nesta combinação");
      boundSession = new SessionConfig.Builder(Arrays.asList(preview, videoCapture)).setFrameRateRange(FPS).build();
      Camera boundCamera = provider.bindToLifecycle(this, selector, boundSession); camera = boundCamera;
      String boundId = Camera2CameraInfo.from(boundCamera.getCameraInfo()).getCameraId();
      if (!lens.cameraId().equals(boundId) && !boundId.equals(physicalId)) {
        throw new IllegalStateException("Câmera vinculada diferente da lente identificada");
      }
      selectedLens = lens;
      // Calibrated against the stock 1× Full HD video on this lens and model.
      selectedZoomRatio = "SM-S931B".equals(Build.MODEL) && "5".equals(physicalId) ? SAMSUNG_FRAMING_ZOOM : 1;
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
      ListenableFuture<Void> zoom = boundCamera.getCameraControl().setZoomRatio((float) selectedZoomRatio);
      zoom.addListener(() -> {
        if (destroyed || camera != boundCamera || cameraGeneration != cameraToken) return;
        try { zoom.get(); zoomReady = true; }
        catch (Exception failure) { cameraFailed("Não foi possível ajustar o enquadramento. Tente novamente."); }
        updateButtons();
      }, ContextCompat.getMainExecutor(this));
    } catch (Exception error) {
      cameraFailed("A lente traseira principal não abriu em Full HD a 60 fps.");
      result.setText("Nenhuma gravação iniciada. Detalhe: " + shortMessage(error));
    } finally { binding = false; updateButtons(); }
  }

  private void confirmLens(long token) {
    if (destroyed || cameraGeneration != token || camera == null) return;
    lensStreamVerified = true;
    source.setText(selectedZoomRatio == SAMSUNG_FRAMING_ZOOM ? "Traseira principal · quadro Samsung 1×"
        : "Traseira principal selecionada · zoom digital 1×");
    showReadyStatus();
    updateButtons();
  }

  private void rejectLens(long token) {
    if (destroyed || cameraGeneration != token) return;
    lensStreamVerified = false;
    if (recording == null) {
      cameraFailed("O Android não confirmou a lente traseira principal.");
    } else {
      lensMismatch = true;
      captureLensConfirmed = false;
      requestStop("Vídeo encerrado após o Android indicar outra lente.");
    }
  }

  private int rotation() { return previewView != null && previewView.getDisplay() != null ? previewView.getDisplay().getRotation() : Surface.ROTATION_0; }
  private void updateRotation() { if (preview != null) preview.setTargetRotation(rotation()); if (videoCapture != null) videoCapture.setTargetRotation(rotation()); }
  private void cancelPreviewDeadline() { if (previewDeadline != null) main.removeCallbacks(previewDeadline); previewDeadline = null; }
  private void watchPreview(Camera owner, long token) {
    if (previewDeadline != null) return;
    previewDeadline = () -> {
      previewDeadline = null;
      if (!destroyed && camera == owner && cameraGeneration == token && !busy() && !cameraReady()) {
        cameraFailed(previewStreaming && zoomReady ? "O Android não confirmou a lente traseira principal."
            : "A câmera não mostrou imagem. Feche outros apps e tente novamente.");
      }
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
    SessionConfig ownedSession = boundSession; boundSession = null;
    camera = null; preview = null; videoCapture = null; previewStreaming = false; zoomReady = false; lensConfirmed = false;
    selectedLens = null; selectedZoomRatio = 1; lensStreamVerified = false;
    if (source != null) source.setText("Lente traseira principal");
    if (lensCheck != null) lensCheck.setChecked(false);
    if (provider != null && ownedSession != null && provider.isBound(ownedSession)) provider.unbind(ownedSession);
  }

  @SuppressLint("MissingPermission")
  private boolean startRecording() {
    if (!foreground() || busy() || !cameraReady() || !lensConfirmed || !hasCameraPermission()) return false;
    if (studio != null) {
      refreshThermalStatus();
      if (thermallyBlocked()) return false;
    }
    OutputOptions output;
    captureWallMs = System.currentTimeMillis();
    captureName = "go-atleta-teste-" + new SimpleDateFormat("yyyyMMdd-HHmmss", Locale.ROOT).format(new Date(captureWallMs)) + "-" + UUID.randomUUID().toString().substring(0, 8);
    long limitMs = studio == null ? PROBE_LIMIT_MS : STUDIO_LIMIT_MS;
    String captureGoal = "Alvo: Full HD a 60 fps. A taxa real ainda será medida.";
    if (studio == null) {
      ContentValues values = new ContentValues();
      values.put(MediaStore.Video.Media.DISPLAY_NAME, captureName + ".mp4");
      values.put(MediaStore.Video.Media.MIME_TYPE, "video/mp4");
      values.put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/GoAtletaTeste");
      output = new MediaStoreOutputOptions.Builder(getContentResolver(), MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
          .setContentValues(values).setDurationLimitMillis(limitMs).build();
    } else {
      long spaceBudget = Math.min(StudioOriginalFile.MAX_BYTES - StudioOriginalFile.HASH_BYTES,
          getFilesDir().getUsableSpace() - STORAGE_RESERVE_BYTES);
      if (spaceBudget < MIN_STUDIO_BYTES) {
        setStatus("Libere espaço no celular antes de gravar.", DANGER);
        return false;
      }
      String id = UUID.randomUUID().toString();
      try {
        studioOutput = studio.reserveOriginal(id);
      } catch (IOException | SecurityException error) {
        setStatus("Não foi possível preparar o arquivo no celular.", DANGER);
        return false;
      }
      studioRecordingId = id; studioPhase = ""; studioElapsedMs = 0; studioSegment = 1;
      lastSourceRefreshMs = 0;
      maxThermalStatus = thermalStatus;
      output = new FileOutputOptions.Builder(studioOutput).setDurationLimitMillis(limitMs).setFileSizeLimit(spaceBudget).build();
      long estimatedSeconds = Math.min(limitMs / 1_000L, spaceBudget / ESTIMATED_BYTES_PER_SECOND);
      captureGoal += "\nEspaço estimado a 20 Mb/s · até " + captureTime(estimatedSeconds);
    }
    starting = true; stopRequested = false; collectSensor = false; stopReason = "";
    long token = ++generation;
    captureLensConfirmed = lensConfirmed;
    captureLens = selectedLens;
    captureZoomRatio = selectedZoomRatio;
    lensMismatch = false;
    updateRotation(); setStatus("Iniciando gravação…", Color.WHITE); result.setText(captureGoal); updateButtons();
    main.postDelayed(hardStop, limitMs);
    try {
      Recorder recorder = videoCapture.getOutput();
      PendingRecording pending = output instanceof MediaStoreOutputOptions media
          ? recorder.prepareRecording(this, media) : recorder.prepareRecording(this, (FileOutputOptions) output);
      // Intentionally do not call withAudioEnabled: the harness has no microphone permission.
      recording = pending.start(ContextCompat.getMainExecutor(this), event -> handleRecording(token, event));
    } catch (Exception error) {
      starting = false; recording = null; stopRequested = false; main.removeCallbacks(hardStop);
      clearStudioOutput();
      setStatus("Não foi possível iniciar a gravação. Tente novamente.", DANGER); result.setText(shortMessage(error));
      updateButtons(); return false;
    }
    updateButtons(); return true;
  }

  private void handleRecording(long token, VideoRecordEvent event) {
    if (token != generation) return;
    if (event instanceof VideoRecordEvent.Start) {
      starting = false; startedMonoMs = SystemClock.elapsedRealtime(); sensorFrames = studioOutput == null ? new FrameStats() : FrameStats.forStudio(); collectSensor = !stopRequested;
      if (studioOutput != null) {
        captureWallMs = System.currentTimeMillis(); activeSinceEpochMs = captureWallMs; activeSinceMonoMs = startedMonoMs; studioPhase = "recording";
        studio.updateOriginal(studioRecordingId, StudioOriginalFile.growing(studioOutput));
      }
      if (!stopRequested && foreground()) {
        if (studioOutput == null) main.postDelayed(autoStop, 10_000L);
        main.post(clock);
      }
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
      if (lensMismatch) {
        releaseCamera();
        retryAvailable = true;
      }
      VideoRecordEvent.Finalize end = (VideoRecordEvent.Finalize) event;
      Uri uri = end.getOutputResults().getOutputUri();
      studioElapsedMs = end.getRecordingStats().getRecordedDurationNanos() / 1_000_000L;
      boolean studioCapture = studioOutput != null;
      if (studioCapture) uri = finalizeStudioOutput(end.getError());
      if (uri == null || Uri.EMPTY.equals(uri)) {
        studioPhase = "error"; publishStudioRecording(); finalizing = false;
        setStatus(studioCapture ? "Não foi possível finalizar o vídeo no celular." : "Não foi gerado um arquivo de vídeo. O modo não foi confirmado.", DANGER);
        updateButtons(); shutdownIfFinished(); return;
      }
      lastVideo = uri; finalizing = true;
      if (studioCapture) getSharedPreferences(PREFS, MODE_PRIVATE).edit()
          .putString("lastVideo", uri.toString()).putString("lastResult", "Vídeo salvo neste celular.")
          .putLong("lastCapturedAt", captureWallMs).apply();
      final FrameStats sensor = sensorFrames;
      final String name = captureName, reason = stopReason; final long capturedAt = captureWallMs; final int error = end.getError(); final boolean confirmed = captureLensConfirmed;
      final Uri original = uri; final long durationMs = studioElapsedMs;
      final int thermal = studioCapture ? maxThermalStatus : -1;
      final int pauses = studioCapture ? studioSegment - 1 : 0;
      final RearLensSelection.Lens recordedLens = captureLens;
      final double recordedZoom = captureZoomRatio;
      final FramingEvidence observedFraming = framingEvidence;
      setStatus("Conferindo o arquivo original…", Color.WHITE); updateButtons();
      inspection.execute(() -> inspectVideo(original, name, capturedAt, reason, error, sensor.snapshot(),
          confirmed, studioCapture, durationMs, thermal, pauses, recordedLens, recordedZoom,
          observedFraming != null && observedFraming.frames() == sensor ? observedFraming : null));
    }
  }

  private void clearStudioOutput() {
    if (studioOutput == null) return;
    studio.discardOffer(studioRecordingId);
    // Empty reservation is expendable. A partial output stays on the phone.
    if (studioOutput.length() == 0) studioOutput.delete();
    studioOutput = null;
  }

  private Uri finalizeStudioOutput(int error) {
    File pending = studioOutput;
    if (successfulFinalize(error)) {
      try {
        StudioOriginalFile.Source original = StudioOriginalFile.finish(pending);
        if (error == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED && stopReason.isEmpty()) {
          stopReason = "Limite de tamanho ou espaço disponível atingido.";
        } else if (error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED && stopReason.isEmpty()) {
          stopReason = "Limite de duas horas atingido.";
        }
        Uri uri = FileProvider.getUriForFile(this, getPackageName() + ".studio-files", original.file(), captureName + ".mp4");
        studioOutput = null;
        studioPhase = "stopped";
        publishStudioRecording();
        studio.updateOriginal(studioRecordingId, original);
        return uri;
      } catch (IOException | IllegalArgumentException | SecurityException errorSaving) {
        result.setText("Confira o arquivo local antes de iniciar outra gravação.");
      }
    }
    if (pending.length() > 0) result.setText("A gravação foi interrompida. O arquivo parcial foi preservado neste celular.");
    clearStudioOutput();
    return null;
  }

  private static boolean successfulFinalize(int error) {
    return error == VideoRecordEvent.Finalize.ERROR_NONE
        || error == VideoRecordEvent.Finalize.ERROR_DURATION_LIMIT_REACHED
        || error == VideoRecordEvent.Finalize.ERROR_FILE_SIZE_LIMIT_REACHED;
  }

  private void requestStop(String reason) {
    if (recording == null || stopRequested) return;
    stopRequested = true; stopReason = reason; collectSensor = false; main.removeCallbacks(autoStop); main.removeCallbacks(clock);
    setStatus("Finalizando o vídeo…", Color.WHITE); updateButtons(); recording.stop();
  }

  private void inspectVideo(Uri uri, String name, long capturedAt, String reason, int error,
      FrameStats.Result sensor, boolean confirmed, boolean studioCapture, long durationMs, int thermal, int pauses,
      RearLensSelection.Lens lens, double requestedZoom, FramingEvidence framing) {
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
      FrameStats file = studioCapture ? FrameStats.forStudio() : new FrameStats();
      while (extractor.getSampleTime() >= 0) {
        if (extractor.getSampleSize() > 0 && !file.addMicroseconds(extractor.getSampleTime())) break;
        if (!extractor.advance()) break;
      }
      FrameStats.Result measured = file.snapshot();
      long minimumSpanUs = Math.max(0, durationMs - 1_000L) * 1_000L;
      boolean fullCoverage = !studioCapture || pauses == 0
          && measured.durationUs >= minimumSpanUs && sensor.durationUs >= minimumSpanUs;
      verified = successfulFinalize(error) && confirmed && fullCoverage && FrameStats.proves1080p60(width, height, measured, sensor);
      summary = String.format(Locale.getDefault(), "%d × %d · arquivo %.2f fps\nSensor: %.2f fps · %d quadros únicos · %.2f s\nMetadado do arquivo: %s\n%s", width, height, measured.framesPerSecond,
          sensor.framesPerSecond, measured.uniqueSamples, measured.durationUs / 1_000_000d,
          nominal == null ? "não informado" : String.format(Locale.getDefault(), "%.2f fps", nominal.doubleValue()),
          verified ? "60 fps confirmados por sensor e PTS." : pauses > 0
              ? "Pausas impedem comprovar a cadência contínua." : "60 fps não confirmados. Original preservado.");
      JSONObject report = new JSONObject(); report.put("version", 1); report.put("file", name + ".mp4"); report.put("capturedAtEpochMs", capturedAt); report.put("requestedWidth", 1920); report.put("requestedHeight", 1080); report.put("requestedFpsMin", 60); report.put("requestedFpsMax", 60); report.put("requestedZoomRatio", requestedZoom); report.put("audio", false); report.put("width", width); report.put("height", height); report.put("finalizeError", error); report.put("stopReason", reason); report.put("verified1080p60", verified);
      if (framing != null) {
        if (framing.logicalZoomRatio() != null && Float.isFinite(framing.logicalZoomRatio())) {
          report.put("reportedLogicalZoomRatio", framing.logicalZoomRatio().doubleValue());
        }
        Rect crop = framing.crop();
        if (crop != null) {
          report.put("reportedCropRegion", new JSONObject().put("left", crop.left).put("top", crop.top)
              .put("right", crop.right).put("bottom", crop.bottom)
              .put("source", framing.fromPhysicalMetadata() ? "physical" : "camera"));
        }
      }
      report.put("camera", "rear-main"); report.put("lensConfirmationRequired", true); report.put("lensConfirmed", confirmed); report.put("codedWidth", codedWidth); report.put("codedHeight", codedHeight); report.put("nominalFileFps", nominal == null ? JSONObject.NULL : nominal); report.put("filePts", statsJson(measured)); report.put("sensorTimestamps", statsJson(sensor));
      if (lens != null) {
        JSONObject optics = new JSONObject().put("cameraId", lens.cameraId())
            .put("physicalId", lens.physicalId() == null ? JSONObject.NULL : lens.physicalId())
            .put("focalLengthMm", lens.focalLengthMm()).put("sensorDiagonalMm", lens.sensorDiagonalMm())
            .put("estimatedEquivalentMm", lens.equivalentMm());
        report.put("rearLens", optics);
      }
      if (studioCapture) {
        report.put("recordedDurationMs", durationMs);
        report.put("pauses", pauses);
        report.put("fullCadenceCoverage", fullCoverage);
        if (thermal >= 0) report.put("maxThermalStatus", thermal);
      }
      saveReport(name, report.toString(2));
    } catch (Exception failure) {
      summary = "Não foi possível conferir o vídeo. Original preservado.\n" + shortMessage(failure);
    } finally { extractor.release(); }
    SharedPreferences saved = getSharedPreferences(PREFS, MODE_PRIVATE);
    if (capturedAt >= saved.getLong("lastCapturedAt", 0)) saved.edit().putString("lastVideo", uri.toString()).putString("lastResult", summary).putLong("lastCapturedAt", capturedAt).apply();
    final String output = summary; final boolean success = verified;
    main.post(() -> {
      finalizing = false;
      if (!destroyed) {
        result.setText("");
        lastResult.setText(output);
        lastResult.setTextColor(success ? GREEN : MUTED);
        String completion = studioCapture ? reason.isEmpty() ? "Vídeo salvo neste celular." : reason
            : success ? "Teste concluído." : "Teste concluído sem confirmar 60 fps.";
        setStatus(completion, success ? GREEN : WARNING);
        updateButtons(); if (foreground() && camera == null && !retryAvailable) bindCamera();
      }
      shutdownIfFinished();
    });
  }

  private JSONObject statsJson(FrameStats.Result value) throws Exception {
    JSONObject json = new JSONObject(); json.put("samples", value.samples); json.put("uniqueSamples", value.uniqueSamples); json.put("duplicateSamples", value.duplicateSamples); json.put("outOfOrderSamples", value.outOfOrderSamples); json.put("invalidSamples", value.invalidSamples); json.put("ignoredSamples", value.ignoredSamples); json.put("firstTimestampUs", value.firstTimestampUs); json.put("lastTimestampUs", value.lastTimestampUs); json.put("spanUs", value.durationUs); json.put("measuredFps", value.framesPerSecond); json.put("medianIntervalUs", value.medianIntervalUs); json.put("p95IntervalUs", value.p95IntervalUs); json.put("maxIntervalUs", value.maxIntervalUs); json.put("cadenceWindows", value.cadenceWindows); json.put("failedCadenceWindows", value.failedCadenceWindows); return json;
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
    if (studio != null && powerManager != null && !thermalListenerRegistered) {
      powerManager.addThermalStatusListener(ContextCompat.getMainExecutor(this), thermalListener);
      thermalListenerRegistered = true;
      refreshThermalStatus();
    }
    // ComponentActivity reaches RESUMED after onResume returns on API 29+.
    main.post(() -> { if (!foreground()) return; if (provider != null) bindCamera(); updateRotation(); updateButtons(); });
  }
  @Override protected void onPause() {
    requestStop("Gravação encerrada ao sair da câmera.");
    if (thermalListenerRegistered) { powerManager.removeThermalStatusListener(thermalListener); thermalListenerRegistered = false; }
    if (displayManager != null && displayListenerRegistered) { displayManager.unregisterDisplayListener(displayListener); displayListenerRegistered = false; }
    super.onPause();
  }
  @Override protected void onStop() { requestStop("Gravação encerrada ao sair da câmera."); if (studio != null) studio.setPreviewEnabled(false); releaseCamera(); updateButtons(); super.onStop(); }
  @Override public void onConfigurationChanged(Configuration configuration) {
    super.onConfigurationChanged(configuration);
    layoutControls.run();
    main.post(this::updateRotation);
  }
  private void shutdownIfFinished() { if (destroyed && recording == null && !finalizing) inspection.shutdown(); }
  @Override protected void onDestroy() {
    destroyed = true; collectSensor = false; main.removeCallbacks(autoStop); main.removeCallbacks(hardStop); main.removeCallbacks(clock);
    if (pairingDialog != null) pairingDialog.dismiss();
    if (recording != null) { recording.stop(); recording.close(); }
    if (studio != null) studio.close();
    releaseCamera(); shutdownIfFinished(); super.onDestroy();
  }
}
