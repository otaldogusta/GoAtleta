import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
    compareRegulationRuleSets,
    listRegulationClauses,
    listRegulationRuleSets,
    type RegulationClause,
    type RegulationRuleSet,
    type RegulationRuleSetDiff,
} from "../src/api/regulation-rule-sets";
import {
    createRegulationSource,
    deleteRegulationSource,
    listRegulationSources,
    type RegulationAuthority,
    type RegulationSource,
    syncRegulationSourceNow,
    toggleRegulationSource,
    updateRegulationSource,
} from "../src/api/regulation-sources";
import { listRegulationUpdates, type RegulationUpdate } from "../src/api/regulation-updates";
import { useAuth } from "../src/auth/auth";
import { ScreenPageHeader } from "../src/components/ui/ScreenPageHeader";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { useConfirmDialog } from "../src/ui/confirm-dialog";

type FormState = {
  label: string;
  authority: RegulationAuthority;
  sourceUrl: string;
  sport: string;
  topicHintsText: string;
  checkIntervalHours: string;
  enabled: boolean;
};

const authorityOptions: RegulationAuthority[] = ["FIVB", "FPV", "PARANAENSE", "OUTRO"];

const emptyForm: FormState = {
  label: "",
  authority: "FIVB",
  sourceUrl: "",
  sport: "volleyball",
  topicHintsText: "",
  checkIntervalHours: "6",
  enabled: true,
};

const parseTopics = (value: string) =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );

const statusLabel: Record<RegulationRuleSet["status"], string> = {
  draft: "Rascunho",
  active: "Ativo",
  pending_next_cycle: "Proximo ciclo",
  archived: "Arquivado",
};

const diffLabel: Record<RegulationRuleSetDiff["diffKind"], string> = {
  added: "Adicionada",
  removed: "Removida",
  changed: "Alterada",
  equal: "Igual",
};

const dateLabel = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
};

