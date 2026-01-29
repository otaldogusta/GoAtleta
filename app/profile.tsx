import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import AsyncStorage from "@react-native-async-storage/async-storage";


import type { ClassGroup } from "../src/core/models";

import { useAuth } from "../src/auth/auth";

import { useRole } from "../src/auth/role";

import { getClasses } from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { ModalSheet } from "../src/ui/ModalSheet";
import { useModalCardStyle } from "../src/ui/use-modal-card-style";
import { ShimmerBlock } from "../src/ui/Shimmer";


export default function ProfileScreen() {
  const { colors } = useAppTheme();
  const { signOut, session } = useAuth();
  const { student } = useRole();
  const router = useRouter();
  const PHOTO_STORAGE_KEY = "profile_photo_uri_v1";
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
      try {
        const stored = await AsyncStorage.getItem(PHOTO_STORAGE_KEY);
        if (!alive) return;
        if (Platform.OS === "web" && stored?.startsWith("blob:")) {
          await AsyncStorage.removeItem(PHOTO_STORAGE_KEY);
          setPhotoUri(null);
          return;
        }
        setPhotoUri(stored || null);
      } catch (error) {
        console.error("Failed to load profile photo", error);
      } finally {
        if (alive) setLoadingPhoto(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadingProfile = loadingClasses || loadingPhoto;

  const currentClass = useMemo(() => {
    if (!student?.classId) return null;
    return classes.find((item) => item.id === student.classId) ?? null;
  }, [classes, student?.classId]);

  const nameParts = useMemo(() => {
    const full = (
      student?.name ??
      session?.user?.user_metadata?.full_name ??
      session?.user?.email ??
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

      return years == 1 ? "1 ano" : `${years} anos`;

    }

    if (diffDays >= 30) {

      const months = Math.max(1, Math.floor(diffDays / 30));

      return months == 1 ? "1 m\u00eas" : `${months} meses`;

    }
    return diffDays <= 1 ? "Hoje" : `${diffDays} dias`;
  }, [session?.user?.created_at, student?.createdAt]);

  const savePhoto = async (uri: string | null) => {
    setPhotoUri(uri);
    try {
      if (uri) {
        await AsyncStorage.setItem(PHOTO_STORAGE_KEY, uri);
      } else {
        await AsyncStorage.removeItem(PHOTO_STORAGE_KEY);
      }
    } catch (error) {
      console.error("Failed to persist profile photo", error);
    }
  };

  const pickPhoto = async (source: "camera" | "library") => {
    try {
      if (Platform.OS === "web" && source === "camera") {
        Alert.alert("C\u00e2mera indispon\u00edvel", "Use a Galeria no navegador.");
        return;
      }
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert("Permiss\u00e3o necess\u00e1ria", "Ative a c\u00e2mera para tirar a foto.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 1,
          allowsEditing: true,
          aspect: [1, 1],
          base64: Platform.OS === "web",
        });
        const asset = result.assets?.[0];
        if (!result.canceled && asset?.uri) {
          let uri = asset.uri;
          if (Platform.OS === "web") {
            if (asset.base64) {
              const mime = asset.mimeType ?? "image/jpeg";
              uri = `data:${mime};base64,${asset.base64}`;
            } else {
              const response = await fetch(asset.uri);
              const blob = await response.blob();
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(String(reader.result));
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              uri = dataUrl;
            }
          }
          await savePhoto(uri);
        }
        return;
      }

      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert(
          "Permiss\u00e3o necess\u00e1ria",
          "Ative a galeria para escolher uma foto."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
        base64: Platform.OS === "web",
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        let uri = asset.uri;
        if (Platform.OS === "web") {
          if (asset.base64) {
            const mime = asset.mimeType ?? "image/jpeg";
            uri = `data:${mime};base64,${asset.base64}`;
          } else {
            const response = await fetch(asset.uri);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(String(reader.result));
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            uri = dataUrl;
          }
        }
        await savePhoto(uri);
      }
    } catch (error) {
      console.error("Failed to pick profile photo", error);
      Alert.alert("Erro", "N\u00e3o foi poss\u00edvel selecionar a foto.");
    } finally {
      setShowPhotoSheet(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

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



        {loadingProfile ? (
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
                  {photoUri ? (
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
              {nameParts.last ? (
                <Text style={{ fontSize: 22, color: colors.muted }}>{nameParts.last}</Text>
              ) : null}
            </View>
          </View>
        )}




        {loadingProfile ? (
          <View style={{ gap: 8 }}>
            <ShimmerBlock style={{ width: 70, height: 12, borderRadius: 6 }} />
            <ShimmerBlock style={{ height: 56, borderRadius: 14 }} />
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Perfil</Text>
            <View
              style={{
                paddingVertical: 10,
                paddingHorizontal: 8,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: "rgba(255, 185, 136, 0.16)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="school-outline" size={18} color={colors.text} />
                </View>
                <View>
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {currentClass?.name || (student ? "Sem turma" : "Professor")}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {currentClass?.unit || (student ? "Sem unidade" : "Treinador")}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}


        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
            Configurações
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: "/notifications" })}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "rgba(135, 120, 255, 0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="settings-outline" size={18} color={colors.text} />
              </View>
              <Text style={{ color: colors.text, fontWeight: "600" }}>
                Abrir configurações
              </Text>
            </View>
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
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>Conta</Text>
          <Pressable
            onPress={async () => {
              await signOut();
            }}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255, 130, 130, 0.16)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.text} />
            </View>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Sair</Text>
          </Pressable>
        </View>
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
            {photoUri ? (
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
            { label: "C\u00e2mera", icon: "camera-outline", value: "camera" },
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
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}








