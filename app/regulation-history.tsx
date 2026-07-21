import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// perf-check: ignore-inline-row-style - tela operacional com composição responsiva local; refatoração de tokens fica para etapa própria.
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
import { ResponsiveGrid } from "../src/components/ui/ResponsiveGrid";
import { ResponsivePage } from "../src/components/ui/ResponsivePage";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { markRender, measureAsync } from "../src/observability/perf";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { RegulationPanel, RegulationSectionHeader } from "../src/screens/regulations/RegulationDashboardPanels";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";
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
  pending_next_cycle: "Próximo ciclo",
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

const dateTimeLabel = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const shortUrl = (value?: string | null) => {
  if (!value) return "Sem URL";
  try {
    const parsed = new URL(value);
    return parsed.hostname.replace(/^www\./, "") + parsed.pathname;
  } catch {
    return value;
  }
};

const valueLabel = (value: unknown) => {
  if (value == null) return "Sem valor base";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "Valor estruturado";
  }
};

export default function RegulationHistoryScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const responsiveLayout = useResponsiveLayout("content");
  const { colors } = useAppTheme();
  const { session } = useAuth();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { activeOrganization, activeOrganizationId } = useOrganization();
  const fallbackPath = pathname.startsWith("/coord") ? "/coord/dashboard" : "/prof/home";
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const isWide = responsiveLayout.supportsSplitView;
  const isMedium = responsiveLayout.usesWorkspaceShell;
  markRender("screen.regulationHistory.render.root", { isAdmin: isAdmin ? 1 : 0 });

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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [selectedClause, setSelectedClause] = useState<RegulationClause | null>(null);

  const formInputStyle = (field: string) => ({
    borderRadius: 12,
    borderWidth: focusedField === field ? 2 : 1,
    borderColor: focusedField === field ? colors.primaryBg : colors.border,
    backgroundColor: colors.inputBg,
    color: colors.inputText,
    paddingHorizontal: 12,
    paddingVertical: 10,
  });

  const activeRuleSet = useMemo(
    () => ruleSets.find((item) => item.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId]
  );

  const editingSource = useMemo(
    () => sources.find((item) => item.id === editingSourceId) ?? null,
    [editingSourceId, sources]
  );

  const selectedSource = useMemo(
    () => sources.find((item) => item.id === editingSourceId) ?? sources.find((item) => item.enabled) ?? sources[0] ?? null,
    [editingSourceId, sources]
  );

  const totalClauses = useMemo(
    () => ruleSets.reduce((sum, item) => sum + item.clausesCount, 0) || clauses.length,
    [clauses.length, ruleSets]
  );

  const activeSourcesCount = useMemo(() => sources.filter((item) => item.enabled).length, [sources]);
  const latestRuleSet = ruleSets[0] ?? null;
  const recentUpdates = updates.slice(0, 4);
  const visibleClauses = clauses.slice(0, isWide ? 6 : 4);

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
      const [sourceRows, ruleSetRows, updatesResult] = await measureAsync(
        "screen.regulationHistory.load.initial",
        () =>
          Promise.all([
            isAdmin ? listRegulationSources(organizationId) : Promise.resolve([] as RegulationSource[]),
            listRegulationRuleSets({ organizationId, limit: 120 }),
            listRegulationUpdates({ organizationId, unreadOnly: false, limit: 50 }),
          ]),
        { isAdmin: isAdmin ? 1 : 0 }
      );
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
      // O reset evita exibir cláusulas da organização/versão anterior durante a troca de contexto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClauses([]);
      return;
    }
    let cancelled = false;
    setLoadingClauses(true);
    void measureAsync(
      "screen.regulationHistory.load.clauses",
      () => listRegulationClauses({ organizationId, ruleSetId: selectedRuleSetId }),
      { hasRuleSet: selectedRuleSetId ? 1 : 0 }
    )
      .then((rows) => {
        if (cancelled) return;
        setClauses(rows);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar cláusulas.");
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
      // O reset mantém a comparação coerente quando um dos lados deixa de ser válido.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiffs([]);
      return;
    }
    let cancelled = false;
    setLoadingDiffs(true);
    void measureAsync(
      "screen.regulationHistory.load.diffs",
      () => compareRegulationRuleSets({ organizationId, leftRuleSetId, rightRuleSetId }),
      { hasLeftRuleSet: leftRuleSetId ? 1 : 0, hasRightRuleSet: rightRuleSetId ? 1 : 0 }
    )
      .then((rows) => {
        if (cancelled) return;
        setDiffs(rows.filter((item) => item.diffKind !== "equal"));
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Falha ao comparar versões.");
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
      Alert.alert("Fonte", "Não foi possível abrir o link.");
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
  }, [activeOrganizationId, closeSheet, editingSourceId, form, loadData, session]);

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

  const renderPill = (label: string, tone: "neutral" | "success" | "warning" = "neutral") => {
    const toneStyles = {
      neutral: { bg: colors.secondaryBg, border: colors.border, text: colors.text },
      success: { bg: colors.successBg, border: colors.successBg, text: colors.successText },
      warning: { bg: colors.warningBg, border: colors.warningBg, text: colors.warningText },
    }[tone];
    return (
      <View style={{ borderRadius: 999, borderWidth: 1, borderColor: toneStyles.border, backgroundColor: toneStyles.bg, paddingHorizontal: 10, paddingVertical: 5 }}>
        <Text style={{ color: toneStyles.text, fontWeight: "800", fontSize: 12 }}>{label}</Text>
      </View>
    );
  };

  const renderMetric = (label: string, value: string | number, detail: string) => (
    <View
      style={{
        flexGrow: 1,
        flexBasis: isMedium ? 132 : "45%",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        padding: 12,
        gap: 3,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>{label}</Text>
      <Text style={{ color: colors.muted, fontSize: 11 }} numberOfLines={1}>{detail}</Text>
    </View>
  );

  const renderEmptyState = (title: string, body: string, action?: { label: string; onPress: () => void }) => (
    <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 8 }}>
      <Text style={{ color: colors.text, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.muted }}>{body}</Text>
      {action ? (
        <Pressable
          onPress={action.onPress}
          style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, paddingHorizontal: 12, paddingVertical: 8 }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 12 }}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  const renderSourceRow = (source: RegulationSource) => (
    <View key={source.id} style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => void openSource(source.sourceUrl)}
          style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: source.enabled ? colors.successBg : colors.secondaryBg, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: source.enabled ? colors.successText : colors.text, fontSize: 20, fontWeight: "900" }}>
            {source.authority.slice(0, 1)}
          </Text>
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }} numberOfLines={1}>{source.label}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
            {source.authority} • {source.checkIntervalHours}h • {shortUrl(source.sourceUrl)}
          </Text>
        </View>
        {renderPill(source.enabled ? "Ativa" : "Pausada", source.enabled ? "success" : "neutral")}
      </View>
      {isAdmin ? (
        <View style={{ flexDirection: isMedium ? "row" : "column", alignItems: isMedium ? "center" : "stretch", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: "auto" }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{source.enabled ? "Monitorando" : "Monitoramento pausado"}</Text>
            <Switch value={source.enabled} onValueChange={() => void handleToggleSource(source)} />
          </View>
          <Pressable
            onPress={() => void handleSyncSource(source)}
            disabled={syncingSourceId === source.id}
            style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, paddingHorizontal: 12, paddingVertical: 9, opacity: syncingSourceId === source.id ? 0.7 : 1 }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 12 }}>
              {syncingSourceId === source.id ? "Sincronizando..." : "Sincronizar"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => openEdit(source)}
            style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 12 }}>Editar</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleDeleteSource(source)}
            style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 9 }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "800", fontSize: 12 }}>Remover</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const renderRuleSetRow = (item: RegulationRuleSet) => {
    const selected = selectedRuleSetId === item.id;
    return (
      <Pressable
        key={item.id}
        onPress={() => setSelectedRuleSetId(item.id)}
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderColor: selected ? colors.primaryBg : colors.border,
          backgroundColor: selected ? colors.primaryBg : colors.background,
          padding: 12,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "900", flex: 1 }} numberOfLines={1}>
            {item.versionLabel}
          </Text>
          {renderPill(statusLabel[item.status], item.status === "active" ? "success" : "neutral")}
        </View>
        <Text style={{ color: selected ? colors.primaryText : colors.muted, fontSize: 12 }} numberOfLines={1}>
          {item.sourceAuthority || "Fonte oficial"} • {item.clausesCount} cláusulas • publicado em {dateLabel(item.publishedAt ?? item.createdAt)}
        </Text>
      </Pressable>
    );
  };

  const renderUpdateRow = (item: RegulationUpdate, index: number) => (
    <View key={item.id} style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: "center" }}>
        <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: index === 0 ? colors.primaryBg : colors.muted }} />
        {index < recentUpdates.length - 1 ? <View style={{ width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 }} /> : null}
      </View>
      <Pressable
        onPress={() => void openSource(item.sourceUrl)}
        style={{ flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 4 }}
      >
        <Text style={{ color: colors.text, fontWeight: "900" }} numberOfLines={1}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {item.sourceLabel || item.sourceAuthority || "Fonte"} • {dateTimeLabel(item.publishedAt ?? item.createdAt)}
        </Text>
        {item.diffSummary ? <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{item.diffSummary}</Text> : null}
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Regulamentos"
        subtitle="Fontes oficiais, versões, cláusulas e atualizações institucionais."
        onBack={() => navigateBackOrReplace({ router, fallback: fallbackPath })}
        horizontalBleed={0}
        contentStyle={{
          width: "100%",
          maxWidth: responsiveLayout.maxContentWidth + responsiveLayout.gutter * 2,
          alignSelf: "center",
          paddingHorizontal: responsiveLayout.gutter,
          boxSizing: "border-box",
        }}
        right={isAdmin ? (
          <Pressable
            onPress={openCreate}
            style={{ borderRadius: 999, borderWidth: 1, borderColor: colors.primaryBg, backgroundColor: colors.primaryBg, paddingHorizontal: 16, paddingVertical: 10 }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "900" }}>Nova fonte</Text>
          </Pressable>
        ) : null}
      />
      <ScrollView
        contentContainerStyle={{
          width: "100%",
          paddingTop: 2,
          paddingBottom: 24,
        }}
      >
        <ResponsivePage variant="content">
        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, gap: 4 }}>
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>{activeOrganization?.name ?? "Organização"}</Text>
          <Text style={{ color: colors.muted }}>Painel operacional de regulamentos, fontes monitoradas e mudanças oficiais.</Text>
        </View>

        {loading ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 20, alignItems: "center", gap: 10 }}>
            <ActivityIndicator color={colors.text} />
            <Text style={{ color: colors.muted }}>Carregando regulamentos...</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.dangerBg, backgroundColor: colors.card, padding: 16, gap: 4 }}>
            <Text style={{ color: colors.dangerText, fontWeight: "900" }}>Falha ao carregar</Text>
            <Text style={{ color: colors.muted }}>{error}</Text>
          </View>
        ) : null}

        {!loading ? (
          <>
            <ResponsiveGrid columns={{ compact: "1", split: "8/4" }}>
              <RegulationPanel colors={colors} style={{ gap: 16 }}>
                <View style={{ flexDirection: isMedium ? "row" : "column", alignItems: isMedium ? "center" : "stretch", gap: 14 }}>
                  <View style={{ width: 62, height: 62, borderRadius: 18, backgroundColor: selectedSource?.enabled ? colors.successBg : colors.secondaryBg, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: selectedSource?.enabled ? colors.successText : colors.text, fontSize: 26, fontWeight: "900" }}>
                      {(selectedSource?.authority ?? "R").slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }} numberOfLines={2}>
                        {selectedSource?.label ?? "Nenhuma fonte cadastrada"}
                      </Text>
                      {selectedSource ? renderPill(selectedSource.enabled ? "Ativa" : "Pausada", selectedSource.enabled ? "success" : "neutral") : null}
                    </View>
                    <Text style={{ color: colors.muted }} numberOfLines={2}>
                      {selectedSource
                        ? `${selectedSource.authority} • intervalo ${selectedSource.checkIntervalHours}h • última verificação ${dateTimeLabel(selectedSource.lastCheckedAt)}`
                        : "Cadastre uma fonte oficial para monitorar versões, cláusulas e atualizações."}
                    </Text>
                  </View>
                </View>

                {selectedSource ? (
                  <View style={{ gap: 10 }}>
                    <Pressable onPress={() => void openSource(selectedSource.sourceUrl)} style={{ alignSelf: "flex-start", width: "100%", maxWidth: "100%" }}>
                      <Text style={{ color: colors.primaryBg, fontWeight: "700" }} numberOfLines={1}>
                        {selectedSource.sourceUrl}
                      </Text>
                    </Pressable>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Última sincronização: {dateTimeLabel(selectedSource.lastCheckedAt)}
                    </Text>
                    {isAdmin ? (
                      <View style={{ flexDirection: isMedium ? "row" : "column", gap: 8 }}>
                        <Pressable
                          onPress={() => void handleSyncSource(selectedSource)}
                          disabled={syncingSourceId === selectedSource.id}
                          style={{ borderRadius: 10, backgroundColor: colors.primaryBg, paddingHorizontal: 14, paddingVertical: 10, opacity: syncingSourceId === selectedSource.id ? 0.7 : 1 }}
                        >
                          <Text style={{ color: colors.primaryText, fontWeight: "900" }}>
                            {syncingSourceId === selectedSource.id ? "Sincronizando..." : "Sincronizar agora"}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => openEdit(selectedSource)} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, paddingHorizontal: 14, paddingVertical: 10 }}>
                          <Text style={{ color: colors.text, fontWeight: "800" }}>Editar</Text>
                        </Pressable>
                        <Pressable onPress={() => void handleDeleteSource(selectedSource)} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 10 }}>
                          <Text style={{ color: colors.dangerText, fontWeight: "800" }}>Remover</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                  {renderMetric("fontes", sources.length, `${activeSourcesCount} ativas`)}
                  {renderMetric("versões", ruleSets.length, latestRuleSet?.versionLabel ?? "sem versão")}
                  {renderMetric("cláusulas", totalClauses, activeRuleSet?.versionLabel ?? "sem versão ativa")}
                  {renderMetric("atualizações", updates.length, updates.length ? `última ${dateLabel(updates[0]?.createdAt)}` : "sem alertas")}
                </View>

                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Fontes monitoradas</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        Sincronização, edição e status das fontes oficiais.
                      </Text>
                    </View>
                    {!isAdmin ? renderPill("Somente leitura") : null}
                  </View>
                  {sources.length
                    ? sources.map(renderSourceRow)
                    : renderEmptyState(
                        "Nenhuma fonte cadastrada",
                        isAdmin
                          ? "Adicione uma fonte oficial para monitorar adendos e atualizações de regulamento."
                          : "Ainda não há fontes oficiais cadastradas para esta organização.",
                        isAdmin ? { label: "Nova fonte", onPress: openCreate } : undefined
                      )}
                </View>
              </RegulationPanel>

              <RegulationPanel colors={colors}>
                <RegulationSectionHeader title="Atualizações recentes" description="Linha do tempo das mudanças detectadas." colors={colors} />
                {recentUpdates.length
                  ? recentUpdates.map(renderUpdateRow)
                  : renderEmptyState("Sem atualizações", "Nenhuma alteração oficial foi detectada até agora.")}
              </RegulationPanel>
            </ResponsiveGrid>

            <ResponsiveGrid columns={{ compact: "1", split: "6/6" }}>
              <RegulationPanel colors={colors} style={{ gap: 12 }}>
                <RegulationSectionHeader title="Versões" description="Histórico institucional e comparação de regras." colors={colors} />
                {ruleSets.length ? ruleSets.map(renderRuleSetRow) : renderEmptyState("Sem versões", "Nenhuma versão de regulamento foi cadastrada.")}

                {ruleSets.length >= 2 ? (
                  <View style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: "900" }}>Comparar versões</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {ruleSets.map((item) => (
                        <Pressable
                          key={`l-${item.id}`}
                          onPress={() => setLeftRuleSetId(item.id)}
                          style={{ borderRadius: 999, borderWidth: 1, borderColor: leftRuleSetId === item.id ? colors.primaryBg : colors.border, backgroundColor: leftRuleSetId === item.id ? colors.primaryBg : colors.secondaryBg, paddingHorizontal: 12, paddingVertical: 7 }}
                        >
                          <Text style={{ color: leftRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "800", fontSize: 12 }}>{item.versionLabel}</Text>
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
                          <Text style={{ color: rightRuleSetId === item.id ? colors.primaryText : colors.text, fontWeight: "800", fontSize: 12 }}>{item.versionLabel}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                    {loadingDiffs ? <ActivityIndicator color={colors.text} /> : null}
                    {!loadingDiffs && leftRuleSetId === rightRuleSetId ? <Text style={{ color: colors.muted }}>Selecione versões diferentes.</Text> : null}
                    {!loadingDiffs && leftRuleSetId !== rightRuleSetId ? (
                      diffs.length ? diffs.slice(0, 4).map((item) => (
                        <View key={`${item.clauseKey}:${item.diffKind}`} style={{ borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 10, gap: 3 }}>
                          <Text style={{ color: colors.text, fontWeight: "800" }}>{item.clauseLabel}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.clauseKey} • {diffLabel[item.diffKind]}</Text>
                        </View>
                      )) : <Text style={{ color: colors.muted }}>Sem diferenças relevantes.</Text>
                    ) : null}
                  </View>
                ) : null}
              </RegulationPanel>

              <RegulationPanel colors={colors} style={{ gap: 12 }}>
                <RegulationSectionHeader title="Cláusulas importantes" description={activeRuleSet ? activeRuleSet.versionLabel : "Selecione uma versão para revisar."} colors={colors} />
                {loadingClauses ? <ActivityIndicator color={colors.text} /> : null}
                {!loadingClauses && visibleClauses.length ? visibleClauses.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir cláusula ${item.clauseLabel}`}
                    onPress={() => setSelectedClause(item)}
                    style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 12, gap: 4 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <Text style={{ color: colors.text, fontWeight: "900", flex: 1 }} numberOfLines={1}>{item.clauseLabel}</Text>
                      {renderPill(item.clauseType)}
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{item.clauseKey}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>Base: {valueLabel(item.baseValue)}</Text>
                  </Pressable>
                )) : null}
                {!loadingClauses && !visibleClauses.length ? renderEmptyState("Sem cláusulas", "Esta versão ainda não possui cláusulas cadastradas.") : null}
              </RegulationPanel>
            </ResponsiveGrid>
          </>
        ) : null}
        </ResponsivePage>
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
            onFocus={() => setFocusedField("label")}
            onBlur={() => setFocusedField(null)}
            placeholder="Ex: Regulamento FIVB 2026"
            placeholderTextColor={colors.muted}
            style={formInputStyle("label")}
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
            onFocus={() => setFocusedField("sourceUrl")}
            onBlur={() => setFocusedField(null)}
            placeholder="https://..."
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={formInputStyle("sourceUrl")}
          />
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Tópicos sugeridos</Text>
          <TextInput
            value={form.topicHintsText}
            onChangeText={(value) => setForm((prev) => ({ ...prev, topicHintsText: value }))}
            onFocus={() => setFocusedField("topicHintsText")}
            onBlur={() => setFocusedField(null)}
            placeholder="Substituições, Líbero, Disputa"
            placeholderTextColor={colors.muted}
            style={formInputStyle("topicHintsText")}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Esporte</Text>
            <TextInput
              value={form.sport}
              onChangeText={(value) => setForm((prev) => ({ ...prev, sport: value }))}
              onFocus={() => setFocusedField("sport")}
              onBlur={() => setFocusedField(null)}
              placeholder="volleyball"
              autoCapitalize="none"
              placeholderTextColor={colors.muted}
              style={formInputStyle("sport")}
            />
          </View>
          <View style={{ width: 120, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Intervalo (h)</Text>
            <TextInput
              value={form.checkIntervalHours}
              onChangeText={(value) => setForm((prev) => ({ ...prev, checkIntervalHours: value }))}
              onFocus={() => setFocusedField("checkIntervalHours")}
              onBlur={() => setFocusedField(null)}
              keyboardType="number-pad"
              placeholder="6"
              placeholderTextColor={colors.muted}
              style={formInputStyle("checkIntervalHours")}
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

      <ModalSheet
        visible={Boolean(selectedClause)}
        onClose={() => setSelectedClause(null)}
        cardStyle={{
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 16,
          gap: 12,
        }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>
          {selectedClause?.clauseLabel}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{selectedClause?.clauseKey}</Text>
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, padding: 12, gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Tipo</Text>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{selectedClause?.clauseType}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Valor base</Text>
          <Text style={{ color: colors.text, fontWeight: "800" }}>{valueLabel(selectedClause?.baseValue)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedClause(null)}
          style={{ alignSelf: "flex-end", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: colors.text, fontWeight: "800" }}>Fechar</Text>
        </Pressable>
      </ModalSheet>
    </SafeAreaView>
  );
}
