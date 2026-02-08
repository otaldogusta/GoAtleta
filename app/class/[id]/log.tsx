import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import {
  getAttendanceByDate,
  getClassById,
  getSessionLogByDate,
  getStudentsByClass,
  getTrainingPlans,
  saveSessionLog,
} from "../../../src/db/seed";
import type { ClassGroup, SessionLog } from "../../../src/core/models";
import { Button } from "../../../src/ui/Button";
import { Pressable } from "../../../src/ui/Pressable";
import { useAppTheme } from "../../../src/ui/app-theme";
import { useCollapsibleAnimation } from "../../../src/ui/use-collapsible";
import { AnchoredDropdown } from "../../../src/ui/AnchoredDropdown";
import { ClassContextHeader } from "../../../src/ui/ClassContextHeader";

export default function LogScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const hydratedKeyRef = useRef<string | null>(null);

  const [PSE, setPSE] = useState<number>(7);
  const [technique, setTechnique] = useState<"boa" | "ok" | "ruim">("boa");
  const [activity, setActivity] = useState("");
  const [autoActivity, setAutoActivity] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [participantsCount, setParticipantsCount] = useState("");
  const [photos, setPhotos] = useState("");
  const [attendancePercent, setAttendancePercent] = useState<number | null>(null);
  const [showPsePicker, setShowPsePicker] = useState(false);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);
  const [pseTriggerLayout, setPseTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [techniqueTriggerLayout, setTechniqueTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const containerRef = useRef<View>(null);
  const pseTriggerRef = useRef<View>(null);
  const techniqueTriggerRef = useRef<View>(null);
  const { animatedStyle: psePickerAnimStyle, isVisible: showPsePickerContent } =
    useCollapsibleAnimation(showPsePicker, { translateY: -6 });
  const { animatedStyle: techniquePickerAnimStyle, isVisible: showTechniquePickerContent } =
    useCollapsibleAnimation(showTechniquePicker, { translateY: -6 });

  const sessionDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
       ? date
      : new Date().toISOString().slice(0, 10);
  const formatDisplayDate = (value: string) => {
    const parts = value.split("-");
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };
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
  const weekdayId = useMemo(() => {
    const dateObj = new Date(sessionDate);
    const day = dateObj.getDay();
    return day === 0 ? 7 : day;
  }, [sessionDate]);

  const togglePicker = useCallback((target: "pse" | "technique") => {
    setShowPsePicker((prev) => (target === "pse" ? !prev : false));
    setShowTechniquePicker((prev) => (target === "technique" ? !prev : false));
  }, []);

  const closePickers = useCallback(() => {
    setShowPsePicker(false);
    setShowTechniquePicker(false);
  }, []);

  const handleSelectPse = useCallback((value: number) => {
    setPSE(value);
    setShowPsePicker(false);
  }, []);

  const handleSelectTechnique = useCallback((value: "boa" | "ok" | "ruim") => {
    setTechnique(value);
    setShowTechniquePicker(false);
  }, []);

  const syncPickerLayouts = useCallback(() => {
    const hasPickerOpen = showPsePicker || showTechniquePicker;
    if (!hasPickerOpen) return;
    requestAnimationFrame(() => {
      if (showPsePicker) {
        pseTriggerRef.current.measureInWindow((x, y, width, height) => {
          setPseTriggerLayout({ x, y, width, height });
        });
      }
      if (showTechniquePicker) {
        techniqueTriggerRef.current.measureInWindow((x, y, width, height) => {
          setTechniqueTriggerLayout({ x, y, width, height });
        });
      }
      containerRef.current.measureInWindow((x, y) => {
        setContainerWindow({ x, y });
      });
    });
  }, [showPsePicker, showTechniquePicker]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (id) {
        const data = await getClassById(id);
        if (alive) setCls(data);
      }
      if (!id) return;
      const [attendanceRecords, students, existingLog] = await Promise.all([
        getAttendanceByDate(id, sessionDate),
        getStudentsByClass(id),
        getSessionLogByDate(id, sessionDate),
      ]);
      if (!alive) return;
      const hydrateKey = `${id ?? ""}_${sessionDate}`;
      if (hydratedKeyRef.current !== hydrateKey) {
        hydratedKeyRef.current = hydrateKey;
        if (existingLog) {
          setSessionLog(existingLog);
          setPSE(existingLog.PSE ?? 7);
          setTechnique(
            (existingLog.technique as "boa" | "ok" | "ruim") ?? "boa"
          );
          setActivity(existingLog.activity ?? "");
          setConclusion(existingLog.conclusion ?? "");
          setParticipantsCount(
            typeof existingLog.participantsCount === "number"
               ? String(existingLog.participantsCount)
              : ""
          );
          setPhotos(existingLog.photos ?? "");
        } else {
          setSessionLog(null);
        }
      } else if (existingLog) {
        setSessionLog(existingLog);
      }
      if (attendanceRecords.length) {
        const present = attendanceRecords.filter(
          (record) => record.status === "presente"
        ).length;
        const total = attendanceRecords.length;
        const percent = total > 0 ? Math.round((present / total) * 100) : 0;
        setAttendancePercent(percent);
      } else if (students.length) {
        setAttendancePercent(0);
      } else {
        setAttendancePercent(null);
      }
      const plans = await getTrainingPlans();
      const byClass = plans.filter((item) => item.classId === id);
      const byDate = byClass.find((item) => item.applyDate === sessionDate);
      const byWeekday = byClass.find((item) =>
        (item.applyDays ?? []).includes(weekdayId)
      );
      const plan = byDate ?? byWeekday ?? null;
      if (!plan) return;
      const fallback =
        plan.title.trim() ||
        plan.main.filter(Boolean).slice(0, 2).join(" / ") ||
        "";
      if (!fallback) return;
      if (!alive) return;
      setAutoActivity(fallback);
      if (!activity.trim()) setActivity(fallback);
    })();
    return () => {
      alive = false;
    };
  }, [activity, id, sessionDate, weekdayId]);

  useEffect(() => {
    syncPickerLayouts();
  }, [showPsePicker, showTechniquePicker, syncPickerLayouts]);

  const saveLog = async () => {
    const dateValue =
      typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
         ? date
        : null;
    const createdAt = dateValue
       ? new Date(`${dateValue}T12:00:00`).toISOString()
      : new Date().toISOString();
    const participantsRaw = participantsCount.trim();
    const participantsValue = participantsRaw ? Number(participantsRaw) : Number.NaN;
    const parsedParticipants =
      Number.isFinite(participantsValue) && participantsValue >= 0
         ? participantsValue
        : undefined;
    const activityValue = activity.trim() || autoActivity.trim();
    const attendanceValue =
      typeof attendancePercent === "number" ? attendancePercent : 0;
    await saveSessionLog({
      id: sessionLog.id,
      clientId: sessionLog.clientId,
      classId: id,
      PSE,
      technique,
      attendance: attendanceValue,
      activity: activityValue,
      conclusion,
      participantsCount: parsedParticipants,
      photos,
      createdAt: sessionLog.createdAt ?? createdAt,
    });
    return dateValue ?? new Date().toISOString().slice(0, 10);
  };

  async function handleSave() {
    await saveLog();
    router.replace("/");
  }

  async function handleSaveAndReport() {
    const reportDate = await saveLog();
    router.replace({
      pathname: "/class/[id]/session",
      params: { id, date: reportDate, autoReport: "1" },
    });
  }

  const className = cls?.name ?? "Turma";
  const dateLabel = formatDisplayDate(sessionDate);
  const parsedStart = parseTime(cls.startTime);
  const timeLabel =
    parsedStart && cls.durationMinutes
      ? formatRange(parsedStart.hour, parsedStart.minute, cls.durationMinutes)
      : "";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={closePickers}
        onScroll={syncPickerLayouts}
        scrollEventThrottle={16}
      >
        { cls ? (
          <ClassContextHeader
            title="Relatório da aula"
            className={className}
            unit={cls.unit}
            ageBand={cls.ageBand}
            gender={cls.gender}
            classColorKey={cls.colorKey}
            dateLabel={dateLabel}
            timeLabel={timeLabel}
          />
        ) : (
          <View style={{ gap: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
              Relatório da aula
            </Text>
            <Text style={{ color: colors.muted }}>Resumo da aula aplicada</Text>
          </View>
        )}
        <View ref={containerRef} style={{ position: "relative", gap: 10 }}>
          <View
            style={{
              gap: 12,
              padding: 16,
              borderRadius: 20,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              shadowColor: "#000",
              shadowOpacity: 0.05,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
              elevation: 2,
            }}
          >
            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                PSE (0-10)
              </Text>
              <View ref={pseTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("pse")}
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
                    {String(PSE)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{ transform: [{ rotate: showPsePicker ? "180deg" : "0deg" }] }}
                  />
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Técnica geral
              </Text>
              <View ref={techniqueTriggerRef}>
                <Pressable
                  onPress={() => togglePicker("technique")}
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
                    {technique}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={16}
                    color={colors.muted}
                    style={{
                      transform: [{ rotate: showTechniquePicker ? "180deg" : "0deg" }],
                    }}
                  />
                </Pressable>
              </View>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Número de participantes
              </Text>
              <TextInput
                placeholder="Ex: 12"
                value={participantsCount}
                onChangeText={setParticipantsCount}
                keyboardType="numeric"
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Atividade
              </Text>
              <TextInput
                placeholder="Resumo da atividade principal"
                value={activity}
                onChangeText={(value) => {
                  setActivity(value);
                  closePickers();
                }}
                placeholderTextColor={colors.placeholder}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Conclusão
              </Text>
              <TextInput
                placeholder="Observações finais da aula"
                value={conclusion}
                onChangeText={(value) => {
                  setConclusion(value);
                  closePickers();
                }}
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  minHeight: 90,
                  textAlignVertical: "top",
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

            <View style={{ gap: 6 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                Fotos
              </Text>
              <TextInput
                placeholder="Cole links ou descreva as fotos"
                value={photos}
                onChangeText={(value) => {
                  setPhotos(value);
                  closePickers();
                }}
                placeholderTextColor={colors.placeholder}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: 12,
                  borderRadius: 12,
                  minHeight: 80,
                  textAlignVertical: "top",
                  backgroundColor: colors.inputBg,
                  color: colors.inputText,
                }}
              />
            </View>

            <View style={{ marginTop: 12, gap: 8 }}>
              <Button label="Salvar e gerar relatório" onPress={handleSaveAndReport} />
              <Button label="Salvar" variant="secondary" onPress={handleSave} />
            </View>
          </View>

          <AnchoredDropdown
            visible={showPsePickerContent}
            layout={pseTriggerLayout}
            container={containerWindow}
            animationStyle={psePickerAnimStyle}
            zIndex={420}
            maxHeight={220}
            nestedScrollEnabled
            onRequestClose={closePickers}
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            }}
            scrollContentStyle={{ padding: 4 }}
          >
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, index) => (
              <Pressable
                key={n}
                onPress={() => handleSelectPse(n)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: PSE === n ? colors.primaryBg : "transparent",
                }}
              >
                <Text
                  style={{
                    color: PSE === n ? colors.primaryText : colors.text,
                    fontSize: 12,
                    fontWeight: PSE === n ? "700" : "500",
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            ))}
          </AnchoredDropdown>

          <AnchoredDropdown
            visible={showTechniquePickerContent}
            layout={techniqueTriggerLayout}
            container={containerWindow}
            animationStyle={techniquePickerAnimStyle}
            zIndex={420}
            maxHeight={200}
            nestedScrollEnabled
            onRequestClose={closePickers}
            panelStyle={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.inputBg,
            }}
            scrollContentStyle={{ padding: 4 }}
          >
            {(["boa", "ok", "ruim"] as const).map((option, index) => (
              <Pressable
                key={option}
                onPress={() => handleSelectTechnique(option)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  margin: index === 0 ? 6 : 2,
                  backgroundColor: technique === option ? colors.primaryBg : "transparent",
                }}
              >
                <Text
                  style={{
                    color: technique === option ? colors.primaryText : colors.text,
                    fontSize: 12,
                    fontWeight: technique === option ? "700" : "500",
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </AnchoredDropdown>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
