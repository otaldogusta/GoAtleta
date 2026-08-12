import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { ClassGroup, TrainingPlan } from "../../../core/models";
import { radius } from "../../../theme/tokens";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { getClassIdentityLabel } from "../application/class-identity";

export type TrainingPlanningWorkspaceTemplate = {
  id: string;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
  ageBands: string[];
  source: "built" | "custom";
  createdAt: string;
};

type Props = {
  collapsed: boolean;
  plans: TrainingPlan[];
  templates: TrainingPlanningWorkspaceTemplate[];
  classes: ClassGroup[];
  selectedPlanId?: string;
  onToggleCollapsed: () => void;
  onSelectPlan: (plan: TrainingPlan) => void;
  onUseTemplate: (template: TrainingPlanningWorkspaceTemplate) => void;
};

type LibraryMode = "classes" | "drafts";

type WeekGroup = {
  key: string;
  label: string;
  plans: TrainingPlan[];
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

const dateKeyForPlan = (plan: TrainingPlan) => {
  if (parseDateKey(plan.applyDate)) return plan.applyDate!;
  const created = String(plan.createdAt ?? "").slice(0, 10);
  return parseDateKey(created) ? created : "";
};

const monthKeyForPlan = (plan?: TrainingPlan | null) => (plan ? dateKeyForPlan(plan).slice(0, 7) : "");

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

const weekForPlan = (plan: TrainingPlan): { key: string; label: string } => {
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

const planRowLabel = (plan: TrainingPlan) => {
  const date = parseDateKey(dateKeyForPlan(plan));
  if (!date) return plan.title || "Plano sem título";
  const weekday = capitalize(
    new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(date).replace(".", "")
  );
  return `${weekday} ${String(date.getUTCDate()).padStart(2, "0")} · ${plan.title || "Plano sem título"}`;
};

export function TrainingPlanningWorkspaceLibrary({
  collapsed,
  plans,
  templates,
  classes,
  selectedPlanId,
  onToggleCollapsed,
  onSelectPlan,
  onUseTemplate,
}: Props) {
  const { colors } = useAppTheme();
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId), [plans, selectedPlanId]);
  const assignedPlans = useMemo(() => plans.filter((plan) => plan.classId && classById.has(plan.classId)), [classById, plans]);
  const draftPlans = useMemo(() => plans.filter((plan) => !plan.classId || !classById.has(plan.classId)), [classById, plans]);
  const assignedClasses = useMemo(
    () => classes.filter((item) => assignedPlans.some((plan) => plan.classId === item.id)),
    [assignedPlans, classes]
  );
  const [mode, setMode] = useState<LibraryMode>(selectedPlan?.classId ? "classes" : "drafts");
  const [search, setSearch] = useState("");
  const [activeClassId, setActiveClassId] = useState(selectedPlan?.classId || assignedClasses[0]?.id || "");
  const [activeMonth, setActiveMonth] = useState(
    monthKeyForPlan(selectedPlan ?? assignedPlans[0] ?? draftPlans[0] ?? null)
  );
  const [expandedWeek, setExpandedWeek] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    if (!selectedPlan) return;
    if (selectedPlan.classId && classById.has(selectedPlan.classId)) {
      setMode("classes");
      setActiveClassId(selectedPlan.classId);
    } else {
      setMode("drafts");
    }
    const nextMonth = monthKeyForPlan(selectedPlan);
    if (nextMonth) setActiveMonth(nextMonth);
    setExpandedWeek(weekForPlan(selectedPlan).key);
  }, [classById, selectedPlan]);

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

  useEffect(() => {
    if (!weekGroups.length) {
      setExpandedWeek("");
      return;
    }
    if (!weekGroups.some((group) => group.key === expandedWeek)) setExpandedWeek(weekGroups[0].key);
  }, [expandedWeek, weekGroups]);

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
  const filteredTemplates = useMemo(
    () => templates.filter((item) => !searchToken || normalize(`${item.title} ${item.tags.join(" ")}`).includes(searchToken)),
    [searchToken, templates]
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

  const renderPlanRow = (plan: TrainingPlan, nested = false) => {
    const selected = selectedPlanId === plan.id;
    return (
      <Pressable
        key={plan.id}
        onPress={() => onSelectPlan(plan)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.planRow,
          nested ? styles.nestedPlanRow : null,
          selected ? { backgroundColor: colors.successBg, borderLeftColor: colors.primaryBg } : null,
          { opacity: pressed ? 0.72 : 1 },
        ]}
      >
        <View style={[styles.planDot, { backgroundColor: selected ? colors.primaryBg : colors.warningText }]} />
        <Text numberOfLines={1} style={[styles.planLabel, { color: selected ? colors.successText : colors.text }]}>
          {planRowLabel(plan)}
        </Text>
        <GoAtletaIcon name="chevronForward" size={15} color={colors.muted} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Biblioteca</Text>
        <Pressable
          onPress={onToggleCollapsed}
          accessibilityRole="button"
          accessibilityLabel="Recolher biblioteca"
          style={({ pressed }) => [styles.iconButton, { borderColor: colors.border, opacity: pressed ? 0.68 : 1 }]}
        >
          <GoAtletaIcon name="chevronBack" size={18} color={colors.text} />
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
          <Pressable onPress={() => setSearch("")} accessibilityLabel="Limpar busca" style={styles.searchClear}>
            <GoAtletaIcon name="close" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.modeRow}>
        <Pressable
          onPress={() => setMode("classes")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "classes" }}
          style={({ pressed }) => [
            styles.modeButton,
            { borderColor: mode === "classes" ? colors.primaryBg : colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <GoAtletaIcon name="students" size={17} color={mode === "classes" ? colors.primaryBg : colors.muted} />
          <Text style={[styles.modeLabel, { color: mode === "classes" ? colors.primaryBg : colors.text }]}>Por turma</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("drafts")}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "drafts" }}
          style={({ pressed }) => [
            styles.modeButton,
            { borderColor: mode === "drafts" ? colors.primaryBg : colors.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <GoAtletaIcon name="document" size={16} color={mode === "drafts" ? colors.primaryBg : colors.muted} />
          <Text style={[styles.modeLabel, { color: mode === "drafts" ? colors.primaryBg : colors.text }]}>Rascunhos</Text>
          <Text style={[styles.modeCount, { color: colors.muted }]}>{draftPlans.length}</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator nestedScrollEnabled>
        {searchToken ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Resultados</Text>
              <Text style={[styles.sectionCount, { color: colors.muted }]}>{searchPlans.length}</Text>
            </View>
            {searchPlans.map((plan) => renderPlanRow(plan))}
            {!searchPlans.length ? <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum plano encontrado.</Text> : null}
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
                    accessibilityLabel="Mês anterior"
                    style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GoAtletaIcon name="chevronBack" size={17} color={colors.text} />
                  </Pressable>
                  <Text style={[styles.monthLabel, { color: colors.text }]}>{formatMonth(effectiveMonth)}</Text>
                  <Pressable
                    onPress={() => setActiveMonth(moveMonth(effectiveMonth, 1))}
                    accessibilityLabel="Próximo mês"
                    style={({ pressed }) => [styles.monthButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <GoAtletaIcon name="chevronForward" size={17} color={colors.text} />
                  </Pressable>
                </View>
                <View style={[styles.weekList, { borderColor: colors.border }]}>
                  {weekGroups.map((group, index) => {
                    const expanded = group.key === expandedWeek;
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
                    <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum plano neste mês.</Text>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Turmas por unidade</Text>
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
                {!assignedClasses.length ? <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum plano vinculado a turmas.</Text> : null}
              </View>
            )}
          </>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Rascunhos sem turma</Text>
              <Text style={[styles.sectionCount, { color: colors.muted }]}>{draftPlans.length}</Text>
            </View>
            {draftPlans.map((plan) => renderPlanRow(plan))}
            {!draftPlans.length ? <Text style={[styles.emptyText, { color: colors.muted }]}>Nenhum rascunho sem turma.</Text> : null}
          </View>
        )}

        <View style={[styles.templatesSection, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => setShowTemplates((current) => !current)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showTemplates }}
            style={({ pressed }) => [styles.templatesHeading, { opacity: pressed ? 0.72 : 1 }]}
          >
            <Text style={[styles.templatesTitle, { color: colors.text }]}>Modelos prontos</Text>
            <Text style={[styles.sectionCount, { color: colors.muted }]}>{filteredTemplates.length}</Text>
            <GoAtletaIcon name={showTemplates ? "chevronDown" : "chevronForward"} size={16} color={colors.muted} />
          </Pressable>
          {showTemplates
            ? filteredTemplates.slice(0, 8).map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => onUseTemplate(template)}
                  style={({ pressed }) => [styles.templateRow, { opacity: pressed ? 0.72 : 1 }]}
                >
                  <GoAtletaIcon name="document" size={16} color={colors.muted} />
                  <Text numberOfLines={1} style={[styles.classLabel, { color: colors.text }]}>{template.title}</Text>
                  <GoAtletaIcon name="chevronForward" size={15} color={colors.muted} />
                </Pressable>
              ))
            : null}
        </View>
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
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 12,
    gap: 10,
  },
  collapsedRail: { width: 56, minWidth: 56, borderWidth: 1, borderRadius: radius.card, padding: 8, alignItems: "center" },
  header: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 17, fontWeight: "900" },
  iconButton: { width: 36, height: 36, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  searchShell: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 12, outlineStyle: "none", borderRadius: 0 } as any,
  searchClear: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  modeRow: { flexDirection: "row", gap: 8 },
  modeButton: { flex: 1, minHeight: 42, paddingHorizontal: 10, borderWidth: 1, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  modeLabel: { fontSize: 12, fontWeight: "900" },
  modeCount: { marginLeft: "auto", fontSize: 11, fontWeight: "800" },
  scroll: { flex: 1, minHeight: 0 },
  scrollContent: { paddingBottom: 8 },
  breadcrumbRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  backButton: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  breadcrumb: { flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 15 },
  monthRow: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  monthButton: { width: 38, height: 38, borderWidth: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  monthLabel: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "900" },
  weekList: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  weekRow: { minHeight: 62, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  weekCopy: { flex: 1, minWidth: 0 },
  weekLabel: { fontSize: 12.5, fontWeight: "900" },
  weekMeta: { marginTop: 2, fontSize: 10.5 },
  weekPlans: { paddingBottom: 6 },
  planRow: { minHeight: 50, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: "transparent", flexDirection: "row", alignItems: "center", gap: 8 },
  nestedPlanRow: { marginHorizontal: 7, borderRadius: 8 },
  planDot: { width: 7, height: 7, borderRadius: 4 },
  planLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "700" },
  section: { gap: 7, paddingVertical: 10 },
  sectionHeading: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 12, fontWeight: "900" },
  sectionCount: { fontSize: 10.5, fontWeight: "800" },
  emptyText: { padding: 12, fontSize: 11, lineHeight: 16 },
  unitGroup: { gap: 5, marginTop: 4 },
  unitLabel: { paddingHorizontal: 4, paddingVertical: 5, fontSize: 10.5, fontWeight: "900", textTransform: "uppercase" },
  classRow: { minHeight: 48, paddingHorizontal: 10, borderWidth: 1, borderRadius: 9, flexDirection: "row", alignItems: "center", gap: 8 },
  classLabel: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: "800" },
  templatesSection: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  templatesHeading: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  templatesTitle: { flex: 1, fontSize: 12.5, fontWeight: "900" },
  templateRow: { minHeight: 46, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8 },
});
