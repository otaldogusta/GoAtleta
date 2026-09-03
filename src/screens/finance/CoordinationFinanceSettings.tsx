// perf-check: ignore-measure -- one organization-scoped connector status load.
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import {
  connectFinanceProvider,
  disconnectFinanceProvider,
  getFinanceProviderConnection,
  provisionFinanceProviderWebhook,
  rotateFinanceProviderKey,
  syncFinanceProviderHistory,
  verifyFinanceProviderConnection,
  type FinanceProviderConnectionStatus,
} from "../../api/finance-provider";
import {
  getFinanceProviderDemoStatus,
  runFinanceProviderDemoAction,
  startFinanceProviderDemo,
  stopFinanceProviderDemo,
} from "../../api/finance-provider-demo";
import { ResponsivePage } from "../../components/ui/ResponsivePage";
import { SectionLoadingState } from "../../components/ui/SectionLoadingState";
import { ScreenPageHeader } from "../../components/ui/ScreenPageHeader";
import { REAL_MONEY_PAYMENTS_ENABLED } from "../../core/payments";
import { resolveFinanceSettingsDisplay } from "../../finance/application/finance-settings-state";
import { markRender } from "../../observability/perf";
import { useOrganization } from "../../providers/OrganizationProvider";
import { radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme, type ThemeColors } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useSaveToast } from "../../ui/save-toast";
import { useResponsiveLayout } from "../../ui/use-responsive-layout";

const INTEGRATION_DETAILS = [
  ["Histórico", "Clientes, cobranças e assinaturas são apenas importados."],
  ["Cobranças", "O Go Atleta não emite pagamentos nesta etapa."],
  ["Vencimentos", "Continuam definidos em cada plano."],
  ["Assinatura Go Atleta", "Permanece nas configurações da instituição."],
] as const;

const emptyStatus = (
  canManageConnection: boolean,
): FinanceProviderConnectionStatus => ({
  status: "not_connected",
  canManageConnection,
  connection: null,
});

const formatConnectionDate = (value: string | null | undefined) => {
  if (!value) return "Ainda não executada";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Ainda não executada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
};

const createFinanceSettingsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    modalHeader: {
      minHeight: 64,
      paddingHorizontal: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    modalHeaderText: { flex: 1, minWidth: 0, gap: 2 },
    modalTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
    modalSubtitle: { color: colors.muted, fontSize: 12 },
    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    contentColumn: {
      width: "100%",
      maxWidth: 760,
      alignSelf: "center",
      gap: spacing.md,
    },
    panel: {
      borderRadius: radius.container,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      overflow: "hidden",
    },
    providerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.lg,
    },
    connectedProviderHeader: {
      paddingBottom: spacing.sm,
    },
    providerIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.secondaryBg,
      alignItems: "center",
      justifyContent: "center",
    },
    providerHeading: { flex: 1, minWidth: 0, gap: 2 },
    providerTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
    providerSubtitle: { color: colors.muted, fontSize: 12 },
    statusChip: {
      borderRadius: radius.full,
      borderWidth: 1,
      paddingVertical: 5,
      paddingHorizontal: 10,
      flexShrink: 0,
    },
    statusChipText: { fontSize: 11, fontWeight: "800" },
    providerMetaBar: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    providerMetaItems: {
      flex: 1,
      minWidth: 180,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.sm,
    },
    providerMetaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    providerKeySummary: {
      flexWrap: "wrap",
    },
    providerMetaText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    providerKeyManageAction: {
      minHeight: 40,
      paddingHorizontal: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    providerKeyManageText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    providerTestAction: {
      minHeight: 40,
      paddingHorizontal: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    providerTestActionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    providerKeyInlineEditor: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 390,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    providerKeyInlineInput: {
      flexGrow: 1,
      flexShrink: 1,
      flexBasis: 180,
      minWidth: 150,
      minHeight: 40,
      borderWidth: 0,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: "transparent",
      color: colors.text,
      fontSize: 12,
      paddingHorizontal: spacing.xs,
      paddingVertical: 0,
    },
    inlineKeyAction: {
      minHeight: 40,
      paddingHorizontal: spacing.xs,
      alignItems: "center",
      justifyContent: "center",
    },
    inlineKeySaveText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    inlineKeyRemoveText: {
      color: colors.dangerText,
      fontSize: 12,
      fontWeight: "800",
    },
    inlineKeyClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledAction: {
      opacity: 0.55,
    },
    mainSection: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
    },
    connectedMainSection: {
      paddingHorizontal: 0,
      paddingVertical: 0,
      gap: 0,
    },
    sectionHeading: { gap: 3 },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
    bodyText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    supportingText: { color: colors.muted, fontSize: 12, lineHeight: 18 },
    fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },
    fieldGroup: { gap: 6 },
    inputContainer: {
      minHeight: 50,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      paddingLeft: 14,
      paddingRight: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    input: {
      flex: 1,
      minHeight: 50,
      paddingVertical: 0,
      borderWidth: 0,
      borderRadius: 0,
      color: colors.inputText,
      backgroundColor: "transparent",
    },
    inputIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    demoAction: {
      minHeight: 36,
      alignSelf: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.sm,
    },
    demoActionText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: "800",
      textDecorationLine: "underline",
    },
    notice: {
      borderRadius: radius.internal,
      borderWidth: 1,
      padding: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
    },
    noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
    connectedNotice: {
      marginHorizontal: spacing.lg,
      marginVertical: spacing.sm,
    },
    operationalRow: {
      minHeight: 96,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    operationalIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      flexShrink: 0,
      backgroundColor: colors.secondaryBg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    operationalBody: {
      flex: 1,
      minWidth: 130,
      gap: 3,
    },
    operationalTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "900",
    },
    operationalSubtitle: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
    },
    operationalState: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    operationalStateDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    compactAction: {
      flexShrink: 0,
      alignSelf: "center",
    },
    connectedStatus: {
      minHeight: 40,
      borderRadius: radius.internal,
      borderWidth: 1,
      borderColor: colors.successBorder,
      backgroundColor: colors.successBg,
      paddingHorizontal: spacing.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    connectedStatusText: {
      color: colors.successText,
      fontSize: 12,
      fontWeight: "800",
    },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    actionItem: { minWidth: 170, flexGrow: 1 },
    summaryGrid: { flexDirection: "row", flexWrap: "wrap" },
    summaryItem: {
      minWidth: 150,
      flexGrow: 1,
      flexBasis: 150,
      paddingVertical: 10,
      paddingRight: 12,
      gap: 2,
    },
    summaryValue: { color: colors.text, fontSize: 15, fontWeight: "900" },
    summaryLabel: { color: colors.muted, fontSize: 11 },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    metaPill: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.secondaryBg,
      paddingHorizontal: 9,
      paddingVertical: 5,
    },
    metaPillText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
    disclosureButton: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingVertical: 10,
    },
    disclosureHeading: { flex: 1, minWidth: 0, gap: 2 },
    disclosureTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
    disclosureSummary: { color: colors.muted, fontSize: 11 },
    detailBody: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.sm,
      backgroundColor: colors.secondaryBg,
    },
    detailRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    detailLabel: {
      width: 118,
      color: colors.text,
      fontSize: 12,
      fontWeight: "800",
    },
    detailText: { flex: 1, color: colors.muted, fontSize: 12, lineHeight: 17 },
    divider: { height: 1, backgroundColor: colors.border },
  });

type CoordinationFinanceSettingsProps = {
  embedded?: boolean;
  onClose?: () => void;
  allowLocalDemo?: boolean;
};

