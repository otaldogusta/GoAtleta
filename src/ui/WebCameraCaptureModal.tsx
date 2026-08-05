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
  getOppositeCameraFacing,
  normalizeWebCameraPicture,
  type WebCameraCaptureResult,
} from "./web-camera-capture";

type WebCameraCaptureModalProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: WebCameraCaptureResult) => void | Promise<void>;
  initialFacing?: CameraType;
  title?: string;
  subtitle?: string;
};

type WebCameraCaptureContentProps = Omit<WebCameraCaptureModalProps, "visible">;

function WebCameraCaptureContent({
  onClose,
  onCapture,
  initialFacing = "front",
  title = "Tirar foto",
  subtitle = "Posicione o aluno no centro da imagem.",
}: WebCameraCaptureContentProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const permissionRequestedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facing, setFacing] = useState<CameraType>(initialFacing);
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

  const capturePhoto = async () => {
    if (!cameraRef.current || !cameraReady || captureBusy) return;

    setCaptureBusy(true);
    setCameraError("");
    try {
      const picture = await cameraRef.current.takePictureAsync({
        base64: Platform.OS === "web",
        quality: 0.7,
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
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {subtitle}
            </Text>
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
              onCameraReady={() => setCameraReady(true)}
              onMountError={({ message }) => setCameraError(message)}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                facing === "front"
                  ? "Usar câmera traseira"
                  : "Usar câmera frontal"
              }
              onPress={() => {
                setCameraReady(false);
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
            disabled={!permission?.granted || !cameraReady || captureBusy}
            onPress={() => void capturePhoto()}
            style={{
              paddingVertical: 11,
              paddingHorizontal: 18,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              opacity: !permission?.granted || !cameraReady || captureBusy ? 0.5 : 1,
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
  initialFacing,
  title,
  subtitle,
}: WebCameraCaptureModalProps) {
  if (!visible) return null;

  return (
    <WebCameraCaptureContent
      onClose={onClose}
      onCapture={onCapture}
      initialFacing={initialFacing}
      title={title}
      subtitle={subtitle}
    />
  );
}
