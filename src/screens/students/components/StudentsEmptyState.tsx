import { memo } from "react";
import { Text, View } from "react-native";

import { radius } from "../../../theme/tokens";
import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";

type StudentsEmptyStateProps = {
  unitFilter: string;
  hasSearch: boolean;
};

export const StudentsEmptyState = memo(function StudentsEmptyState(
  props: StudentsEmptyStateProps
) {
  const { colors } = useAppTheme();

  return <StudentsEmptyStateContent colors={colors} {...props} />;
});

export function buildStudentsEmptyStateDescription({
  unitFilter,
  hasSearch,
}: StudentsEmptyStateProps) {
  if (hasSearch) return "Nenhum aluno corresponde à busca.";
  if (unitFilter !== "Todas") return "Nenhum aluno nesta unidade";
  return "Comece adicionando alunos";
}

export function StudentsEmptyStateContent({
  colors,
  unitFilter,
  hasSearch,
}: StudentsEmptyStateProps & { colors: ThemeColors }) {
  return (
    <View
      style={{
        padding: 16,
        borderRadius: radius.container,
        backgroundColor: colors.backgroundSubtle,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        alignItems: "center",
        gap: 8,
      }}
    >
      <Text style={{ color: colors.textPrimary, fontWeight: "900" }}>
        Nenhum aluno encontrado
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {buildStudentsEmptyStateDescription({ unitFilter, hasSearch })}
      </Text>
    </View>
  );
}
