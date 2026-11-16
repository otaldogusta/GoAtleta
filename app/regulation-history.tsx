import { useFocusEffect, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ActivityIndicator, Linking, Platform, ScrollView, Switch, TextInput, useWindowDimensions, View } from "react-native";
import { OperationalText as Text } from "../src/ui/OperationalText";
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
import { useOptionalCopilotOpen } from "../src/copilot/CopilotProvider";
import { usesRegulationsAssistantButton } from "../src/copilot/route-visibility";
import { ResponsiveGrid } from "../src/components/ui/ResponsiveGrid";
import { ResponsivePage } from "../src/components/ui/ResponsivePage";
import { navigateBackOrReplace } from "../src/navigation/safe-router";
import { markRender, measureAsync } from "../src/observability/perf";
import { useOrganization } from "../src/providers/organization-context";
import { RegulationEmpty, RegulationPanel, RegulationProblem, RegulationSectionHeader } from "../src/screens/regulations/RegulationDashboardPanels";
import { Button } from "../src/ui/Button";
import { CompactSelect } from "../src/ui/CompactSelect";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { ModalSheet } from "../src/ui/ModalSheet";
import { Pressable } from "../src/ui/Pressable";
import { useResponsiveLayout } from "../src/ui/use-responsive-layout";
import { useAppTheme } from "../src/ui/app-theme";
import { useConfirmDialog } from "../src/ui/confirm-dialog";
import { borders, compactUiMetrics, radius, spacing } from "../src/theme/tokens";

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
  active: "Ativa",
  pending_next_cycle: "Próximo ciclo",
  archived: "Arquivada",
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
  const { width: viewportWidth } = useWindowDimensions();
  const openAssistant = useOptionalCopilotOpen();
  const responsiveLayout = useResponsiveLayout("content");
  const { colors, mode } = useAppTheme();
  const { session } = useAuth();
  const { confirm: confirmDialog } = useConfirmDialog();
  const { activeOrganization, activeOrganizationId, isLoading: organizationLoading } = useOrganization();
  const fallbackPath = pathname.startsWith("/coord") ? "/coord/dashboard" : "/prof/home";
  const isAdmin = (activeOrganization?.role_level ?? 0) >= 50;
  const isWide = responsiveLayout.supportsSplitView;
  markRender("screen.regulationHistory.render.root", { isAdmin: isAdmin ? 1 : 0 });

  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sources, setSources] = useState<RegulationSource[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [sourceSyncFailure, setSourceSyncFailure] = useState<{ context: string; sourceId: string } | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetContext, setSheetContext] = useState<string | null>(null);
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
  const [clausesFailed, setClausesFailed] = useState(false);
  const [diffsFailed, setDiffsFailed] = useState(false);
  const [resolvedClauseKey, setResolvedClauseKey] = useState<string | null>(null);
  const [resolvedDiffKey, setResolvedDiffKey] = useState<string | null>(null);
  const [clausesAttempt, setClausesAttempt] = useState(0);
  const [diffsAttempt, setDiffsAttempt] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [showAllDiffs, setShowAllDiffs] = useState(false);
  const [showAllClauses, setShowAllClauses] = useState(false);
  const [showAllVersions, setShowAllVersions] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [keyboardFieldFocus, setKeyboardFieldFocus] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onPointerDown = () => setKeyboardFieldFocus(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Tab" && !event.altKey && !event.ctrlKey && !event.metaKey) {
        setKeyboardFieldFocus(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
  const [selectedClause, setSelectedClause] = useState<RegulationClause | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ context: string; detail: string; failed: boolean } | null>(null);
  const contextKey = activeOrganizationId ? `${activeOrganizationId}:${isAdmin ? "admin" : "reader"}` : null;
  const [loadedContext, setLoadedContext] = useState<string | null>(null);
  const contextRef = useRef(contextKey);
  const requestIdRef = useRef(0);
  const sheetOpenerRef = useRef<HTMLElement | null>(null);
  const sourceNameInputRef = useRef<TextInput>(null);
  useLayoutEffect(() => {
    contextRef.current = contextKey;
  }, [contextKey]);
  const hasSnapshot = contextKey !== null && loadedContext === contextKey;
  const reportFeedback = useCallback((detail: string, failed = false) => {
    if (contextKey && contextRef.current === contextKey) setFeedback({ context: contextKey, detail, failed });
  }, [contextKey]);

  const displayedRuleSet = useMemo(
    () => ruleSets.find((item) => item.id === selectedRuleSetId) ?? null,
    [ruleSets, selectedRuleSetId]
  );
  const currentClauseKey = displayedRuleSet && contextKey ? `${contextKey}:${displayedRuleSet.id}:${clausesAttempt}` : null;
  const currentDiffKey = showComparison && contextKey && leftRuleSetId && rightRuleSetId
    ? `${contextKey}:${leftRuleSetId}:${rightRuleSetId}:${diffsAttempt}`
    : null;

  const editingSource = useMemo(
    () => sources.find((item) => item.id === editingSourceId) ?? null,
    [editingSourceId, sources]
  );
  const visibleClauseDetail = resolvedClauseKey === currentClauseKey && hasSnapshot && selectedClause
    ? clauses.find((item) => item.id === selectedClause.id) ?? null
    : null;

  const recentUpdates = updates.slice(0, 4);
  const versionPreviewLimit = isWide ? 5 : 3;
  const previewVersions = ruleSets.slice(0, versionPreviewLimit);
  const visibleVersions = showAllVersions
    ? ruleSets
    : displayedRuleSet && !previewVersions.includes(displayedRuleSet)
      ? [...previewVersions.slice(0, -1), displayedRuleSet]
      : previewVersions;
  const clausePreviewLimit = isWide ? 6 : 4;
  const visibleClauses = showAllClauses ? clauses : clauses.slice(0, clausePreviewLimit);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setSheetContext(null);
    setEditingSourceId(null);
    setForm(emptyForm);
    setFormError(null);
  }, []);

  const rememberSheetOpener = useCallback(() => {
    if (Platform.OS === "web") {
      const active = document.activeElement;
      sheetOpenerRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
    }
  }, []);
  const restoreSheetFocus = () => {
    if (Platform.OS === "web") {
      const opener = sheetOpenerRef.current;
      (opener?.isConnected ? opener : document.getElementById("regulations-title"))?.focus();
    }
    sheetOpenerRef.current = null;
  };

  const openCreate = useCallback(() => {
    rememberSheetOpener();
    setEditingSourceId(null);
    setForm(emptyForm);
    setFormError(null);
    setSheetContext(contextKey);
    setSheetVisible(true);
  }, [contextKey, rememberSheetOpener]);

  const openEdit = useCallback((source: RegulationSource) => {
    rememberSheetOpener();
    setEditingSourceId(source.id);
    setFormError(null);
    setSheetContext(contextKey);
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
  }, [contextKey, rememberSheetOpener]);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const editingSourceOpen = sheetVisible && sheetContext === contextKey && isAdmin;
    if (!editingSourceOpen) return;

    const frame = requestAnimationFrame(() => {
      sourceNameInputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [contextKey, isAdmin, sheetContext, sheetVisible, visibleClauseDetail]);

  const loadData = useCallback(async () => {
    if (contextRef.current !== contextKey) return;
    const requestId = ++requestIdRef.current;
    const isCurrentRequest = () => requestIdRef.current === requestId && contextRef.current === contextKey;
    if (!activeOrganizationId || !contextKey) {
      setSources([]);
      setRuleSets([]);
      setUpdates([]);
      setDiffs([]);
      setClauses([]);
      setLoadedContext(null);
      setLoadFailed(false);
      setLoading(false);
      return;
    }
    const organizationId = activeOrganizationId;
    setLoading(true);
    setLoadFailed(false);
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
      if (!isCurrentRequest()) return;
      setSources(sourceRows);
      setRuleSets(ruleSetRows);
      setUpdates(updatesResult.items);
      const defaultVersion = ruleSetRows.find((item) => item.status === "active") ?? ruleSetRows[0];
      const defaultComparison = ruleSetRows.find((item) => item.id !== defaultVersion?.id);
      const exists = (id: string) => ruleSetRows.some((item) => item.id === id);
      setSelectedRuleSetId((prev) => exists(prev) ? prev : defaultVersion?.id ?? "");
      setLeftRuleSetId((prev) => exists(prev) ? prev : defaultVersion?.id ?? "");
      setRightRuleSetId((prev) => exists(prev) ? prev : defaultComparison?.id ?? "");
      setLoadedContext(contextKey);
    } catch {
      if (isCurrentRequest()) setLoadFailed(true);
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, [activeOrganizationId, contextKey, isAdmin]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !hasSnapshot || !currentClauseKey) {
      // O reset evita exibir cláusulas da organização/versão anterior durante a troca de contexto.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClauses([]);
      setResolvedClauseKey(null);
      return;
    }
    let cancelled = false;
    setClauses([]);
    setClausesFailed(false);
    setShowAllClauses(false);
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
      .catch(() => {
        if (cancelled) return;
        setClausesFailed(true);
      })
      .finally(() => {
        if (cancelled) return;
        setResolvedClauseKey(currentClauseKey);
        setLoadingClauses(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, currentClauseKey, hasSnapshot, selectedRuleSetId]);

  useEffect(() => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !hasSnapshot || !currentDiffKey || leftRuleSetId === rightRuleSetId) {
      // O reset mantém a comparação coerente quando um dos lados deixa de ser válido.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDiffs([]);
      setLoadingDiffs(false);
      setDiffsFailed(false);
      setResolvedDiffKey(null);
      return;
    }
    let cancelled = false;
    setDiffs([]);
    setDiffsFailed(false);
    setShowAllDiffs(false);
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
      .catch(() => {
        if (cancelled) return;
        setDiffsFailed(true);
      })
      .finally(() => {
        if (cancelled) return;
        setResolvedDiffKey(currentDiffKey);
        setLoadingDiffs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeOrganizationId, currentDiffKey, hasSnapshot, leftRuleSetId, rightRuleSetId]);

  const openSource = useCallback(async (url: string) => {
    const target = String(url ?? "").trim();
    if (!target) return;
    try {
      const canOpen = await Linking.canOpenURL(target);
      if (!canOpen) throw new Error("invalid");
      await Linking.openURL(target);
    } catch {
      reportFeedback("Não foi possível abrir o link da fonte.", true);
    }
  }, [reportFeedback]);

  const handleUpdateKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>, sourceUrl: string) => {
    if (event.key !== "Enter" || event.repeat || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    // RN Web does not synthesize onPress for role="link" on a non-anchor.
    event.preventDefault();
    void openSource(sourceUrl);
  }, [openSource]);

  const handleSaveSource = useCallback(async () => {
    const organizationId = activeOrganizationId ?? "";
    if (!organizationId || !isAdmin || sheetContext !== contextKey || contextRef.current !== contextKey) return;

    const label = form.label.trim();
    const sourceUrl = form.sourceUrl.trim();
    if (!label || !sourceUrl) {
      setFormError("Preencha o nome e a URL da fonte.");
      return;
    }

    const checkIntervalHours = Math.max(1, Math.min(Number(form.checkIntervalHours || 6), 168));
    if (!Number.isFinite(checkIntervalHours)) {
      setFormError("Informe um número de horas entre 1 e 168.");
      return;
    }

    setFormError(null);
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
      if (contextRef.current !== contextKey) return;
      closeSheet();
      reportFeedback("Fonte salva.");
      await loadData();
    } catch {
      if (contextRef.current === contextKey) setFormError("Não foi possível salvar a fonte. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }, [activeOrganizationId, closeSheet, contextKey, editingSourceId, form, isAdmin, loadData, reportFeedback, session, sheetContext]);

  const handleToggleSource = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      try {
        await toggleRegulationSource(source.id, organizationId, !source.enabled);
        await loadData();
      } catch {
        reportFeedback("Não foi possível atualizar o monitoramento da fonte.", true);
      }
    },
    [activeOrganizationId, loadData, reportFeedback]
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
          } catch {
            reportFeedback("Não foi possível remover a fonte.", true);
          }
        },
      });
    },
    [activeOrganizationId, confirmDialog, loadData, reportFeedback]
  );

  const handleSyncSource = useCallback(
    async (source: RegulationSource) => {
      const organizationId = activeOrganizationId ?? "";
      if (!organizationId) return;
      setSyncingSourceId(source.id);
      setSourceSyncFailure(null);
      try {
        const report = await syncRegulationSourceNow({
          organizationId,
          sourceId: source.id,
          force: true,
        });
        await loadData();
        if (contextRef.current !== contextKey) return;
        if (report.errors.length && contextKey) {
          setSourceSyncFailure({ context: contextKey, sourceId: source.id });
          return;
        }
        reportFeedback(`Sincronização concluída. Fontes verificadas: ${report.checked}. Novos documentos: ${report.newDocuments}. Novos avisos: ${report.newUpdates}.`);
      } catch {
        if (contextKey && contextRef.current === contextKey) setSourceSyncFailure({ context: contextKey, sourceId: source.id });
      } finally {
        setSyncingSourceId(null);
      }
    },
    [activeOrganizationId, contextKey, loadData, reportFeedback]
  );

  const renderStatus = (label: string, tone: "neutral" | "success" | "warning" = "neutral") => (
    <Text style={{ color: tone === "success" ? colors.successText : tone === "warning" ? colors.warningText : colors.muted, fontWeight: "600", fontSize: responsiveLayout.density.metadataFontSize }}>{label}</Text>
  );

  const renderSourceRow = (source: RegulationSource) => (
    <View key={source.id} style={{ borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 12, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Abrir documento oficial de ${source.label}`}
          onPress={() => void openSource(source.sourceUrl)}
          style={{ width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, borderRadius: radius.internal, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" }}
        >
          <GoAtletaIcon name="regulations" size={compactUiMetrics.iconSize} color={source.enabled ? colors.successText : colors.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: responsiveLayout.density.cardTitleFontSize, fontWeight: "700" }}>{source.label}</Text>
          <Text style={{ color: colors.muted, fontSize: responsiveLayout.density.metadataFontSize }} numberOfLines={2}>
            {source.authority} · {shortUrl(source.sourceUrl)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: responsiveLayout.density.metadataFontSize }}>
            Verificação a cada {source.checkIntervalHours} h · {source.lastCheckedAt ? dateTimeLabel(source.lastCheckedAt) : "Ainda não verificada"}
          </Text>
        </View>
        {renderStatus(source.enabled ? "Ativa" : "Pausada", source.enabled ? "success" : "neutral")}
      </View>
      {sourceSyncFailure?.context === contextKey && sourceSyncFailure.sourceId === source.id ? (
        <RegulationProblem title="Não foi possível verificar esta fonte" detail="As versões já disponíveis permanecem no histórico." colors={colors} />
      ) : null}
      {isAdmin ? (
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: compactUiMetrics.touchTarget }}>
            <Text style={{ color: colors.muted, flex: 1 }}>Monitoramento</Text>
            <Switch accessibilityLabel={`Monitorar ${source.label}`} value={source.enabled} onValueChange={() => void handleToggleSource(source)} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
            <Button label="Sincronizar" variant="secondary" loading={syncingSourceId === source.id} disabled={syncingSourceId !== null && syncingSourceId !== source.id} loadingLabel="Sincronizando…" onPress={() => void handleSyncSource(source)} />
            <Button label="Editar" variant="secondary" onPress={() => openEdit(source)} />
            <Button label="Remover" variant="ghost" onPress={() => void handleDeleteSource(source)} />
          </View>
        </View>
      ) : null}
    </View>
  );

  const renderRuleSetRow = (item: RegulationRuleSet) => {
    const selected = selectedRuleSetId === item.id;
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        aria-pressed={selected}
        onPress={() => setSelectedRuleSetId(item.id)}
        style={{
          borderBottomWidth: 1,
          borderColor: colors.border,
          backgroundColor: selected ? colors.secondaryBg : "transparent",
          paddingVertical: responsiveLayout.density.cardPadding,
          paddingHorizontal: spacing.xs,
          gap: 4,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "700", flex: 1 }}>
            {item.versionLabel}
          </Text>
          {renderStatus(statusLabel[item.status], item.status === "active" ? "success" : item.status === "pending_next_cycle" ? "warning" : "neutral")}
        </View>
        <Text style={{ color: colors.muted, fontSize: responsiveLayout.density.metadataFontSize }}>
          {item.sourceAuthority || "Fonte oficial"} · {item.clausesCount} {item.clausesCount === 1 ? "cláusula" : "cláusulas"} · {item.publishedAt ? `Publicada em ${dateLabel(item.publishedAt)}` : `Registrada em ${dateLabel(item.createdAt)}`}
          {item.activationPolicy === "effective_from" && item.effectiveFrom ? ` · A partir de ${dateLabel(`${item.effectiveFrom}T00:00:00`)}` : ""}
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
        accessibilityRole="link"
        accessibilityLabel={`Abrir atualização: ${item.title}`}
        {...(Platform.OS === "web" ? { onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => handleUpdateKeyDown(event, item.sourceUrl) } : {})}
        onPress={() => void openSource(item.sourceUrl)}
        style={{ flex: 1, paddingBottom: 16, gap: 4 }}
      >
        <Text style={{ color: colors.text, fontWeight: "600" }} numberOfLines={2}>{item.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
          {item.sourceLabel || item.sourceAuthority || "Fonte"} • {dateTimeLabel(item.publishedAt ?? item.createdAt)}
        </Text>
        {item.diffSummary ? <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{item.diffSummary}</Text> : null}
      </Pressable>
    </View>
  );

  const renderComparisonOptions = (label: string, selectedId: string, onSelect: (id: string) => void) => (
    <CompactSelect
      label={label}
      value={selectedId}
      onChange={onSelect}
      options={ruleSets.map((item) => ({ value: item.id, label: item.versionLabel }))}
    />
  );

  const hasHistory = ruleSets.length > 0 || updates.length > 0;
  const currentFeedback = feedback?.context === contextKey ? feedback : null;
  const baselineLoading = !hasSnapshot && (organizationLoading || Boolean(contextKey && (loading || !loadFailed)));
  const awaitingClauses = loadingClauses || currentClauseKey !== resolvedClauseKey;
  const awaitingDiffs = loadingDiffs || currentDiffKey !== resolvedDiffKey;
  const inputShell = (field: string) => ({
    minHeight: compactUiMetrics.modalFieldHeight,
    justifyContent: "center" as const,
    borderRadius: radius.internal,
    borderWidth: 1,
    borderColor: focusedField === field && (Platform.OS !== "web" || keyboardFieldFocus)
      ? (Platform.OS === "web" ? colors.text : colors.primaryBg)
      : colors.border,
    backgroundColor: mode === "dark" ? "#121c30" : colors.inputBg,
    paddingHorizontal: 10,
  });
  const inputText = { borderRadius: 0, color: colors.inputText, minHeight: compactUiMetrics.modalFieldHeight - 2, paddingVertical: 0, fontSize: responsiveLayout.density.bodyFontSize };

  return (
    <SafeAreaView nativeID="regulation-history" style={{ flex: 1, backgroundColor: colors.background }}>
      {Platform.OS === "web" ? (
        <style>{`
          :is(#regulation-history, #regulation-source-sheet, #regulation-clause-sheet)
          :is(button, [role="button"], [role="link"], [role="switch"]):focus-visible {
            outline: ${borders.focus}px solid ${colors.text};
            outline-offset: ${borders.focus}px;
          }
        `}</style>
      ) : null}
      <ScreenPageHeader
        title="Regulamentos"
        subtitle={activeOrganization?.name}
        onBack={() => navigateBackOrReplace({ router, fallback: fallbackPath })}
        horizontalBleed={0}
        contentStyle={{ width: "100%", alignSelf: "center", paddingHorizontal: responsiveLayout.gutter }}
        right={<View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {openAssistant && usesRegulationsAssistantButton(pathname, viewportWidth) ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir Assistente dos Regulamentos" onPress={openAssistant}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 }}>
              <GoAtletaIcon name="chat" size={compactUiMetrics.iconSize} color={colors.muted} />
            </Pressable>
          ) : null}
          {isAdmin && hasSnapshot && sources.length > 0 ? <Button label="Nova fonte" onPress={openCreate} /> : null}
        </View>}
      />
      <ScrollView contentContainerStyle={{ paddingTop: spacing.xs, paddingBottom: spacing.xl }}>
        <ResponsivePage variant="content">
          <View nativeID="regulations-title" tabIndex={-1} accessibilityLabel="Regulamentos" />
          {baselineLoading ? (
            <RegulationPanel colors={colors} style={{ flexDirection: "row", alignItems: "center" }}>
              <ActivityIndicator color={colors.primaryBg} />
              <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Carregando regulamentos…</Text>
            </RegulationPanel>
          ) : !contextKey ? (
            <RegulationPanel colors={colors}>
              <RegulationEmpty title="Selecione uma organização" detail="Escolha a organização para consultar seus regulamentos." colors={colors} />
            </RegulationPanel>
          ) : null}

          {contextKey && !baselineLoading && !loading && loadFailed ? (
            <RegulationPanel colors={colors}>
              <RegulationProblem
                title="Não foi possível carregar os regulamentos"
                detail={hasSnapshot ? "Você está vendo a última consulta bem-sucedida." : "Tente novamente para consultar as fontes e versões."}
                colors={colors}
                onRetry={() => void loadData()}
              />
            </RegulationPanel>
          ) : null}

          {currentFeedback ? (
            <RegulationPanel colors={colors}>
              {currentFeedback.failed ? <RegulationProblem title={currentFeedback.detail} colors={colors} /> : (
                <Text role="status" accessibilityLiveRegion="polite" style={{ color: colors.successText }}>{currentFeedback.detail}</Text>
              )}
            </RegulationPanel>
          ) : null}
          {hasSnapshot ? (
            <>
              {loading ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Atualizando regulamentos…</Text> : null}
              {!sources.length && !hasHistory ? (
                <RegulationPanel colors={colors}>
                  {isAdmin ? (
                    <RegulationEmpty title="Nenhuma fonte cadastrada" detail="Adicione um documento oficial para acompanhar as versões e mudanças." colors={colors}>
                      <Button label="Nova fonte" onPress={openCreate} variant="secondary" />
                    </RegulationEmpty>
                  ) : (
                    <RegulationEmpty title="Nenhum regulamento disponível" detail="As versões publicadas pela organização aparecerão aqui." colors={colors} />
                  )}
                </RegulationPanel>
              ) : null}

              {hasHistory ? (
                <ResponsiveGrid columns={{ compact: "1", split: "6/6" }}>
                  {ruleSets.length > 0 ? (
                    <RegulationPanel colors={colors}>
                      <RegulationSectionHeader title="Versões" colors={colors} />
                      {visibleVersions.map(renderRuleSetRow)}
                      {ruleSets.length > versionPreviewLimit ? (
                        <Button label={showAllVersions ? "Ver menos versões" : `Ver todas as ${ruleSets.length} versões`} variant="ghost" onPress={() => setShowAllVersions((value) => !value)} />
                      ) : null}
                      {ruleSets.length >= 2 ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ expanded: showComparison }}
                            onPress={() => setShowComparison((value) => !value)}
                            style={{ minHeight: compactUiMetrics.touchTarget, paddingHorizontal: spacing.xs, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: radius.internal }}
                          >
                            <Text style={{ color: colors.text, fontWeight: "700" }}>Comparar versões</Text>
                            <GoAtletaIcon name={showComparison ? "chevronUp" : "chevronDown"} size={compactUiMetrics.iconSize} color={colors.textSecondary} />
                          </Pressable>
                          {showComparison ? (
                            <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.xs, gap: spacing.xs }}>
                              {renderComparisonOptions("Versão de referência", leftRuleSetId, setLeftRuleSetId)}
                              {renderComparisonOptions("Versão para comparar", rightRuleSetId, setRightRuleSetId)}
                              {leftRuleSetId === rightRuleSetId ? <Text style={{ color: colors.muted }}>Selecione duas versões diferentes.</Text>
                                : awaitingDiffs ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Comparando versões…</Text>
                                  : diffsFailed ? <RegulationProblem title="Comparação indisponível" detail="As versões continuam selecionadas." onRetry={() => setDiffsAttempt((value) => value + 1)} colors={colors} />
                                    : diffs.length ? (
                                      <>
                                        {(showAllDiffs ? diffs : diffs.slice(0, 4)).map((item) => (
                                          <View key={`${item.clauseKey}:${item.diffKind}`} style={{ borderBottomWidth: 1, borderColor: colors.border, padding: spacing.xs, gap: 3 }}>
                                            <Text style={{ color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                                            <Text style={{ color: colors.muted }}>{diffLabel[item.diffKind]}</Text>
                                            <Text style={{ color: colors.text }}>
                                              {item.diffKind === "added" ? valueLabel(item.rightValue) : item.diffKind === "removed" ? valueLabel(item.leftValue) : `${valueLabel(item.leftValue)} → ${valueLabel(item.rightValue)}`}
                                            </Text>
                                          </View>
                                        ))}
                                        {diffs.length > 4 ? (
                                          <Button label={showAllDiffs ? "Ver menos diferenças" : `Ver todas as mudanças (${diffs.length})`} variant="ghost" onPress={() => setShowAllDiffs((value) => !value)} />
                                        ) : null}
                                      </>
                                    ) : <Text style={{ color: colors.muted }}>Sem diferenças relevantes.</Text>}
                            </View>
                          ) : null}
                        </>
                      ) : null}
                    </RegulationPanel>
                  ) : null}

                  {displayedRuleSet ? (
                    <RegulationPanel colors={colors}>
                      <RegulationSectionHeader title="Cláusulas" description={displayedRuleSet.versionLabel} colors={colors} />
                      {awaitingClauses ? <Text accessibilityLiveRegion="polite" style={{ color: colors.muted }}>Carregando cláusulas…</Text>
                        : clausesFailed ? <RegulationProblem title="Cláusulas indisponíveis" detail="Tente carregar novamente a versão selecionada." onRetry={() => setClausesAttempt((value) => value + 1)} colors={colors} />
                          : visibleClauses.length ? visibleClauses.map((item) => (
                            <Pressable
                              key={item.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Abrir cláusula ${item.clauseLabel}`}
                              onPress={() => {
                                rememberSheetOpener();
                                setSelectedClause(item);
                              }}
                              style={{ minHeight: compactUiMetrics.touchTarget, borderBottomWidth: 1, borderColor: colors.border, padding: spacing.xs, gap: 4 }}
                            >
                              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                                <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{item.clauseLabel}</Text>
                                <GoAtletaIcon name="chevronForward" size={compactUiMetrics.iconSize} color={colors.muted} />
                              </View>
                              <Text style={{ color: colors.muted }} numberOfLines={2}>Base: {valueLabel(item.baseValue)}</Text>
                            </Pressable>
                          )) : <Text style={{ color: colors.muted }}>Esta versão ainda não tem cláusulas cadastradas.</Text>}
                      {!awaitingClauses && !clausesFailed && clauses.length > clausePreviewLimit ? (
                        <Button label={showAllClauses ? "Ver menos cláusulas" : "Ver mais cláusulas"} variant="ghost" onPress={() => setShowAllClauses((value) => !value)} />
                      ) : null}
                    </RegulationPanel>
                  ) : null}
                </ResponsiveGrid>
              ) : null}

              {sources.length > 0 || hasHistory ? (
                <ResponsiveGrid columns={{ compact: "1", split: "8/4" }}>
                  {sources.length > 0 ? (
                    <RegulationPanel colors={colors}>
                      <RegulationSectionHeader title="Fontes" colors={colors} />
                      {sources.map(renderSourceRow)}
                      {!hasHistory ? <Text style={{ color: colors.muted }}>As versões aparecerão depois que uma fonte publicar um documento.</Text> : null}
                    </RegulationPanel>
                  ) : isAdmin ? (
                    <RegulationPanel colors={colors}>
                      <RegulationEmpty title="Nenhuma fonte cadastrada" detail="Adicione uma fonte para acompanhar os próximos documentos." colors={colors}>
                        <Button label="Nova fonte" onPress={openCreate} variant="secondary" />
                      </RegulationEmpty>
                    </RegulationPanel>
                  ) : null}
                  {recentUpdates.length > 0 ? (
                    <RegulationPanel colors={colors}>
                      <RegulationSectionHeader title="Atualizações recentes" colors={colors} />
                      {recentUpdates.map(renderUpdateRow)}
                    </RegulationPanel>
                  ) : null}
                </ResponsiveGrid>
              ) : null}
            </>
          ) : null}
        </ResponsivePage>
      </ScrollView>

      <ModalSheet
        visible={sheetVisible && isAdmin && sheetContext === contextKey}
        dialogLabel={editingSource ? "Editar fonte" : "Nova fonte"}
        onClose={closeSheet}
        onExited={restoreSheetFocus}
        cardStyle={{
          maxWidth: 440,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 14,
          gap: 10,
        }}
      >
        <ScrollView
          nativeID="regulation-source-sheet"
          keyboardShouldPersistTaps="handled"
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ gap: spacing.xs }}
        >
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "700" }}>
            {editingSource ? "Editar fonte" : "Nova fonte"}
          </Text>

          {formError ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{formError}</Text> : null}
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Nome da fonte</Text>
            <View style={inputShell("label")}>
              <TextInput
                accessibilityLabel="Nome da fonte"
                ref={sourceNameInputRef}
                value={form.label}
                onChangeText={(value) => {
                  setForm((prev) => ({ ...prev, label: value }));
                  setFormError(null);
                }}
                onFocus={() => setFocusedField("label")}
                onBlur={() => setFocusedField(null)}
                placeholder="Ex: Regulamento FIVB 2026"
                placeholderTextColor={colors.muted}
                style={inputText}
              />
            </View>
          </View>

          <CompactSelect
            label="Autoridade"
            value={form.authority}
            options={authorityOptions.map((value) => ({ value, label: value }))}
            onChange={(authority) => setForm((prev) => ({ ...prev, authority: authority as RegulationAuthority }))}
          />

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>URL da fonte</Text>
            <View style={inputShell("sourceUrl")}>
              <TextInput
                accessibilityLabel="URL da fonte"
                value={form.sourceUrl}
                onChangeText={(value) => {
                  setForm((prev) => ({ ...prev, sourceUrl: value }));
                  setFormError(null);
                }}
                onFocus={() => setFocusedField("sourceUrl")}
                onBlur={() => setFocusedField(null)}
                placeholder="https://..."
                autoCapitalize="none"
                placeholderTextColor={colors.muted}
                style={inputText}
              />
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Tópicos sugeridos</Text>
            <View style={inputShell("topicHintsText")}>
              <TextInput
                accessibilityLabel="Tópicos sugeridos"
                value={form.topicHintsText}
                onChangeText={(value) => setForm((prev) => ({ ...prev, topicHintsText: value }))}
                onFocus={() => setFocusedField("topicHintsText")}
                onBlur={() => setFocusedField(null)}
                placeholder="Substituições, Líbero, Disputa"
                placeholderTextColor={colors.muted}
                style={inputText}
              />
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Esporte</Text>
              <View style={inputShell("sport")}>
                <TextInput
                  accessibilityLabel="Esporte"
                  value={form.sport}
                  onChangeText={(value) => setForm((prev) => ({ ...prev, sport: value }))}
                  onFocus={() => setFocusedField("sport")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="volleyball"
                  autoCapitalize="none"
                  placeholderTextColor={colors.muted}
                  style={inputText}
                />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Intervalo (h)</Text>
              <View style={inputShell("checkIntervalHours")}>
                <TextInput
                  accessibilityLabel="Intervalo em horas"
                  value={form.checkIntervalHours}
                  onChangeText={(value) => {
                    setForm((prev) => ({ ...prev, checkIntervalHours: value }));
                    setFormError(null);
                  }}
                  onFocus={() => setFocusedField("checkIntervalHours")}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="number-pad"
                  placeholder="6"
                  placeholderTextColor={colors.muted}
                  style={inputText}
                />
              </View>
            </View>
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>Fonte ativa</Text>
            <Switch
              accessibilityLabel="Fonte ativa"
              value={form.enabled}
              onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value }))}
            />
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Cancelar" variant="secondary" onPress={closeSheet} /></View>
            <View style={{ flex: 1 }}><Button label="Salvar" loading={saving} loadingLabel="Salvando…" disabled={!form.label.trim() || !form.sourceUrl.trim()} onPress={() => void handleSaveSource()} /></View>
          </View>
        </ScrollView>
      </ModalSheet>

      <ModalSheet
        visible={Boolean(visibleClauseDetail)}
        dialogLabel={visibleClauseDetail?.clauseLabel ?? "Cláusula"}
        onClose={() => setSelectedClause(null)}
        onExited={restoreSheetFocus}
        cardStyle={{
          maxWidth: 440,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          padding: 16,
          gap: 12,
        }}
      >
        <View
          nativeID="regulation-clause-sheet"
          style={{ gap: spacing.xs }}
        >
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "700" }}>
            {visibleClauseDetail?.clauseLabel}
          </Text>
          <View style={{ borderTopWidth: 1, borderColor: colors.border, paddingVertical: 16, gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Valor base</Text>
            <Text style={{ color: colors.text, fontWeight: "600" }}>{valueLabel(visibleClauseDetail?.baseValue)}</Text>
            {visibleClauseDetail?.sourceReference ? <Text style={{ color: colors.muted, fontSize: 11 }}>{visibleClauseDetail.sourceReference}</Text> : null}
          </View>
          <View style={{ alignSelf: "flex-end" }}>
            <Button label="Fechar" variant="secondary" onPress={() => setSelectedClause(null)} />
          </View>
        </View>
      </ModalSheet>
    </SafeAreaView>
  );
}
