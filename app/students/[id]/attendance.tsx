import { markRender, measureAsync } from "../../../src/observability/perf";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../src/auth/auth";

import type { AttendanceRecord, ClassGroup, Student } from "../../../src/core/models";
import { ScreenPageHeader } from "../../../src/components/ui/ScreenPageHeader";
import {
    getAttendanceByStudent,
    getClassById,
    getStudentById,
} from "../../../src/db/seed";
import { ListEmptyState } from "../../../src/ui/ListEmptyState";
import { OperationalText as Text } from "../../../src/ui/OperationalText";
import { Pressable } from "../../../src/ui/Pressable";
import { GoAtletaIcon } from "../../../src/ui/icon-registry";
import { Button } from "../../../src/ui/Button";
import { Typography } from "../../../src/ui/Typography";
import { useAppTheme } from "../../../src/ui/app-theme";
import { formatIsoDateToPtBr } from "../../../src/utils/date-time";
import { useOrganization } from "../../../src/providers/organization-context";
import { navigateBackOrReplace } from "../../../src/navigation/safe-router";

type AttendanceResult = {
  scope: string;
  student?: Student;
  classGroup?: ClassGroup | null;
  records: AttendanceRecord[];
  failed?: boolean;
};

const noRecords: AttendanceRecord[] = [];

