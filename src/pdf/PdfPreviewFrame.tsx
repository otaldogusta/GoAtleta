import { Text, View } from "react-native";

export function PdfPreviewFrame({ title }: { url: string; title: string; html?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text accessibilityRole="text">{title} disponível para baixar.</Text>
    </View>
  );
}
