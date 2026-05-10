import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  colors: ThemeColors;
  onBack: () => void;
  onToggleForm: () => void;
  isFormExpanded: boolean;
  showToggleAction?: boolean;
};

export function ExerciseLibraryHeader({
  colors,
  onBack,
  onToggleForm,
  isFormExpanded,
  showToggleAction = true,
}: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}
    >
      <View style={{ flex: 1, gap: 6 }}>
        <Pressable
          onPress={onBack}
          style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={{ fontSize: 28, fontWeight: "700", color: colors.text }}>
            Exercícios
          </Text>
        </Pressable>
        <Text style={{ color: colors.muted }}>
          Revise, gere e libere demonstrações para treinos e PDFs.
        </Text>
      </View>

      {showToggleAction ? (
        <Pressable
          onPress={onToggleForm}
          style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 14,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text style={{ color: colors.secondaryText, fontWeight: "700" }}>
          {isFormExpanded ? "Fechar formulário" : "+ Novo link"}
        </Text>
      </Pressable>
      ) : null}
    </View>
  );
}
