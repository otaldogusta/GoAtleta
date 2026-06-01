import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import {
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../../src/ui/Pressable";

import type {
    AttendanceRecord,
    ClassGroup,
    Student,
} from "../../../src/core/models";
import { useAuth } from "../../../src/auth/auth";
import {
    getAttendanceByDate,
    getClassById,
    getStudentsByClass,
    saveAttendanceRecords,
} from "../../../src/db/seed";
import { isAuthError, isNetworkError } from "../../../src/db/client";
import { logAction } from "../../../src/observability/breadcrumbs";
import { measure } from "../../../src/observability/perf";
import { useAppTheme } from "../../../src/ui/app-theme";
import { radius, shadow } from "../../../src/theme/tokens";
import { Button } from "../../../src/ui/Button";
import { ClassContextHeader } from "../../../src/ui/ClassContextHeader";
import { DateInput } from "../../../src/ui/DateInput";
import { DatePickerModal } from "../../../src/ui/DatePickerModal";
import { FadeHorizontalScroll } from "../../../src/ui/FadeHorizontalScroll";
import { useSaveToast } from "../../../src/ui/save-toast";
import { ScreenLoadingState } from "../../../src/components/ui/ScreenLoadingState";
import { usePersistedState } from "../../../src/ui/use-persisted-state";

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

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

const formatDays = (days: number[]) =>
  days.length ? days.map((day) => dayNames[day]).join(", ") : "";

const getDayIndex = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getDay();
};

