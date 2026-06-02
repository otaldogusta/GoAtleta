import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { TextInput, View } from "react-native";

import { radius } from "../../../theme/tokens";
import { Pressable } from "../../../ui/Pressable";
import { UnitFilterBar } from "../../../ui/UnitFilterBar";
import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";

type StudentsSearchFiltersPanelProps = {
  studentsUnitOptions: string[];
  studentsUnitFilter: string;
  onStudentsUnitFilterChange: (unit: string) => void;
  studentsSearch: string;
  onStudentsSearchChange: (search: string) => void;
  placeholder?: string;
};

export const StudentsSearchFiltersPanel = memo(function StudentsSearchFiltersPanel(
  props: StudentsSearchFiltersPanelProps
) {
  const { colors } = useAppTheme();

  return <StudentsSearchFiltersPanelContent colors={colors} {...props} />;
});

export function StudentsSearchFiltersPanelContent({
  colors,
  studentsUnitOptions,
  studentsUnitFilter,
  onStudentsUnitFilterChange,
  studentsSearch,
  onStudentsSearchChange,
  placeholder = "Buscar aluno, responsável, turma ou unidade",
}: StudentsSearchFiltersPanelProps & { colors: ThemeColors }) {
  return (
    <View style={{ gap: 12 }}>
      <UnitFilterBar
        units={studentsUnitOptions}
        selectedUnit={studentsUnitFilter}
        onSelectUnit={onStudentsUnitFilterChange}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: radius.card,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
        }}
      >
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          placeholder={placeholder}
          value={studentsSearch}
          onChangeText={onStudentsSearchChange}
          placeholderTextColor={colors.placeholder}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 13 }}
        />
        <Pressable
          onPress={() => onStudentsSearchChange("")}
          onContextMenu={(event: any) => event.preventDefault()}
          disabled={!studentsSearch}
          style={{
            width: 26,
            height: 26,
            borderRadius: radius.full,
            backgroundColor: colors.backgroundSubtle,
            alignItems: "center",
            justifyContent: "center",
            opacity: studentsSearch ? 1 : 0,
          }}
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}
