import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Text,
  View
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Typography } from "../../src/ui/Typography";
import { Button } from "../../src/ui/Button";
import { useAppTheme } from "../../src/ui/app-theme";
import { useAuth } from "../../src/auth/auth";
import { getRoleOverride, setRoleOverride } from "../../src/auth/role-override";
import { useRole } from "../../src/auth/role";

const STORAGE_KEY = "notify_settings_v1";
const isWeb = Platform.OS === "web";

export default function NotificationsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { signOut } = useAuth();
  const { refresh: refreshRole } = useRole();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [rolePreview, setRolePreview] = useState<"trainer" | "student" | null>(null);

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

  useEffect(() => {
    if (!__DEV__) return;
    let alive = true;
    (async () => {
      const override = await getRoleOverride();
      if (!alive) return;
      setRolePreview(override);
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
      setStatus("Notificações não sao suportadas no navegador.");
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
        setStatus("Notificações ativadas.");
      } else {
        setStatus("Permissão negada.");
      }
    } else {
      await disableNotifications();
    }
  };

  const applyRolePreview = async (next: "trainer" | "student" | null) => {
    await setRoleOverride(next);
    setRolePreview(next);
    await refreshRole();
    router.replace("/");
  };

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{children}</Text>
  );

  const SettingsRow = ({
    icon,
    iconBg,
    label,
    onPress,
    rightContent,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    label: string;
    onPress?: () => void;
    rightContent?: React.ReactNode;
  }) => (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: iconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={18} color={colors.text} />
        </View>
        <Text style={{ color: colors.text, fontWeight: "600" }}>{label}</Text>
      </View>
      {rightContent ? (
        rightContent
      ) : (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text} />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
                onPress={() => applyRolePreview("trainer")}
                rightContent={
                  rolePreview === "trainer" ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                  ) : undefined
                }
              />
              <SettingsRow
                icon="person-outline"
                iconBg="rgba(150, 200, 255, 0.16)"
                label="Ver como Aluno"
                onPress={() => applyRolePreview("student")}
                rightContent={
                  rolePreview === "student" ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryBg} />
                  ) : undefined
                }
              />
              <SettingsRow
                icon="sync-outline"
                iconBg="rgba(200, 200, 200, 0.16)"
                label="Auto (backend)"
                onPress={() => applyRolePreview(null)}
                rightContent={
                  rolePreview == null ? (
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
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Salvar alterações
          </Text>
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


