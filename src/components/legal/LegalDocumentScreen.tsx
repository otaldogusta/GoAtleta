import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsivePage } from "../ui/ResponsivePage";
import { ScreenPageHeader } from "../ui/ScreenPageHeader";
import { navigateBackOrReplace } from "../../navigation/safe-router";
import { radius, spacing } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export function LegalDocumentScreen({
  title,
  summary,
  sections,
}: {
  title: string;
  summary: string;
  sections: LegalSection[];
}) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <ResponsivePage gap={spacing.lg} style={{ maxWidth: 920 }}>
          <ScreenPageHeader
            title={title}
            subtitle="Atualizado em 23 de setembro de 2026"
            horizontalBleed={0}
            onBack={() => navigateBackOrReplace({ router, fallback: "/welcome" })}
          />

          <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 23 }}>
            {summary}
          </Text>

          {sections.map((section) => (
            <View
              key={section.title}
              style={{
                gap: spacing.sm,
                padding: spacing.lg,
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
                {section.title}
              </Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>
                  {paragraph}
                </Text>
              ))}
              {section.bullets?.map((bullet) => (
                <View key={bullet} style={{ flexDirection: "row", gap: 9 }}>
                  <Text style={{ color: colors.muted, lineHeight: 22 }}>•</Text>
                  <Text style={{ flex: 1, color: colors.muted, fontSize: 14, lineHeight: 22 }}>
                    {bullet}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
