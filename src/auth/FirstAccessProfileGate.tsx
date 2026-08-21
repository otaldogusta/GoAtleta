import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getMyProfilePhoto, setMyProfilePhoto } from "../api/profile-photo";
import { uploadMyProfilePhoto } from "../api/profile-photo-storage";
import {
  getFirstAccessProfileNameValidationError,
  suggestProfileNameFromEmail,
} from "../core/profile-name";
import { useAuth } from "./auth";
import { useAppTheme } from "../ui/app-theme";
import { GoAtletaBrandMark } from "../ui/GoAtletaBrand";
import { GoAtletaIcon } from "../ui/icon-registry";
import { ModalSheet } from "../ui/ModalSheet";
import { Pressable } from "../ui/Pressable";
import { useModalCardStyle } from "../ui/use-modal-card-style";
import { WebCameraCaptureModal } from "../ui/WebCameraCaptureModal";

export function FirstAccessProfileGate() {
  const { colors, mode } = useAppTheme();
  const { session, updateProfileName } = useAuth();
  const email = session?.user?.email ?? "";
  const [name, setName] = useState(() => suggestProfileNameFromEmail(email));
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [avatarHovered, setAvatarHovered] = useState(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const photoSheetStyle = useModalCardStyle({
    maxWidth: 380,
    padding: 18,
    radius: 20,
  });
  const validationError = useMemo(
    () => getFirstAccessProfileNameValidationError(name, email),
    [email, name]
  );
  const canContinue = !validationError && !saving && !photoBusy;

  useEffect(() => {
    let active = true;
    void getMyProfilePhoto()
      .then((uri) => {
        if (!active) return;
        setPhotoUri(uri);
        setPhotoLoaded(!uri);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingPhoto(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const persistPhoto = async (uri: string, mimeType?: string | null) => {
    const userId = session?.user?.id ?? "";
    if (!userId || photoBusy) return;
    setPhotoBusy(true);
    setError("");
    try {
      const uploadedUri = await uploadMyProfilePhoto({
        userId,
        uri,
        contentType: mimeType,
      });
      await setMyProfilePhoto(uploadedUri);
      setPhotoLoaded(false);
      setPhotoUri(uploadedUri);
      setShowPhotoSheet(false);
    } catch (photoError) {
      const message = photoError instanceof Error ? photoError.message : "";
      setError(message || "Não foi possível salvar a foto.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const choosePhoto = async (source: "camera" | "library") => {
    if (source === "camera") {
      setShowPhotoSheet(false);
      setShowCamera(true);
      return;
    }

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permissão necessária", "Ative a galeria para escolher uma foto.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: true,
        aspect: [1, 1],
        base64: false,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset?.uri) {
        await persistPhoto(asset.uri, asset.mimeType);
      }
    } catch {
      setError("Não foi possível selecionar a foto.");
    }
  };

  const saveName = async () => {
    setNameTouched(true);
    if (!canContinue) return;
    setSaving(true);
    setError("");
    try {
      await updateProfileName(name);
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "";
      setError(message || "Não foi possível salvar o nome.");
    } finally {
      setSaving(false);
    }
  };

  const showAvatarAction = avatarHovered;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 18 }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.card,
            paddingHorizontal: 24,
            paddingVertical: 26,
            alignItems: "center",
            gap: 18,
          }}
        >
          <GoAtletaBrandMark
            size={42}
            tone={mode === "dark" ? "light" : "navy"}
            decorative
          />

          <Text
            style={{
              color: colors.text,
              fontSize: 27,
              lineHeight: 32,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            Como quer ser chamado?
          </Text>

          <View style={{ alignItems: "center", gap: 7 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photoUri ? "Alterar foto" : "Adicionar foto"}
              onHoverIn={() => setAvatarHovered(true)}
              onHoverOut={() => setAvatarHovered(false)}
              onPress={() => setShowPhotoSheet(true)}
              suppressWebHoverFeedback
              style={{
                width: 104,
                height: 104,
                borderRadius: 52,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: avatarHovered ? colors.primaryBg : colors.border,
                backgroundColor: colors.inputBg,
              }}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  contentFit="cover"
                  transition={120}
                  onLoadStart={() => setPhotoLoaded(false)}
                  onLoad={() => setPhotoLoaded(true)}
                  onError={() => setPhotoLoaded(true)}
                  style={{ width: "100%", height: "100%" }}
                />
              ) : (
                <GoAtletaIcon name="personSolid" size={44} color={colors.muted} />
              )}
              {loadingPhoto || (photoUri && !photoLoaded) || photoBusy ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(5, 12, 24, 0.42)",
                  }}
                >
                  <ActivityIndicator color="#ffffff" />
                </View>
              ) : showAvatarAction ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(5, 12, 24, 0.56)",
                  }}
                >
                  <GoAtletaIcon name="camera" size={25} color={photoUri ? "#ffffff" : colors.text} />
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowPhotoSheet(true)}
              suppressWebHoverFeedback
              disableWebPressScale
              style={{ paddingHorizontal: 8, paddingVertical: 3 }}
            >
              <Text style={{ color: colors.primaryBg, fontSize: 13, fontWeight: "700" }}>
                {photoUri ? "Alterar foto" : "Adicionar foto"}
              </Text>
            </Pressable>
          </View>

          <View style={{ width: "100%", gap: 7 }}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Nome</Text>
            <View
              style={{
                minHeight: 50,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: error || validationError ? colors.dangerBorder : colors.border,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 14,
                justifyContent: "center",
              }}
            >
              <TextInput
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setError("");
                }}
                autoCapitalize="words"
                autoCorrect={false}
                onBlur={() => setNameTouched(true)}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={() => void saveName()}
                placeholder="Seu nome"
                placeholderTextColor={colors.placeholder}
                style={{
                  minHeight: 48,
                  color: colors.inputText,
                  fontSize: 16,
                  borderRadius: 0,
                  outlineStyle: "none",
                } as never}
              />
            </View>
            {error || (nameTouched && validationError) ? (
              <Text accessibilityRole="alert" style={{ color: colors.dangerText, fontSize: 12 }}>
                {error || validationError}
              </Text>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canContinue}
            onPress={() => void saveName()}
            style={{
              width: "100%",
              minHeight: 50,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
              opacity: canContinue ? 1 : 0.55,
            }}
          >
            {saving ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={{ color: colors.primaryText, fontSize: 16, fontWeight: "800" }}>
                Continuar
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ModalSheet
        visible={showPhotoSheet}
        onClose={() => setShowPhotoSheet(false)}
        cardStyle={photoSheetStyle}
        position="center"
        backdropOpacity={0.68}
        overlayZIndex={5100}
      >
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Foto do perfil</Text>
            <Pressable
              accessibilityLabel="Fechar"
              onPress={() => setShowPhotoSheet(false)}
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
          {([
            { label: "Câmera", icon: "camera" as const, value: "camera" as const },
            { label: "Galeria", icon: "gallery" as const, value: "library" as const },
          ]).map((item) => (
            <Pressable
              key={item.value}
              onPress={() => void choosePhoto(item.value)}
              style={{
                minHeight: 52,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <GoAtletaIcon name={item.icon} size={20} color={colors.text} />
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ModalSheet>

      <WebCameraCaptureModal
        visible={showCamera}
        captureQuality={0.7}
        initialFacing="front"
        title="Foto do perfil"
        subtitle=""
        onClose={() => setShowCamera(false)}
        onCapture={({ uri, mimeType }) => persistPhoto(uri, mimeType)}
      />
    </SafeAreaView>
  );
}
