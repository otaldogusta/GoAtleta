import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";


import type { ClassGroup } from "../src/core/models";

import { useAuth } from "../src/auth/auth";

import { useRole } from "../src/auth/role";

import { getMyProfilePhoto, setMyProfilePhoto } from "../src/api/profile-photo";
import {
    removeMyProfilePhotoObject,
    uploadMyProfilePhoto,
} from "../src/api/profile-photo-storage";
import {
    removeStudentPhotoObject,
    uploadStudentPhoto,
} from "../src/api/student-photo-storage";
import { getClasses, updateStudentPhoto } from "../src/db/seed";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { useBiometricLock } from "../src/security/biometric-lock";
import { isBiometricsSupported, promptBiometrics } from "../src/security/biometrics";
import { useAppTheme } from "../src/ui/app-theme";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { SettingsRow } from "../src/ui/SettingsRow";
import { ShimmerBlock } from "../src/ui/Shimmer";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";


export default function ProfileScreen() {
  const { colors, mode, toggleMode } = useAppTheme();
  const { signOut, session } = useAuth();
  const { student, refresh: refreshRole } = useRole();
  const { organizations, activeOrganization, setActiveOrganizationId, devProfilePreview, setDevProfilePreview } = useOrganization();
  const {
    isEnabled: biometricsEnabled,
    isUnlocked,
    ensureUnlocked,
    setEnabled: setBiometricsEnabled,
  } = useBiometricLock();
  const router = useRouter();
  const LEGACY_PHOTO_STORAGE_KEY = "profile_photo_uri_v1";
  const NOTIFY_SETTINGS_KEY = "notify_settings_v1";
  const isWeb = Platform.OS === "web";
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [updatingBiometrics, setUpdatingBiometrics] = useState(false);
  const photoSheetStyle = useModalCardStyle({
    maxHeight: "70%",
    radius: 22,
  });


  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getClasses();
        if (alive) setClasses(data);
      } finally {
        if (alive) setLoadingClasses(false);
      }
    })();

    return () => {

      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (student) {
        if (alive) {
          setPhotoUri(student.photoUrl ?? null);
          setLoadingPhoto(false);
        }
        return;
      }
      try {
        const remotePhoto = await getMyProfilePhoto();
        if (!alive) return;
        if (remotePhoto) {
          setPhotoUri(remotePhoto);
          return;
        }

        const stored = await AsyncStorage.getItem(LEGACY_PHOTO_STORAGE_KEY);
        if (!alive) return;
        if (Platform.OS === "web" && stored?.startsWith("blob:")) {
          await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
          setPhotoUri(null);
          return;
        }
        if (stored) {
          const userId = session?.user?.id ?? "";
          if (userId) {
            const migratedPhoto = stored.startsWith("http")
              ? stored
              : await uploadMyProfilePhoto({
                  userId,
                  uri: stored,
                  contentType: "image/jpeg",
                });
            await setMyProfilePhoto(migratedPhoto);
            await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
            setPhotoUri(migratedPhoto);
            return;
          }
          setPhotoUri(stored);
          return;
        }
        setPhotoUri(null);
      } catch (error) {
        console.error("Failed to load profile photo", error);
      } finally {
        if (alive) setLoadingPhoto(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [session?.user?.id, student]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(NOTIFY_SETTINGS_KEY);
        if (!raw || !alive) return;
        const data = JSON.parse(raw) as { enabled: boolean };
        setNotificationsEnabled(Boolean(data.enabled));
      } catch (error) {
        console.error("Failed to load notification settings", error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [NOTIFY_SETTINGS_KEY]);

  const loadingProfile = loadingClasses || loadingPhoto;
  const showWorkspaceSwitcher = !student && organizations.length > 1;
  const isDevUser = session?.user?.email === "gusantinho753@gmail.com";

  const currentClass = useMemo(() => {
    if (!student || !student.classId) return null;
    return classes.find((item) => item.id === student.classId) ?? null;
  }, [classes, student?.classId]);

  const nameParts = useMemo(() => {
    const full = (
      student?.name ||
      session?.user?.user_metadata?.full_name ||
      session?.user?.email ||
      ""
    ).trim();
    if (!full) return { first: "Aluno", last: "" };
    const parts = full.split(" ");
    const first = parts[0] ?? "Aluno";
    const last = parts.slice(1).join(" ");
    return { first, last };
  }, [session?.user?.email, session?.user?.user_metadata?.full_name, student?.name]);

  const joinedLabel = useMemo(() => {
    const joinedAt = student?.createdAt ?? session?.user?.created_at;
    if (!joinedAt) return "Entrou recentemente";
    const joined = new Date(joinedAt);
    if (Number.isNaN(joined.getTime())) return "Entrou recentemente";
    const now = new Date();
    const diffDays = Math.max(0, Math.floor((now.getTime() - joined.getTime()) / 86400000));

    if (diffDays >= 365) {

      const years = Math.max(1, Math.floor(diffDays / 365));

      return years === 1 ? "1 ano" : `${years} anos`;

    }

    if (diffDays >= 30) {

      const months = Math.max(1, Math.floor(diffDays / 30));

      return months === 1 ? "1 mês" : `${months} meses`;

    }
    return diffDays <= 1 ? "Hoje" : `${diffDays} dias`;
  }, [session?.user?.created_at, student?.createdAt]);

  const profileDisplay = useMemo(() => {
    if (isDevUser && devProfilePreview && devProfilePreview !== "auto") {
      if (devProfilePreview === "professor") {
        return {
          icon: "school-outline",
          label: "Professor",
          subtitle: "Treinador",
        };
      }
      if (devProfilePreview === "admin") {
        return {
          icon: "briefcase-outline",
          label: "Coordenação",
          subtitle: "Administrador",
        };
      }
      if (devProfilePreview === "student") {
        return {
          icon: "person-outline",
          label: currentClass?.name || "Sem turma",
          subtitle: currentClass?.unit || "Sem unidade",
        };
      }
    }

    // Perfil real (auto ou usuário não-dev)
    return {
      icon: "school-outline",
      label: currentClass?.name || (student ? "Sem turma" : "Professor"),
      subtitle: currentClass?.unit || (student ? "Sem unidade" : "Treinador"),
    };
  }, [isDevUser, devProfilePreview, currentClass, student]);

  const handleOrganizationChange = useCallback(
    async (orgId: string) => {
      if (activeOrganization?.id === orgId) return;
      try {
        if (biometricsEnabled && !isUnlocked) {
          const ok = await ensureUnlocked("Confirmar troca de workspace");
          if (!ok) return;
        }
        await setActiveOrganizationId(orgId);
      } catch (error) {
        console.error("Failed to change active organization", error);
        Alert.alert("Erro", "Não foi possível trocar de workspace.");
      }
    },
    [activeOrganization?.id, biometricsEnabled, ensureUnlocked, isUnlocked, setActiveOrganizationId]
  );

  const handleToggleNotifications = useCallback(async () => {
    const nextEnabled = !notificationsEnabled;
    setNotificationsEnabled(nextEnabled);

    try {
      await AsyncStorage.setItem(
        NOTIFY_SETTINGS_KEY,
        JSON.stringify({ enabled: nextEnabled })
      );

      if (nextEnabled && !isWeb) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") {
          const result = await Notifications.requestPermissionsAsync();
          if (result.status !== "granted") {
            Alert.alert("Permissão negada", "Ative notificações nas configurações do dispositivo.");
            setNotificationsEnabled(false);
            await AsyncStorage.setItem(
              NOTIFY_SETTINGS_KEY,
              JSON.stringify({ enabled: false })
            );
          }
        }
      } else if (!nextEnabled && !isWeb) {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    } catch (error) {
      console.error("Failed to toggle notifications", error);
      Alert.alert("Erro", "Não foi possível alterar configurações de notificação.");
    }
  }, [notificationsEnabled, isWeb, NOTIFY_SETTINGS_KEY]);

  const handleToggleBiometrics = useCallback(async () => {
    if (updatingBiometrics) return;
    setUpdatingBiometrics(true);
    try {
      if (biometricsEnabled) {
        await setBiometricsEnabled(false);
        return;
      }
      const support = await isBiometricsSupported();
      if (!support.hasHardware) {
        Alert.alert("Biometria indisponível", "Este aparelho não possui hardware biométrico.");
        return;
      }
      if (!support.isEnrolled) {
        Alert.alert(
          "Biometria não configurada",
          "Cadastre sua biometria nas configurações do aparelho para ativar este recurso."
        );
        return;
      }
      const result = await promptBiometrics("Ativar biometria no GoAtleta");
      if (!result.success) return;
      await setBiometricsEnabled(true);
    } catch (error) {
      console.error("Failed to toggle biometrics", error);
      Alert.alert("Erro", "Não foi possível atualizar a biometria agora.");
    } finally {
      setUpdatingBiometrics(false);
    }
  }, [biometricsEnabled, setBiometricsEnabled, updatingBiometrics]);

  const applyProfilePreview = useCallback(async (preview: "professor" | "student" | "admin" | "auto") => {
    await setDevProfilePreview(preview);
    await refreshRole();
    router.replace("/");
  }, [setDevProfilePreview, refreshRole, router]);

  const savePhoto = async (uri: string | null) => {
    const previousPhotoUri = photoUri;
    setPhotoUri(uri);
    if (student?.id) {
      try {
        if (!uri) {
          await removeStudentPhotoObject({
            organizationId: student.organizationId ?? "",
            studentId: student.id,
          });
        }
        await updateStudentPhoto(student.id, uri);
        await refreshRole();
      } catch (error) {
        console.error("Failed to update student photo", error);
        Alert.alert("Erro", "Não foi possível salvar a foto.");
      }
      return;
    }
    try {
      if (!uri && session?.user?.id) {
        await removeMyProfilePhotoObject(session.user.id);
      }
      await setMyProfilePhoto(uri);
      await AsyncStorage.removeItem(LEGACY_PHOTO_STORAGE_KEY);
    } catch (error) {
      setPhotoUri(previousPhotoUri);
      console.error("Failed to persist profile photo", error);
      Alert.alert("Erro", "Não foi possível salvar a foto.");
    }
  };

  const pickPhoto = async (source: "camera" | "library") => {
    try {
      const currentUserId = session?.user?.id ?? "";
      if (Platform.OS === "web" && source === "camera") {
        Alert.alert("Câmera indisponível", "Use a Galeria no navegador.");
        return;
      }
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Permissão necessária", "Ative a câmera para tirar a foto.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: student?.id ? 0.7 : 0.6,
          allowsEditing: true,
          aspect: [1, 1],
          base64: false,
        });
        const asset = result.assets?.[0];
        if (!result.canceled && asset.uri) {
          const uri = student?.id
            ? await uploadStudentPhoto({
                organizationId: student.organizationId ?? "",
                studentId: student.id,
                uri: asset.uri,
                contentType: asset.mimeType,
              })
            : currentUserId
              ? await uploadMyProfilePhoto({
                  userId: currentUserId,
                  uri: asset.uri,
                  contentType: asset.mimeType,
                })
              : null;
          if (!uri && !student?.id) {
            Alert.alert("Erro", "Sua sessão expirou. Entre novamente.");
            return;
          }
          await savePhoto(uri);
        }
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permissão necessária",
          "Ative a galeria para escolher uma foto."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: student?.id ? 0.7 : 0.6,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset.uri) {
        const uri = student?.id
          ? await uploadStudentPhoto({
              organizationId: student.organizationId ?? "",
              studentId: student.id,
              uri: asset.uri,
              contentType: asset.mimeType,
            })
          : currentUserId
            ? await uploadMyProfilePhoto({
                userId: currentUserId,
                uri: asset.uri,
                contentType: asset.mimeType,
              })
            : null;
        if (!uri && !student?.id) {
          Alert.alert("Erro", "Sua sessão expirou. Entre novamente.");
          return;
        }
        await savePhoto(uri);
      }
    } catch (error) {
      console.error("Failed to pick profile photo", error);
      Alert.alert("Erro", "Não foi possível selecionar a foto.");
    } finally {
      setShowPhotoSheet(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await refreshRole();
                const data = await getClasses();
                setClasses(data);
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>

          <Pressable

            onPress={() => router.back()}

            style={{

              width: 34,

              height: 34,

              borderRadius: 17,

              backgroundColor: colors.secondaryBg,

              borderWidth: 1,

              borderColor: colors.border,

              alignItems: "center",

              justifyContent: "center",

            }}

          >

            <Ionicons name="chevron-back" size={18} color={colors.text} />

          </Pressable>

        </View>



        { loadingProfile ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <ShimmerBlock style={{ width: 120, height: 120, borderRadius: 60 }} />
              <View style={{ gap: 8 }}>
                <ShimmerBlock style={{ width: 60, height: 10, borderRadius: 6 }} />
                <ShimmerBlock style={{ width: 90, height: 14, borderRadius: 6 }} />
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <ShimmerBlock style={{ width: 180, height: 28, borderRadius: 8 }} />
              <ShimmerBlock style={{ width: 140, height: 20, borderRadius: 8 }} />
            </View>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ position: "relative" }}>
                <Pressable
                  onPress={() => setShowPhotoViewer(true)}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 60,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#000",
                    shadowOpacity: 0.12,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 7 },
                    elevation: 5,
                  }}
                >
                  { photoUri ? (
                    <Image
                      source={{ uri: photoUri }}
                      style={{ width: 96, height: 96, borderRadius: 48 }}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={{
                        width: 96,
                        height: 96,
                        borderRadius: 48,
                        backgroundColor: colors.secondaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="person" size={40} color={colors.text} />
                    </View>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => setShowPhotoSheet(true)}
                  style={{
                    position: "absolute",
                    right: 6,
                    bottom: 6,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="pencil" size={14} color={colors.text} />
                </Pressable>
              </View>
              <View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Entrou</Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {joinedLabel}
                </Text>
              </View>
            </View>
            <View>
              <Text style={{ fontSize: 30, fontWeight: "800", color: colors.text }}>
                {nameParts.first}
              </Text>
              { nameParts.last ? (
                <Text style={{ fontSize: 22, color: colors.muted }}>{nameParts.last}</Text>
              ) : null}
            </View>
          </View>
        )}




        { loadingProfile ? (
          <View style={{ gap: 8 }}>
            <ShimmerBlock style={{ width: 70, height: 12, borderRadius: 6 }} />
            <ShimmerBlock style={{ height: 56, borderRadius: 14 }} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Perfil</Text>
            <SettingsRow
              icon={profileDisplay.icon as any}
              iconBg="rgba(255, 185, 136, 0.16)"
              label={profileDisplay.label}
              subtitle={profileDisplay.subtitle}
              rightContent={<View />}
            />
          </View>
        )}

        {!loadingProfile && showWorkspaceSwitcher ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
              Workspace(s)
            </Text>
            <View
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
                {activeOrganization?.name || "Selecione um workspace"}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Você tem acesso a {organizations.length} workspace(s). Toque para alternar.
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {organizations.map((org) => {
                  const isActive = activeOrganization?.id === org.id;
                  return (
                    <Pressable
                      key={org.id}
                      onPress={() => void handleOrganizationChange(org.id)}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: isActive ? colors.primaryBg : colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: isActive ? "rgba(86, 214, 154, 0.45)" : colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: isActive ? colors.primaryText : colors.text,
                          fontSize: 13,
                          fontWeight: isActive ? "700" : "500",
                        }}
                      >
                        {org.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        ) : null}

        {!loadingProfile && isDevUser ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
              Mudar perfil (DEV)
            </Text>
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

        { loadingProfile ? (
          <>
            <ShimmerBlock style={{ width: 70, height: 12, borderRadius: 6 }} />
            <ShimmerBlock style={{ height: 56, borderRadius: 14 }} />
            <ShimmerBlock style={{ width: 60, height: 12, borderRadius: 6 }} />
            <ShimmerBlock style={{ height: 56, borderRadius: 14 }} />
          </>
        ) : (
          <>
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                Configurações
              </Text>
              <SettingsRow
                icon="notifications-outline"
                iconBg="rgba(135, 120, 255, 0.14)"
                label="Notificações"
                onPress={handleToggleNotifications}
                rightContent={
                  <View
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: notificationsEnabled ? colors.primaryBg : colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: notificationsEnabled ? colors.primaryText : colors.text,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {notificationsEnabled ? "Ligado" : "Desligado"}
                    </Text>
                  </View>
                }
              />
              {Platform.OS !== "web" ? (
                <SettingsRow
                  icon="finger-print-outline"
                  iconBg="rgba(100, 190, 255, 0.16)"
                  label="Entrar com biometria"
                  onPress={() => {
                    void handleToggleBiometrics();
                  }}
                  rightContent={
                    <View
                      style={{
                        paddingVertical: 5,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: biometricsEnabled ? colors.primaryBg : colors.secondaryBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text
                        style={{
                          color: biometricsEnabled ? colors.primaryText : colors.text,
                          fontWeight: "700",
                          fontSize: 12,
                        }}
                      >
                        {updatingBiometrics ? "..." : biometricsEnabled ? "Ligado" : "Desligado"}
                      </Text>
                    </View>
                  }
                />
              ) : null}
              {!student && Platform.OS !== "web" ? (
                <SettingsRow
                  icon="radio-outline"
                  iconBg="rgba(120, 220, 180, 0.16)"
                  label="Presença NFC"
                  subtitle="Modo presença por tag UID"
                  onPress={() => router.push("/nfc-attendance")}
                  rightContent={<Ionicons name="chevron-forward" size={16} color={colors.muted} />}
                />
              ) : null}
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
            </View>

            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Conta</Text>
              <SettingsRow
                icon="log-out-outline"
                iconBg="rgba(255, 130, 130, 0.16)"
                label="Sair"
                onPress={async () => {
                  await signOut();
                }}
                rightContent={<View />}
              />
            </View>
          </>
        )}
      </ScrollView>
      <Modal
        visible={showPhotoViewer}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setShowPhotoViewer(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 10,
            }}
          >
            <Pressable
              onPress={() => setShowPhotoViewer(false)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="chevron-back" size={18} color="#fff" />
            </Pressable>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
              Foto do perfil
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => {
                  setShowPhotoViewer(false);
                  setShowPhotoSheet(true);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setShowPhotoViewer(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="share-social-outline" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            { photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="contain"
              />
            ) : (
              <View
                style={{
                  width: 220,
                  height: 220,
                  borderRadius: 110,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="person" size={96} color="#fff" />
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <ModalSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        cardStyle={photoSheetStyle}
        position="center"
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Pressable
            onPress={() => setShowPhotoSheet(false)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Foto do perfil</Text>
          <View style={{ width: 36, height: 36 }} />
        </View>
        <View style={{ gap: 12 }}>
          {[
            { label: "Câmera", icon: "camera-outline", value: "camera" },
            { label: "Galeria", icon: "images-outline", value: "library" },
          ].map((item) => (
            <Pressable
              key={item.label}
              onPress={() => pickPhoto(item.value as "camera" | "library")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: colors.secondaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name={item.icon as any} size={18} color={colors.text} />
              </View>
              <Text style={{ color: colors.text, fontWeight: "600" }}>{item.label}</Text>
            </Pressable>
          ))}
          {photoUri ? (
            <Pressable
              onPress={() => {
                void savePhoto(null);
                setShowPhotoSheet(false);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                paddingHorizontal: 12,
                borderRadius: 14,
                backgroundColor: colors.dangerSolidBg,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(255,255,255,0.18)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash" size={18} color={colors.dangerSolidText} />
              </View>
              <Text style={{ color: colors.dangerSolidText, fontWeight: "600" }}>
                Remover foto
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}