export default function StudentAttendanceScreen() {
  markRender("screen.studentAttendance.render.root");
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(() => StyleSheet.create({
    initials: { color: colors.text, fontWeight: "600", fontSize: 14 },
    studentDetails: { flex: 1, gap: 3 },
    studentName: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "600" },
    className: { color: colors.muted, fontSize: 11 },
    dateFilter: {
      minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12,
      borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.inputBg,
    },
    clearDateFilter: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginRight: -10, borderRadius: 10 },
    dateInput: { flex: 1, minWidth: 0, paddingVertical: 10, borderRadius: 0, color: colors.inputText },
    day: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 16, gap: 10 },
    record: { gap: 8 },
    recordHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    recordStatus: { flexDirection: "row", alignItems: "center", gap: 6 },
    recordText: { color: colors.text, fontSize: 12 },
  }), [colors.border, colors.inputBg, colors.inputText, colors.muted, colors.text]);
  const { activeOrganizationId } = useOrganization();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const scope = JSON.stringify([userId, activeOrganizationId, id]);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("");
  const current = result?.scope === scope ? result : null;
  const { student, classGroup } = current ?? {};
  const records = current?.records ?? noRecords;
  const filtering = Boolean(filter.trim());

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!id || !activeOrganizationId || !userId) {
          if (alive) setResult({ scope, records: noRecords });
          return;
        }
        const options = { organizationId: activeOrganizationId };
        const student = await measureAsync("screen.studentAttendance.load.student", () => getStudentById(id, options));
        if (!alive) return;
        if (!student) {
          setResult({ scope, records: noRecords });
          return;
        }
        const [classGroup, records] = await Promise.all([
          student.classId ? measureAsync("screen.studentAttendance.load.class", () => getClassById(student.classId, options)) : Promise.resolve(null),
          measureAsync("screen.studentAttendance.load.attendance", () => getAttendanceByStudent(student.id, options)),
        ]);
        if (alive) setResult({ scope, student, classGroup, records });
      } catch {
        if (alive) setResult({ scope, records: noRecords, failed: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [activeOrganizationId, id, retry, scope, userId]);

  const grouped = useMemo(() => {
    const normalizedFilter = filter.trim().toLowerCase();
    const map: Record<string, AttendanceRecord[]> = {};
    records.forEach((record) => {
      if (!map[record.date]) map[record.date] = [];
      map[record.date].push(record);
    });
    return Object.entries(map).filter(([date]) => {
      const datePtBr = formatIsoDateToPtBr(date).toLowerCase();
      const dateIso = date.toLowerCase();
      return datePtBr.includes(normalizedFilter) || dateIso.includes(normalizedFilter);
    });
  }, [records, filter]);

  const summary = useMemo(() => {
    const visibleRecords = grouped.flatMap(([, entries]) => entries);
    const total = visibleRecords.length;
    const present = visibleRecords.filter((r) => r.status === "presente").length;
    const percent = total ? Math.round((present / total) * 100) : 0;
    return { total, present, percent };
  }, [grouped]);

  return (
    <SafeAreaView
      style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScreenPageHeader title="Presença do aluno" horizontalBleed={0}
        onBack={() => navigateBackOrReplace({ router, fallback: "/students" })} />
      {!current ? <ActivityIndicator accessibilityLabel="Carregando presenças" color={colors.primaryBg} /> : null}
      {current?.failed ? (
        <View style={{ marginTop: 12, gap: 8, alignItems: "flex-start" }}>
          <Typography variant="body">Não foi possível carregar as presenças.</Typography>
          <Button label="Tentar novamente" variant="outline" onPress={() => {
            setResult(null);
            setRetry((value) => value + 1);
          }} />
        </View>
      ) : null}
      {current && !current.failed && !student ? <ListEmptyState title="Aluno indisponível nesta instituição" /> : null}
      {student ? <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
          <Text style={styles.initials}>{student.name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join("")}</Text>
        </View>
        <View style={styles.studentDetails}>
          <Text style={styles.studentName}>{student.name}</Text>
          {classGroup ? <Text style={styles.className}>{classGroup.name}</Text> : null}
        </View>
      </View>
      <View style={styles.dateFilter}>
        <GoAtletaIcon name="calendar" size={16} color={colors.muted} />
        <TextInput accessibilityLabel="Filtrar presenças por data" placeholder="Buscar data · DD/MM/AAAA" value={filter}
          onChangeText={setFilter} placeholderTextColor={colors.placeholder}
          style={styles.dateInput} />
        {filtering ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar filtro" onPress={() => setFilter("")}
          style={styles.clearDateFilter}>
          <GoAtletaIcon name="close" size={16} color={colors.muted} />
        </Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        {summary.total > 0 ? <View style={{ flexDirection: "row", alignItems: "center", gap: 20, paddingBottom: 24 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "600" }}>{summary.percent}%</Text>
            <Text style={styles.className}>Frequência{filtering ? " no filtro" : " no histórico"}</Text>
          </View>
          <View style={{ borderLeftWidth: 1, borderLeftColor: colors.border, paddingLeft: 20, gap: 4 }}>
            <Text style={styles.recordText}>{summary.present} {summary.present === 1 ? "presença" : "presenças"} em {summary.total} {summary.total === 1 ? "registro" : "registros"}</Text>
            <Text style={styles.className}>{summary.total - summary.present} {summary.total - summary.present === 1 ? "falta" : "faltas"}</Text>
          </View>
        </View> : null}
        {grouped.length === 0 ? (
          <ListEmptyState title={filtering ? "Nenhum registro nesta data" : "Nenhuma presença registrada"}
            description={filtering ? "Tente outra data ou consulte o histórico completo." : "As chamadas registradas pela turma aparecerão aqui."}
            actionLabel="Ver histórico completo" onAction={filtering ? () => setFilter("") : undefined} />
        ) : (
          grouped.map(([date, list]) => (
            <View key={date} style={styles.day}>
              {list.map((item) => (
                <View key={item.id} style={styles.record}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordText}>{formatIsoDateToPtBr(date)}</Text>
                    <View style={styles.recordStatus}>
                      <GoAtletaIcon name={item.status === "presente" ? "checkmarkCircle" : "close"} size={16} color={item.status === "presente" ? colors.successText : colors.dangerText} />
                      <Text style={styles.recordText}>{item.status === "presente" ? "Presente" : "Faltou"}</Text>
                    </View>
                  </View>
                  {item.note || item.painScore !== undefined ? <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
                    {[item.note, item.painScore !== undefined ? `Dor ${item.painScore}` : null].filter(Boolean).join(" · ")}
                  </Text> : null}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      </> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


