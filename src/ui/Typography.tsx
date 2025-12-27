import { Text } from "react-native";

export function Typography({
  variant,
  children,
}: {
  variant: "title" | "subtitle" | "body";
  children: any;
}) {
  const style =
    variant === "title"
      ? { fontSize: 26, fontWeight: "700", marginBottom: 8, color: "#111" }
      : variant === "subtitle"
      ? { fontSize: 16, opacity: 0.7, marginBottom:  10, color: "#111" }
      : { fontSize: 15, lineHeight: 22, color: "#111" };

  return <Text style={style}>{children}</Text>;
}
