import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Pressable } from "../../src/ui/Pressable";

import type { AttendanceRecord, ClassGroup, SessionLog, Student } from "../../src/core/models";
import {
    getAttendanceAll,
    getClasses,
    getSessionLogsByRange,
    getStudents,
} from "../../src/db/seed";
import { useAppTheme } from "../../src/ui/app-theme";
import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const nextMonth = (date: Date, delta: number) =>
  new Date(date.getFullYear(), date.getMonth() + delta, 1);

const monthLabel = (date: Date) => {
  const names = [
    "Janeiro",
    "Fevereiro",
    "Marco",
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

const formatDateLabel = (iso: string) => {
  const date = iso.split("T")[0];
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return parts.reverse().join("/");
};

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionLogs, setSessionLogs] = useState<SessionLog[]>([]);
  const [month, setMonth] = useState(new Date());
  const [classId, setClassId] = useState<string>("all");
  const reportTabs = [
    { id: "month" as const, label: "Mês atual" },
    { id: "reports" as const, label: "Relatórios" },
    { id: "students" as const, label: "Alertas" },
  ];
  type ReportTabId = (typeof reportTabs)[number]["id"];
  const [reportTab, setReportTab] = useState<ReportTabId>("month");
  const cardStyle = {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
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
          getClasses(),
          getStudents(),
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
  }, []);

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

  const monthKey = useMemo(() => formatMonthKey(month), [month]);

  const monthAttendance = useMemo(
    () => attendance.filter((r) => r.date.startsWith(monthKey)),
    [attendance, monthKey]
  );

  const attendanceByClass = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    monthAttendance.forEach((record) => {
      if (!map[record.classId]) map[record.classId] = [];
      map[record.classId].push(record);
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

  const studentsForClass = useMemo(() => {
    if (classId === "all") return students;
    return students.filter((s) => s.classId === classId);
  }, [students, classId]);

  const indicators = useMemo(() => {
    const now = new Date();
    const byStudent: Array<{
      student: Student;
      className: string;
      streak: number;
      lastDate: string;
      inactiveDays: number | null;
    }> = [];

    studentsForClass.forEach((student) => {
      const records = attendance
        .filter((r) => r.studentId === student.id)
        .sort((a, b) => b.date.localeCompare(a.date));
      const lastDate = records[0]?.date ?? "";
      let streak = 0;
      for (const record of records) {
        if (record.status === "faltou") {
          streak += 1;
        } else {
          break;
        }
      }
      let inactiveDays: number | null = null;
      if (!lastDate) {
        inactiveDays = null;
      } else {
        const last = new Date(lastDate + "T00:00:00");
        const diffMs = now.getTime() - last.getTime();
        inactiveDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      }
      byStudent.push({
        student,
        className: classMap[student.classId]?.name ?? "",
        streak,
        lastDate,
        inactiveDays,
      });
    });

    const consecutiveAbsences = byStudent.filter((item) => item.streak >= 2);
    const inactive = byStudent.filter(
      (item) => item.inactiveDays !== null && item.inactiveDays >= 30
    );

    return { consecutiveAbsences, inactive };
  }, [attendance, classMap, studentsForClass]);

  const studentRows = useMemo(() => {
    return studentsForClass.map((student) => {
      const records = monthAttendance.filter(
        (r) => r.studentId === student.id
      );
      const total = records.length;
      const present = records.filter((r) => r.status === "presente").length;
      const percent = total ? Math.round((present / total) * 100) : 0;
      return { student, total, present, percent };
    });
  }, [studentsForClass, monthAttendance]);

  const classRows = useMemo(() => {
    return classes.map((cls) => {
      const records = attendanceByClass[cls.id] ?? [];
      const total = records.length;
      const present = records.filter((r) => r.status === "presente").length;
      const percent = total ? Math.round((present / total) * 100) : 0;
      return { cls, total, present, percent };
    });
  }, [classes, attendanceByClass]);

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

  const topStudents = useMemo(() => {
    return [...studentRows]
      .sort((a, b) => b.percent - a.percent)
      .slice(0, 5);
  }, [studentRows]);

  const statCards = [
    { label: "Presenças", value: String(summary.present), color: colors.primaryBg },
    { label: "Faltas", value: String(summary.absent), color: colors.dangerSolidBg },
    { label: "Aulas", value: String(summary.total), color: colors.infoBg },
    { label: "Turmas", value: String(classes.length), color: colors.secondaryBg },
    {
      label: "PSE medio",
      value: pseSummary.avg === null ? "--" : pseSummary.avg.toFixed(1),
      color: colors.warningBg,
    },
    {
      label: "Media por turma",
      value: avgPresenceByClass === null ? "--" : `${avgPresenceByClass.toFixed(0)}%`,
      color: colors.secondaryBg,
    },
  ];

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
            Carregando relatórios...
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
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

        {reportTab === "month" ? (
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
              }}
            >
              <Pressable
                onPress={() => setMonth((m) => nextMonth(m, -1))}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>{"<"}</Text>
              </Pressable>
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                {monthLabel(month)}
              </Text>
              <Pressable
                onPress={() => setMonth((m) => nextMonth(m, 1))}
                style={{ padding: 8 }}
              >
                <Text style={{ fontSize: 18, color: colors.text }}>{">"}</Text>
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

        {reportTab === "students" ? (
        <View style={cardStyle}>
          <Text style={sectionTitleStyle}>Alertas rapidos</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={[
                insetCardStyle,
                { flex: 1, backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },
              ]}
            >
              <Text style={{ fontWeight: "700", color: colors.dangerText }}>
                Ausencias seguidas
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dangerText }}>
                {indicators.consecutiveAbsences.length}
              </Text>
            </View>
            <View
              style={[
                insetCardStyle,
                { flex: 1, backgroundColor: colors.warningBg, borderColor: colors.warningBg },
              ]}
            >
              <Text style={{ fontWeight: "700", color: colors.warningText }}>
                Inativos
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.warningText }}>
                {indicators.inactive.length}
              </Text>
            </View>
          </View>
        </View>
        ) : null}

        {reportTab === "reports" ? (
        <View style={cardStyle}>
          <Text style={sectionTitleStyle}>Relatórios do mês</Text>
          {sessionLogRows.length ? (
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
              ))}
            </View>
          ) : (
            <Text style={{ color: colors.muted }}>
              Nenhum relatório registrado neste mês.
            </Text>
          )}
        </View>
        ) : null}

        {reportTab === "month" ? (
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

        {reportTab === "students" ? (
        <View style={cardStyle}>
          <Text style={sectionTitleStyle}>Alunos destaque</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() => setClassId("all")}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 10,
                backgroundColor: classId === "all" ? colors.primaryBg : colors.secondaryBg,
              }}
            >
              <Text style={{ color: classId === "all" ? colors.primaryText : colors.text }}>
                Todas
              </Text>
            </Pressable>
            {classes.map((cls) => (
              <Pressable
                key={cls.id}
                onPress={() => setClassId(cls.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: classId === cls.id ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text
                    style={{ color: classId === cls.id ? colors.primaryText : colors.text }}
                  >
                    {cls.name}
                  </Text>
                  <ClassGenderBadge gender={cls.gender} size="sm" />
                </View>
              </Pressable>
            ))}
          </View>

          <View style={{ gap: 10 }}>
            {topStudents.map((row) => (
              <View
                key={row.student.id}
                style={insetCardStyle}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {row.student.name}
                  </Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}
