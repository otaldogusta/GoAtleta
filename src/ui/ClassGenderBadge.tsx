import { Text, View } from "react-native";
import { useAppTheme } from "./app-theme";
import type { ClassGender } from "../core/models";

type BadgeSize = "sm" | "md";

const labelByGender: Record<ClassGender, string> = {
  masculino: "Masculino",
  feminino: "Feminino",
  misto: "Misto",
};

export function ClassGenderBadge({
  gender,
  size = "sm",
}: {
  gender: ClassGender;
  size?: BadgeSize;
}) {
  const { colors } = useAppTheme();
  if (!gender) return null;
  const resolved =
    gender === "masculino" || gender === "feminino" ? gender : "misto";
  const palette =
    resolved === "masculino"
      ? { bg: colors.infoBg, text: colors.infoText }
      : resolved === "feminino"
      ? { bg: colors.warningBg, text: colors.warningText }
      : { bg: colors.secondaryBg, text: colors.text };
  const padding = size === "md" ? { y: 4, x: 8 } : { y: 2, x: 6 };
  const fontSize = size === "md" ? 11 : 10;
  return (
    <View
      style={{
        paddingVertical: padding.y,
        paddingHorizontal: padding.x,
        borderRadius: 999,
        backgroundColor: palette.bg,
      }}
    >
      <Text style={{ color: palette.text, fontSize, fontWeight: "700" }}>
        {labelByGender[resolved]}
      </Text>
    </View>
  );
}
