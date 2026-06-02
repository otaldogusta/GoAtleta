import { memo } from "react";
import { Text, View } from "react-native";

import { useAppTheme, type ThemeColors } from "../../../ui/app-theme";

type StudentsListHeaderProps = {
  resultCount: number;
};

export const StudentsListHeader = memo(function StudentsListHeader(
  props: StudentsListHeaderProps
) {
  const { colors } = useAppTheme();

  return <StudentsListHeaderContent colors={colors} {...props} />;
});

export function StudentsListHeaderContent({
  colors,
  resultCount,
}: StudentsListHeaderProps & { colors: ThemeColors }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary }}>
        Alunos
      </Text>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>
        {resultCount} resultado(s)
      </Text>
    </View>
  );
}
