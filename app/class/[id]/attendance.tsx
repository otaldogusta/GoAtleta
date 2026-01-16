import {
  useEffect,
  useMemo,
  useState } from "react";
import {
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
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRef } from "react";

import {
  getClassById,
  getStudentsByClass,
  saveAttendanceRecords,
  getAttendanceByDate,
} from "../../../src/db/seed";
import type {
  AttendanceRecord,
  ClassGroup,
  Student,
} from "../../../src/core/models";
import { Button } from "../../../src/ui/Button";
import { DatePickerModal } from "../../../src/ui/DatePickerModal";
import { DateInput } from "../../../src/ui/DateInput";
import { usePersistedState } from "../../../src/ui/use-persisted-state";
import { useAppTheme } from "../../../src/ui/app-theme";
import { useSaveToast } from "../../../src/ui/save-toast";
import { ClassContextHeader } from "../../../src/ui/ClassContextHeader";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";

const formatDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDisplayDate = (value: string) => {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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
  const [loadMessage, setLoadMessage] = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const [baseline, setBaseline] = useState<{
    status: Record<string, "presente" | "faltou" | undefined>;
    note: Record<string, string>;
    pain: Record<string, number>;
  }>({ status: {}, note: {}, pain: {} });
  const [expandedById, setExpandedById] = usePersistedState<
    Record<string, boolean>
  >(id ? `attendance_${id}_expanded_v1` : null, {});
  const [showCalendar, setShowCalendar] = useState(false);
  const loadMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);
  const { showSaveToast } = useSaveToast();
  const parseTime = (value?: string) => {
    if (!value) return null;
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };
  const formatRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
    const endTotal = hour * 60 + minute + durationMinutes;
    const endHour = Math.floor(endTotal / 60) % 24;
    const endMinute = endTotal % 60;
    const end = String(endHour).padStart(2, "0") + ":" + String(endMinute).padStart(2, "0");
    return start + " - " + end;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      if (alive) setCls(data);
      if (data) {
        const list = await getStudentsByClass(data.id);
        if (alive) setStudents(list);
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
    const initialStatus: Record<string, "presente" | "faltou" | undefined> = {};
    const initialNotes: Record<string, string> = {};
    const initialPain: Record<string, number> = {};
    students.forEach((student) => {
      initialStatus[student.id] = undefined;
      initialNotes[student.id] = "";
      initialPain[student.id] = 0;
    });
    setStatusById(initialStatus);
    setNoteById(initialNotes);
    setPainById(initialPain);
    setBaseline({ status: initialStatus, note: initialNotes, pain: initialPain });
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

  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "";
  const getDayIndex = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getDay();
  };
  const classDays = cls?.daysOfWeek ?? [];
  const isClassDay = useMemo(() => {
    if (!classDays.length) return true;
    const dayIndex = getDayIndex(date);
    if (dayIndex === null) return true;
    return classDays.includes(dayIndex);
  }, [classDays, date]);

  const buildBaseMaps = () => {
    const baseStatus: Record<string, "presente" | "faltou" | undefined> = {};
    const baseNotes: Record<string, string> = {};
    const basePain: Record<string, number> = {};
    students.forEach((student) => {
      baseStatus[student.id] = undefined;
      baseNotes[student.id] = "";
      basePain[student.id] = 0;
    });
    return { baseStatus, baseNotes, basePain };
  };

  useEffect(() => {
    if (!cls) return;
    if (!students.length) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    void loadDate(date);
  }, [cls, date, students.length]);


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
    setBaseline({
      status: { ...statusById },
      note: { ...noteById },
      pain: { ...painById },
    });
    logAction("Salvar chamada", {
      classId: cls.id,
      date,
      total: records.length,
    });
    showSaveToast({
      message: "Chamada salva com sucesso.",
      variant: "success",
    });
    showSaveToast({
      message: "Chamada salva - abrir relatorio?",
      variant: "info",
    });
    setHasSaved(true);
  };

  const loadDate = async (value: string) => {
    if (!cls) return;
    setDate(value);
    setLoadMessage("");
    if (loadMessageTimer.current) {
      clearTimeout(loadMessageTimer.current);
      loadMessageTimer.current = null;
    }
    const { baseStatus, baseNotes, basePain } = buildBaseMaps();
    if (classDays.length) {
      const dayIndex = getDayIndex(value);
      if (dayIndex !== null && !classDays.includes(dayIndex)) {
        setStatusById(baseStatus);
        setNoteById(baseNotes);
        setPainById(basePain);
        setBaseline({ status: baseStatus, note: baseNotes, pain: basePain });
        setHasSaved(false);
        setLoadMessage(
          `Essa turma treina em ${formatDays(classDays)}. Selecione um desses dias.`
        );
        loadMessageTimer.current = setTimeout(() => {
          setLoadMessage("");
          loadMessageTimer.current = null;
        }, 2500);
        return;
      }
    }
    const records = await getAttendanceByDate(cls.id, value);
    if (!records.length) {
      setStatusById(baseStatus);
      setNoteById(baseNotes);
      setPainById(basePain);
      setBaseline({ status: baseStatus, note: baseNotes, pain: basePain });
      setHasSaved(false);
      setLoadMessage("Sem registros para essa data.");
      loadMessageTimer.current = setTimeout(() => {
        setLoadMessage("");
        loadMessageTimer.current = null;
      }, 2500);
      return;
    }
    const nextStatus: Record<string, "presente" | "faltou"> = {};
    const nextNotes: Record<string, string> = {};
    const nextPain: Record<string, number> = {};
    records.forEach((record) => {
      nextStatus[record.studentId] = record.status;
      nextNotes[record.studentId] = record.note;
      nextPain[record.studentId] = record.painScore ?? 0;
    });
    const finalStatus = { ...baseStatus, ...nextStatus };
    const finalNotes = { ...baseNotes, ...nextNotes };
    const finalPain = { ...basePain, ...nextPain };
    setStatusById(finalStatus);
    setNoteById(finalNotes);
    setPainById(finalPain);
    setBaseline({ status: finalStatus, note: finalNotes, pain: finalPain });
    setHasSaved(true);
    setLoadMessage("Historico carregado para essa data.");
    loadMessageTimer.current = setTimeout(() => {
      setLoadMessage("");
      loadMessageTimer.current = null;
    }, 2000);
  };

  const handleDateChange = (value: string) => {
    if (cls) {
      setHasSaved(false);
      void loadDate(value);
    } else {
      setDate(value);
      setLoadMessage("");
    }
  };

  const handleToday = () => {
    const today = formatDate(new Date());
    if (cls) {
      void loadDate(today);
    } else {
      setDate(today);
    }
  };


  const hasChanges = useMemo(() => {
    const statusKeys = new Set([
      ...Object.keys(baseline.status),
      ...Object.keys(statusById),
    ]);
    for (const key of statusKeys) {
      if ((baseline.status[key] ?? undefined) !== (statusById[key] ?? undefined)) {
        return true;
      }
    }
    const noteKeys = new Set([
      ...Object.keys(baseline.note),
      ...Object.keys(noteById),
    ]);
    for (const key of noteKeys) {
      if ((baseline.note[key] ?? "") !== (noteById[key] ?? "")) {
        return true;
      }
    }
    const painKeys = new Set([
      ...Object.keys(baseline.pain),
      ...Object.keys(painById),
    ]);
    for (const key of painKeys) {
      if ((baseline.pain[key] ?? 0) !== (painById[key] ?? 0)) {
        return true;
      }
    }
    return false;
  }, [baseline, noteById, painById, statusById]);


  if (!cls) return null;
  const dateLabel = formatDisplayDate(date);
  const parsedStart = parseTime(cls.startTime);
  const timeLabel =
    parsedStart && cls.durationMinutes
      ? formatRange(parsedStart.hour, parsedStart.minute, cls.durationMinutes)
      : "";

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ClassContextHeader
        title="Chamada"
        className={cls.name}
        unit={cls.unit}
        ageBand={cls.ageBand}
        gender={cls.gender}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
      />

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
          onChange={handleDateChange}
          placeholder="Selecione a data"
          onOpenCalendar={() => setShowCalendar(true)}
        />
        {loadMessage ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={14}
              color={colors.warningText}
            />
            <Text style={{ color: colors.warningText, fontSize: 12 }}>
              {loadMessage}
            </Text>
          </View>
        ) : null}
      </View>

      {isClassDay ? (
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
                    <MaterialCommunityIcons
                      name={
                        expandedById[item.student.id]
                          ? "chevron-down"
                          : "chevron-right"
                      }
                      size={16}
                      color={colors.muted}
                    />
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
      ) : (
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
            Dia sem aula para essa turma.
          </Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>
            Dias da turma: {formatDays(classDays)}.
          </Text>
        </View>
      )}

      <View style={{ marginTop: 8, gap: 8 }}>
        <Button
          label="Salvar chamada"
          onPress={handleSave}
          disabled={!isClassDay || !hasChanges}
        />
        <Button
          label="Abrir relatorio"
          variant="secondary"
          disabled={!isClassDay || !hasSaved}
          onPress={() => {
            router.push({
              pathname: "/class/[id]/session",
              params: {
                id: cls.id,
                date,
                tab: "relatorio",
              },
            });
          }}
        />
      </View>

      <DatePickerModal
        visible={showCalendar}
        value={date}
        onChange={handleDateChange}
        onClose={() => setShowCalendar(false)}
        closeOnSelect
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}










