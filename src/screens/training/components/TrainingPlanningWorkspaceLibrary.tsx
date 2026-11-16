import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { OperationalText as Text } from "../../../ui/OperationalText";

import type { ClassGroup } from "../../../core/models";
import type { TrainingPlanSummary } from "../../../db/training";
import { compactUiMetrics, radius } from "../../../theme/tokens";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { UnderlineTabs } from "../../../ui/UnderlineTabs";
import { ListEmptyState } from "../../../ui/ListEmptyState";
import { getClassIdentityLabel } from "../application/class-identity";

type Props = {
  collapsed: boolean;
  presentation?: "rail" | "sheet";
  plans: TrainingPlanSummary[];
  classes: ClassGroup[];
  selectedPlanId?: string;
  loadingPlanId?: string | null;
  onToggleCollapsed: () => void;
  onSelectPlan: (plan: TrainingPlanSummary) => void;
};

type LibraryMode = "classes" | "drafts";

type WeekGroup = {
  key: string;
  label: string;
  plans: TrainingPlanSummary[];
};

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const parseDateKey = (value?: string) => {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dateKeyForPlan = (plan: TrainingPlanSummary) => {
  if (parseDateKey(plan.applyDate)) return plan.applyDate!;
  const created = String(plan.createdAt ?? "").slice(0, 10);
  return parseDateKey(created) ? created : "";
};

const monthKeyForPlan = (plan?: TrainingPlanSummary | null) => (plan ? dateKeyForPlan(plan).slice(0, 7) : "");

const capitalize = (value: string) => value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  if (!year || !month) return "Sem data";
  return capitalize(
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(Date.UTC(year, month - 1, 1))
    )
  );
};

const moveMonth = (monthKey: string, amount: number) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const shortDate = (date: Date) =>
  `${String(date.getUTCDate()).padStart(2, "0")} ${new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "")}`;

const weekForPlan = (plan: TrainingPlanSummary): { key: string; label: string } => {
  const date = parseDateKey(dateKeyForPlan(plan));
  if (!date) return { key: "undated", label: "Sem data" };
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const key = start.toISOString().slice(0, 10);
  const label =
    start.getUTCMonth() === end.getUTCMonth()
      ? `${String(start.getUTCDate()).padStart(2, "0")}–${shortDate(end)}`
      : `${shortDate(start)}–${shortDate(end)}`;
  return { key, label };
};

const planRowLabel = (plan: TrainingPlanSummary) => {
  const date = parseDateKey(dateKeyForPlan(plan));
  if (!date) return plan.title || "Plano sem título";
  const weekday = capitalize(
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "")
  );
  return `${weekday} ${String(date.getUTCDate()).padStart(2, "0")} · ${plan.title || "Plano sem título"}`;
};

