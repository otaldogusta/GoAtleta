import { Text, TextInput, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  colors: ThemeColors;
  isVisible: boolean;
  isWideLayout: boolean;
  isEditing: boolean;
  videoUrl: string;
  title: string;
  source: string;
  notes: string;
  metaStatus: string;
  metaLoading: boolean;
  canSave: boolean;
  onVideoUrlChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function ExerciseLinkForm({
  colors,
  isVisible,
  isWideLayout,
  isEditing,
  videoUrl,
  title,
  source,
  notes,
  metaStatus,
  metaLoading,
  canSave,
  onVideoUrlChange,
  onTitleChange,
  onSourceChange,
  onNotesChange,
  onSave,
  onCancel,
}: Props) {
  if (!isVisible && !isWideLayout) {
    return null;
  }

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Link manual
        </Text>
        <Text style={{ color: colors.muted }}>
          Salve uma referência externa.
        </Text>
      </View>

      <TextInput
        placeholder="Cole o link do vídeo"
        placeholderTextColor={colors.placeholder}
        value={videoUrl}
        onChangeText={onVideoUrlChange}
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <TextInput
        placeholder="Título do exercício"
        placeholderTextColor={colors.placeholder}
        value={title}
        onChangeText={onTitleChange}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <TextInput
        placeholder="Fonte"
        placeholderTextColor={colors.placeholder}
        value={source}
        onChangeText={onSourceChange}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <TextInput
        placeholder="Observações"
        placeholderTextColor={colors.placeholder}
        value={notes}
        onChangeText={onNotesChange}
        multiline
        textAlignVertical="top"
        style={{
          minHeight: 88,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      {metaStatus ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>{metaStatus}</Text>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onSave}
          style={{
            flex: 1,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: canSave ? colors.primaryBg : colors.primaryDisabledBg,
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {metaLoading
              ? "Lendo link..."
              : isEditing
                ? "Salvar alterações"
                : "Salvar exercício"}
          </Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          style={{
            flex: 1,
            minHeight: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
            Cancelar
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
