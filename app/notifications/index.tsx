import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/auth";
import { useRole } from "../../src/auth/role";
import { type DevProfilePreview } from "../../src/dev/profile-preview";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { Pressable } from "../../src/ui/Pressable";
import { SettingsRow } from "../../src/ui/SettingsRow";
import { Typography } from "../../src/ui/Typography";
import { useAppTheme } from "../../src/ui/app-theme";

const STORAGE_KEY = "notify_settings_v1";
const isWeb = Platform.OS === "web";

export default function NotificationsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { signOut } = useAuth();
  const { refresh: refreshRole } = useRole();
  const { devProfilePreview, setDevProfilePreview } = useOrganization();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw || !alive) return;
      const data = JSON.parse(raw) as { enabled: boolean };
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
      setStatus("Notificações não são suportadas no navegador.");
      return;
    }
    await Notifications.cancelAllScheduledNotificationsAsync();
    setStatus("Lembretes removidos.");
  };

  const saveSettings = async (nextEnabled: boolean) => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled: nextEnabled }));
  };

  const apply = async (nextEnabled: boolean) => {
    setStatus("");
    await saveSettings(nextEnabled);
    if (nextEnabled) {
      const ok = await requestPermissions();
      setStatus(ok ? "Notificações ativadas." : "Permissão negada.");
      return;
    }
    await disableNotifications();
  };

  const applyProfilePreview = async (preview: DevProfilePreview) => {
    await setDevProfilePreview(preview);
    await refreshRole();
    router.replace("/");
  };

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{children}</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <Typography variant="title">Configurações</Typography>

        <View style={{ marginTop: 12, gap: 12 }}>
          <View style={{ gap: 8 }}>
            <SectionTitle>Configurações</SectionTitle>
            <SettingsRow
              icon="notifications-outline"
              iconBg="rgba(135, 120, 255, 0.14)"
              label="Notificações"
              onPress={() => setEnabled((prev) => !prev)}
              rightContent={
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: enabled ? colors.primaryBg : colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      color: enabled ? colors.primaryText : colors.text,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {enabled ? "Ligado" : "Desligado"}
                  </Text>
                </View>
              }
            />
            <SettingsRow
              icon="moon-outline"
              iconBg="rgba(96, 187, 255, 0.16)"
              label="Modo escuro"
              onPress={toggleMode}
              rightContent={
                <View
                  style={{
                    width: 42,
                    height: 24,
                    borderRadius: 999,
                    backgroundColor: mode === "dark" ? colors.primaryBg : colors.secondaryBg,
                    alignItems: mode === "dark" ? "flex-end" : "flex-start",
                    justifyContent: "center",
                    paddingHorizontal: 3,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: colors.card,
                    }}
                  />
                </View>
              }
            />
            {status ? <Text style={{ color: colors.muted }}>{status}</Text> : null}
          </View>

          {__DEV__ ? (
            <View style={{ gap: 8 }}>
              <SectionTitle>Preview de perfil (DEV)</SectionTitle>
              <View style={{ gap: 8 }}>
                <SettingsRow
                  icon="school-outline"
                  iconBg="rgba(255, 210, 150, 0.16)"
                  label="Ver como Professor"
                  onPress={() => applyProfilePreview("professor")}
                  rightContent={
                    devProfilePreview === "professor" ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
                <SettingsRow
                  icon="person-outline"
                  iconBg="rgba(150, 200, 255, 0.16)"
                  label="Ver como Aluno"
                  onPress={() => applyProfilePreview("student")}
                  rightContent={
                    devProfilePreview === "student" ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
                <SettingsRow
                  icon="briefcase-outline"
                  iconBg="rgba(140, 220, 180, 0.16)"
                  label="Ver como Coordenação (Admin)"
                  onPress={() => applyProfilePreview("admin")}
                  rightContent={
                    devProfilePreview === "admin" ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
                <SettingsRow
                  icon="sync-outline"
                  iconBg="rgba(200, 200, 200, 0.16)"
                  label="Auto (backend)"
                  onPress={() => applyProfilePreview("auto")}
                  rightContent={
                    devProfilePreview === "auto" ? (
                      <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
              </View>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <SectionTitle>Conta</SectionTitle>
            <SettingsRow
              icon="log-out-outline"
              iconBg="rgba(255, 130, 130, 0.16)"
              label="Sair"
              onPress={async () => {
                await signOut();
              }}
            />
          </View>

          <Pressable
            onPress={() => void apply(enabled)}
            style={{
              alignSelf: "center",
              paddingVertical: 10,
              paddingHorizontal: 22,
              borderRadius: 12,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Salvar alterações</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
