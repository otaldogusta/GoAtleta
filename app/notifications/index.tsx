import {
  useEffect,
  useState } from "react";
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Text,
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { Typography } from "../../src/ui/Typography";
import { Button } from "../../src/ui/Button";
import { useAppTheme } from "../../src/ui/app-theme";
import { useAuth } from "../../src/auth/auth";

const STORAGE_KEY = "notify_settings_v1";
const UPDATE_CHANNEL = "main";
const UPDATE_URL =
  "https://u.expo.dev/a5b1cd35-0ae7-4c50-a12e-df9741e0dfca?channel-name=" +
  UPDATE_CHANNEL;
const UPDATE_DEEPLINK =
  "meuapp://expo-development-client/?url=" +
  encodeURIComponent(UPDATE_URL);

const isWeb = Platform.OS === "web";

export default function NotificationsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { signOut } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw || !alive) return;
      const data = JSON.parse(raw) as {
        enabled: boolean;
      };
      setEnabled(Boolean(data.enabled));
    })();
    return () => {
      alive = false;
    };
  }, []);


  const requestPermissions = async () => {
    if (isWeb) return false;
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const result = await Notifications.requestPermissionsAsync();
    return result.status === "granted";
  };

  const disableNotifications = async () => {
    if (isWeb) {
      setStatus("Notificacoes nao sao suportadas no navegador.");
      return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    setStatus("Lembretes removidos.");
  };

  const saveSettings = async (nextEnabled: boolean) => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ enabled: nextEnabled })
    );
  };

  const apply = async (nextEnabled: boolean) => {
    setStatus("");
    await saveSettings(nextEnabled);
    if (nextEnabled) {
      const ok = await requestPermissions();
      if (ok) {
        setStatus("Notificacoes ativadas.");
      } else {
        setStatus("Permissao negada.");
      }
    } else {
      await disableNotifications();
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <Typography variant="title">Configuracoes</Typography>

      <View style={{ marginTop: 16, gap: 12 }}>
        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Typography variant="body">Tema</Typography>
          <Pressable
            onPress={toggleMode}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {mode === "dark" ? "Claro" : "Escuro"}
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Typography variant="body">Notificacoes</Typography>
          <Pressable
            onPress={() => {
              setEnabled((prev) => !prev);
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: enabled ? colors.primaryBg : colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text
              style={{
                color: enabled ? colors.primaryText : colors.text,
                fontWeight: "700",
              }}
            >
              {enabled ? "Lembrete ligado" : "Lembrete desligado"}
            </Text>
          </Pressable>
          {status ? (
            <Text style={{ color: colors.muted }}>{status}</Text>
          ) : null}
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Typography variant="body">Atualizacoes</Typography>
          <Pressable
            onPress={() => Linking.openURL(UPDATE_DEEPLINK)}
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Carregar update (main)
            </Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Linking.openURL(
                "https://qr.expo.dev/development-client?appScheme=" +
                  encodeURIComponent("meuapp") +
                  "&url=" +
                  encodeURIComponent(UPDATE_URL)
              )
            }
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Abrir QR do update
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Use o update quando mudar apenas telas e textos.
          </Text>
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Typography variant="body">Diagnostico</Typography>
          <Pressable
            onPress={() => {
              throw new Error("Erro de teste do inbox");
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Gerar erro de teste
            </Text>
          </Pressable>
        </View>

        <View
          style={{
            padding: 12,
            borderRadius: 14,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Typography variant="body">Conta</Typography>
          <Pressable
            onPress={async () => {
              await signOut();
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Sair
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => void apply(enabled)}
          style={{
            paddingVertical: 12,
            borderRadius: 14,
            backgroundColor: colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            Salvar alteracoes
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}



