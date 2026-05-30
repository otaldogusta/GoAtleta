import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    FlatList,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { ScreenLoadingState } from "../../src/components/ui/ScreenLoadingState";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import type {
    ClassGroup,
} from "../../src/core/models";
import { markRender, measureAsync } from "../../src/observability/perf";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import {
    buildAttendanceSummaryByClass,
    buildAvgPresenceByClass,
    buildClassRows,
    buildEntityMap,
    buildMonthAttendance,
    buildPerformanceRows,
    buildPseSummary,
    buildSessionLogRows,
    buildSimulationHighlights,
    buildTrainerReportSummary,
    buildTrainerReportUnits,
    buildTrainerTeamIntelligence,
    buildUniqueSessionLogs,
    buildWeeklySummary,
} from "../../src/screens/reports/application/trainer-report-selectors";
import { useTrainerReportsData } from "../../src/screens/reports/hooks/useTrainerReportsData";
import { useAppTheme } from "../../src/ui/app-theme";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR } from "../../src/utils/export-schemas";
import { exportWorkbookXlsx } from "../../src/utils/export-xlsx";

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
  const reportTabs = [
    { id: "month" as const, label: "Mês atual" },
    { id: "reports" as const, label: "Relatórios" },
    { id: "students" as const, label: "Destaques" },
  ];
  type ReportTabId = (typeof reportTabs)[number]["id"];
  const [reportTab, setReportTab] = useState<ReportTabId>("month");
  const monthKey = useMemo(() => formatMonthKey(month), [month]);
  const cardStyle = {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "visible" as const,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 12,
  };
  const insetCardStyle = {
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  };
  const sectionTitleStyle = {
    fontSize: 15,
    fontWeight: "700" as const,
    color: colors.text,
  };
  const dividerStyle = {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
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
    attendance,
    loading,
    sessionLogs,
    studentScoutingLogs,
    loadError,
  } = useTrainerReportsData({
    organizationId: activeOrganization?.id ?? null,
    month,
    monthKey,
    classId,
    reportTab,
    rangeBounds,
  });

  const monthAttendance = useMemo(
    () => buildMonthAttendance(attendance, monthKey),
    [attendance, monthKey]
  );

  const attendanceSummaryByClass = useMemo(
    () => buildAttendanceSummaryByClass(monthAttendance),
    [monthAttendance]
  );

  const studentMap = useMemo(() => buildEntityMap(students), [students]);

  const classMap = useMemo(() => buildEntityMap<ClassGroup>(classes), [classes]);

  const summary = useMemo(
    () => buildTrainerReportSummary(monthAttendance),
    [monthAttendance]
  );

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
      setUnitFilter(units[0]);
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
      setClassId(classesForUnit[0].id);
    }
  }, [classId, classesForUnit]);

  const studentsForClass = useMemo(() => {
    if (!classId) return students;
    return students.filter((s) => s.classId === classId);
  }, [students, classId]);

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
    try {
      await measureAsync("screen.reportsTrainer.export.xlsx", async () => {
        const rows = [
          [...REPORT_ATTENDANCE_EXPORT_HEADERS_PTBR],
          ...monthAttendance.map((r) => [
            r.date,
            classMap[r.classId]?.name ?? "",
            studentMap[r.studentId]?.name ?? "",
            r.status,
            r.note ?? "",
          ]),
        ];
        await exportWorkbookXlsx({
          fileName: `relatorio_${monthKey}.xlsx`,
          sheets: [
            {
              name: "Relatorio",
              rows,
              options: {
                freezeHeaderRow: true,
                autoFilterHeaderRow: true,
                autoSizeColumns: true,
                columnWidths: [12, 24, 28, 14, 42],
                minColumnWidth: 10,
                maxColumnWidth: 48,
              },
            },
          ],
          dialogTitle: "Exportar relatorio",
        });
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha ao exportar relatorio XLSX.";
      Alert.alert("Relatorios", message);
    }
  };

  const weeklySummary = useMemo(
    () => buildWeeklySummary(monthAttendance),
    [monthAttendance]
  );

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

  const statCards = [
    { label: "Presenças", value: String(summary.present), color: colors.primaryBg },
    { label: "Faltas", value: String(summary.absent), color: colors.dangerSolidBg },
    { label: "Aulas", value: String(summary.total), color: colors.infoBg },
    { label: "Turmas", value: String(classes.length), color: colors.secondaryBg },
    {
      label: "PSE médio",
      value: pseSummary.avg === null ? "--" : pseSummary.avg.toFixed(1),
      color: colors.warningBg,
    },
    {
      label: "Média por turma",
      value: avgPresenceByClass === null ? "--" : `${avgPresenceByClass.toFixed(0)}%`,
      color: colors.secondaryBg,
    },
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
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ gap: 6 }}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/");
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
              Relatórios
            </Text>
          </Pressable>
          <Text style={{ color: colors.muted }}>
            Dashboard de presença e desempenho
          </Text>
        </View>

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
              Nao foi possivel carregar tudo
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>{loadError}</Text>
          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            gap: 6,
            backgroundColor: colors.secondaryBg,
            padding: 6,
            borderRadius: 999,
          }}
        >
          {reportTabs.map((tab) => {
            const selected = reportTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setReportTab(tab.id)}
                style={{
                  flex: 1,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : colors.card,
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: selected ? colors.primaryText : colors.text,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        { reportTab === "month" ? (
        <View style={cardStyle}>
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={sectionTitleStyle}>Mês atual</Text>
              <Pressable
                onPress={() => {
                  void exportXlsx();
                }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Exportar XLSX
                </Text>
              </Pressable>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderRadius: 16,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Pressable
                onPress={() => setMonth((m) => nextMonth(m, -1))}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text }}>{"‹"}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color={colors.muted} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                  {monthLabel(month)}
                </Text>
              </View>
              <Pressable
                onPress={() => setMonth((m) => nextMonth(m, 1))}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontSize: 16, color: colors.text }}>{"›"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {statCards.map((card) => (
              <View
                key={card.label}
                style={{
                  flexBasis: "48%",
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {card.label}
                </Text>
                <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>
                  {card.value}
                </Text>
              </View>
            ))}
          </View>

          <View style={insetCardStyle}>
            <Text style={sectionTitleStyle}>Team intelligence (comparativo)</Text>
            <Text style={{ color: colors.muted }}>
              Presença média global: {(teamIntelligence.globalAvgAttendance * 100).toFixed(0)}% • PSE médio global: {teamIntelligence.globalAvgPse.toFixed(1)}
            </Text>
            {teamIntelligence.rankingByAttendance.length === 0 ? (
              <Text style={{ color: colors.muted }}>Sem sessões suficientes para ranking no período.</Text>
            ) : (
              <View style={{ gap: 6 }}>
                {teamIntelligence.rankingByAttendance.map((item, index) => (
                  <Text key={`team-ranking-${item.classId}`} style={{ color: colors.text }}>
                    {index + 1}. {item.className} • {(item.avgAttendance * 100).toFixed(0)}% • PSE {item.avgPse.toFixed(1)}
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={insetCardStyle}>
            <Text style={sectionTitleStyle}>Simulação de evolução (6 semanas)</Text>
            <Text style={{ color: colors.muted }}>
              Projeção assistiva e determinística. Aplicação real exige validação humana.
            </Text>
            {simulationHighlights.length === 0 ? (
              <Text style={{ color: colors.muted }}>
                Sem histórico suficiente para simular no período atual.
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {simulationHighlights.map((item) => (
                  <Text key={`sim-${item.classId}`} style={{ color: colors.text }}>
                    {item.className} • {Math.round(item.baseline * 100)}% → {Math.round(item.projected * 100)}% • confiança {Math.round(item.confidence * 100)}%
                  </Text>
                ))}
              </View>
            )}
          </View>

          <View style={insetCardStyle}>
            <Text style={sectionTitleStyle}>Presença geral</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
              <View
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  borderWidth: 8,
                  borderColor: colors.primaryBg,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "700", color: colors.text }}>
                  {summary.percent}%
                </Text>
              </View>
              <View style={{ gap: 6, flex: 1 }}>
                <Text style={{ color: colors.text }}>
                  Presenças: {summary.present}
                </Text>
                <Text style={{ color: colors.text }}>
                  Faltas: {summary.absent}
                </Text>
                <Text style={{ color: colors.muted }}>
                  Total registrado: {summary.total}
                </Text>
              </View>
            </View>
            <View style={dividerStyle} />
            <View style={{ gap: 8 }}>
              <Text style={sectionTitleStyle}>Evolucao semanal</Text>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {weeklySummary.map((week) => (
                  <View key={week.label} style={{ alignItems: "center", gap: 6 }}>
                    <View
                      style={{
                        width: 18,
                        height: 64,
                        borderRadius: 10,
                        backgroundColor: colors.secondaryBg,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          width: "100%",
                          height: `${week.percent}%`,
                          backgroundColor: colors.primaryBg,
                        }}
                      />
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {week.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
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
        <View style={cardStyle}>
          <Text style={sectionTitleStyle}>Turmas (mês atual)</Text>
          <View style={{ gap: 10 }}>
            <FlatList
              data={classRows}
              keyExtractor={(row) => row.cls.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item: row }) => (
                <View style={insetCardStyle}>
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
                      height: 8,
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
                    Presenças: {row.present} | Total: {row.total}
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
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {unitFilter || "Selecione a unidade"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
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
                      shadowColor: "#000",
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 10,
                    }}
                  >
                    {units.map((unit) => (
                      <Pressable
                        key={unit}
                        onPress={() => {
                          setUnitFilter(unit);
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
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                    {classForUnitById[classId]?.name || "Selecione a turma"}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={colors.muted} />
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
                      shadowColor: "#000",
                      shadowOpacity: 0.12,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 10,
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
                padding: 16,
                borderRadius: 24,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 16,
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
                            <MaterialCommunityIcons name="crown" size={30} color={ringColor} />
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
                                shadowColor: ringColor,
                                shadowOpacity: 0.22,
                                shadowRadius: 10,
                                shadowOffset: { width: 0, height: 4 },
                                elevation: 5,
                              }}
                            >
                              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14 }}>
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
                            <MaterialCommunityIcons name="star-four-points" size={12} color={ringColor} />
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
                          <MaterialCommunityIcons
                            name="star-four-points"
                            size={12}
                            color={highlight ? colors.primaryText : colors.primaryBg}
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
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
              Conquistas
            </Text>
            <Text style={{ color: colors.muted }}>
              {selectedHighlight.name}
            </Text>
            <Text style={{ color: colors.primaryBg, fontWeight: "800", fontSize: 20 }}>
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
                    <Text style={{ fontSize: 20 }}>{badge.icon}</Text>
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
