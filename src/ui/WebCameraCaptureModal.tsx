import {
  CameraView,
  useCameraPermissions,
  type CameraType,
} from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";

import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";
import { useModalCardStyle } from "./use-modal-card-style";
import {
  getDefaultCameraZoom,
  getOppositeCameraFacing,
  getWebCameraZoomOptions,
  normalizeWebCameraPicture,
  normalizeCameraZoom,
  selectPreferredRearCameraDevice,
  type WebCameraCaptureResult,
  type WebCameraZoomOption,
  type WebCameraZoomRange,
} from "./web-camera-capture";

type WebCameraCaptureModalProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: WebCameraCaptureResult) => void | Promise<void>;
  captureQuality?: number;
  initialFacing?: CameraType;
  title?: string;
  subtitle?: string;
};

type WebCameraCaptureContentProps = Omit<WebCameraCaptureModalProps, "visible">;

type ZoomCapableVideoTrack = {
  applyConstraints: (constraints: {
    advanced: { zoom: number }[];
  }) => Promise<void>;
  getCapabilities: () => { zoom?: WebCameraZoomRange };
  getSettings?: () => {
    deviceId?: string;
    height?: number;
    width?: number;
  };
};

type CameraContainerElement = {
  querySelector?: (selector: string) => HTMLVideoElement | null;
};

const WEB_CAMERA_TRACK_RETRIES = 12;
const WEB_CAMERA_TRACK_RETRY_MS = 60;

function getCameraVideoElement(container: unknown): HTMLVideoElement | null {
  const cameraContainer = container as CameraContainerElement | null;
  return cameraContainer?.querySelector?.("video") ?? null;
}

function getZoomCapableVideoTrack(container: unknown): ZoomCapableVideoTrack | null {
  const video = getCameraVideoElement(container);
  const stream = video?.srcObject as MediaStream | null;
  return (stream?.getVideoTracks?.()[0] as ZoomCapableVideoTrack | undefined) ?? null;
}

