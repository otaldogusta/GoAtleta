import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { buildTeamIntelligenceSnapshot } from "../../src/api/reports";
import { simulateClassEvolution } from "../../src/core/simulator/evolution-simulator";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { Pressable } from "../../src/ui/Pressable";
import { ShimmerBlock } from "../../src/ui/Shimmer";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import type {
    AttendanceRecord,
    ClassGroup,
    SessionLog,
    Student,
    StudentScoutingLog,
} from "../../src/core/models";
import {
    countsFromStudentLog,
    createEmptyCounts,
    getTechnicalPerformanceScore,
} from "../../src/core/scouting";
import {
    getAttendanceAll,
    getClasses,
    getSessionLogsByRange,
    getStudentScoutingByRange,
    getStudents,
} from "../../src/db/seed";
import { useOrganization } from "../../src/providers/OrganizationProvider";
import { useAppTheme } from "../../src/ui/app-theme";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const nextMonth = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = pad2(value.getMonth() + 1);
  const d = pad2(value.getDate());
  return `${y}-${m}-${d}`;
};

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

const formatDateLabel = (iso: string) => {
  const date = iso.split("T")[0];
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return parts.reverse().join("/");
};

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  const { activeOrganization } = useOrganization();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [studentScoutingLogs, setStudentScoutingLogs] = useState<StudentScoutingLog[]>([]);
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
    fontWeight: "700",
    color: colors.text,
  };
  const dividerStyle = {
    height: 1,
    backgroundColor: colors.border,
    opacity: 0.5,
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cls, st, att] = await Promise.all([
          getClasses({ organizationId: activeOrganization?.id }),
          getStudents({ organizationId: activeOrganization?.id }),
          getAttendanceAll(),
        ]);
        if (!alive) return;
        setClasses(cls);
        setStudents(st);
        setAttendance(att);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganization?.id]);

  useEffect(() => {
    let alive = true;
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    (async () => {
      const logs = await getSessionLogsByRange(
        start.toISOString(),
        end.toISOString()
      );
      if (!alive) return;
      setSessionLogs(logs);
    })();
    return () => {
      alive = false;
    };
  }, [month]);

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

  useEffect(() => {
    let alive = true;
    if (!classId) {
      setStudentScoutingLogs([]);
      return () => {
        alive = false;
      };
    }
    const startKey = formatIsoDate(rangeBounds.start);
    const endKey = formatIsoDate(rangeBounds.end);
    (async () => {
      const logs = await getStudentScoutingByRange(classId, startKey, endKey);
      if (!alive) return;
      setStudentScoutingLogs(logs);
    })();
    return () => {
      alive = false;
    };
  }, [classId, rangeBounds]);

  const monthKey = useMemo(() => formatMonthKey(month), [month]);

  const monthAttendance = useMemo(
    () => attendance.filter((r) => r.date.startsWith(monthKey)),
    [attendance, monthKey]
  );

  const attendanceSummaryByClass = useMemo(() => {
    const map: Record<string, { total: number; present: number }> = {};
    monthAttendance.forEach((record) => {
      const current = map[record.classId] ?? { total: 0, present: 0 };
      current.total += 1;
      if (record.status === "presente") current.present += 1;
      map[record.classId] = current;
    });
    return map;
  }, [monthAttendance]);

  const studentMap = useMemo(() => {
    const map: Record<string, Student> = {};
    students.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const classMap = useMemo(() => {
    const map: Record<string, ClassGroup> = {};
    classes.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [classes]);

  const summary = useMemo(() => {
    const total = monthAttendance.length;
    const present = monthAttendance.filter((r) => r.status === "presente").length;
    const absent = total - present;
    const percent = total ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, percent };
  }, [monthAttendance]);

  const uniqueSessionLogs = useMemo(() => {
    const sorted = [...sessionLogs].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    const unique: SessionLog[] = [];
    const seen = new Set<string>();
    sorted.forEach((log) => {
      const dateKey = log.createdAt.split("T")[0];
      const key = `${log.classId}_${dateKey}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(log);
    });
    return unique;
  }, [sessionLogs]);

  const pseSummary = useMemo(() => {
    const valid = uniqueSessionLogs.filter(
      (log) => typeof log.PSE === "number"
    );
    if (!valid.length) {
      return { avg: null, total: 0 };
    }
    const sum = valid.reduce((acc, log) => acc + (log.PSE ?? 0), 0);
    return { avg: sum / valid.length, total: valid.length };
  }, [uniqueSessionLogs]);

  const units = useMemo(() => {
    const seen = new Set<string>();
    return classes
      .map((cls) => cls.unit || "Sem unidade")
      .filter((unit) => {
        if (seen.has(unit)) return false;
        seen.add(unit);
        return true;
      });
  }, [classes]);

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

  const classRows = useMemo(() => {
    return classes.map((cls) => {
      const classSummary = attendanceSummaryByClass[cls.id] ?? {
        total: 0,
        present: 0,
      };
      const total = classSummary.total;
      const present = classSummary.present;
      const percent = total ? Math.round((present / total) * 100) : 0;
      return { cls, total, present, percent };
    });
  }, [attendanceSummaryByClass, classes]);

  const sessionLogRows = useMemo(() => {
    return uniqueSessionLogs
      .map((log) => {
        const cls = classMap[log.classId];
        const className = cls?.name ?? "Turma";
        const dateKey = log.createdAt.split("T")[0];
        return {
          log,
          className,
          classGender: cls?.gender,
          dateKey,
          dateLabel: formatDateLabel(log.createdAt),
        };
      });
  }, [classMap, uniqueSessionLogs]);

  const avgPresenceByClass = useMemo(() => {
    if (!classRows.length) return null;
    const sum = classRows.reduce((acc, row) => acc + row.percent, 0);
    return sum / classRows.length;
  }, [classRows]);

  const exportCsv = () => {
    const rows = [
      ["date", "class", "student", "status", "note"],
      ...monthAttendance.map((r) => [
        r.date,
        classMap[r.classId]?.name ?? "",
        studentMap[r.studentId]?.name ?? "",
        r.status,
        r.note ?? "",
      ]),
    ];
    const csv = rows
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    if (Platform.OS !== "web" || typeof document === "undefined") {
      console.warn("CSV export only available on web platform");
      return;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio_${monthKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const weeklySummary = useMemo(() => {
    const weeks = Array.from({ length: 5 }).map(() => ({ total: 0, present: 0 }));
    monthAttendance.forEach((record) => {
      const day = Number(record.date.slice(8, 10));
      const weekIndex = Math.min(Math.floor((day - 1) / 7), weeks.length - 1);
      weeks[weekIndex].total += 1;
      if (record.status === "presente") weeks[weekIndex].present += 1;
    });
    return weeks
      .map((week, index) => {
        const percent = week.total
          ? Math.round((week.present / week.total) * 100)
          : 0;
        return { label: `S${index + 1}`, percent, total: week.total };
      })
      .filter((week) => week.total > 0);
  }, [monthAttendance]);

  const performanceRows = useMemo(() => {
    if (!classId) return [];
    const countsByStudent: Record<string, ReturnType<typeof createEmptyCounts>> = {};
    studentScoutingLogs.forEach((log) => {
      if (!countsByStudent[log.studentId]) {
        countsByStudent[log.studentId] = createEmptyCounts();
      }
      const base = countsByStudent[log.studentId];
      const next = countsFromStudentLog(log);
      (Object.keys(base) as (keyof typeof base)[]).forEach((skill) => {
        base[skill][0] += next[skill][0];
        base[skill][1] += next[skill][1];
        base[skill][2] += next[skill][2];
      });
    });
    return studentsForClass
      .map((student) => {
        const counts = countsByStudent[student.id] ?? createEmptyCounts();
        const score = getTechnicalPerformanceScore(counts);
        return { student, score, counts };
      })
      .sort((a, b) => b.score - a.score);
  }, [classId, studentScoutingLogs, studentsForClass]);

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
    () =>
      buildTeamIntelligenceSnapshot({
        classes: classes.map((item) => ({ id: item.id, name: item.name, unit: item.unit })),
        sessionLogs: uniqueSessionLogs.map((item) => ({
          classId: item.classId,
          attendance: Number(item.attendance || 0),
          PSE: Number(item.PSE || 0),
        })),
      }),
    [classes, uniqueSessionLogs]
  );

  const simulationHighlights = useMemo(() => {
    return classes
      .map((cls) => {
        const logs = uniqueSessionLogs
          .filter((item) => item.classId === cls.id)
          .slice(0, 8);
        if (!logs.length) return null;
        const simulation = simulateClassEvolution({
          classId: cls.id,
          logs,
          horizonWeeks: 6,
          interventionIntensity: "balanced",
        });
        const lastPoint = simulation.points[simulation.points.length - 1];
        if (!lastPoint) return null;
        return {
          classId: cls.id,
          className: cls.name,
          baseline: simulation.baselineScore,
          projected: lastPoint.projectedScore,
          confidence: lastPoint.confidence,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.projected - a.projected)
      .slice(0, 5);
  }, [classes, uniqueSessionLogs]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
          <View style={{ gap: 10 }}>
            <ShimmerBlock style={{ height: 28, width: 170, borderRadius: 12 }} />
            <ShimmerBlock style={{ height: 16, width: 240, borderRadius: 8 }} />
          </View>
          <View style={{ gap: 12 }}>
            <ShimmerBlock style={{ height: 120, borderRadius: 20 }} />
            <ShimmerBlock style={{ height: 120, borderRadius: 20 }} />
          </View>
          <ShimmerBlock style={{ height: 220, borderRadius: 20 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24, paddingHorizontal: 16, paddingTop: 16 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Relatórios
          </Text>
          <Text style={{ color: colors.muted }}>
            Dashboard de presença e desempenho
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 6,
            backgroundColor: colors.secondaryBg,
            padding: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: colors.border,
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
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : colors.card,
                  borderWidth: selected ? 0 : 1,
                  borderColor: selected ? "transparent" : colors.border,
                  alignItems: "center",
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: selected ? colors.primaryText : colors.muted,
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
                onPress={exportCsv}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  backgroundColor: colors.primaryBg,
                }}
              >
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                  Exportar CSV
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
            <View style={{ gap: 10 }}>
              {sessionLogRows.map((row) => (
                <Pressable
                  key={`${row.log.classId}_${row.log.createdAt}`}
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
                      { row.classGender ? (
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
              ))}
            </View>
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
            {classRows.map((row) => (
              <View
                key={row.cls.id}
                style={insetCardStyle}
              >
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
            ))}
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

                <View style={{ gap: 8 }}>
                  {topStudents.slice(3).map((row, index) => {
                    const rank = index + 4;
                    const highlight = false;
                    return (
                      <Pressable
                        key={row.student.id}
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
                  })}
                </View>
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
