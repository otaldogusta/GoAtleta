import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAppTheme } from "./app-theme";
import { GoAtletaIcon } from "./icon-registry";
import { ModalSheet } from "./ModalSheet";
import { Pressable } from "./Pressable";
import { useModalCardStyle } from "./use-modal-card-style";
import {
  normalizeWebCameraPicture,
  type WebCameraCaptureResult,
} from "./web-camera-capture";

type WebCameraCaptureModalProps = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: WebCameraCaptureResult) => void;
};

type WebCameraCaptureContentProps = Omit<WebCameraCaptureModalProps, "visible">;

function WebCameraCaptureContent({
  onClose,
  onCapture,
}: WebCameraCaptureContentProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const permissionRequestedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [captureBusy, setCaptureBusy] = useState(false);
  const [cameraError, setCameraError] = useState("");
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
        base64: true,
        quality: 0.7,
      });
      onCapture(normalizeWebCameraPicture(picture));
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
              Tirar foto
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Posicione o aluno no centro da imagem.
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
              ref={cameraRef}
              style={{ flex: 1 }}
              facing="front"
              mode="picture"
              onCameraReady={() => setCameraReady(true)}
              onMountError={({ message }) => setCameraError(message)}
            />
          </View>
        ) : (
          <View style={{ minHeight: 260, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <GoAtletaIcon name="camera" size={32} color={colors.muted} />
            <Text style={{ color: colors.text, fontWeight: "700", textAlign: "center" }}>
              Permita o acesso à webcam para tirar a foto.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
              Se a permissão foi bloqueada, libere a câmera nas configurações do site no navegador.
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
            accessibilityLabel="Capturar foto da webcam"
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
}: WebCameraCaptureModalProps) {
  if (!visible) return null;

  return <WebCameraCaptureContent onClose={onClose} onCapture={onCapture} />;
}