function WebCameraCaptureContent({
  onClose,
  onCapture,
  captureQuality = 0.7,
  initialFacing = "back",
  title = "Tirar foto",
  subtitle = "Posicione o aluno no centro da imagem.",
}: WebCameraCaptureContentProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const permissionRequestedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [rearCameraConfigured, setCameraConfigured] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facing, setFacing] = useState<CameraType>(initialFacing);
  const cameraConfigured = cameraReady && (Platform.OS !== "web" || facing !== "back" || rearCameraConfigured);
  const [normalizedZoom, setNormalizedZoom] = useState(0);
  const [selectedZoom, setSelectedZoom] = useState(1);
  const [zoomOptions, setZoomOptions] = useState<WebCameraZoomOption[]>([]);
  const cameraContainerRef = useRef<unknown>(null);
  const webVideoTrackRef = useRef<ZoomCapableVideoTrack | null>(null);
  const customCameraStreamRef = useRef<MediaStream | null>(null);
  const cardStyle = useModalCardStyle({
    maxHeight: "92%",
    maxWidth: 560,
    padding: 16,
    radius: 18,
  });

  useEffect(() => {
    if (!permission || permission.granted || !permission.canAskAgain) return;
    if (permissionRequestedRef.current) return;

    permissionRequestedRef.current = true;
    void requestPermission().catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      setCameraError(detail);
    });
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!cameraReady) return;

    if (Platform.OS !== "web" || facing !== "back") {
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const stopStream = (stream: MediaStream | null) => {
      stream?.getTracks().forEach((track) => track.stop());
    };

    const stopCustomCameraStream = () => {
      stopStream(customCameraStreamRef.current);
      customCameraStreamRef.current = null;
    };

    const selectPreferredRearCameraTrack = async (
      currentTrack: ZoomCapableVideoTrack,
    ): Promise<ZoomCapableVideoTrack> => {
      const video = getCameraVideoElement(cameraContainerRef.current);
      const mediaDevices = typeof navigator !== "undefined"
        ? navigator.mediaDevices
        : undefined;
      if (!video || !mediaDevices?.enumerateDevices || !mediaDevices.getUserMedia) {
        return currentTrack;
      }

      try {
        const currentSettings = currentTrack.getSettings?.() ?? {};
        const preferred = selectPreferredRearCameraDevice(
          await mediaDevices.enumerateDevices(),
          currentSettings.deviceId,
        );
        if (!preferred || preferred.deviceId === currentSettings.deviceId) {
          return currentTrack;
        }

        const previousStream = video.srcObject;
        const nextStream = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: preferred.deviceId },
            facingMode: { ideal: "environment" },
            ...(currentSettings.width
              ? { width: { ideal: currentSettings.width } }
              : {}),
            ...(currentSettings.height
              ? { height: { ideal: currentSettings.height } }
              : {}),
          },
        });
        const nextTrack = nextStream.getVideoTracks()[0] as
          | ZoomCapableVideoTrack
          | undefined;
        if (!nextTrack) {
          stopStream(nextStream);
          return currentTrack;
        }

        try {
          video.srcObject = nextStream;
          await video.play();
        } catch {
          video.srcObject = previousStream;
          stopStream(nextStream);
          return currentTrack;
        }

        if (cancelled) {
          stopStream(nextStream);
          return currentTrack;
        }

        stopCustomCameraStream();
        customCameraStreamRef.current = nextStream;
        return nextTrack;
      } catch {
        return currentTrack;
      }
    };

    const finishWithoutZoomControls = () => {
      if (cancelled) return;
      webVideoTrackRef.current = null;
      setZoomOptions([]);
      setSelectedZoom(1);
      setNormalizedZoom(0);
      setCameraConfigured(true);
    };

    const configureRearCamera = async (attempt = 0): Promise<void> => {
      const initialTrack = getZoomCapableVideoTrack(cameraContainerRef.current);
      if (!initialTrack) {
        if (attempt >= WEB_CAMERA_TRACK_RETRIES) {
          finishWithoutZoomControls();
          return;
        }
        retryTimer = setTimeout(
          () => void configureRearCamera(attempt + 1),
          WEB_CAMERA_TRACK_RETRY_MS,
        );
        return;
      }

      const track = await selectPreferredRearCameraTrack(initialTrack);
      if (cancelled) return;

      const range = track.getCapabilities?.().zoom;
      const options = range ? getWebCameraZoomOptions(range) : [];
      if (!range || options.length === 0) {
        finishWithoutZoomControls();
        return;
      }

      const defaultZoom = getDefaultCameraZoom(range);
      try {
        await track.applyConstraints({ advanced: [{ zoom: defaultZoom }] });
      } catch {
        finishWithoutZoomControls();
        return;
      }

      if (cancelled) return;
      webVideoTrackRef.current = track;
      setZoomOptions(options);
      setSelectedZoom(defaultZoom);
      setNormalizedZoom(normalizeCameraZoom(defaultZoom, range));
      setCameraConfigured(true);
    };

    void configureRearCamera();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      stopCustomCameraStream();
    };
  }, [cameraReady, facing]);

  const selectZoom = async (option: WebCameraZoomOption) => {
    const track = webVideoTrackRef.current;
    if (!track || Math.abs(option.value - selectedZoom) < 0.01) return;

    try {
      await track.applyConstraints({ advanced: [{ zoom: option.value }] });
      setSelectedZoom(option.value);
      setNormalizedZoom(option.normalized);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setCameraError(detail || "Não foi possível alterar o zoom da câmera.");
    }
  };

  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady || !cameraConfigured || captureBusy) return;

    setCaptureBusy(true);
    setCameraError("");
    try {
      const picture = await cameraRef.current.takePictureAsync({
        base64: Platform.OS === "web",
        quality: captureQuality,
      });
      await onCapture(normalizeWebCameraPicture(picture));
      onClose();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setCameraError(detail || "Não foi possível capturar a foto.");
    } finally {
      setCaptureBusy(false);
    }
  };

  return (
    <ModalSheet
      visible
      onClose={onClose}
      cardStyle={cardStyle}
      position="center"
      backdropOpacity={0.72}
      overlayZIndex={5200}
    >
      <View style={{ gap: 14 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Fechar câmera"
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <GoAtletaIcon name="close" size={18} color={colors.text} />
          </Pressable>
        </View>

        {!permission ? (
          <View style={{ minHeight: 300, alignItems: "center", justifyContent: "center", gap: 10 }}>
            <ActivityIndicator color={colors.primaryBg} />
            <Text style={{ color: colors.muted }}>Preparando a câmera...</Text>
          </View>
        ) : permission.granted ? (
          <View
            ref={(node) => {
              cameraContainerRef.current = node;
            }}
            style={{
              height: 360,
              borderRadius: 18,
              overflow: "hidden",
              backgroundColor: "#05080d",
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <CameraView
              key={facing}
              ref={cameraRef}
              style={{ flex: 1 }}
              facing={facing}
              mirror={facing === "front"}
              mode="picture"
              zoom={normalizedZoom}
              onCameraReady={() => setCameraReady(true)}
              onMountError={({ message }) => setCameraError(message)}
            />
            {!cameraConfigured ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#05080d",
                }}
              >
                <ActivityIndicator color="#ffffff" />
              </View>
            ) : null}
            {cameraConfigured && facing === "back" && zoomOptions.length > 1 ? (
              <View
                style={{
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {zoomOptions.map((option) => {
                  const active = Math.abs(option.value - selectedZoom) < 0.01;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar zoom ${option.label}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => void selectZoom(option)}
                      style={{
                        minWidth: 42,
                        height: 34,
                        paddingHorizontal: 10,
                        borderRadius: 17,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: active
                          ? colors.primaryBg
                          : "rgba(5, 8, 13, 0.72)",
                        borderWidth: 1,
                        borderColor: active
                          ? colors.primaryBg
                          : "rgba(255, 255, 255, 0.24)",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? colors.primaryText : "#ffffff",
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                facing === "front"
                  ? "Usar câmera traseira"
                  : "Usar câmera frontal"
              }
              onPress={() => {
                customCameraStreamRef.current
                  ?.getTracks()
                  .forEach((track) => track.stop());
                customCameraStreamRef.current = null;
                setCameraReady(false);
                setCameraConfigured(false);
                setZoomOptions([]);
                setSelectedZoom(1);
                setNormalizedZoom(0);
                webVideoTrackRef.current = null;
                setFacing((current) => getOppositeCameraFacing(current));
              }}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(5, 8, 13, 0.72)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.24)",
              }}
            >
              <GoAtletaIcon name="sync" size={21} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <GoAtletaIcon name="camera" size={32} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "700", textAlign: "center" }}>
              Permita o acesso à câmera para tirar a foto.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
              Se a permissão foi bloqueada, libere a câmera nas configurações do navegador ou do dispositivo.
            </Text>
            {permission.canAskAgain ? (
              <Pressable
                onPress={() => void requestPermission()}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
                  Permitir câmera
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {cameraError ? (
          <Text style={{ color: colors.danger, fontSize: 12 }} accessibilityRole="alert">
            {cameraError}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10 }}>
          <Pressable
            onPress={onClose}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 18,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capturar foto"
            disabled={
              !permission?.granted ||
              !cameraReady ||
              !cameraConfigured ||
              captureBusy
            }
            onPress={() => void capturePhoto()}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              opacity:
                !permission?.granted ||
                !cameraReady ||
                !cameraConfigured ||
                captureBusy
                  ? 0.5
                  : 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            {captureBusy ? (
              <ActivityIndicator size="small" color={colors.primaryText} />
            ) : (
              <GoAtletaIcon name="camera" size={17} color={colors.primaryText} />
            )}
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              Capturar foto
            </Text>
          </Pressable>
        </View>
      </View>
    </ModalSheet>
  );
}

export function WebCameraCaptureModal({
  visible,
  onClose,
  onCapture,
  captureQuality,
  initialFacing,
  title,
  subtitle,
}: WebCameraCaptureModalProps) {
  if (!visible) return null;

  return (
    <WebCameraCaptureContent
      onClose={onClose}
      onCapture={onCapture}
      captureQuality={captureQuality}
      initialFacing={initialFacing}
      title={title}
      subtitle={subtitle}
    />
  );
}