export default function RegulationHistoryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { activeOrganization, activeOrganizationId } = useOrganization();
  const fallbackPath = pathname.startsWith("/coord") ? "/coord/dashboard" : "/prof/home";
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<RegulationSource[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [ruleSets, setRuleSets] = useState<RegulationRuleSet[]>([]);
  const [updates, setUpdates] = useState<RegulationUpdate[]>([]);
  const [leftRuleSetId, setLeftRuleSetId] = useState<string>("");
  const [rightRuleSetId, setRightRuleSetId] = useState<string>("");
  const [selectedRuleSetId, setSelectedRuleSetId] = useState<string>("");
  const [diffs, setDiffs] = useState<RegulationRuleSetDiff[]>([]);
  const [clauses, setClauses] = useState<RegulationClause[]>([]);
  const [loadingDiffs, setLoadingDiffs] = useState(false);
  const [loadingClauses, setLoadingClauses] = useState(false);

  const activeRuleSet = useMemo(
    () => ruleSets.find((item) => item.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId]
  );

  const editingSource = useMemo(
    () => sources.find((item) => item.id === editingSourceId) ?? null,
    [editingSourceId, sources]
  );

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setEditingSourceId(null);
    setForm(emptyForm);
  }, []);

  const openCreate = useCallback(() => {
    setEditingSourceId(null);
    setForm(emptyForm);
    setSheetVisible(true);
  }, []);

  const openEdit = useCallback((source: RegulationSource) => {
    setEditingSourceId(source.id);
    setForm({
      label: source.label,
      authority: source.authority,
      sourceUrl: source.sourceUrl,
      sport: source.sport || "volleyball",
      topicHintsText: source.topicHints.join(", "),
      checkIntervalHours: String(source.checkIntervalHours || 6),
      enabled: source.enabled,
    });
    setSheetVisible(true);
  }, []);

  const loadData = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId) {
      setSources([]);
      setRuleSets([]);
      setUpdates([]);
      setDiffs([]);
      setClauses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [sourceRows, ruleSetRows, updatesResult] = await Promise.all([
        isAdmin ? listRegulationSources(organizationId) : Promise.resolve([] as RegulationSource[]),
        listRegulationRuleSets({ organizationId, limit: 120 }),
        listRegulationUpdates({ organizationId, unreadOnly: false, limit: 50 }),
      ]);
      setSources(sourceRows);
      setRuleSets(ruleSetRows);
      setUpdates(updatesResult.items);
      const firstId = ruleSetRows[0]?.id ?? "";
      const secondId = ruleSetRows[1]?.id ?? ruleSetRows[0]?.id ?? "";
      setSelectedRuleSetId((prev) => prev || firstId);
      setLeftRuleSetId((prev) => prev || firstId);
      setRightRuleSetId((prev) => prev || secondId);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar regulamentos.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganizationId, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !selectedRuleSetId) {
      setClauses([]);
      return;
    }
    let cancelled = false;
    setLoadingClauses(true);
    void listRegulationClauses({ organizationId, ruleSetId: selectedRuleSetId })
      .then((rows) => {
        if (cancelled) return;
        setClauses(rows);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar clausulas.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingClauses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, selectedRuleSetId]);

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !leftRuleSetId || !rightRuleSetId || leftRuleSetId === rightRuleSetId) {
      setDiffs([]);
      return;
    }
    let cancelled = false;
    setLoadingDiffs(true);
    void compareRegulationRuleSets({ organizationId, leftRuleSetId, rightRuleSetId })
      .then((rows) => {
        if (cancelled) return;
        setDiffs(rows.filter((item) => item.diffKind !== "equal"));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao comparar versoes.");
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingDiffs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, leftRuleSetId, rightRuleSetId]);

  const openSource = useCallback(async (url: string) => {
    const target = String(url ?? "").trim();
    if (!target) return;
    try {
      const canOpen = await Linking.canOpenURL(target);
      if (!canOpen) throw new Error("invalid");
      await Linking.openURL(target);
    } catch {
      Alert.alert("Fonte", "Nao foi possivel abrir o link.");
    }
  }, []);

  const handleSaveSource = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId) return;

    const label = form.label.trim();
    const sourceUrl = form.sourceUrl.trim();
    if (!label || !sourceUrl) {
      Alert.alert("Campos obrigatórios", "Preencha nome da fonte e URL.");
      return;
    }

    const checkIntervalHours = Math.max(1, Math.min(Number(form.checkIntervalHours || 6), 168));
    if (!Number.isFinite(checkIntervalHours)) {
      Alert.alert("Intervalo inválido", "Informe um número de horas entre 1 e 168.");
      return;
    }

    setSaving(true);
    try {
      if (editingSourceId) {
        await updateRegulationSource(editingSourceId, organizationId, {
          label,
          authority: form.authority,
          sourceUrl,
          sport: form.sport || "volleyball",
          topicHints: parseTopics(form.topicHintsText),
          checkIntervalHours,
          enabled: form.enabled,
        });
      } else {
        await createRegulationSource({
          organizationId,
          label,
          authority: form.authority,
          sourceUrl,
          sport: form.sport || "volleyball",
          topicHints: parseTopics(form.topicHintsText),
          checkIntervalHours,
          enabled: form.enabled,
          createdBy: session?.user?.id ?? null,
        });
      }
      closeSheet();
      await loadData();
    } catch (saveError) {
      Alert.alert("Erro", saveError instanceof Error ? saveError.message : "Falha ao salvar fonte.");
    } finally {
      setSaving(false);
    }
  }, [activeOrganizationId, closeSheet, editingSourceId, form, loadData, session?.user?.id]);

  const handleToggleSource = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      try {
        await toggleRegulationSource(source.id, organizationId, !source.enabled);
        await loadData();
      } catch (toggleError) {
        Alert.alert("Erro", toggleError instanceof Error ? toggleError.message : "Falha ao atualizar status.");
      }
    },
    [activeOrganizationId, loadData]
  );

  const handleDeleteSource = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      confirmDialog({
        title: "Remover fonte?",
        message: `Deseja remover "${source.label}"?`,
        confirmLabel: "Remover",
        cancelLabel: "Cancelar",
        tone: "danger",
        onConfirm: async () => {
          try {
            await deleteRegulationSource(source.id, organizationId);
            await loadData();
          } catch (deleteError) {
            Alert.alert("Erro", deleteError instanceof Error ? deleteError.message : "Falha ao remover.");
          }
        },
      });
    },
    [activeOrganizationId, confirmDialog, loadData]
  );

  const handleSyncSource = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      setSyncingSourceId(source.id);
      try {
        const report = await syncRegulationSourceNow({
          organizationId,
          sourceId: source.id,
          force: true,
        });
        await loadData();
        Alert.alert(
          "Sincronização concluída",
          `Verificadas: ${report.checked}\nNovos documentos: ${report.newDocuments}\nNovos avisos: ${report.newUpdates}`
        );
      } catch (syncError) {
        Alert.alert("Erro", syncError instanceof Error ? syncError.message : "Falha ao sincronizar fonte.");
      } finally {
        setSyncingSourceId(null);
      }
    },
    [activeOrganizationId, loadData]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} stickyHeaderIndices={[0]}>
        <ScreenPageHeader
          title="Regulamentos"
          onBack={() => navigateBackOrReplace({ router, fallback: fallbackPath })}
        />

        <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{activeOrganization?.name ?? "Organizacao"}</Text>
          <Text style={{ color: colors.muted }}>Fontes oficiais, versões e atualizações institucionais.</Text>
        </View>

        {loading ? <ActivityIndicator color={colors.text} /> : null}
        {!loading && error ? <Text style={{ color: colors.dangerText }}>{error}</Text> : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Fontes oficiais</Text>
                <Text style={{ color: colors.muted }}>Monitoramento e sincronização de fontes de regulamento.</Text>
              </View>
              {isAdmin ? (
                <Pressable
                  onPress={openCreate}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, paddingHorizontal: 14, paddingVertical: 8 }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "700" }}>Nova fonte</Text>
                </Pressable>
              ) : null}
            </View>

            {!isAdmin ? (
              <Text style={{ color: colors.muted }}>
                Somente administradores da organização podem gerenciar fontes de regulamento.
              </Text>
            ) : null}

            {isAdmin && sources.length ? sources.map((source) => (
              <View key={source.id} style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 12, gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{source.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{source.sourceUrl}</Text>
                  </View>
                  <View style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 5 }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 11 }}>{source.authority}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Intervalo: {source.checkIntervalHours}h</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{source.enabled ? "Ativa" : "Pausada"}</Text>
                    <Switch value={source.enabled} onValueChange={() => void handleToggleSource(source)} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable
                    onPress={() => void handleSyncSource(source)}
                    disabled={syncingSourceId === source.id}
                    style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, paddingHorizontal: 10, paddingVertical: 8, opacity: syncingSourceId === source.id ? 0.7 : 1 }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                      {syncingSourceId === source.id ? "Sincronizando..." : "Sincronizar agora"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openEdit(source)}
                    style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 8 }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Editar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleDeleteSource(source)}
                    style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 8 }}
                  >
                    <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            )) : null}

            {isAdmin && !sources.length ? (
              <Text style={{ color: colors.muted }}>
                Nenhuma fonte cadastrada. Adicione uma fonte oficial para monitorar adendos e atualizações.
              </Text>
            ) : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Versoes</Text>
            {ruleSets.length ? ruleSets.map((item) => {
              const selected = selectedRuleSetId === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSelectedRuleSetId(item.id)}
                  style={{
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? colors.primaryBg : colors.border,
                    backgroundColor: selected ? colors.primaryBg : colors.secondaryBg,
                    padding: 10,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>{item.versionLabel}</Text>
                  <Text style={{ color: selected ? colors.primaryText : colors.muted, fontSize: 12 }}>
                    {statusLabel[item.status]} - {item.sourceAuthority || "Fonte"}
                  </Text>
                </Pressable>
              );
            }) : <Text style={{ color: colors.muted }}>Sem versoes cadastradas.</Text>}
          </View>
        ) : null}

        {!loading && ruleSets.length >= 2 ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Comparacao</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ruleSets.map((item) => (
                <Pressable
                  key={`l-${item.id}`}
                  onPress={() => setLeftRuleSetId(item.id)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: leftRuleSetId === item.id ? colors.primaryBg : colors.border, backgroundColor: leftRuleSetId === item.id ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Text style={{ color: leftRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>{item.versionLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ruleSets.map((item) => (
                <Pressable
                  key={`r-${item.id}`}
                  onPress={() => setRightRuleSetId(item.id)}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: rightRuleSetId === item.id ? colors.primaryBg : colors.border, backgroundColor: rightRuleSetId === item.id ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 7 }}
                >
                  <Text style={{ color: rightRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>{item.versionLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {loadingDiffs ? <ActivityIndicator color={colors.text} /> : null}
            {!loadingDiffs && leftRuleSetId === rightRuleSetId ? <Text style={{ color: colors.muted }}>Selecione versoes diferentes.</Text> : null}
            {!loadingDiffs && leftRuleSetId !== rightRuleSetId ? (
              diffs.length ? diffs.map((item) => (
                <View key={`${item.clauseKey}:${item.diffKind}`} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 3 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{item.clauseKey} - {diffLabel[item.diffKind]}</Text>
                </View>
              )) : <Text style={{ color: colors.muted }}>Sem diferencas relevantes.</Text>
            ) : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>
              Clausulas {activeRuleSet ? `- ${activeRuleSet.versionLabel}` : ""}
            </Text>
            {loadingClauses ? <ActivityIndicator color={colors.text} /> : null}
            {!loadingClauses && clauses.length ? clauses.map((item) => (
              <View key={item.id} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 3 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.clauseKey} - {item.clauseType}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Base: {JSON.stringify(item.baseValue)}</Text>
              </View>
            )) : null}
            {!loadingClauses && !clauses.length ? <Text style={{ color: colors.muted }}>Sem clausulas para este ruleset.</Text> : null}
          </View>
        ) : null}

        {!loading ? (
          <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 14, gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Atualizacoes</Text>
            {updates.length ? updates.map((item) => (
              <View key={item.id} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 5 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{item.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Publicado em {dateLabel(item.publishedAt ?? item.createdAt)}</Text>
                <Text style={{ color: colors.muted }}>{item.diffSummary}</Text>
                <Pressable
                  onPress={() => void openSource(item.sourceUrl)}
                  style={{ alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Ver fonte</Text>
                </Pressable>
              </View>
            )) : <Text style={{ color: colors.muted }}>Sem atualizacoes detectadas.</Text>}
          </View>
        ) : null}
      </ScrollView>

      <ModalSheet
        visible={sheetVisible}
        onClose={closeSheet}
        cardStyle={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {editingSource ? "Editar fonte" : "Nova fonte"}
        </Text>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Nome da fonte</Text>
          <TextInput
            value={form.label}
            onChangeText={(value) => setForm((prev) => ({ ...prev, label: value }))}
            placeholder="Ex: Regulamento FIVB 2026"
            placeholderTextColor={colors.muted}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.inputText, paddingHorizontal: 12, paddingVertical: 10 }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Autoridade</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {authorityOptions.map((authority) => {
              const active = authority === form.authority;
              return (
                <Pressable
                  key={authority}
                  onPress={() => setForm((prev) => ({ ...prev, authority }))}
                  style={{ borderRadius: 999, borderWidth: 1, borderColor: active ? colors.primaryBg : colors.border, backgroundColor: active ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 10, paddingVertical: 7 }}
                >
                  <Text style={{ color: active ? colors.primaryText : colors.text, fontWeight: "700", fontSize: 12 }}>
                    {authority}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>URL da fonte</Text>
          <TextInput
            value={form.sourceUrl}
            onChangeText={(value) => setForm((prev) => ({ ...prev, sourceUrl: value }))}
            placeholder="https://..."
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.inputText, paddingHorizontal: 12, paddingVertical: 10 }}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Tópicos sugeridos</Text>
          <TextInput
            value={form.topicHintsText}
            onChangeText={(value) => setForm((prev) => ({ ...prev, topicHintsText: value }))}
            placeholder="Substituições, Líbero, Disputa"
            placeholderTextColor={colors.muted}
            style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.inputText, paddingHorizontal: 12, paddingVertical: 10 }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Esporte</Text>
            <TextInput
              value={form.sport}
              onChangeText={(value) => setForm((prev) => ({ ...prev, sport: value }))}
              placeholder="volleyball"
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
              style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.inputText, paddingHorizontal: 12, paddingVertical: 10 }}
            />
          </View>
          <View style={{ width: 120, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Intervalo (h)</Text>
            <TextInput
              value={form.checkIntervalHours}
              onChangeText={(value) => setForm((prev) => ({ ...prev, checkIntervalHours: value }))}
              keyboardType="number-pad"
              placeholder="6"
              placeholderTextColor={colors.muted}
              style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg, color: colors.inputText, paddingHorizontal: 12, paddingVertical: 10 }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Fonte ativa</Text>
          <Switch
            value={form.enabled}
            onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={closeSheet}
            style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, alignItems: "center", paddingVertical: 11 }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSaveSource()}
            disabled={saving}
            style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, alignItems: "center", paddingVertical: 11, opacity: saving ? 0.7 : 1 }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800" }}>
              {saving ? "Salvando..." : "Salvar"}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
