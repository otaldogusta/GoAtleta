import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, ScrollView, StyleSheet, View } from "react-native";
import { OperationalText as Text } from "../../src/ui/OperationalText";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScreenPageHeader } from "../../src/components/ui/ScreenPageHeader";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { Pressable } from "../../src/ui/Pressable";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import { UnderlineTabs } from "../../src/ui/UnderlineTabs";
import { ListEmptyState } from "../../src/ui/ListEmptyState";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import type {
    ClassGroup,
} from "../../src/core/models";
import { markRender, measureAsync } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/organization-context";
import { compactUiMetrics, shadow, spacing } from "../../src/theme/tokens";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import {
    buildAggregatedAttendanceSummary,
    buildAvgPresenceByClass,
    buildClassRows,
    buildEntityMap,
    buildPerformanceRows,
    buildPseSummary,
    buildSessionLogRows,
    buildSimulationHighlights,
    buildTrainerReportUnits,
    buildTrainerTeamIntelligence,
    buildUniqueSessionLogs,
    countClassDaysWithAttendance,
} from "../../src/screens/reports/application/trainer-report-selectors";
import { useTrainerReportsData } from "../../src/screens/reports/hooks/useTrainerReportsData";
import { useAppTheme } from "../../src/ui/app-theme";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { exportTrainerAttendance } from "../../src/screens/reports/application/export-trainer-attendance";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";

const REPORT_TABS = [
  { id: "month" as const, label: "Resumo" },
  { id: "reports" as const, label: "Relatórios" },
  { id: "students" as const, label: "Destaques" },
] as const;

type ReportTabId = (typeof REPORT_TABS)[number]["id"];

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const nextMonth = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const monthLabel = (date: Date) => {
  const names = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return `${names[date.getMonth()]} ${date.getFullYear()}`;
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0][0].toUpperCase() ?? "";
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
};

const badgeDefs = [
  { id: "rookie", label: "Iniciante", threshold: 1, icon: "?" },
  { id: "steady", label: "Constante", threshold: 30, icon: "?" },
  { id: "focus", label: "Foco", threshold: 50, icon: "?" },
  { id: "ace", label: "Ace", threshold: 70, icon: "?" },
  { id: "elite", label: "Elite", threshold: 90, icon: "?" },
  { id: "master", label: "Mestre", threshold: 100, icon: "?" },
];

