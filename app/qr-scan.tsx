import { CameraView, useCameraPermissions } from "expo-camera";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "../src/ui/app-theme";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

export default function QrScanScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const sheetStyle = useModalCardStyle({ maxHeight: "70%", maxWidth: 440 });

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20, gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
            Escanear QR Code
          </Text>
          <Text style={{ color: colors.muted }}>
            O scanner funciona apenas no app mobile.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20 }}>
          <Text style={{ color: colors.text }}>Carregando câmera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ padding: 20, gap: 12 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              alignSelf: "flex-start",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>
            Permitir câmera
          </Text>
          <Text style={{ color: colors.muted }}>
            Precisamos da câmera para escanear QR Code.
          </Text>
          <Pressable
            onPress={() => requestPermission()}
            style={{
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Permitir acesso
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            alignSelf: "flex-start",
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
        </Pressable>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>
          Escanear QR Code
        </Text>
        <Text style={{ color: colors.muted }}>
          Aponte a câmera para o QR.
        </Text>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 16 }}>
        <View
          style={{
            flex: 1,
            borderRadius: 24,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
          }}
        >
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={({ data }) => {
              if (scanned) return;
              setScanned(true);
              setResult(data);
            }}
          />
          <View
            style={{
              position: "absolute",
              inset: 16,
              borderRadius: 18,
              borderWidth: 2,
              borderColor: colors.primaryBg,
              backgroundColor: "transparent",
            }}
          />
        </View>
      </View>

      <ModalSheet
        visible={!!result}
        onClose={() => {
          setResult(null);
          setScanned(false);
        }}
        cardStyle={sheetStyle}
      >
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            QR detectado
          </Text>
          <Text style={{ color: colors.muted }} numberOfLines={4}>
            {result}
          </Text>
          <View style={{ gap: 10 }}>
            {result && isHttpUrl(result) ? (
              <Pressable
                onPress={() => Linking.openURL(result)}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: colors.primaryBg,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Abrir link
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                if (result) Clipboard.setStringAsync(result);
              }}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Copiar
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setResult(null);
                setScanned(false);
              }}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Escanear novamente
              </Text>
            </Pressable>
          </View>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
