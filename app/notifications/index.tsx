import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../src/auth/auth";
import { useRole } from "../../src/auth/role";
import { resolveEffectiveProfile } from "../../src/core/effective-profile";
import { type DevProfilePreview } from "../../src/dev/profile-preview";
import {
  AppNotification,
  clearNotifications,
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "../../src/notificationsInbox";
import { getNotificationsModule, isExpoGo } from "../../src/push/notificationRuntime";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { Pressable } from "../../src/ui/Pressable";
import { SettingsRow } from "../../src/ui/SettingsRow";
import { Typography } from "../../src/ui/Typography";
import { useAppTheme } from "../../src/ui/app-theme";
import { GoAtletaIcon } from "../../src/ui/icon-registry";

const STORAGE_KEY = "notify_settings_v1";
const isWeb = Platform.OS === "web";
type ProfilePreviewId = Exclude<DevProfilePreview, "auto">;

const profilePreviewRoutes: Record<ProfilePreviewId, string> = {
  professor: "/prof/home",
  admin: "/coord/dashboard",
  student: "/student/home",
};

export default function NotificationsScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { signOut } = useAuth();
  const { role: userRole, refresh: refreshRole } = useRole();
  const { activeOrganization, devProfilePreview, setDevProfilePreview } = useOrganization();
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [items, setItems] = useState<AppNotification[]>([]);

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

  useEffect(() => {
    let alive = true;
    (async () => {
      const nextItems = await getNotifications();
      if (!alive) return;
      setItems(nextItems);
      await markAllRead();
      if (alive) {
        const readAt = new Date().toISOString();
        setItems(nextItems.map((item) => ({ ...item, read: true, readAt: item.readAt ?? readAt })));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const requestPermissions = async () => {
    if (isWeb || isExpoGo) return false;
    const Notifications = getNotificationsModule();
    if (!Notifications) return false;
    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return true;
    const result = await Notifications.requestPermissionsAsync();
    return result.status === "granted";
  };

  const disableNotifications = async () => {
    if (isWeb || isExpoGo) {
      setStatus("Notificações não são suportadas no navegador.");
      return;
    }
    const Notifications = getNotificationsModule();
    if (!Notifications) {
      setStatus("Notificações indisponíveis neste ambiente.");
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

  const defaultProfile = resolveEffectiveProfile({
    role: userRole,
    orgRoleLevel: activeOrganization?.role_level,
  });
  const defaultProfilePreview: ProfilePreviewId =
    defaultProfile === "admin"
      ? "admin"
      : defaultProfile === "student"
        ? "student"
        : "professor";
  const selectedProfilePreview: ProfilePreviewId =
    devProfilePreview === "auto" ? defaultProfilePreview : devProfilePreview;

  const applyProfilePreview = async (preview: ProfilePreviewId) => {
    await setDevProfilePreview(preview);
    await refreshRole();
    router.replace(profilePreviewRoutes[preview] as never);
  };

  const SectionTitle = ({ children }: { children: string }) => (
    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{children}</Text>
  );

  const formatTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <Typography variant="title">Notificações</Typography>

          <View style={{ marginTop: 12, gap: 12 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
              <SectionTitle>Notificações</SectionTitle>
              {items.length ? (
                <Pressable
                  onPress={() => {
                    void (async () => {
                      await clearNotifications();
                      setItems([]);
                    })();
                  }}
                >
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>Limpar</Text>
                </Pressable>
              ) : null}
            </View>

            {items.length === 0 ? (
              <View
                style={{
                  padding: 14,
                  borderRadius: 14,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Sem notificações</Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>
                  Treinos, avisos e atualizações vão aparecer aqui.
                </Text>
              </View>
            ) : (
              items.slice(0, 12).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    void (async () => {
                      await markNotificationRead(item.id);
                      if (item.actionUrl) router.push(item.actionUrl as never);
                    })();
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: item.read ? colors.border : colors.primaryBg,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                  <Text style={{ color: colors.text }}>{item.body}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {formatTime(item.createdAt)}
                  </Text>
                </Pressable>
              ))
            )}
          </View>

          <View style={{ gap: 8 }}>
            <SectionTitle>Configurações</SectionTitle>
            <SettingsRow
              icon="notifications"
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
              icon="darkMode"
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
                  icon="professor"
                  iconBg="rgba(255, 210, 150, 0.16)"
                  label="Ver como Professor"
                  onPress={() => applyProfilePreview("professor")}
                  rightContent={
                    selectedProfilePreview === "professor" ? (
                      <GoAtletaIcon name="checkmarkCircle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
                <SettingsRow
                  icon="student"
                  iconBg="rgba(150, 200, 255, 0.16)"
                  label="Ver como Aluno"
                  onPress={() => applyProfilePreview("student")}
                  rightContent={
                    selectedProfilePreview === "student" ? (
                      <GoAtletaIcon name="checkmarkCircle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
                <SettingsRow
                  icon="coordination"
                  iconBg="rgba(140, 220, 180, 0.16)"
                  label="Ver como Coordenação (Admin)"
                  onPress={() => applyProfilePreview("admin")}
                  rightContent={
                    selectedProfilePreview === "admin" ? (
                      <GoAtletaIcon name="checkmarkCircle" size={20} color={colors.primaryBg} />
                    ) : undefined
                  }
                />
              </View>
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <SectionTitle>Conta</SectionTitle>
            <SettingsRow
              icon="logout"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
