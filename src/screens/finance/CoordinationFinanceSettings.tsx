// perf-check: ignore-measure -- static capability summary with no async load.
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { REAL_MONEY_PAYMENTS_ENABLED } from "../../core/payments";
import { resolveFinanceSettingsDisplay } from "../../finance/application/finance-settings-state";
import { markRender } from "../../observability/perf";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { useAppTheme, type ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";

const PAYMENT_METHODS = [
  ["Pix", "Disponível ao conectar"],
  ["Boleto", "Disponível ao conectar"],
  ["Cartão", "Disponível ao conectar"],
] as const;

const BILLING_RULES = [
  "Vencimento definido em cada plano",
  "Multa e juros serão configurados na integração",
  "Lembretes serão enviados após a confirmação do provedor",
  "A assinatura do Go Atleta fica em Configurações da instituição",
] as const;

const createFinanceSettingsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    paymentMethodItem: {
      minWidth: 150,
      flexGrow: 1,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      gap: 2,
    },
    paymentMethodLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "800",
    },
    paymentMethodValue: {
      color: colors.muted,
      fontSize: 11,
    },
    rulesCard: {
      borderRadius: radius.container,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: spacing.md,
      gap: 10,
    },
    ruleRow: {
      flexDirection: "row",
      gap: 9,
      alignItems: "flex-start",
    },
    ruleText: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
    },
  });

function ConfigurationCard({
  icon,
  title,
  subtitle,
  status,
  children,
}: {
  icon: GoAtletaIconName;
  title: string;
  subtitle: string;
  status: string;
  children?: React.ReactNode;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        minHeight: 0,
        borderRadius: radius.container,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        padding: spacing.md,
        gap: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name={icon} size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>
            {title}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text>
        </View>
      </View>
      <View
        style={{
          alignSelf: "flex-start",
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.warningBorder,
          backgroundColor: colors.warningBg,
          paddingVertical: 5,
          paddingHorizontal: 9,
        }}
      >
        <Text
          style={{ color: colors.warningText, fontSize: 11, fontWeight: "800" }}
        >
          {status}
        </Text>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

type CoordinationFinanceSettingsProps = {
  embedded?: boolean;
  onClose?: () => void;
};

export default function CoordinationFinanceSettings({
  embedded = false,
  onClose,
}: CoordinationFinanceSettingsProps = {}) {
  markRender("screen.coordFinanceSettings.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganization();
  const styles = useMemo(() => createFinanceSettingsStyles(colors), [colors]);
  const integrationDisplay = resolveFinanceSettingsDisplay({
    capabilityEnabled: REAL_MONEY_PAYMENTS_ENABLED,
    // There is no read API for persisted subscription or merchant state yet.
    // The feature flag must never be presented as commercial activation.
    persisted: null,
  });

  return (
    <SafeAreaView
      edges={embedded ? [] : ["top"]}
      style={{ flex: 1, minHeight: 0, backgroundColor: embedded ? colors.card : colors.background }}
    >
      <ScrollView
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={{ paddingBottom: embedded ? spacing.md : insets.bottom + 80 }}
      >
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          <ScreenPageHeader
            title="Configurações financeiras"
            subtitle={activeOrganization?.name ?? "Instituição"}
            onBack={onClose ?? (() => router.back())}
            horizontalBleed={0}
          />

          <ConfigurationCard
            icon="payments"
            title="Integração de recebimentos"
            subtitle="Mensalidades recebidas pela instituição"
            status={integrationDisplay.merchantStatusLabel}
          >
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              Pix, boleto e cartão serão processados pelo provedor conectado. Os
              dados bancários e de cartão não passam pelo aplicativo.
            </Text>
            <Text style={{ marginTop: 10, color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              {integrationDisplay.capabilityLabel}
            </Text>
          </ConfigurationCard>

          <View
            style={{
              borderRadius: radius.container,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              padding: spacing.md,
              gap: 10,
            }}
          >
            <Text
              style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}
            >
              Formas de pagamento
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {PAYMENT_METHODS.map(([label, value]) => (
                <View
                  key={label}
                  style={styles.paymentMethodItem}
                >
                  <Text style={styles.paymentMethodLabel}>{label}</Text>
                  <Text style={styles.paymentMethodValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.rulesCard}>
            <Text
              style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}
            >
              Regras de cobrança
            </Text>
            {BILLING_RULES.map((item) => (
              <View key={item} style={styles.ruleRow}>
                <GoAtletaIcon
                  name="circleOutline"
                  size={16}
                  color={colors.muted}
                />
                <Text style={styles.ruleText}>
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