export default function ReportsScreen() {
  markRender("screen.reportsTrainer.render.root");

  const { colors } = useAppTheme();
  const textStyles = useMemo(() => StyleSheet.create({
    statLabel: { color: colors.muted, fontSize: compactUiMetrics.metadataFontSize },
    statValue: { color: colors.text, fontSize: 20, fontWeight: "700" },
    badgeIcon: { fontSize: compactUiMetrics.titleFontSize },
  }), [colors.muted, colors.text]);
  const summaryStyles = useMemo(() => StyleSheet.create({
    primaryStat: { flex: 1, minWidth: 0, gap: spacing.xs, paddingLeft: 0, borderLeftWidth: 0, borderLeftColor: colors.border },
    separatedPrimaryStat: { paddingLeft: spacing.md, borderLeftWidth: 1 },
    weeklySection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.md },
    weekRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md },
    metaLabel: { color: colors.muted, fontSize: compactUiMetrics.bodyFontSize },
    metaValue: { color: colors.text, fontSize: compactUiMetrics.bodyFontSize },
    additionalSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.sm },
    mutedText: { color: colors.muted },
    detailText: { color: colors.text },
    classRow: { gap: spacing.xs, paddingVertical: spacing.sm },
  }), [colors.border, colors.muted, colors.text]);
  const responsiveLayout = useResponsiveLayout();
  const isMobile = responsiveLayout.isMobile;
  const { activeOrganization } = useOrganization();
  const router = useRouter();
  const [month, setMonth] = useState(new Date());
  const [unitFilter, setUnitFilter] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [classPickerOpen, setClassPickerOpen] = useState(false);
  const [rankRange, setRankRange] = useState<"day" | "week" | "month">("month");
  const [selectedHighlight, setSelectedHighlight] = useState<{
    name: string;
    score: number;
  } | null>(null);
  const highlightModalStyle = useModalCardStyle({ maxHeight: "70%", maxWidth: 440 });
  const [reportTab, setReportTab] = useState<ReportTabId>("month");
  const monthKey = useMemo(() => formatMonthKey(month), [month]);
  const organizationId = activeOrganization?.id ?? null;
  const exportScope = useRef<{ organizationId: string | null; monthKey: string } | null>(null);
  const exportBusy = useRef(false);
  const [isExporting, setIsExporting] = useState(false);
  useLayoutEffect(() => {
    exportScope.current = { organizationId, monthKey };
    return () => { exportScope.current = null; };
  }, [organizationId, monthKey]);
  const cardStyle = {
    padding: isMobile ? 10 : 16,
    borderRadius: isMobile ? 16 : 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "visible" as const,
    ...shadow.card,
    gap: isMobile ? 10 : 12,
  };
  const insetCardStyle = {
    padding: isMobile ? 10 : 12,
    borderRadius: isMobile ? 14 : 16,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  };
  const sectionTitleStyle = {
    fontSize: compactUiMetrics.titleFontSize,
    fontWeight: "700" as const,
    color: colors.text,
  };


  const rangeBounds = useMemo(() => {
    const now = new Date();
    if (rankRange === "day") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      return { start, end };
    }
    if (rankRange === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    }
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    return { start, end };
  }, [month, rankRange]);

  const {
    classes,
    students,
    attendanceDays,
    loading,
    sessionLogs,
    studentScoutingLogs,
    loadError,
  } = useTrainerReportsData({
    organizationId,
    month,
    monthKey,
    classId,
    reportTab,
    rangeBounds,
  });

  const aggregatedAttendance = useMemo(() => buildAggregatedAttendanceSummary(attendanceDays), [attendanceDays]);
  const classesWithAttendance = useMemo(() => countClassDaysWithAttendance(attendanceDays), [attendanceDays]);
  const attendanceSummaryByClass = aggregatedAttendance.byClass;

  const classMap = useMemo(() => buildEntityMap<ClassGroup>(classes), [classes]);

  const summary = aggregatedAttendance.summary;

  const uniqueSessionLogs = useMemo(
    () => buildUniqueSessionLogs(sessionLogs),
    [sessionLogs]
  );

  const pseSummary = useMemo(
    () => buildPseSummary(uniqueSessionLogs),
    [uniqueSessionLogs]
  );

  const units = useMemo(() => buildTrainerReportUnits(classes), [classes]);

  useEffect(() => {
    if (!unitFilter && units.length) {
      Promise.resolve().then(() => {
        setUnitFilter(units[0]);
      });
    }
  }, [unitFilter, units]);

  const classesForUnit = useMemo(() => {
    if (!unitFilter) return classes;
    return classes.filter((cls) => (cls.unit || "Sem unidade") === unitFilter);
  }, [classes, unitFilter]);

  const classForUnitById = useMemo(() => {
    const map: Record<string, ClassGroup> = {};
    classesForUnit.forEach((cls) => {
      map[cls.id] = cls;
    });
    return map;
  }, [classesForUnit]);

  useEffect(() => {
    if (!classId && classesForUnit.length) {
      Promise.resolve().then(() => {
        setClassId(classesForUnit[0].id);
      });
    }
  }, [classId, classesForUnit]);

  const studentsForClass = students;

  const classRows = useMemo(
    () => buildClassRows(classes, attendanceSummaryByClass),
    [attendanceSummaryByClass, classes]
  );

  const sessionLogRows = useMemo(
    () => buildSessionLogRows(reportTab, uniqueSessionLogs, classMap),
    [classMap, reportTab, uniqueSessionLogs]
  );

  const avgPresenceByClass = useMemo(
    () => buildAvgPresenceByClass(classRows),
    [classRows]
  );

  const exportXlsx = async () => {
    const scope = exportScope.current;
    if (exportBusy.current || !scope?.organizationId || loading || loadError) return;
    exportBusy.current = true;
    setIsExporting(true);
    try {
      await measureAsync("screen.reportsTrainer.export.xlsx", () => exportTrainerAttendance({
        organizationId: scope.organizationId!, monthKey: scope.monthKey,
        classNames: Object.fromEntries(classes.map(cls => [cls.id, cls.name])),
        isCurrent: () => exportScope.current === scope,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao exportar relatório XLSX.";
      Alert.alert("Relatórios", message);
    } finally {
      exportBusy.current = false;
      if (exportScope.current) setIsExporting(false);
    }
  };

  const weeklySummary = aggregatedAttendance.weekly;

  const performanceRows = useMemo(
    () =>
      buildPerformanceRows({
        reportTab,
        classId,
        studentScoutingLogs,
        studentsForClass,
      }),
    [classId, reportTab, studentScoutingLogs, studentsForClass]
  );

  const topStudents = useMemo(() => performanceRows.slice(0, 10), [performanceRows]);

  const primaryStats = [
    { label: "Presenças", value: String(summary.present) },
    { label: "Faltas", value: String(summary.absent) },
    { label: "Aulas com chamada", value: String(classesWithAttendance) },
  ];

  const teamIntelligence = useMemo(
    () => buildTrainerTeamIntelligence(classes, uniqueSessionLogs),
    [classes, uniqueSessionLogs]
  );

  const simulationHighlights = useMemo(
    () => buildSimulationHighlights(classes, uniqueSessionLogs),
    [classes, uniqueSessionLogs]
  );

  if (loading) {
    return <ScreenLoadingState />;
  }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenPageHeader
        title="Relatórios"
        onBack={() => navigateBackOrReplace({ router, fallback: "/prof/home" })}
      >
        <UnderlineTabs
          items={REPORT_TABS.map((tab) => ({ value: tab.id, label: tab.label }))}
          value={reportTab}
          onChange={(tab) => setReportTab(tab as ReportTabId)}
          accessibilityLabel="Seções dos relatórios"
        />
      </ScreenPageHeader>
      <ScrollView
        contentContainerStyle={{
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          paddingHorizontal: spacing.md,
          paddingTop: spacing.sm,
        }}
      >

        {loadError ? (
          <View
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              gap: 4,
            }}
          >
            <Text style={{ color: colors.dangerText, fontWeight: "800" }}>
              Não foi possível carregar tudo
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>{loadError}</Text>
          </View>
        ) : null}

        {reportTab === "month" ? (
          <View style={{ gap: spacing.xl }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
              <View style={{ flexDirection: "row", alignItems: "center", minWidth: 0 }}>
                <Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" onPress={() => setMonth((m) => nextMonth(m, -1))}
                  style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: compactUiMetrics.titleFontSize, color: colors.text }}>‹</Text>
                </Pressable>
                <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>{monthLabel(month)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" onPress={() => setMonth((m) => nextMonth(m, 1))}
                  style={{ width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: compactUiMetrics.titleFontSize, color: colors.text }}>›</Text>
                </Pressable>
              </View>
              <Pressable accessibilityRole="button" disabled={isExporting || Boolean(loadError)}
                onPress={() => { void exportXlsx(); }} suppressWebHoverFeedback
                style={{ minHeight: 44, paddingHorizontal: spacing.xs, borderRadius: 12, justifyContent: "center", opacity: isExporting || loadError ? 0.55 : 1 }}>
                <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>{isExporting ? "Exportando..." : "Exportar XLSX"}</Text>
              </Pressable>
            </View>

            {summary.total === 0 ? (
              <ListEmptyState title="Nenhum registro neste período" description="As chamadas e as aulas finalizadas aparecem aqui." />
            ) : (
              <>
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm }}>
                    <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>Frequência no período</Text>
                    <Text style={textStyles.statValue}>{summary.percent}%</Text>
                  </View>
                  <View accessibilityLabel={`Frequência de ${summary.percent}%`} style={{ height: 4, borderRadius: 2, backgroundColor: colors.secondaryBg, overflow: "hidden" }}>
                    <View style={{ height: "100%", width: `${summary.percent}%`, backgroundColor: colors.primaryBg }} />
                  </View>
                  <View style={{ flexDirection: "row", paddingVertical: spacing.sm }}>
                    {primaryStats.map((stat, index) => (
                      <View key={stat.label} style={[summaryStyles.primaryStat, index > 0 && summaryStyles.separatedPrimaryStat]}>
                        <Text style={textStyles.statValue}>{stat.value}</Text>
                        <Text style={textStyles.statLabel}>{stat.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <View style={summaryStyles.weeklySection}>
                  <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>Evolução semanal</Text>
                  {weeklySummary.map((week) => (
                    <View key={week.label} style={summaryStyles.weekRow}>
                      <Text style={{ color: colors.muted, fontSize: compactUiMetrics.metadataFontSize, width: 28 }}>{week.label}</Text>
                      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.secondaryBg, overflow: "hidden" }}>
                        <View style={{ height: "100%", width: `${week.percent}%`, backgroundColor: colors.primaryBg }} />
                      </View>
                      <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, minWidth: 36, textAlign: "right" }}>{week.percent}%</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.sm }}>
              {[
                { label: "Turmas", value: String(classes.length) },
                { label: "PSE médio", value: pseSummary.avg === null ? "Sem registro" : pseSummary.avg.toFixed(1) },
                { label: "Média de presença por turma", value: avgPresenceByClass === null ? "Sem registro" : `${avgPresenceByClass.toFixed(0)}%` },
              ].map((stat) => (
                <View key={stat.label} style={summaryStyles.metaRow}>
                  <Text style={summaryStyles.metaLabel}>{stat.label}</Text>
                  <Text style={summaryStyles.metaValue}>{stat.value}</Text>
                </View>
              ))}
            </View>
            {teamIntelligence.rankingByAttendance.length > 0 ? (
              <View style={summaryStyles.additionalSection}>
                <Text style={sectionTitleStyle}>Comparativo da equipe</Text>
                <Text style={summaryStyles.mutedText}>Presença média global de {(teamIntelligence.globalAvgAttendance * 100).toFixed(0)}% · PSE {teamIntelligence.globalAvgPse.toFixed(1)}</Text>
                {teamIntelligence.rankingByAttendance.map((item, index) => (
                  <Text key={`team-ranking-${item.classId}`} style={summaryStyles.detailText}>{index + 1}. {item.className} · {(item.avgAttendance * 100).toFixed(0)}% · PSE {item.avgPse.toFixed(1)}</Text>
                ))}
              </View>
            ) : null}
            {simulationHighlights.length > 0 ? (
              <View style={summaryStyles.additionalSection}>
                <Text style={sectionTitleStyle}>Simulação de evolução · 6 semanas</Text>
                <Text style={summaryStyles.mutedText}>Projeção assistiva. Aplicação real exige validação humana.</Text>
                {simulationHighlights.map((item) => (
                  <Text key={`sim-${item.classId}`} style={summaryStyles.detailText}>{item.className} · {Math.round(item.baseline * 100)}% → {Math.round(item.projected * 100)}% · confiança {Math.round(item.confidence * 100)}%</Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        { reportTab === "reports" ? (
        <View style={cardStyle}>
          <Text style={sectionTitleStyle}>Relatórios do mês</Text>
          { sessionLogRows.length ? (
            <FlatList
              data={sessionLogRows}
              keyExtractor={(row) => `${row.log.classId}_${row.log.createdAt}`}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: row }) => (
                <Pressable
                  onPress={() => {
                    router.push({
                      pathname: "/class/[id]/session",
                      params: { id: row.log.classId, date: row.dateKey, tab: "relatório" },
                    });
                  }}
                  style={insetCardStyle}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontWeight: "700", color: colors.text }}>
                        {row.className}
                      </Text>
                      {row.classGender ? (
                        <ClassGenderBadge gender={row.classGender} size="sm" />
                      ) : null}
                    </View>
                    <Text style={{ color: colors.muted }}>{row.dateLabel}</Text>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    PSE: {row.log.PSE} | Técnica: {row.log.technique} | Presença:{" "}
                    {Math.round(row.log.attendance)}%
                  </Text>
                </Pressable>
              )}
            />
          ) : (
            <Text style={{ color: colors.muted }}>
              Nenhum relatório registrado neste mês.
            </Text>
          )}
        </View>
        ) : null}

        { reportTab === "month" ? (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600" }}>Presença por turma</Text>
          <View style={{ gap: 10 }}>
            <FlatList
              data={classRows}
              keyExtractor={(row) => row.cls.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: row }) => (
                <View style={summaryStyles.classRow}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontWeight: "700", color: colors.text }}>
                        {row.cls.name}
                      </Text>
                      <ClassGenderBadge gender={row.cls.gender} size="sm" />
                    </View>
                    <Text style={{ color: colors.muted }}>{row.percent}%</Text>
                  </View>
                  <View
                    style={{
                      height: 4,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${row.percent}%`,
                        backgroundColor: colors.primaryBg,
                      }}
                    />
                  </View>
                  <Text style={{ color: colors.muted }}>
                    {row.present} de {row.total} registros de presença
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
        ) : null}

        { reportTab === "students" ? (
        <>
          <View style={[cardStyle, { zIndex: 40, elevation: 8 }]}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 160, gap: 6, position: "relative" }}>
                <Text style={{ color: colors.muted }}>Unidade</Text>
                <Pressable
                  onPress={() => {
                    setUnitPickerOpen((prev) => !prev);
                    setClassPickerOpen(false);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: compactUiMetrics.bodyFontSize }}>
                    {unitFilter || "Selecione a unidade"}
                  </Text>
                  <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />
                </Pressable>
                { unitPickerOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 72,
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      gap: 8,
                      padding: 8,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      ...shadow.elevated,
                    }}
                  >
                    {units.map((unit) => (
                      <Pressable
                        key={unit}
                        onPress={() => {
                          if (unit !== unitFilter) {
                            setUnitFilter(unit);
                            setClassId(classes.find(cls => (cls.unit || "Sem unidade") === unit)?.id ?? "");
                          }
                          setUnitPickerOpen(false);
                          setClassPickerOpen(false);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor:
                            unitFilter === unit ? colors.primaryBg : colors.secondaryBg,
                        }}
                      >
                        <Text
                          style={{
                            color: unitFilter === unit ? colors.primaryText : colors.text,
                          }}
                        >
                          {unit}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={{ flex: 1, minWidth: 160, gap: 6, position: "relative" }}>
                <Text style={{ color: colors.muted }}>Turma</Text>
                <Pressable
                  onPress={() => {
                    setClassPickerOpen((prev) => !prev);
                    setUnitPickerOpen(false);
                  }}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: compactUiMetrics.bodyFontSize }}>
                    {classForUnitById[classId]?.name || "Selecione a turma"}
                  </Text>
                  <GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />
                </Pressable>
                { classPickerOpen ? (
                  <View
                    style={{
                      position: "absolute",
                      top: 72,
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      gap: 8,
                      padding: 8,
                      borderRadius: 12,
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      ...shadow.elevated,
                    }}
                  >
                    {classesForUnit.map((cls) => (
                      <Pressable
                        key={cls.id}
                        onPress={() => {
                          setClassId(cls.id);
                          setClassPickerOpen(false);
                          setUnitPickerOpen(false);
                        }}
                        style={{
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          backgroundColor:
                            classId === cls.id ? colors.primaryBg : colors.secondaryBg,
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={{
                              color: classId === cls.id ? colors.primaryText : colors.text,
                            }}
                          >
                            {cls.name}
                          </Text>
                          <ClassGenderBadge gender={cls.gender} size="sm" />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={cardStyle}>
            <View
              style={{
                padding: isMobile ? 10 : 16,
                borderRadius: isMobile ? 16 : 24,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: isMobile ? 10 : 16,
              }}
            >
              <View style={{ alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    flexDirection: "row",
                  gap: 8,
                  padding: 6,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                {["Hoje", "Semana", "Mês"].map((label) => (
                  <Pressable
                    key={label}
                    onPress={() => setRankRange(label === "Hoje" ? "day" : label === "Semana" ? "week" : "month")}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 16,
                      borderRadius: 999,
                      backgroundColor:
                        rankRange === (label === "Hoje" ? "day" : label === "Semana" ? "week" : "month")
                           ? colors.primaryBg
                          : "transparent",
                    }}
                  >
                    <Text
                      style={{
                        color:
                          rankRange === (label === "Hoje" ? "day" : label === "Semana" ? "week" : "month")
                             ? colors.primaryText
                            : colors.muted,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            { topStudents.length ? (
              <>
                <View
                  style={{
                    position: "relative",
                    borderRadius: 24,
                    paddingVertical: 16,
                    paddingHorizontal: 10,
                    marginBottom: 32,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <LinearGradient
                    colors={[
                      "rgba(86, 214, 154, 0.22)",
                      "rgba(56, 140, 110, 0.18)",
                      "rgba(24, 64, 48, 0.22)",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-end",
                      gap: 12,
                      paddingHorizontal: 8,
                      marginBottom: 6,
                    }}
                  >
                    {[
                      { rank: 2, idx: 1, size: 76, offset: 18 },
                      { rank: 1, idx: 0, size: 102, offset: 0 },
                      { rank: 3, idx: 2, size: 76, offset: 18 },
                    ].map((slot) => {
                      const row = topStudents[slot.idx];
                      if (!row) return <View key={slot.rank} style={{ flex: 1 }} />;
                      const ringColor =
                        slot.rank === 1
                           ? "#D4AF37"
                          : slot.rank === 2
                           ? "#C0C0C0"
                          : "#CD7F32";
                      const medalText = "#0b1220";
                      return (
                        <Pressable
                          key={row.student.id}
                          onPress={() => setSelectedHighlight({ name: row.student.name, score: row.score })}
                          style={{
                            flex: 1,
                            alignItems: "center",
                            gap: 10,
                            transform: [{ translateY: slot.offset }],
                          }}
                        >
                          { slot.rank === 1 ? (
                            <GoAtletaIcon name="trophy" size={30} color={ringColor} />
                          ) : (
                            <View style={{ height: 28 }} />
                          )}
                          <View style={{ alignItems: "center", gap: 6 }}>
                            <View
                              style={{
                                width: slot.size,
                                height: slot.size,
                                borderRadius: slot.size / 2,
                                backgroundColor: colors.secondaryBg,
                                alignItems: "center",
                                justifyContent: "center",
                                borderWidth: 2,
                                borderColor: ringColor,
                                ...shadow.card,
                              }}
                            >
                              <Text style={{ color: colors.text, fontWeight: "700", fontSize: compactUiMetrics.bodyFontSize }}>
                                {getInitials(row.student.name)}
                              </Text>
                            </View>
                            <View
                              style={{
                                position: "absolute",
                                bottom: -10,
                                backgroundColor: ringColor,
                                borderRadius: 999,
                                paddingHorizontal: 8,
                                paddingVertical: 2,
                                borderWidth: 2,
                                borderColor: colors.card,
                              }}
                            >
                              <Text style={{ color: medalText, fontWeight: "800", fontSize: 12 }}>
                                {slot.rank}
                              </Text>
                            </View>
                          </View>
                          <Text
                            numberOfLines={1}
                            style={{
                              color: colors.text,
                              fontSize: 12,
                              fontWeight: "600",
                              marginTop: 12,
                            }}
                          >
                            {row.student.name}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <GoAtletaIcon name="star" size={12} color={ringColor} />
                            <Text style={{ color: ringColor, fontWeight: "700" }}>
                              {row.score} pts
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <FlatList
                  data={topStudents.slice(3)}
                  keyExtractor={(row) => row.student.id}
                  scrollEnabled={false}
                  contentContainerStyle={{ gap: 8 }}
                  renderItem={({ item: row, index }) => {
                    const rank = index + 4;
                    const highlight = false;
                    return (
                      <Pressable
                        onPress={() => setSelectedHighlight({ name: row.student.name, score: row.score })}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          borderRadius: 16,
                          backgroundColor: highlight ? colors.primaryBg : colors.secondaryBg,
                          borderWidth: 1,
                          borderColor: highlight ? "transparent" : colors.border,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <View
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 13,
                              backgroundColor: highlight ? colors.primaryText : colors.card,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                color: highlight ? colors.primaryBg : colors.muted,
                                fontWeight: "800",
                                fontSize: 12,
                              }}
                            >
                              {rank}
                            </Text>
                          </View>
                          <View
                            style={{
                              width: 34,
                              height: 34,
                              borderRadius: 17,
                              backgroundColor: highlight ? colors.primaryText : colors.card,
                              alignItems: "center",
                              justifyContent: "center",
                              borderWidth: 1,
                              borderColor: highlight ? "transparent" : colors.primaryBg,
                            }}
                          >
                            <Text
                              style={{
                                color: highlight ? colors.primaryBg : colors.text,
                                fontWeight: "700",
                                fontSize: 12,
                              }}
                            >
                              {getInitials(row.student.name)}
                            </Text>
                          </View>
                          <Text
                            style={{
                              color: highlight ? colors.primaryText : colors.text,
                              fontWeight: "600",
                            }}
                          >
                            {row.student.name}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: highlight ? colors.primaryText : colors.primaryBg,
                            }}
                          />
                          <Text
                            style={{
                              color: highlight ? colors.primaryText : colors.primaryBg,
                              fontWeight: "700",
                            }}
                          >
                            {row.score} pts
                          </Text>
                        </View>
                      </Pressable>
                    );
                  }}
                />
              </>
            ) : (
              <Text style={{ color: colors.muted }}>Nenhum scouting registrado.</Text>
            )}
            </View>
          </View>
        </>
        ) : null}

        <ModalSheet
          visible={!!selectedHighlight}
          onClose={() => setSelectedHighlight(null)}
          cardStyle={highlightModalStyle}
        >
          {selectedHighlight && (
          <View style={{ gap: 12 }}>
            <Text style={{ color: colors.text, fontSize: compactUiMetrics.titleFontSize, fontWeight: "800" }}>
              Conquistas
            </Text>
            <Text style={{ color: colors.muted }}>
              {selectedHighlight.name}
            </Text>
            <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: compactUiMetrics.titleFontSize }}>
              {selectedHighlight.score ?? 0} pts
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {badgeDefs.map((badge) => {
                const earned = (selectedHighlight.score ?? 0) >= badge.threshold;
                return (
                  <View
                    key={badge.id}
                    style={{
                      width: "30%",
                      aspectRatio: 1,
                      borderRadius: 16,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: earned ? colors.primaryBg : colors.border,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Text style={textStyles.badgeIcon}>{badge.icon}</Text>
                    <Text style={{ fontSize: 10, color: colors.text, textAlign: "center" }}>
                      {badge.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          )}
        </ModalSheet>
      </ScrollView>
    </SafeAreaView>
  );
}
