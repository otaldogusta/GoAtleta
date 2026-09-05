import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type StudentPhotoViewerModalProps = {
  visible: boolean;
  name?: string | null;
  uri?: string | null;
  loading?: boolean;
  onClose: () => void;
};

export type StudentPhotoViewerState = "photo" | "loading" | "empty";

export function resolveStudentPhotoViewerState({
  uri,
  loading,
  imageFailed,
}: {
  uri?: string | null;
  loading: boolean;
  imageFailed: boolean;
}): StudentPhotoViewerState {
  if (uri && !imageFailed) return "photo";
  if (loading && !imageFailed) return "loading";
  return "empty";
}

export function StudentPhotoViewerModal(props: StudentPhotoViewerModalProps) {
  return <StudentPhotoViewerContent key={props.uri ?? ""} {...props} />;
}

function StudentPhotoViewerContent({
  visible,
  name,
  uri,
  loading = false,
  onClose,
}: StudentPhotoViewerModalProps) {
  const { colors } = useAppTheme();
  const [imageFailed, setImageFailed] = useState(false);
  if (!visible && imageFailed) setImageFailed(false);

const viewerState = resolveStudentPhotoViewerState({ uri, loading, imageFailed });

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          style={{
            minHeight: 58,
            flexDirection: "row",
            alignItems: "center",
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: colors.background,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar foto"
            onPress={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: colors.secondaryBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              paddingHorizontal: 12,
              color: colors.text,
              fontWeight: "700",
              fontSize: 16,
              textAlign: "center",
            }}
          >
            {name ? `Foto de ${name}` : "Foto do aluno"}
          </Text>
          <View style={{ width: 38, height: 38 }} />
        </View>
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.background,
          }}
        >
          {viewerState === "photo" ? (
            <Image
              source={{ uri: uri! }}
              style={{ width: "100%", height: "100%" }}
              contentFit="contain"
              cachePolicy="memory-disk"
              onError={() => setImageFailed(true)}
            />
          ) : viewerState === "loading" ? (
            <View style={{ alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={colors.primaryBg} />
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                Carregando foto...
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 56,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="profile" size={54} color={colors.muted} />
              </View>
              <Text style={{ color: colors.muted, fontWeight: "700" }}>
                Sem foto
              </Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
