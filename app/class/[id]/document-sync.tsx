import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
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
import { markRender } from "../../../src/observability/perf";
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

export default function DocumentSyncScreen() {
  markRender("screen.document-sync");
  const router = useRouter();
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
      const cls = await getClassById(classId);
      if (!cls?.organizationId) throw new Error("Turma sem workspace ativo.");
      const redirectTo = Linking.createURL(`/class/${classId}/document-sync`, { queryParams: { month } });
      const connection = await getDriveConnection(cls.organizationId, redirectTo);
      if (!connection.connected) {
        if (!connection.authorizationUrl) throw new Error("Conexão com o Drive indisponível.");
        await Linking.openURL(connection.authorizationUrl);
        return;
      }
      const result = await analyzeDriveDocument({
        organizationId: cls.organizationId,
        classId,
        month,
        sourceUrl: sourceUrl.trim(),
      });
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ width: "100%", maxWidth: 1040, alignSelf: "center", padding: 16, gap: 16, paddingBottom: 48 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()}>
            <Text style={{ color: colors.text, fontSize: 24 }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>Sincronização inteligente</Text>
            <Text style={{ color: colors.muted }}>Compare documentos com o planejamento atual antes de atualizar.</Text>
          </View>
        </View>

        {!proposal && !receipt ? (
          <View style={[getSectionCardStyle(colors, "primary", { padding: 16, radius: 16 }), { gap: 12 }]}>
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
          <>
            <View style={[getSectionCardStyle(colors, "neutral", { padding: 14, radius: 14 }), { gap: 5 }]}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{proposal.sourceTitle}</Text>
              <Text style={{ color: colors.muted }}>{proposal.className} · {proposal.periodLabel}</Text>
              <Text style={{ color: colors.text }}>{proposal.summary}</Text>
            </View>
            {([...groups.entries()] as Array<[DocumentMergeItem["category"], DocumentMergeItem[]]>).map(([category, items]) =>
              items.length ? (
                <View key={category} style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 17 }}>{categoryLabels[category]}</Text>
                  {items.map((item) => {
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
                        style={[getSectionCardStyle(colors, "neutral", { padding: 12, radius: 12, shadow: false }), { opacity: selectable && !selected ? 0.68 : 1 }]}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700" }}>{String(item.proposedValue ?? item.currentValue ?? "")}</Text>
                        <Text style={{ color: colors.muted, marginTop: 4 }}>{item.reason}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null
            )}
            <View style={{ gap: 8 }}>
              <Button label="Aplicar recomendados" onPress={() => void applySelected()} disabled={busy} />
              <Button label="Somente complementar" variant="secondary" onPress={() => void applySelected(true)} disabled={busy} />
              <Button label="Cancelar" variant="ghost" onPress={() => router.back()} disabled={busy} />
            </View>
          </>
        ) : null}

        {receipt ? (
          <View style={[getSectionCardStyle(colors, "primary", { padding: 16, radius: 16 }), { gap: 10 }]}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{receipt.undoneAt ? "Atualização desfeita" : "Planejamento atualizado"}</Text>
            <Text style={{ color: colors.muted }}>{receipt.appliedItemIds.length} item(ns) registrado(s) no histórico.</Text>
            {!receipt.undoneAt ? <Button label="Desfazer atualização" variant="secondary" onPress={() => void undo()} disabled={busy} /> : null}
            <Button label="Voltar ao planejamento" onPress={() => router.back()} />
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={colors.text} /> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
