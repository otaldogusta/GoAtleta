import { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getAttendanceByStudent,
  getClassById,
  getStudentById,
} from "../../../src/db/seed";
import type { AttendanceRecord, ClassGroup, Student } from "../../../src/core/models";
import { Card } from "../../../src/ui/Card";
import { Typography } from "../../../src/ui/Typography";
import { useAppTheme } from "../../../src/ui/app-theme";

export default function StudentAttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [student, setStudent] = useState<Student | null>(null);
  const [classGroup, setClassGroup] = useState<ClassGroup | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getStudentById(id);
      if (alive) setStudent(data);
      if (data) {
        const cls = await getClassById(data.classId);
        if (alive) setClassGroup(cls);
        const list = await getAttendanceByStudent(data.id);
        if (alive) setRecords(list);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const grouped = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    records.forEach((record) => {
      if (!map[record.date]) map[record.date] = [];
      map[record.date].push(record);
    });
    return Object.entries(map).filter(([date]) =>
      date.includes(filter.trim())
    );
  }, [records, filter]);

  const summary = useMemo(() => {
    const total = records.length;
    const present = records.filter((r) => r.status === "presente").length;
    const percent = total ? Math.round((present / total) * 100) : 0;
    return { total, present, percent };
  }, [records]);

  if (!student) return null;

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <Typography variant="title">Presença do aluno</Typography>
      <Typography variant="subtitle">
        {student.name}
        {classGroup ? " - " + classGroup.name : ""}
      </Typography>
      <Typography variant="body">
        Presenças: {summary.present}/{summary.total} ({summary.percent}%)
      </Typography>

      <View style={{ marginTop: 8 }}>
        <TextInput
          placeholder="Filtrar por data (YYYY-MM-DD)"
          value={filter}
          onChangeText={setFilter}
          placeholderTextColor={colors.placeholder}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            padding: 10,
            borderRadius: 10,
            backgroundColor: colors.inputBg,
            color: colors.inputText,
          }}
        />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingVertical: 12, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {grouped.length === 0 ? (
          <Card title="Sem registros" />
        ) : (
          grouped.map(([date, list]) => (
            <View key={date} style={{ gap: 8 }}>
              <Typography variant="body">Data: {date}</Typography>
              {list.map((item) => (
                <Card
                  key={item.id}
                  title={item.status === "presente" ? "Presente" : "Faltou"}
                  subtitle={
                    item.note || item.painScore !== undefined
                      ? [
                          item.note ? `Obs: ${item.note}` : null,
                          item.painScore !== undefined ? `Dor: ${item.painScore}` : null,
                        ]
                          .filter(Boolean)
                          .join(" | ")
                      : undefined
                  }
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