export function TrainingPlanningWorkspaceLibrary({
  collapsed,
  presentation = "rail",
  plans,
  classes,
  selectedPlanId,
  loadingPlanId,
  onToggleCollapsed,
  onSelectPlan,
}: Props) {
  const { colors } = useAppTheme();
  const sheetMode = presentation === "sheet";
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId), [plans, selectedPlanId]);
  const assignedPlans = useMemo(() => plans.filter((plan) => plan.classId && classById.has(plan.classId)), [classById, plans]);
  const draftPlans = useMemo(() => plans.filter((plan) => !plan.classId || !classById.has(plan.classId)), [classById, plans]);
  const assignedClasses = useMemo(
    () => classes.filter((item) => assignedPlans.some((plan) => plan.classId === item.id)),
    [assignedPlans, classes]
  );
  const [mode, setMode] = useState<LibraryMode>(
    selectedPlan && !classById.has(selectedPlan.classId) ? "drafts" : "classes"
  );
  const [search, setSearch] = useState("");
  const [activeClassId, setActiveClassId] = useState(selectedPlan?.classId || "");
  const [activeMonth, setActiveMonth] = useState(
    monthKeyForPlan(selectedPlan ?? assignedPlans[0] ?? draftPlans[0] ?? null)
  );
  const [expandedWeek, setExpandedWeek] = useState(() => selectedPlan ? weekForPlan(selectedPlan).key : "");

  const selectionKey = `${selectedPlan?.id ?? ""}:${selectedPlan?.classId ?? ""}:${selectedPlan ? monthKeyForPlan(selectedPlan) : ""}:${selectedPlan ? dateKeyForPlan(selectedPlan) : ""}:${classById.has(selectedPlan?.classId ?? "")}`;
  const [syncedSelection, setSyncedSelection] = useState(selectionKey);
  if (syncedSelection !== selectionKey) {
    setSyncedSelection(selectionKey);
    if (selectedPlan) {
      if (selectedPlan.classId && classById.has(selectedPlan.classId)) {
        setMode("classes");
        setActiveClassId(selectedPlan.classId);
      } else {
        setMode("drafts");
      }
      const nextMonth = monthKeyForPlan(selectedPlan);
      if (nextMonth) setActiveMonth(nextMonth);
      setExpandedWeek(weekForPlan(selectedPlan).key);
    }
  }

  const activeClass = classById.get(activeClassId);
  const activeClassPlans = useMemo(
    () => assignedPlans.filter((plan) => plan.classId === activeClassId),
    [activeClassId, assignedPlans]
  );
  const effectiveMonth = activeMonth || monthKeyForPlan(activeClassPlans[0]) || moveMonth("", 0);
  const monthPlans = useMemo(
    () => activeClassPlans.filter((plan) => monthKeyForPlan(plan) === effectiveMonth),
    [activeClassPlans, effectiveMonth]
  );
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const grouped = new Map<string, WeekGroup>();
    monthPlans.forEach((plan) => {
      const week = weekForPlan(plan);
      const current = grouped.get(week.key) ?? { ...week, plans: [] };
      current.plans.push(plan);
      grouped.set(week.key, current);
    });
    return [...grouped.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((group) => ({
        ...group,
        plans: [...group.plans].sort((a, b) => dateKeyForPlan(a).localeCompare(dateKeyForPlan(b))),
      }));
  }, [monthPlans]);

  const visibleExpandedWeek = weekGroups.some((group) => group.key === expandedWeek)
    ? expandedWeek : weekGroups[0]?.key ?? "";

  const searchToken = normalize(search);
  const searchPlans = useMemo(
    () =>
      plans.filter((plan) => {
        if (!searchToken) return false;
        const classItem = classById.get(plan.classId);
        return normalize(`${plan.title} ${classItem ? getClassIdentityLabel(classItem, classes) : ""} ${classItem?.unit ?? ""} ${(plan.tags ?? []).join(" ")}`).includes(searchToken);
      }),
    [classById, classes, plans, searchToken]
  );

  if (collapsed) {
    return (
      <View style={[styles.collapsedRail, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Expandir biblioteca"
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
        >
          <GoAtletaIcon name="chevronForward" size={18} color={colors.text} />
        </Pressable>
      </View>
    );
  }

  const renderPlanRow = (plan: TrainingPlanSummary, nested = false) => {
    const selected = selectedPlanId === plan.id;
    const loading = loadingPlanId === plan.id;
    const label = planRowLabel(plan);
    return (
      <Pressable
        key={plan.id}
        accessibilityRole="button"
        accessibilityLabel={loading ? `Abrindo plano: ${label}` : `Abrir plano: ${label}`}
        accessibilityState={{ selected, busy: loading, disabled: loading }}
        disabled={loading}
        onPress={() => onSelectPlan(plan)}
        style={({ pressed }) => [
          styles.planRow,
          nested ? styles.nestedPlanRow : null,
          selected ? { backgroundColor: colors.successBg, borderLeftColor: colors.primaryBg } : null,
          { opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <View style={[styles.planDot, { backgroundColor: selected ? colors.primaryBg : colors.muted }]} />
        <Text numberOfLines={1} style={[styles.planLabel, { color: selected ? colors.successText : colors.text }]}>
          {label}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.primaryBg} /> : <GoAtletaIcon name="chevronForward" size={15} color={colors.muted} />}
      </Pressable>
    );
  };

  return (
    <View
      testID="training-planning-workspace-library"
      style={[
        styles.root,
        sheetMode ? styles.sheetRoot : null,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Biblioteca</Text>
        <Pressable
          nativeID={sheetMode ? undefined : "planning-library-close"}
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel={sheetMode ? "Fechar biblioteca" : "Recolher biblioteca"}
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
        >
          <GoAtletaIcon name={sheetMode ? "close" : "chevronBack"} size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={[styles.searchShell, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <GoAtletaIcon name="search" size={16} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar plano, turma ou unidade"
          placeholderTextColor={colors.placeholder}
          accessibilityLabel="Buscar plano, turma ou unidade"
          style={[styles.searchInput, { color: colors.inputText }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Limpar busca" style={styles.searchClear}>
            <GoAtletaIcon name="close" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <UnderlineTabs
        items={[
          { value: "classes", label: "Por turma" },
          { value: "drafts", label: "Rascunhos" },
        ]}
        value={mode}
        onChange={(value) => setMode(value as LibraryMode)}
        accessibilityLabel="Biblioteca de planos"
      />

      <ScrollView style={[styles.scroll, sheetMode && styles.sheetScroll]} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator nestedScrollEnabled>
        {searchToken ? (
          <View style={styles.section}>
            {searchPlans.length ? <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resultados</Text>
              <Text style={[styles.sectionCount, { color: colors.muted }]}>{searchPlans.length}</Text>
            </View> : null}
            {searchPlans.map((plan) => renderPlanRow(plan))}
            {!searchPlans.length ? <ListEmptyState title="Nenhum plano encontrado" description="Busque por plano, turma ou unidade." actionLabel="Limpar busca" onAction={() => setSearch("")} /> : null}
          </View>
        ) : mode === "classes" ? (
          <>
            {activeClass ? (
              <>
                <View style={[styles.breadcrumbRow, { borderBottomColor: colors.border }]}>
                  <Pressable
                    onPress={() => setActiveClassId("")}
                    accessibilityRole="button"
                    accessibilityLabel="Escolher outra turma"
                    style={({ pressed }) => [styles.backButton, { backgroundColor: colors.secondaryBg, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GoAtletaIcon name="chevronBack" size={16} color={colors.text} />
                  </Pressable>
                  <Text numberOfLines={1} style={[styles.breadcrumb, { color: colors.muted }]}>
                    {activeClass.unit || "Sem unidade"} / {getClassIdentityLabel(activeClass, classes)} / {formatMonth(effectiveMonth)}
                  </Text>
                </View>
                <View style={styles.monthRow}>
                  <Pressable
                    onPress={() => setActiveMonth(moveMonth(effectiveMonth, -1))}
                    accessibilityRole="button"
                    accessibilityLabel="Mês anterior"
                    style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GoAtletaIcon name="chevronBack" size={17} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.monthLabel, { color: colors.text }]}>{formatMonth(effectiveMonth)}</Text>
                  <Pressable
                    onPress={() => setActiveMonth(moveMonth(effectiveMonth, 1))}
                    accessibilityRole="button"
                    accessibilityLabel="Próximo mês"
                    style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GoAtletaIcon name="chevronForward" size={17} color={colors.text} />
                  </Pressable>
                </View>
                <View style={[styles.weekList, { borderColor: colors.border }]}>
                  {weekGroups.map((group, index) => {
                    const expanded = group.key === visibleExpandedWeek;
                    return (
                      <View key={group.key} style={index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null}>
                        <Pressable
                          onPress={() => setExpandedWeek(expanded ? "" : group.key)}
                          accessibilityRole="button"
                          accessibilityState={{ expanded }}
                          style={({ pressed }) => [styles.weekRow, { opacity: pressed ? 0.72 : 1 }]}
                        >
                          <GoAtletaIcon name={expanded ? "chevronDown" : "chevronForward"} size={15} color={colors.text} />
                          <View style={styles.weekCopy}>
                            <Text style={[styles.weekLabel, { color: colors.text }]}>{group.label}</Text>
                            <Text style={[styles.weekMeta, { color: colors.muted }]}>
                              {group.plans.length} plano{group.plans.length === 1 ? "" : "s"}
                            </Text>
                          </View>
                        </Pressable>
                        {expanded ? <View style={styles.weekPlans}>{group.plans.map((plan) => renderPlanRow(plan, true))}</View> : null}
                      </View>
                    );
                  })}
                  {!weekGroups.length ? (
                    <ListEmptyState title="Nenhum plano neste mês" description="Navegue entre os meses para ver os planos da turma." />
                  ) : null}
                </View>
              </>
            ) : (
              <View style={styles.section}>
                {[...new Set(assignedClasses.map((item) => item.unit || "Sem unidade"))].map((unit) => (
                  <View key={unit} style={styles.unitGroup}>
                    <Text style={[styles.unitLabel, { color: colors.muted }]}>{unit}</Text>
                    {assignedClasses
                      .filter((item) => (item.unit || "Sem unidade") === unit)
                      .map((item) => {
                        const count = assignedPlans.filter((plan) => plan.classId === item.id).length;
                        return (
                          <Pressable
                            key={item.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Planos de ${getClassIdentityLabel(item, classes)}`}
                            onPress={() => {
                              setActiveClassId(item.id);
                              const firstPlan = assignedPlans.find((plan) => plan.classId === item.id);
                              if (firstPlan) setActiveMonth(monthKeyForPlan(firstPlan));
                            }}
                            style={({ pressed }) => [styles.classRow, { borderColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
                          >
                            <GoAtletaIcon name="classes" size={16} color={colors.muted} />
                            <Text numberOfLines={1} style={[styles.classLabel, { color: colors.text }]}>
                              {getClassIdentityLabel(item, classes)}
                            </Text>
                            <Text style={[styles.sectionCount, { color: colors.muted }]}>{count}</Text>
                            <GoAtletaIcon name="chevronForward" size={15} color={colors.muted} />
                          </Pressable>
                        );
                      })}
                  </View>
                ))}
                {!assignedClasses.length ? <ListEmptyState title="Nenhum plano vinculado a turmas" description="Os planos ficam organizados aqui depois de vinculados." /> : null}
              </View>
            )}
          </>
        ) : (
          <View style={styles.section}>
            {draftPlans.length ? <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rascunhos sem turma</Text>
              <Text style={[styles.sectionCount, { color: colors.muted }]}>{draftPlans.length}</Text>
            </View> : null}
            {draftPlans.map((plan) => renderPlanRow(plan))}
            {!draftPlans.length ? <ListEmptyState title="Nenhum rascunho sem turma" description="Novos planos sem turma aparecem aqui." /> : null}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: 300,
    minWidth: 300,
    minHeight: 0,
    maxHeight: "100%",
    overflow: "hidden",
    borderRightWidth: 1,
    padding: 12,
    gap: 10,
  },
  sheetRoot: {
    width: "100%",
    minWidth: 0,
    borderWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: "auto",
    maxHeight: undefined,
  },
  collapsedRail: { width: 36, minWidth: 36, borderWidth: 0, borderRadius: 9, padding: 0, alignItems: "center" },
  header: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: compactUiMetrics.titleFontSize, fontWeight: "600" },
  iconButton: { width: 44, height: 44, borderRadius: radius.internal, alignItems: "center", justifyContent: "center" },
  searchShell: { minHeight: 50, borderWidth: 1, borderRadius: radius.internal, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 12, outlineStyle: "none", borderRadius: 0 } as any,
  searchClear: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  scroll: { flex: 1, minHeight: 0 },
  sheetScroll: { flexGrow: 0, flexShrink: 1, flexBasis: "auto" },
  scrollContent: { paddingBottom: 8 },
  breadcrumbRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  breadcrumb: { flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 15 },
  monthRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthButton: { width: 44, height: 44, borderRadius: radius.internal, alignItems: "center", justifyContent: "center" },
  monthLabel: { flex: 1, textAlign: "center", fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" },
  weekList: { borderBottomWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  weekRow: { minHeight: 48, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  weekCopy: { flex: 1, minWidth: 0 },
  weekLabel: { fontSize: 12.5, fontWeight: "600" },
  weekMeta: { marginTop: 2, fontSize: 10.5 },
  weekPlans: { paddingBottom: 6 },
  planRow: { minHeight: 50, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: "transparent", flexDirection: "row", alignItems: "center", gap: 8 },
  nestedPlanRow: { marginHorizontal: 7, borderRadius: 8 },
  planDot: { width: 7, height: 7, borderRadius: 4 },
  planLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "700" },
  section: { gap: 7, paddingVertical: 10 },
  sectionHeading: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 12, fontWeight: "600" },
  sectionCount: { fontSize: 10.5, fontWeight: "600" },
  unitGroup: { gap: 5, marginTop: 4 },
  unitLabel: { paddingHorizontal: 4, paddingVertical: 5, fontSize: 10.5, fontWeight: "600", textTransform: "uppercase" },
  classRow: { minHeight: 48, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  classLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "600" },
});