// perf-check: ignore-render
// perf-check: ignore-measure
export default function AttendanceScreen() {
  const { colors } = useAppTheme();
  const { signOut } = useAuth();
  const { id, date: dateParam } = useLocalSearchParams<{
    id: string;
    date: string;
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
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
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
  const parseTime = (value: string) => {
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

  const classDays = useMemo(() => cls?.daysOfWeek ?? [], [cls?.daysOfWeek]);
  const isClassDay = useMemo(() => {
    if (!classDays.length) return true;
    const dayIndex = getDayIndex(date);
    if (dayIndex === null) return true;
    return classDays.includes(dayIndex);
  }, [classDays, date]);

  const buildBaseMaps = useCallback(() => {
    const baseStatus: Record<string, "presente" | "faltou" | undefined> = {};
    const baseNotes: Record<string, string> = {};
    const basePain: Record<string, number> = {};
    students.forEach((student) => {
      baseStatus[student.id] = undefined;
      baseNotes[student.id] = "";
      basePain[student.id] = 0;
    });
    return { baseStatus, baseNotes, basePain };
  }, [students]);

  const loadDate = useCallback(
    async (value: string) => {
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
      let records: AttendanceRecord[] = [];
      try {
        records = await getAttendanceByDate(cls.id, value);
      } catch (error) {
        if (isAuthError(error)) {
          setLoadMessage("Sessão expirada. Faça login novamente.");
        } else if (isNetworkError(error)) {
          setLoadMessage("Sem conexão. Mantendo os dados já carregados.");
        } else {
          setLoadMessage("Não foi possível carregar a data agora.");
        }
        loadMessageTimer.current = setTimeout(() => {
          setLoadMessage("");
          loadMessageTimer.current = null;
        }, 2500);
        return;
      }
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
      setLoadMessage("Histórico carregado para essa data.");
      loadMessageTimer.current = setTimeout(() => {
        setLoadMessage("");
        loadMessageTimer.current = null;
      }, 2000);
    },
    [buildBaseMaps, classDays, cls]
  );

  useEffect(() => {
    if (!cls) return;
    if (typeof dateParam !== "string") return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return;
    const parsed = new Date(dateParam);
    if (Number.isNaN(parsed.getTime())) return;
    void loadDate(dateParam);
  }, [cls, dateParam, loadDate]);

  useEffect(() => {
    if (!cls) return;
    if (!students.length) return;
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;
    void loadDate(date);
  }, [cls, date, loadDate, students.length]);

  const handleSave = async () => {
    if (!cls) return;
    if (isSavingAttendance) return;
    setIsSavingAttendance(true);
    try {
      const createdAt = new Date().toISOString();
      const records = items
        .filter(
          (item): item is (typeof item & { status: "presente" | "faltou" }) =>
            item.status === "presente" || item.status === "faltou"
        )
        .map((item) => ({
          id: `${cls.id}_${item.student.id}_${date}`,
          classId: cls.id,
          studentId: item.student.id,
          date,
          status: item.status,
          note: item.note.trim(),
          painScore: item.pain,
          createdAt,
        }));

      const nextStatus: Record<string, "presente" | "faltou" | undefined> = {};
      const nextNotes: Record<string, string> = {};
      const nextPain: Record<string, number> = {};
      students.forEach((student) => {
        const status = statusById[student.id];
        nextStatus[student.id] = status;
        nextNotes[student.id] = status ? (noteById[student.id] ?? "").trim() : "";
        nextPain[student.id] = status ? painById[student.id] ?? 0 : 0;
      });

      await measure("saveAttendanceRecords", () =>
        saveAttendanceRecords(cls.id, date, records)
      );
      setStatusById(nextStatus);
      setNoteById(nextNotes);
      setPainById(nextPain);
      setBaseline({ status: nextStatus, note: nextNotes, pain: nextPain });
      logAction("Salvar chamada", {
        classId: cls.id,
        date,
        total: records.length,
      });
      showSaveToast({
        message: "Chamada salva com sucesso.",
        variant: "success",
      });
      setHasSaved(records.length > 0);
    } catch (error) {
      if (isAuthError(error)) {
        showSaveToast({
          message: "Sessão expirada. Entre novamente.",
          variant: "error",
          actionLabel: "Login",
          onAction: async () => {
            await signOut();
            router.replace("/login");
          },
          durationMs: 6000,
        });
        return;
      }
      if (isNetworkError(error)) {
        showSaveToast({
          message: "Sem conexão. Tente novamente.",
          variant: "error",
        });
        return;
      }
      showSaveToast({
        error,
        variant: "error",
      });
    } finally {
      setIsSavingAttendance(false);
    }
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


  if (!cls) {
    return <ScreenLoadingState />;
  }
  const dateLabel = formatDisplayDate(date);
  const parsedStart = parseTime(cls.startTime);
  const timeLabel =
    parsedStart && cls.durationMinutes
      ? formatRange(parsedStart.hour, parsedStart.minute, cls.durationMinutes)
      : "";
  const attendanceEmptyState = !isClassDay ? (
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
  ) : items.length === 0 ? (
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
        Nenhum aluno cadastrado nesta turma.
      </Text>
    </View>
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1, padding: 16 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ClassContextHeader
        title="Chamada"
        className={cls.name}
        unit={cls.unit}
        ageBand={cls.ageBand}
        gender={cls.gender}
        classColorKey={cls.colorKey}
        dateLabel={dateLabel}
        timeLabel={timeLabel}
        notice={loadMessage}
      />

      <View
        style={{
          gap: 8,
          padding: 14,
          borderRadius: radius.container,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderSubtle,
          shadowColor: shadow.card.shadowColor,
          shadowOpacity: shadow.card.shadowOpacity,
          shadowRadius: shadow.card.shadowRadius,
          shadowOffset: shadow.card.shadowOffset,
          elevation: shadow.card.elevation,
          marginBottom: 12,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: "900", color: colors.textPrimary }}>
          Data da aula
        </Text>
        <DateInput
          value={date}
          onChange={handleDateChange}
          placeholder="Selecione a data"
          onOpenCalendar={() => setShowCalendar(true)}
        />
        { loadMessage ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <Ionicons
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

      <FlatList
        style={{ flex: 1, minHeight: 0 }}
        data={isClassDay ? items : []}
        keyExtractor={(item) => item.student.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View
            style={{
              borderRadius: radius.container,
              padding: 14,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              shadowColor: shadow.card.shadowColor,
              shadowOpacity: shadow.card.shadowOpacity,
              shadowRadius: shadow.card.shadowRadius,
              shadowOffset: shadow.card.shadowOffset,
              elevation: shadow.card.elevation,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <FadeHorizontalScroll
                containerStyle={{ flex: 1, minWidth: 0 }}
                fadeColor={colors.card}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text
                    style={{ fontSize: 16, fontWeight: "900", color: colors.textPrimary }}
                    numberOfLines={1}
                  >
                    {item.student.name}
                  </Text>
                  {item.student.isExperimental ? (
                    <View
                      style={{
                        borderRadius: radius.full,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        backgroundColor: colors.warningBg,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.warningText,
                          fontSize: 11,
                          fontWeight: "700",
                        }}
                      >
                        Experimental
                      </Text>
                    </View>
                  ) : null}
                </View>
              </FadeHorizontalScroll>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
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
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: item.status === "presente" ? colors.successBorder : colors.borderSubtle,
                    backgroundColor:
                      item.status === "presente" ? colors.successBg : colors.backgroundSubtle,
                  }}
                >
                  <Text
                    style={{
                      color: item.status === "presente" ? colors.successText : colors.textPrimary,
                      fontWeight: "800",
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
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: item.status === "faltou" ? colors.dangerBorder : colors.borderSubtle,
                    backgroundColor:
                      item.status === "faltou" ? colors.dangerBg : colors.backgroundSubtle,
                  }}
                >
                  <Text
                    style={{
                      color: item.status === "faltou" ? colors.dangerText : colors.textPrimary,
                      fontWeight: "800",
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
                    borderRadius: radius.full,
                    backgroundColor: colors.backgroundSubtle,
                    borderWidth: 1,
                    borderColor: colors.borderSubtle,
                  }}
                >
                  <Ionicons
                    name={expandedById[item.student.id] ? "chevron-down" : "chevron-forward"}
                    size={16}
                    color={colors.textMuted}
                  />
                </Pressable>
              </View>
            </View>

            { expandedById[item.student.id] ? (
              <View style={{ marginTop: 10, gap: 8 }}>
                <Text style={{ color: colors.textSecondary }}>
                  Idade: {item.student.age} | Tel: {item.student.phone}
                </Text>
                <TextInput
                  placeholder="Observação (opcional)"
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
                    borderColor: colors.borderSubtle,
                    padding: 10,
                    borderRadius: radius.internal,
                    backgroundColor: colors.inputBg,
                    color: colors.textPrimary,
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
        )}
        ListEmptyComponent={attendanceEmptyState}
        ListFooterComponent={
          <View style={{ marginTop: 8, gap: 8 }}>
            <Button
              label={isSavingAttendance ? "Salvando chamada..." : "Salvar chamada"}
              onPress={handleSave}
              disabled={!isClassDay || !hasChanges || isSavingAttendance}
              loading={isSavingAttendance}
            />
            <Button
              label="Abrir relatório"
              variant="secondary"
              disabled={!isClassDay || !hasSaved || isSavingAttendance}
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
        }
      />

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
