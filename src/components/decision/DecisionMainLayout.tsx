import { useWindowDimensions, View } from "react-native";

export function DecisionMainLayout({
  main,
  mainWidth = 1.75,
  side,
  sideWidth = 0.95,
}: {
  main: React.ReactNode;
  mainWidth?: number;
  side: React.ReactNode;
  sideWidth?: number;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1040;

  return (
    <View
      style={{
        flexDirection: isDesktop ? "row" : "column",
        alignItems: "flex-start",
        gap: 16,
      }}
    >
      <View style={{ flex: isDesktop ? mainWidth : undefined, width: "100%", gap: 16 }}>{main}</View>
      <View style={{ flex: isDesktop ? sideWidth : undefined, width: "100%", gap: 16 }}>{side}</View>
    </View>
  );
}
