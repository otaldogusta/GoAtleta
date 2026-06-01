import { Text, TextInput, View } from "react-native";

import { ptBR } from "../../../constants/copy/pt-br";
import { Pressable } from "../../../ui/Pressable";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  colors: ThemeColors;
  label: string;
  placeholder: string;
  objective: string;
  fallbackObjective: string;
  guideline: string;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  onChangeDraft: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
};

export function SessionObjectiveCard({
  colors,
  label,
  placeholder,
  objective,
  fallbackObjective,
  guideline,
  isEditing,
  draft,
  isSaving,
  onChangeDraft,
  onStartEdit,
  onSave,
  onCancel,
}: Props) {
  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 6,
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
      {isEditing ? (
        <TextInput
          value={draft}
          onChangeText={onChangeDraft}
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          multiline
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
            padding: 10,
            minHeight: 72,
            textAlignVertical: "top",
            fontSize: 15,
            fontWeight: "700",
          }}
        />
      ) : (
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
          {objective || fallbackObjective}
        </Text>
      )}
      {!isEditing && guideline ? (
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {guideline}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {isEditing ? (
          <>
            <Pressable
              onPress={onSave}
              disabled={isSaving}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.primaryBg,
                opacity: isSaving ? 0.65 : 1,
              }}
            >
              <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>
                {isSaving ? ptBR.session.objectiveActions.saving : ptBR.session.objectiveActions.save}
              </Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={isSaving}
              style={{
                paddingVertical: 7,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: colors.secondaryBg,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: isSaving ? 0.65 : 1,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                {ptBR.common.actions.cancel}
              </Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            onPress={onStartEdit}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
              {ptBR.session.objectiveActions.edit}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
