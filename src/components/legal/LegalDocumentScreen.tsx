import * as Clipboard from "expo-clipboard";
import { Link, useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";

import { ResponsivePage } from "../ui/ResponsivePage";
import { ScreenPageHeader } from "../ui/ScreenPageHeader";
import { navigateBackOrReplace } from "../../navigation/safe-router";
import { radius, spacing } from "../../theme/tokens";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";

export const LEGAL_CONTACT_EMAIL = "uniquexperieence@gmail.com";
export const DATA_DELETION_EMAIL_SUBJECT = "Exclusão de dados Go Atleta";

export type LegalSection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
  links?: { label: string; href: "/privacy" | "/data-deletion" }[];
  contact?: { subject?: string };
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
  const [contactFeedback, setContactFeedback] = useState("");

  async function openContact(subject?: string) {
    setContactFeedback("");
    const query = subject ? `?subject=${encodeURIComponent(subject)}` : "";
    try {
      await Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}${query}`);
    } catch {
      setContactFeedback("Não foi possível abrir o e-mail. Copie o endereço para usar no seu aplicativo.");
    }
  }

  async function copyContact() {
    try {
      const copied = await Clipboard.setStringAsync(LEGAL_CONTACT_EMAIL);
      setContactFeedback(copied ? "Endereço copiado." : "Não foi possível copiar o endereço.");
    } catch {
      setContactFeedback("Não foi possível copiar o endereço.");
    }
  }

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
              <Text role="heading" aria-level={2} style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>
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
              {section.links?.map(({ label, href }) => (
                <Link key={href} href={href} style={{ color: colors.text, fontSize: 14, lineHeight: 24, textDecorationLine: "underline", alignSelf: "flex-start" }}>
                  {label}
                </Link>
              ))}
              {section.contact ? (
                <>
                  <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 22, fontWeight: "600" }}>
                    {LEGAL_CONTACT_EMAIL}
                  </Text>
                  {section.contact.subject ? (
                    <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>Assunto: {section.contact.subject}</Text>
                  ) : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                    <Button label="Abrir rascunho de e-mail" onPress={() => void openContact(section.contact?.subject)} />
                    <Button label="Copiar endereço" variant="outline" onPress={() => void copyContact()} />
                  </View>
                  <Text accessibilityLiveRegion="polite" role="status" style={{ display: contactFeedback ? "flex" : "none", color: colors.text, fontSize: 14 }}>
                    {contactFeedback}
                  </Text>
                </>
              ) : null}
            </View>
          ))}
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
