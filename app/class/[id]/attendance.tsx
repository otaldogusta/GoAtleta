import {
  useEffect,
  useMemo,
  useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View
} from "react-native";
import { Pressable } from "../../../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getClassById,
  getStudentsByClass,
  saveAttendanceRecords,
  getAttendanceByClass,
  getAttendanceByDate,
} from "../../../src/db/seed";
import type {
  AttendanceRecord,
  ClassGroup,
  Student,
} from "../../../src/core/models";
import { Button } from "../../../src/ui/Button";
import { animateLayout } from "../../../src/ui/animate-layout";
import { DatePickerModal } from "../../../src/ui/DatePickerModal";
import { DateInput } from "../../../src/ui/DateInput";
import { usePersistedState } from "../../../src/ui/use-persisted-state";
import { Typography } from "../../../src/ui/Typography";
import { useAppTheme } from "../../../src/ui/app-theme";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";

const formatDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};



export default function AttendanceScreen() {
  const { colors } = useAppTheme();
  const { id, date: dateParam } = useLocalSearchParams<{
    id: string;
    date?: string;
  }>();
  const router = useRouter();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState(formatDate(new Date()));
  const [statusById, setStatusById] = useState<Record<string, "presente" | "faltou" | undefined>>({});
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [painById, setPainById] = useState<Record<string, number | undefined>>({});
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [historyFilter, setHistoryFilter] = useState("");
  const [csvPreview, setCsvPreview] = useState("");
  const [expandedById, setExpandedById] = usePersistedState<
    Record<string, boolean>
  >(id ? `attendance_${id}_expanded_v1` : null, {});
  const [showHistory, setShowHistory] = usePersistedState<boolean>(
    id ? `attendance_${id}_show_history_v1` : null,
    false
  );
  const {
    animatedStyle: historyAnimStyle,
    isVisible: showHistoryContent,
  } = useCollapsibleAnimation(showHistory);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      if (alive) setCls(data);
      if (data) {
        const list = await getStudentsByClass(data.id);
        if (alive) setStudents(list);
        const past = await getAttendanceByClass(data.id);
        if (alive) setHistory(past);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!cls) return;
    if (typeof dateParam !== "string") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    const parsed = new Date(dateParam);
    if (Number.isNaN(parsed.getTime())) return;
    void loadDate(dateParam);
  }, [cls, dateParam]);

  useEffect(() => {
    const initial: Record<string, "presente" | "faltou" | undefined> = {};
    const painInitial: Record<string, number | undefined> = {};
    students.forEach((student) => {
      initial[student.id] = statusById[student.id];
      painInitial[student.id] = painById[student.id] ?? 0;
    });
    setStatusById(initial);
    setPainById(painInitial);
  }, [students]);

  const items = useMemo(
    () =>
      students.map((student) => ({
        student,
        status: statusById[student.id],
        note: noteById[student.id] ?? "",
        pain: painById[student.id] ?? 0,
      })),
    [students, statusById, noteById, painById]
  );


  const handleSave = async () => {
    if (!cls) return;
    const createdAt = new Date().toISOString();
    const records: AttendanceRecord[] = items.map((item) => ({
      id: `${cls.id}_${item.student.id}_${date}`,
      classId: cls.id,
      studentId: item.student.id,
      date,
      status: item.status ?? "faltou",
      note: item.note.trim(),
      painScore: item.pain,
      createdAt,
    }));

    await measure("saveAttendanceRecords", () =>
      saveAttendanceRecords(cls.id, date, records)
    );
    const past = await measure("getAttendanceByClass", () =>
      getAttendanceByClass(cls.id)
    );
    setHistory(past);
    logAction("Salvar chamada", {
      classId: cls.id,
      date,
      total: records.length,
    });
    router.replace("/");
  };

  const loadDate = async (value: string) => {
    if (!cls) return;
    setDate(value);
    const records = await getAttendanceByDate(cls.id, value);
    if (!records.length) return;
    const nextStatus: Record<string, "presente" | "faltou"> = {};
    const nextNotes: Record<string, string> = {};
    const nextPain: Record<string, number> = {};
    records.forEach((record) => {
      nextStatus[record.studentId] = record.status;
      nextNotes[record.studentId] = record.note;
      nextPain[record.studentId] = record.painScore ?? 0;
    });
    setStatusById((prev) => ({ ...prev, ...nextStatus }));
    setNoteById((prev) => ({ ...prev, ...nextNotes }));
    setPainById((prev) => ({ ...prev, ...nextPain }));
  };

  const historyDates = Array.from(
    new Set(history.map((record) => record.date))
  );
  const filteredHistoryDates = historyDates.filter((value) =>
    value.includes(historyFilter.trim())
  );

  const buildCsv = () => {
    const rows = [
      ["date", "class", "student", "status", "note", "pain", "phone", "age"],
      ...items.map((item) => [
        date,
        cls?.name ?? "",
        item.student.name,
        item.status,
        item.note ?? "",
        String(item.pain ?? 0),
        item.student.phone,
        String(item.student.age),
      ]),
    ];
    return rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  };

  const handleExportCsv = () => {
    const csv = buildCsv();
    if (typeof document !== "undefined") {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chamada_${date}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      setCsvPreview(csv);
    }
  };

  if (!cls) return null;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <View>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Chamada
          </Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{cls.name}</Text>
        </View>
      </View>

      <View
        style={{
          gap: 8,
          padding: 14,
          borderRadius: 20,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
          Data da aula
        </Text>
        <DateInput
          value={date}
          onChange={setDate}
          placeholder="Selecione a data"
          onOpenCalendar={() => setShowCalendar(true)}
        />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Button label="Carregar data" onPress={() => loadDate(date)} />
          {historyDates.length > 0 ? (
            <Button
              label="Hoje"
              variant="secondary"
              onPress={() => loadDate(formatDate(new Date()))}
            />
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {items.map((item) => (
          <View
            key={item.student.id}
            style={{
              borderRadius: 18,
              padding: 14,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
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
                {item.student.name}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() =>
                    setStatusById((prev) => ({
                      ...prev,
                      [item.student.id]:
                        prev[item.student.id] === "presente" ? undefined : "presente",
                    }))
                  }
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor:
                      item.status === "presente" ? colors.successBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: item.status === "presente" ? colors.primaryText : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    Presente
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setStatusById((prev) => ({
                      ...prev,
                      [item.student.id]:
                        prev[item.student.id] === "faltou" ? undefined : "faltou",
                    }))
                  }
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor:
                      item.status === "faltou" ? colors.dangerSolidBg : colors.secondaryBg,
                  }}
                >
                  <Text
                    style={{
                      color: item.status === "faltou" ? colors.primaryText : colors.text,
                      fontWeight: "700",
                    }}
                  >
                    Faltou
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    animateLayout();
                    setExpandedById((prev) => ({
                      ...prev,
                      [item.student.id]: !prev[item.student.id],
                    }));
                  }}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ fontWeight: "700", color: colors.text }}>
                    {expandedById[item.student.id] ? "\u25B2" : "\u25BC"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {expandedById[item.student.id] ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={{ color: colors.text }}>
                  Idade: {item.student.age} | Tel: {item.student.phone}
                </Text>
                <TextInput
                  placeholder="Observacao (opcional)"
                  value={item.note}
                  onChangeText={(text) =>
                    setNoteById((prev) => ({
                      ...prev,
                      [item.student.id]: text,
                    }))
                  }
                  placeholderTextColor={colors.placeholder}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                <View style={{ gap: 6 }}>
                  <Text style={{ color: colors.text }}>Dor (0-3)</Text>
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                    {[0, 1, 2, 3].map((value) => (
                      <Button
                        key={value}
                        label={String(value)}
                        variant={item.pain === value ? "primary" : "secondary"}
                        onPress={() =>
                          setPainById((prev) => ({
                            ...prev,
                            [item.student.id]: value,
                          }))
                        }
                      />
                    ))}
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>

      <View style={{ marginTop: 8, gap: 8 }}>
        <Button label="Salvar chamada" onPress={handleSave} />
      </View>

      {historyDates.length > 0 ? (
        <View style={{ marginTop: 16 }}>
          <Button
            label={showHistory ? "Esconder historico" : "Mostrar historico"}
            variant="secondary"
            onPress={() => {
              animateLayout();
              setShowHistory((prev) => !prev);
            }}
          />
          {showHistoryContent ? (
            <Animated.View style={historyAnimStyle}>
            <View style={{ marginTop: 8 }}>
              <Typography variant="subtitle">Historico por data</Typography>
              <TextInput
                placeholder="Filtrar por data (YYYY-MM-DD)"
                value={historyFilter}
                onChangeText={setHistoryFilter}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 10,
                  borderRadius: 10,
                  marginTop: 8,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
              <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
                {filteredHistoryDates.map((value) => (
                  <Button
                    key={value}
                    label={value}
                    variant={value === date ? "primary" : "secondary"}
                    onPress={() => loadDate(value)}
                  />
                ))}
              </ScrollView>
              <Button label="Exportar CSV (data)" onPress={handleExportCsv} />
              {csvPreview ? (
                <View>
                  <Typography variant="subtitle">CSV gerado</Typography>
                  <TextInput
                    value={csvPreview}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 10,
                      borderRadius: 10,
                      minHeight: 120,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                    }}
                  />
                </View>
              ) : null}
            </View>
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      <DatePickerModal
        visible={showCalendar}
        value={date}
        onChange={setDate}
        onClose={() => setShowCalendar(false)}
        closeOnSelect
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}










