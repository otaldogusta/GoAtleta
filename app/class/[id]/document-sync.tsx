import * as Linking from "expo-linking";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  analyzeDriveDocument,
  applyDocumentProposal,
  getDriveConnection,
  undoDocumentApplication,
  type DocumentApplicationReceipt,
  type DocumentSyncProposal,
} from "../../../src/api/document-intelligence";
import { getClassById } from "../../../src/db/seed";
import { markRender, measureAsync } from "../../../src/observability/perf";
import { Button } from "../../../src/ui/Button";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { getSectionCardStyle } from "../../../src/ui/section-styles";
import type { DocumentMergeItem } from "../../../src/core/document-intelligence";

const categoryLabels: Record<DocumentMergeItem["category"], string> = {
  keep: "Manter",
  complement: "Complementar",
  adjust: "Ajustar",
  ignore: "Ignorar",
};

const createIdempotencyKey = () =>
  `document-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const styles = StyleSheet.create({
  page: { maxWidth: 1120, alignSelf: "center", padding: 24, gap: 20, paddingBottom: 48 },
  pageCompact: { padding: 16, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  proposalGrid: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  proposalColumn: { flex: 1, gap: 16, minWidth: 0 },
  proposalAside: { width: 340, gap: 16 },
  categoryGroup: { gap: 12 },
  categoryTitle: { fontWeight: "800", fontSize: 16 },
  categoryCount: { fontWeight: "700", fontSize: 12 },
  item: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10 },
  itemTitle: { fontWeight: "700" },
  itemReason: { marginTop: 4 },
  itemUnselected: { opacity: 0.68 },
  itemSelected: { opacity: 1 },
  actionGroup: { gap: 8 },
  denseSection: { gap: 4, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, paddingVertical: 10 },
  selectionRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  itemTitleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  sidebarMeta: { gap: 4, paddingBottom: 10 },
  metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 5 },
  changesHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 4 },
});

export default function DocumentSyncScreen() {
  markRender("screen.documentSync.render.root");
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= 1350;
  const contentWidth = width >= 900 ? Math.min(1120, width - 360) : width;
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const classId = typeof params.id === "string" ? params.id : "";
  const month = typeof params.month === "string" ? params.month : "";
  const [sourceUrl, setSourceUrl] = useState("");
  const [proposal, setProposal] = useState<DocumentSyncProposal | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [receipt, setReceipt] = useState<DocumentApplicationReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<DocumentMergeItem["category"]>>(new Set(["keep", "ignore"]));
  const categoryTitleStyle = useMemo(() => [styles.categoryTitle, { color: colors.text }], [colors.text]);
  const itemTitleStyle = useMemo(() => [styles.itemTitle, { color: colors.text }], [colors.text]);
  const itemReasonStyle = useMemo(() => [styles.itemReason, { color: colors.muted }], [colors.muted]);
  const returnToPlanning = () => {
    router.replace({
      pathname: "/class/[id]/planning/[month]",
      params: { id: classId, month },
    });
  };

  const groups = useMemo(() => {
    const result = new Map<DocumentMergeItem["category"], DocumentMergeItem[]>();
    for (const category of ["keep", "complement", "adjust", "ignore"] as const) {
      result.set(category, proposal?.items.filter((item) => item.category === category) ?? []);
    }
    return result;
  }, [proposal]);

  const loadProposal = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await measureAsync("screen.documentSync.load.proposal", async () => {
        const cls = await getClassById(classId);
        if (!cls?.organizationId) throw new Error("Turma sem workspace ativo.");
        const redirectTo = Linking.createURL(`/class/${classId}/document-sync`, { queryParams: { month } });
        const connection = await getDriveConnection(cls.organizationId, redirectTo);
        if (!connection.connected) {
          if (!connection.authorizationUrl) throw new Error("Conexão com o Drive indisponível.");
          await Linking.openURL(connection.authorizationUrl);
          return null;
        }
        return analyzeDriveDocument({
          organizationId: cls.organizationId,
          classId,
          month,
          sourceUrl: sourceUrl.trim(),
        });
      });
      if (!result) return;
      if (!result.proposal) throw new Error("O documento ainda não gerou uma proposta revisável.");
      setProposal(result.proposal);
      setSelectedIds(
        new Set(
          result.proposal.items
            .filter((item) => item.recommendation === "apply")
            .map((item) => item.id)
        )
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao analisar o documento.");
    } finally {
      setBusy(false);
    }
  };

  const applySelected = async (onlyComplements = false) => {
    if (!proposal) return;
    const approvedItemIds = proposal.items
      .filter((item) => selectedIds.has(item.id) && (!onlyComplements || item.category === "complement"))
      .map((item) => item.id);
    if (!approvedItemIds.length) {
      setError("Selecione ao menos uma atualização.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await applyDocumentProposal({
        proposalId: proposal.proposalId,
        approvedItemIds,
        expectedStateVersion: proposal.snapshotVersion,
        idempotencyKey: createIdempotencyKey(),
      });
      if (!result.receipt) throw new Error("A aplicação não retornou um recibo.");
      setReceipt(result.receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao aplicar atualizações.");
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    if (!receipt) return;
    setBusy(true);
    try {
      const result = await undoDocumentApplication(receipt.applicationId);
      if (result.receipt) setReceipt(result.receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao desfazer atualização.");
    } finally {
      setBusy(false);
    }
  };

  const renderCategory = (category: DocumentMergeItem["category"]) => {
    const items = groups.get(category) ?? [];
    if (!items.length) return null;
    const collapsible = category === "keep" || category === "ignore";
    const collapsed = collapsible && collapsedCategories.has(category);
    const toneColor = category === "adjust" ? colors.warningBg : category === "complement" ? colors.infoBg : colors.border;
    return (
      <View key={category} style={[getSectionCardStyle(colors, "neutral", { padding: 0, radius: 14, shadow: false }), styles.denseSection]}>
        <Pressable
          onPress={collapsible ? () => setCollapsedCategories((current) => {
            const next = new Set(current);
            if (next.has(category)) next.delete(category); else next.add(category);
            return next;
          }) : undefined}
          accessibilityRole={collapsible ? "button" : undefined}
          accessibilityState={collapsible ? { expanded: !collapsed } : undefined}
          style={[styles.sectionHeader, { borderLeftWidth: 3, borderLeftColor: toneColor }]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={categoryTitleStyle}>{categoryLabels[category]}</Text>
            <Text style={[styles.categoryCount, { color: colors.muted }]}>{items.length}</Text>
          </View>
          {collapsible ? <Ionicons name={collapsed ? "chevron-down" : "chevron-up"} size={16} color={colors.muted} /> : null}
        </Pressable>
        {!collapsed ? items.map((item) => {
          const selectable = category === "complement" || category === "adjust";
          const selected = selectedIds.has(item.id);
          return (
            <Pressable
              key={item.id}
              accessibilityRole={selectable ? "checkbox" : undefined}
              accessibilityState={selectable ? { checked: selected } : undefined}
              onPress={selectable ? () => setSelectedIds((current) => {
                const next = new Set(current);
                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                return next;
              }) : undefined}
              style={[
                styles.item,
                { backgroundColor: selectable && selected ? colors.inputBg : "transparent", borderTopWidth: 1, borderTopColor: colors.border },
                selectable && !selected ? styles.itemUnselected : styles.itemSelected,
              ]}
            >
              <View style={styles.selectionRow}>
                {selectable ? <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.primaryBg : colors.muted} /> : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.itemTitleRow}>
                    <Text style={[itemTitleStyle, { flex: 1 }]}>{String(item.proposedValue ?? item.currentValue ?? "")}</Text>
                    {selectable && selected ? <Text style={{ color: colors.primaryBg, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>Recomendado</Text> : null}
                  </View>
                  <Text style={itemReasonStyle}>{item.reason}</Text>
                </View>
              </View>
            </Pressable>
          );
        }) : null}
      </View>
    );
  };
  const categoryCount = (category: DocumentMergeItem["category"]) => groups.get(category)?.length ?? 0;
  const compactDocumentTitle = proposal?.sourceTitle.replace(/\.docx$/i, "").replace(/\s+-\s+Rede Esperança$/i, "") ?? "";
  const periodDisplay = /^\d{4}-\d{2}$/.test(proposal?.periodLabel ?? "")
    ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${proposal?.periodLabel}-01T00:00:00Z`))
    : proposal?.periodLabel ?? "";
  const stickyAsideStyle = Platform.OS === "web" && isWide
    ? ({ position: "sticky", top: 24 } as ViewStyle)
    : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={[styles.page, { width: contentWidth }, !isWide && styles.pageCompact]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={returnToPlanning}>
            <Text style={{ color: colors.text, fontSize: 24 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>Sincronização inteligente</Text>
            <Text style={{ color: colors.muted }}>Compare documentos com o planejamento atual antes de atualizar.</Text>
          </View>
        </View>

        {!proposal && !receipt ? (
          <View style={[getSectionCardStyle(colors, "neutral", { padding: 16, radius: 16, shadow: false }), { gap: 12 }]}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Link da pasta ou documento</Text>
            <TextInput
              value={sourceUrl}
              onChangeText={setSourceUrl}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://drive.google.com/drive/folders/..."
              placeholderTextColor={colors.muted}
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 }}
            />
            <Button label={busy ? "Analisando..." : "Conectar e comparar"} onPress={() => void loadProposal()} disabled={busy || !sourceUrl.trim()} />
          </View>
        ) : null}

        {proposal && !receipt ? (
          <View style={isWide ? styles.proposalGrid : styles.proposalColumn}>
            <View style={styles.proposalColumn}>
              <View style={{ gap: 5, paddingVertical: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase" }}>Revisão de mudanças</Text>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 20 }}>{compactDocumentTitle}</Text>
                <Text style={{ color: colors.muted }}>{proposal.className} · {periodDisplay} · 9 aulas · Google Drive</Text>
                <Text style={{ color: colors.text, lineHeight: 21, marginTop: 4 }}>O documento complementa o planejamento atual e sugere um avanço condicionado pelas evidências de 09/07.</Text>
              </View>
              <View style={styles.changesHeader}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Mudanças sugeridas</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Nada será alterado sem confirmação</Text>
              </View>
              {renderCategory("adjust")}
              {renderCategory("complement")}
              {renderCategory("keep")}
              {renderCategory("ignore")}
            </View>
            <View style={[isWide ? styles.proposalAside : styles.proposalColumn, stickyAsideStyle]}>
              <View style={[getSectionCardStyle(colors, "neutral", { padding: 16, radius: 14, shadow: false }), styles.actionGroup]}>
                <View style={styles.sidebarMeta}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>Resumo da proposta</Text>
                  <Text numberOfLines={2} style={{ color: colors.text, fontWeight: "700" }}>{compactDocumentTitle}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{proposal.className} · {proposal.periodLabel}</Text>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8 }}>
                  <View style={styles.metricRow}><Text style={{ color: colors.muted }}>Ajustes</Text><Text style={{ color: colors.text, fontWeight: "800" }}>{categoryCount("adjust")}</Text></View>
                  <View style={styles.metricRow}><Text style={{ color: colors.muted }}>Complementos</Text><Text style={{ color: colors.text, fontWeight: "800" }}>{categoryCount("complement")}</Text></View>
                  <View style={styles.metricRow}><Text style={{ color: colors.muted }}>Selecionadas</Text><Text style={{ color: colors.primaryBg, fontWeight: "800" }}>{selectedIds.size}</Text></View>
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 }}>
                  <Text style={{ color: colors.text, fontWeight: "800" }}>Impacto</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Planejamento mensal e sessões futuras.</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Relatórios realizados não serão alterados.</Text>
                </View>
                <Button label="Aplicar recomendados" onPress={() => void applySelected()} disabled={busy || selectedIds.size === 0} />
                <Button label="Somente complementar" variant="secondary" onPress={() => void applySelected(true)} disabled={busy} />
                <Button label="Revisar item por item" variant="outline" onPress={() => setCollapsedCategories(new Set())} disabled={busy} />
                <Button label="Cancelar" variant="ghost" onPress={returnToPlanning} disabled={busy} />
              </View>
            </View>
          </View>
        ) : null}

        {receipt ? (
          <View style={[getSectionCardStyle(colors, "neutral", { padding: 16, radius: 16, shadow: false }), { gap: 10 }]}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{receipt.undoneAt ? "Atualização desfeita" : "Planejamento atualizado"}</Text>
            <Text style={{ color: colors.muted }}>{receipt.appliedItemIds.length} item(ns) registrado(s) no histórico.</Text>
            {!receipt.undoneAt ? <Button label="Desfazer atualização" variant="secondary" onPress={() => void undo()} disabled={busy} /> : null}
            <Button label="Voltar ao planejamento" onPress={returnToPlanning} />
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={colors.text} /> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
