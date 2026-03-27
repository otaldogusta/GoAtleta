import { Text } from "react-native";

import { useAppTheme } from "./app-theme";

export function Typography({
  variant,
  children,
}: {
  variant: "title" | "subtitle" | "body";
  children: any;
}) {
  const { colors } = useAppTheme();
  const style =
    variant === "title"
      ? { fontSize: 26, fontWeight: "700" as const, marginBottom: 8, color: colors.text }
      : variant === "subtitle"
      ? { fontSize: 16, opacity: 0.7, marginBottom: 10, color: colors.text }
      : { fontSize: 15, lineHeight: 22, color: colors.text };

  return <Text style={style}>{children}</Text>;
}
