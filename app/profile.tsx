import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Text, View } from "react-native";
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
import { useAppTheme } from "../src/ui/app-theme";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { SettingsRow } from "../src/ui/SettingsRow";
import { ShimmerBlock } from "../src/ui/Shimmer";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";


export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { signOut, session } = useAuth();
  const { student, refresh: refreshRole } = useRole();
  const { organizations, activeOrganization, setActiveOrganizationId } = useOrganization();
  const router = useRouter();
  const LEGACY_PHOTO_STORAGE_KEY = "profile_photo_uri_v1";
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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

  const loadingProfile = loadingClasses || loadingPhoto;
  const showWorkspaceSwitcher = !student && organizations.length > 1;

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

      return months === 1 ? "1 m?s" : `${months} meses`;

    }
    return diffDays <= 1 ? "Hoje" : `${diffDays} dias`;
  }, [session?.user?.created_at, student?.createdAt]);

  const handleOrganizationChange = useCallback(
    async (orgId: string) => {
      if (activeOrganization?.id === orgId) return;
      try {
        await setActiveOrganizationId(orgId);
      } catch (error) {
        console.error("Failed to change active organization", error);
        Alert.alert("Erro", "N?o foi poss?vel trocar de workspace.");
      }
    },
    [activeOrganization?.id, setActiveOrganizationId]
  );

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
        Alert.alert("Erro", "N?o foi poss?vel salvar a foto.");
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
      Alert.alert("Erro", "N?o foi poss?vel salvar a foto.");
    }
  };

  const pickPhoto = async (source: "camera" | "library") => {
    try {
      const currentUserId = session?.user?.id ?? "";
      if (Platform.OS === "web" && source === "camera") {
        Alert.alert("C?mera indispon?vel", "Use a Galeria no navegador.");
        return;
      }
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Permiss?o necess?ria", "Ative a c?mera para tirar a foto.");
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
            Alert.alert("Erro", "Sua sess?o expirou. Entre novamente.");
            return;
          }
          await savePhoto(uri);
        }
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permiss?o necess?ria",
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
          Alert.alert("Erro", "Sua sess?o expirou. Entre novamente.");
          return;
        }
        await savePhoto(uri);
      }
    } catch (error) {
      console.error("Failed to pick profile photo", error);
      Alert.alert("Erro", "N?o foi poss?vel selecionar a foto.");
    } finally {
      setShowPhotoSheet(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>

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
              icon="school-outline"
              iconBg="rgba(255, 185, 136, 0.16)"
              label={currentClass?.name || (student ? "Sem turma" : "Professor")}
              subtitle={currentClass?.unit || (student ? "Sem unidade" : "Treinador")}
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
                Voc? tem acesso a {organizations.length} workspace(s). Toque para alternar.
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
                Configura??es
              </Text>
              <SettingsRow
                icon="settings-outline"
                iconBg="rgba(135, 120, 255, 0.14)"
                label="Abrir configura??es"
                onPress={() => router.push({ pathname: "/notifications" })}
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
            { label: "C?mera", icon: "camera-outline", value: "camera" },
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








