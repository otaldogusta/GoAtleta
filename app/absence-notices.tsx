import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import type { AbsenceNotice, ClassGroup, Student } from "../src/core/models";
import {
  getAbsenceNotices,
  getClasses,
  getStudents,
  updateAbsenceNoticeStatus,
} from "../src/db/seed";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

const formatDate = (value: string) => {
  const parsed = new Date(value + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("pt-BR");
};

export default function AbsenceNoticesScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const [notices, setNotices] = useState<AbsenceNotice[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [noticeList, studentList, classList] = await Promise.all([
        getAbsenceNotices(),
        getStudents(),
        getClasses(),
      ]);
      if (!alive) return;
      setNotices(noticeList);
      setStudents(studentList);
      setClasses(classList);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const pending = useMemo(
    () => notices.filter((item) => item.status === "pending"),
    [notices]
  );

  const getStudentName = (id: string) =>
    students.find((item) => item.id === id)?.name ?? "Aluno";

  const getClassLabel = (id: string) => {
    const cls = classes.find((item) => item.id === id);
    if (!cls) return "Turma";
    return cls.unit ? `${cls.unit} • ${cls.name}` : cls.name;
  };

  const updateStatus = async (notice: AbsenceNotice, status: AbsenceNotice["status"]) => {
    await updateAbsenceNoticeStatus(notice.id, status);
    setNotices((prev) =>
      prev.map((item) => (item.id === notice.id ? { ...item, status } : item))
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
            Avisos de ausência
          </Text>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>
        </View>

        {pending.length === 0 ? (
          <View
            style={{
              padding: 16,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Nenhum aviso pendente
            </Text>
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Avisos de ausência vão aparecer aqui.
            </Text>
          </View>
        ) : (
          pending.map((notice) => (
            <View
              key={notice.id}
              style={{
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: 8,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                {getStudentName(notice.studentId)}
              </Text>
              <Text style={{ color: colors.muted }}>{getClassLabel(notice.classId)}</Text>
              <Text style={{ color: colors.muted }}>
                {formatDate(notice.date)} • {notice.reason}
              </Text>
              {notice.note ? (
                <Text style={{ color: colors.text }}>{notice.note}</Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => updateStatus(notice, "confirmed")}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                    Confirmar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => updateStatus(notice, "ignored")}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Ignorar
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
