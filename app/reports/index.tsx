import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  View,
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAttendanceAll,
  getClasses,
  getStudents,
} from "../../src/db/seed";
import type { AttendanceRecord, ClassGroup, Student } from "../../src/core/models";
import { useAppTheme } from "../../src/ui/app-theme";

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

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [month, setMonth] = useState(new Date());
  const [classId, setClassId] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cls, st, att] = await Promise.all([
        getClasses(),
        getStudents(),
        getAttendanceAll(),
      ]);
      if (!alive) return;
      setClasses(cls);
      setStudents(st);
      setAttendance(att);
    })();
    return () => {
      alive = false;
    };
  }, []);

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
    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio_${monthKey}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
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
    { label: "Presencas", value: String(summary.present), color: colors.primaryBg },
    { label: "Faltas", value: String(summary.absent), color: colors.dangerSolidBg },
    { label: "Aulas", value: String(summary.total), color: colors.infoBg },
    { label: "Turmas", value: String(classes.length), color: colors.secondaryBg },
  ];

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Relatorios
          </Text>
          <Text style={{ color: colors.muted }}>
            Dashboard de presenca e desempenho
          </Text>
        </View>

        <View
          style={{
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
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
              Mes atual
            </Text>
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

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {statCards.map((card) => (
              <View
                key={card.label}
                style={{
                  flexBasis: "48%",
                  padding: 14,
                  borderRadius: 16,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
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

          <View
            style={{
              padding: 16,
              borderRadius: 18,
              backgroundColor: colors.inputBg,
              borderWidth: 1,
              borderColor: colors.border,
              gap: 10,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>
              Presenca geral
            </Text>
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
                  Presencas: {summary.present}
                </Text>
                <Text style={{ color: colors.text }}>
                  Faltas: {summary.absent}
                </Text>
                <Text style={{ color: colors.muted }}>
                  Total registrado: {summary.total}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View
          style={{
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
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Evolucao semanal
          </Text>
          <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 10 }}>
            {weeklySummary.map((week) => (
              <View key={week.label} style={{ alignItems: "center", gap: 6 }}>
                <View
                  style={{
                    width: 22,
                    height: 80,
                    borderRadius: 12,
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
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {week.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
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
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Alertas rapidos
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.dangerBg,
                borderWidth: 1,
                borderColor: colors.dangerBorder,
              }}
            >
              <Text style={{ fontWeight: "700", color: colors.dangerText }}>
                Ausencias seguidas
              </Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: colors.dangerText }}>
                {indicators.consecutiveAbsences.length}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                backgroundColor: colors.warningBg,
                borderWidth: 1,
                borderColor: colors.warningBg,
              }}
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

        <View
          style={{
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
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Turmas (mes atual)
          </Text>
          <View style={{ gap: 10 }}>
            {classRows.map((row) => (
              <View
                key={row.cls.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {row.cls.name}
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
                  Presencas: {row.present} • Total: {row.total}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View
          style={{
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
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Alunos destaque
          </Text>
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
                <Text style={{ color: classId === cls.id ? colors.primaryText : colors.text }}>
                  {cls.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={{ gap: 10 }}>
            {topStudents.map((row) => (
              <View
                key={row.student.id}
                style={{
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: 6,
                }}
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
                  Presencas: {row.present} • Total: {row.total}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