export default function CoordinationFinanceSettings({
  embedded = false,
  onClose,
  allowLocalDemo = false,
}: CoordinationFinanceSettingsProps = {}) {
  markRender("screen.coordFinanceSettings.render.root");
  const router = useRouter();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const responsiveLayout = useResponsiveLayout();
  const { showSaveToast } = useSaveToast();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id ?? "";
  const defaultCanManage = (activeOrganization?.role_level ?? 0) >= 50;
  const canManageConnection = defaultCanManage || (__DEV__ && allowLocalDemo);
  const styles = useMemo(() => createFinanceSettingsStyles(colors), [colors]);
  const [providerStatus, setProviderStatus] = useState(() =>
    emptyStatus(canManageConnection),
  );
  const [demoActive, setDemoActive] = useState(false);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyEditorOpen, setKeyEditorOpen] = useState(false);
  const [message, setMessage] = useState<{ text: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!organizationId) {
      setProviderStatus(emptyStatus(false));
      setLoading(false);
      return;
    }
    setLoading(true);
    const demoStatus = __DEV__
      ? getFinanceProviderDemoStatus(organizationId)
      : null;
    if (demoStatus) {
      setProviderStatus(demoStatus);
      setDemoActive(true);
      setLoading(false);
      return;
    }
    setDemoActive(false);
    try {
      const status = await getFinanceProviderConnection(organizationId);
      setProviderStatus(status);
    } catch {
      setProviderStatus(emptyStatus(canManageConnection));
      setMessage({
        text: "Conexão indisponível neste ambiente.",
      });
    } finally {
      setLoading(false);
    }
  }, [canManageConnection, organizationId]);

  useEffect(() => {
    setApiKey("");
    setKeyEditorOpen(false);
    setShowApiKey(false);
    setMessage(null);
    void refresh();
  }, [refresh]);

  const connection = providerStatus.connection;
  const isConnected =
    providerStatus.status === "connected" && Boolean(connection);
  const merchantStatus = connection?.merchantStatus ?? null;
  const integrationDisplay = resolveFinanceSettingsDisplay({
    capabilityEnabled: REAL_MONEY_PAYMENTS_ENABLED,
    connectorPrepared: true,
    persisted: {
      subscriptionStatus: null,
      merchantStatus,
      connectionMode: connection?.mode ?? null,
    },
  });
  const showStatusChip = loading || isConnected;
  const statusLabel = loading
    ? "Verificando"
    : integrationDisplay.merchantStatusLabel;
  const statusTone = loading
    ? "neutral"
    : connection?.merchantStatus === "restricted"
      ? "warning"
      : isConnected
        ? "success"
        : "neutral";
  const statusPalette =
    statusTone === "success"
      ? {
          border: colors.successBorder,
          background: colors.successBg,
          text: colors.successText,
        }
      : statusTone === "warning"
        ? {
            border: colors.warningBorder,
            background: colors.warningBg,
            text: colors.warningText,
          }
        : {
            border: colors.border,
            background: colors.secondaryBg,
            text: colors.muted,
          };

  const handleConnect = async () => {
    if (!organizationId || !apiKey.trim() || busyAction) return;
    setBusyAction("connect");
    setMessage(null);
    try {
      const result = await connectFinanceProvider({
        organizationId,
        apiKey: apiKey.trim(),
      });
      setProviderStatus(result);
      setApiKey("");
      showSaveToast({
        variant: "success",
        message: "Conta conectada em modo de leitura.",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível conectar o Asaas.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartDemo = async () => {
    if (!organizationId || busyAction) return;
    setBusyAction("demo");
    setMessage(null);
    try {
      const result = await startFinanceProviderDemo(
        organizationId,
        canManageConnection,
      );
      setProviderStatus(result);
      setDemoActive(true);
      showSaveToast({
        variant: "success",
        message: "Demonstração iniciada com dados fictícios.",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar a demonstração.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const closeKeyEditor = () => {
    setKeyEditorOpen(false);
    setApiKey("");
    setShowApiKey(false);
    setMessage(null);
  };

  const handleRotateKey = async () => {
    if (!organizationId || !apiKey.trim() || busyAction || demoActive) return;
    setBusyAction("rotate_key");
    setMessage(null);
    try {
      const result = await rotateFinanceProviderKey({
        organizationId,
        apiKey: apiKey.trim(),
      });
      setProviderStatus(result);
      setApiKey("");
      setShowApiKey(false);
      setKeyEditorOpen(false);
      showSaveToast({
        variant: "success",
        message: "Chave substituída. Histórico preservado.",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível substituir a chave.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const runConnectedAction = async (action: "verify" | "sync" | "webhook") => {
    if (!organizationId || busyAction) return;
    setBusyAction(action);
    setMessage(null);
    try {
      const result = demoActive
        ? await runFinanceProviderDemoAction(organizationId, action)
        : action === "verify"
          ? await verifyFinanceProviderConnection(organizationId)
          : action === "sync"
            ? await syncFinanceProviderHistory(organizationId)
            : await provisionFinanceProviderWebhook(organizationId);
      setProviderStatus(result);
      showSaveToast({
        variant: "success",
        message: demoActive
          ? action === "verify"
            ? "Conexão fictícia validada."
            : action === "sync"
              ? "Histórico fictício sincronizado."
              : "Atualizações fictícias ativadas."
          : action === "verify"
            ? "Conexão validada."
            : action === "sync"
              ? "Histórico sincronizado sem alterar cobranças no Asaas."
              : "Atualizações automáticas configuradas.",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível concluir a operação.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!organizationId || busyAction) return;
    setBusyAction("disconnect");
    try {
      const result = demoActive
        ? await stopFinanceProviderDemo(organizationId, canManageConnection)
        : await disconnectFinanceProvider(organizationId);
      setProviderStatus(result);
      setDemoActive(false);
      setKeyEditorOpen(false);
      setApiKey("");
      setShowApiKey(false);
      showSaveToast({
        variant: "success",
        message: demoActive
          ? "Demonstração encerrada. Nenhum dado real foi alterado."
          : "Conexão removida. O histórico financeiro foi preservado.",
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível remover a conexão.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const requestDisconnect = () => {
    if (!organizationId || busyAction) return;
    const isDemo = demoActive;
    void confirmDialog({
      title: isDemo ? "Encerrar demonstração?" : "Remover conexão do Asaas?",
      message: isDemo
        ? "Os dados fictícios serão removidos. Nenhum dado real será alterado."
        : "A chave será removida e as atualizações serão interrompidas. O histórico importado será preservado.",
      confirmLabel: isDemo ? "Encerrar" : "Remover conexão",
      cancelLabel: "Cancelar",
      tone: "danger",
      onConfirm: handleDisconnect,
    });
  };

  const sync = connection?.sync;
  const needsReview = sync
    ? Math.max(
        0,
        sync.customerCount -
          sync.matchedCustomerCount -
          sync.ambiguousCustomerCount,
      ) + sync.ambiguousCustomerCount
    : 0;
  const contentSizedEmbedded = embedded && !responsiveLayout.isMobile;

  return (
    <SafeAreaView
      edges={embedded ? [] : ["top"]}
      style={{
        flex: contentSizedEmbedded ? undefined : 1,
        minHeight: 0,
        backgroundColor: embedded ? colors.card : colors.background,
      }}
    >
      {embedded ? (
        <View style={styles.modalHeader}>
          <View style={styles.modalHeaderText}>
            <Text style={styles.modalTitle}>Configurações financeiras</Text>
            <Text numberOfLines={1} style={styles.modalSubtitle}>
              {activeOrganization?.name ?? "Instituição"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar configurações financeiras"
            accessibilityRole="button"
            onPress={onClose}
            style={styles.modalClose}
          >
            <GoAtletaIcon name="close" size={20} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        style={{
          flex: contentSizedEmbedded ? undefined : 1,
          minHeight: 0,
        }}
        contentContainerStyle={{
          paddingTop: embedded ? spacing.md : 0,
          paddingBottom: embedded ? spacing.md : insets.bottom + 80,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <ResponsivePage variant="dashboard" gap={spacing.md}>
          {!embedded ? (
            <ScreenPageHeader
              title="Configurações financeiras"
              subtitle={activeOrganization?.name ?? "Instituição"}
              onBack={() => router.back()}
              horizontalBleed={0}
            />
          ) : null}

          <View style={styles.contentColumn}>
            <View style={styles.panel}>
              <View
                style={[
                  styles.providerHeader,
                  isConnected ? styles.connectedProviderHeader : null,
                ]}
              >
                <View style={styles.providerIcon}>
                  <GoAtletaIcon name="payments" size={20} color={colors.text} />
                </View>
                <View style={styles.providerHeading}>
                  <Text style={styles.providerTitle}>Asaas</Text>
                  <Text style={styles.providerSubtitle}>
                    Recebimentos da instituição
                  </Text>
                </View>
                {showStatusChip ? (
                  <View
                    style={[
                      styles.statusChip,
                      {
                        borderColor: statusPalette.border,
                        backgroundColor: statusPalette.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: statusPalette.text },
                      ]}
                    >
                      {statusLabel}
                    </Text>
                  </View>
                ) : null}
              </View>

              {isConnected ? (
                <View style={styles.providerMetaBar}>
                  <View style={styles.providerMetaItems}>
                    {!keyEditorOpen ? (
                      <View style={styles.providerMetaItem}>
                        <GoAtletaIcon
                          name="externalProvider"
                          size={15}
                          color={colors.muted}
                        />
                        <Text style={styles.providerMetaText}>
                          Ambiente:{" "}
                          {connection?.environment === "production"
                            ? "Conta real"
                            : "Teste"}
                        </Text>
                      </View>
                    ) : null}
                    {keyEditorOpen &&
                    providerStatus.canManageConnection &&
                    !demoActive ? (
                      <View style={styles.providerKeyInlineEditor}>
                        <GoAtletaIcon
                          name="key"
                          size={15}
                          color={colors.muted}
                        />
                        <Text style={styles.providerMetaText}>Chave:</Text>
                        <TextInput
                          accessibilityLabel="Nova chave de API do Asaas"
                          value={apiKey}
                          onChangeText={(value) => {
                            setApiKey(value);
                            if (message) setMessage(null);
                          }}
                          placeholder="Cole a nova chave"
                          placeholderTextColor={colors.placeholder}
                          secureTextEntry={!showApiKey}
                          autoCapitalize="none"
                          autoCorrect={false}
                          spellCheck={false}
                          style={[
                            styles.providerKeyInlineInput,
                            Platform.OS === "web"
                              ? ({ outlineStyle: "none" } as never)
                              : null,
                          ]}
                        />
                        <Pressable
                          accessibilityLabel={
                            showApiKey
                              ? "Ocultar nova chave"
                              : "Mostrar nova chave"
                          }
                          accessibilityRole="button"
                          onPress={() => setShowApiKey((current) => !current)}
                          style={styles.inlineKeyClose}
                        >
                          <GoAtletaIcon
                            name={showApiKey ? "eyeOff" : "view"}
                            size={18}
                            color={colors.muted}
                          />
                        </Pressable>
                        <Pressable
                          accessibilityLabel={
                            busyAction === "rotate_key"
                              ? "Salvando nova chave"
                              : "Salvar nova chave"
                          }
                          accessibilityRole="button"
                          accessibilityState={{
                            disabled: !apiKey.trim() || Boolean(busyAction),
                            busy: busyAction === "rotate_key",
                          }}
                          disabled={!apiKey.trim() || Boolean(busyAction)}
                          onPress={() => void handleRotateKey()}
                          suppressWebHoverFeedback
                          style={[
                            styles.inlineKeyAction,
                            !apiKey.trim() || busyAction
                              ? styles.disabledAction
                              : null,
                          ]}
                        >
                          <Text style={styles.inlineKeySaveText}>
                            {busyAction === "rotate_key"
                              ? "Salvando..."
                              : "Salvar"}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityLabel="Fechar troca da chave"
                          accessibilityRole="button"
                          disabled={Boolean(busyAction)}
                          onPress={closeKeyEditor}
                          style={[
                            styles.inlineKeyClose,
                            busyAction ? styles.disabledAction : null,
                          ]}
                        >
                          <GoAtletaIcon
                            name="close"
                            size={18}
                            color={colors.muted}
                          />
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.providerMetaItem,
                          styles.providerKeySummary,
                        ]}
                      >
                        <GoAtletaIcon
                          name="key"
                          size={15}
                          color={colors.muted}
                        />
                        <Text style={styles.providerMetaText}>
                          Chave: {connection?.keyHint ?? "Protegida"}
                        </Text>
                        {providerStatus.canManageConnection && !demoActive ? (
                          <>
                            <Pressable
                              accessibilityLabel="Trocar chave do Asaas"
                              accessibilityRole="button"
                              onPress={() => {
                                setKeyEditorOpen(true);
                                setMessage(null);
                              }}
                              suppressWebHoverFeedback
                              style={styles.providerKeyManageAction}
                            >
                              <Text style={styles.providerKeyManageText}>
                                Trocar
                              </Text>
                            </Pressable>
                            <Pressable
                              accessibilityLabel="Remover conexão Asaas"
                              accessibilityRole="button"
                              disabled={Boolean(busyAction)}
                              onPress={requestDisconnect}
                              suppressWebHoverFeedback
                              style={styles.providerKeyManageAction}
                            >
                              <Text style={styles.inlineKeyRemoveText}>
                                Remover
                              </Text>
                            </Pressable>
                          </>
                        ) : null}
                      </View>
                    )}
                    {demoActive ? (
                      <Text style={styles.providerMetaText}>
                        Demonstração local
                      </Text>
                    ) : null}
                  </View>
                  {!keyEditorOpen ? (
                    <Pressable
                      accessibilityLabel={
                        busyAction === "verify"
                          ? "Testando conexão"
                          : "Testar conexão"
                      }
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: Boolean(busyAction),
                        busy: busyAction === "verify",
                      }}
                      disabled={Boolean(busyAction)}
                      onPress={() => void runConnectedAction("verify")}
                      suppressWebHoverFeedback
                      style={[
                        styles.providerTestAction,
                        busyAction ? { opacity: 0.55 } : null,
                      ]}
                    >
                      <Text style={styles.providerTestActionText}>
                        {busyAction === "verify"
                          ? "Testando..."
                          : "Testar conexão"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.divider} />

              <View
                style={[
                  styles.mainSection,
                  isConnected ? styles.connectedMainSection : null,
                ]}
              >
                {loading ? (
                  <SectionLoadingState />
                ) : !isConnected ? (
                  <>
                    <View style={styles.sectionHeading}>
                      <Text style={styles.sectionTitle}>Conectar conta</Text>
                      <Text style={styles.bodyText}>
                        O dinheiro continua entrando direto no Asaas da
                        instituição.
                      </Text>
                    </View>

                    {message ? (
                      <View
                        accessibilityRole="alert"
                        style={[
                          styles.notice,
                          {
                            borderColor: colors.warningBorder,
                            backgroundColor: colors.warningBg,
                          },
                        ]}
                      >
                        <GoAtletaIcon
                          name="warningCircle"
                          size={18}
                          color={colors.warningText}
                        />
                        <Text
                          style={[
                            styles.noticeText,
                            {
                              color: colors.warningText,
                            },
                          ]}
                        >
                          {message.text}
                        </Text>
                      </View>
                    ) : null}

                    {providerStatus.canManageConnection ? (
                      <>
                        <View style={styles.fieldGroup}>
                          <Text style={styles.fieldLabel}>Chave de API</Text>
                          <View style={styles.inputContainer}>
                            <TextInput
                              accessibilityLabel="Chave de API do Asaas"
                              value={apiKey}
                              onChangeText={(value) => {
                                setApiKey(value);
                                if (message) setMessage(null);
                              }}
                              placeholder="Cole a chave do Asaas"
                              placeholderTextColor={colors.placeholder}
                              secureTextEntry={!showApiKey}
                              autoCapitalize="none"
                              autoCorrect={false}
                              spellCheck={false}
                              style={[
                                styles.input,
                                Platform.OS === "web"
                                  ? ({ outlineStyle: "none" } as never)
                                  : null,
                              ]}
                            />
                            <Pressable
                              accessibilityLabel={
                                showApiKey ? "Ocultar chave" : "Mostrar chave"
                              }
                              accessibilityRole="button"
                              onPress={() =>
                                setShowApiKey((current) => !current)
                              }
                              style={styles.inputIcon}
                            >
                              <GoAtletaIcon
                                name={showApiKey ? "eyeOff" : "view"}
                                size={19}
                                color={colors.muted}
                              />
                            </Pressable>
                          </View>
                        </View>

                        <Button
                          label="Validar e conectar"
                          loading={busyAction === "connect"}
                          loadingLabel="Validando..."
                          disabled={!apiKey.trim() || Boolean(busyAction)}
                          onPress={() => void handleConnect()}
                        />
                        {__DEV__ ? (
                          <Pressable
                            accessibilityLabel="Testar conector com dados fictícios"
                            accessibilityRole="button"
                            disabled={Boolean(busyAction)}
                            onPress={() => void handleStartDemo()}
                            suppressWebHoverFeedback
                            disableWebPressScale
                            style={styles.demoAction}
                          >
                            <Text style={styles.demoActionText}>
                              Testar com dados fictícios
                            </Text>
                          </Pressable>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.supportingText}>
                        Somente a coordenação pode configurar esta conexão.
                      </Text>
                    )}

                    <View style={styles.metaRow}>
                      {["Pix", "Boleto", "Cartão", "Somente leitura"].map(
                        (label) => (
                          <View key={label} style={styles.metaPill}>
                            <Text style={styles.metaPillText}>{label}</Text>
                          </View>
                        ),
                      )}
                    </View>
                  </>
                ) : (
                  <>
                    {message ? (
                      <View
                        accessibilityRole="alert"
                        style={[
                          styles.notice,
                          styles.connectedNotice,
                          {
                            borderColor: colors.warningBorder,
                            backgroundColor: colors.warningBg,
                          },
                        ]}
                      >
                        <GoAtletaIcon
                          name="warningCircle"
                          size={18}
                          color={colors.warningText}
                        />
                        <Text
                          style={[
                            styles.noticeText,
                            {
                              color: colors.warningText,
                            },
                          ]}
                        >
                          {message.text}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.operationalRow}>
                      <View style={styles.operationalIcon}>
                        <GoAtletaIcon
                          name="sync"
                          size={20}
                          color={colors.text}
                        />
                      </View>
                      <View style={styles.operationalBody}>
                        <Text style={styles.operationalTitle}>Histórico</Text>
                        <Text style={styles.operationalSubtitle}>
                          Última sincronização:{" "}
                          {formatConnectionDate(connection?.lastSyncAt)}
                        </Text>
                      </View>
                      <View style={styles.compactAction}>
                        <Button
                          label="Sincronizar agora"
                          variant="success"
                          loading={busyAction === "sync"}
                          loadingLabel="Sincronizando..."
                          disabled={Boolean(busyAction)}
                          onPress={() => void runConnectedAction("sync")}
                        />
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.operationalRow}>
                      <View style={styles.operationalIcon}>
                        <GoAtletaIcon
                          name="notifications"
                          size={20}
                          color={colors.text}
                        />
                      </View>
                      <View style={styles.operationalBody}>
                        <Text style={styles.operationalTitle}>
                          Atualizações automáticas
                        </Text>
                        <View style={styles.operationalState}>
                          <View
                            style={[
                              styles.operationalStateDot,
                              {
                                backgroundColor:
                                  connection?.webhookStatus === "configured"
                                    ? colors.successText
                                    : colors.warningText,
                              },
                            ]}
                          />
                          <Text style={styles.operationalSubtitle}>
                            {connection?.webhookStatus === "configured"
                              ? "Ativas"
                              : "Pendentes"}
                          </Text>
                        </View>
                        <Text style={styles.operationalSubtitle}>
                          Emissão bloqueada
                        </Text>
                      </View>
                      {connection?.webhookStatus !== "configured" ? (
                        <View style={styles.compactAction}>
                          <Button
                            label="Ativar"
                            variant="outline"
                            loading={busyAction === "webhook"}
                            loadingLabel="Ativando..."
                            disabled={Boolean(busyAction)}
                            onPress={() => void runConnectedAction("webhook")}
                          />
                        </View>
                      ) : (
                        <View style={styles.connectedStatus}>
                          <Text style={styles.connectedStatusText}>Ativas</Text>
                        </View>
                      )}
                    </View>
                  </>
                )}
              </View>

              {!loading ? <View style={styles.divider} /> : null}

              {!loading ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: detailsOpen }}
                  onPress={() => setDetailsOpen((current) => !current)}
                  style={styles.disclosureButton}
                >
                  <View style={styles.disclosureHeading}>
                    <Text style={styles.disclosureTitle}>
                      {isConnected ? "Detalhes da integração" : "Como funciona"}
                    </Text>
                    {!isConnected ? (
                      <Text style={styles.disclosureSummary}>
                        Histórico, segurança e regras
                      </Text>
                    ) : null}
                  </View>
                  <GoAtletaIcon
                    name="chevronDown"
                    size={18}
                    color={colors.muted}
                    style={{
                      transform: [{ rotate: detailsOpen ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>
              ) : null}

              {!loading && detailsOpen ? (
                <View style={styles.detailBody}>
                  {sync ? (
                    <>
                      <Text style={styles.fieldLabel}>Última importação</Text>
                      <View style={styles.summaryGrid}>
                        {[
                          [sync.customerCount, "Clientes"],
                          [sync.paymentCount, "Cobranças"],
                          [sync.subscriptionCount, "Assinaturas"],
                          [needsReview, "Para revisar"],
                        ].map(([value, label]) => (
                          <View key={String(label)} style={styles.summaryItem}>
                            <Text style={styles.summaryValue}>{value}</Text>
                            <Text style={styles.summaryLabel}>{label}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.supportingText}>
                        {sync.matchedCustomerCount} cliente(s) vinculados por
                        e-mail.
                      </Text>
                      {sync.truncated ? (
                        <Text
                          style={[
                            styles.supportingText,
                            { color: colors.warningText },
                          ]}
                        >
                          Há mais registros para importar.
                        </Text>
                      ) : null}
                      <View style={styles.divider} />
                    </>
                  ) : null}

                  {INTEGRATION_DETAILS.map(([label, text]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{label}</Text>
                      <Text style={styles.detailText}>{text}</Text>
                    </View>
                  ))}

                  {isConnected ? (
                    <Text style={styles.supportingText}>
                      Última validação:{" "}
                      {formatConnectionDate(connection?.lastVerifiedAt)}
                    </Text>
                  ) : null}

                  {isConnected &&
                  providerStatus.canManageConnection &&
                  demoActive ? (
                    <View style={styles.actions}>
                      <View style={styles.actionItem}>
                        <Button
                          label="Encerrar demonstração"
                          variant="danger"
                          loading={busyAction === "disconnect"}
                          loadingLabel="Encerrando..."
                          disabled={Boolean(busyAction)}
                          onPress={requestDisconnect}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </ResponsivePage>
      </ScrollView>
    </SafeAreaView>
  );
}
