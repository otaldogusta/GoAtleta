import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
  Vibration,
} from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  deleteClassCascade,
  duplicateClass,
  getClassById,
  getClasses,
  updateClass,
} from "../../src/db/seed";
import type { ClassGroup } from "../../src/core/models";
import { Button } from "../../src/ui/Button";
import { useAppTheme } from "../../src/ui/app-theme";
import { useConfirmUndo } from "../../src/ui/confirm-undo";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { animateLayout } from "../../src/ui/animate-layout";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export default function ClassDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { confirm } = useConfirmUndo();
  const [cls, setCls] = useState<ClassGroup | null>(null);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [ageBand, setAgeBand] = useState<ClassGroup["ageBand"]>("8-9");
  const [startTime, setStartTime] = useState("14:00");
  const [duration, setDuration] = useState("60");
  const [allClasses, setAllClasses] = useState<ClassGroup[]>([]);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [goal, setGoal] = useState<ClassGroup["goal"]>("Fundamentos");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showDetails, setShowDetails] = usePersistedState<boolean>(
    "class_details_show_info_v1",
    true
  );
  const {
    animatedStyle: detailsAnimStyle,
    isVisible: showDetailsContent,
  } = useCollapsibleAnimation(showDetails);
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const ageBandOptions = ["8-9", "10-12", "13-15", "16-18"];
  const goals: ClassGroup["goal"][] = [
    "Fundamentos",
    "Forca Geral",
    "Potencia/Agilidade",
    "Forca+Potencia",
    "Velocidade",
    "Agilidade",
    "Resistencia",
    "Potencia",
    "Mobilidade",
    "Coordenacao",
    "Prevencao de lesoes",
  ];
  const durationOptions = ["60", "75", "90"];
  const formatDays = (days: number[]) =>
    days.length ? days.map((day) => dayNames[day]).join(", ") : "-";
  const getChipStyle = (active: boolean, palette?: { bg: string; text: string }) => ({
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: active ? palette?.bg ?? colors.primaryBg : colors.secondaryBg,
  });
  const getChipTextStyle = (active: boolean, palette?: { bg: string; text: string }) => ({
    color: active ? palette?.text ?? colors.primaryText : colors.text,
    fontWeight: "600" as const,
    fontSize: 12,
  });
  const normalizeTimeInput = (value: string) => {
    const digits = value.replace(/[^\d]/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + ":" + digits.slice(2);
  };
  const isValidTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return false;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
  };
  const parseDuration = (value: string) => {
    const minutes = Number(value);
    if (!Number.isFinite(minutes)) return null;
    return minutes >= 30 && minutes <= 180 ? minutes : null;
  };
  const parseTime = (value: string) => {
    const match = value.match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    return { hour: Number(match[1]), minute: Number(match[2]) };
  };
  const formatTimeRange = (hour: number, minute: number, durationMinutes: number) => {
    const start = hour * 60 + minute;
    const end = start + durationMinutes;
    const endHour = Math.floor(end / 60) % 24;
    const endMinute = end % 60;
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(hour)}:${pad(minute)} - ${pad(endHour)}:${pad(endMinute)}`;
  };
  const toMinutes = (value: string) => {
    if (!isValidTime(value)) return null;
    const [hour, minute] = value.split(":").map(Number);
    return hour * 60 + minute;
  };
  const clsId = cls?.id ?? "";
  const clsUnit = cls?.unit ?? "";
  const currentUnit = unit.trim() || clsUnit || "Sem unidade";
  const unitLabel = clsUnit || "Sem unidade";
  const className = cls?.name || "Turma";
  const classAgeBand = cls?.ageBand || ageBand;
  const classDays = cls?.daysOfWeek ?? [];
  const classStartTime = cls?.startTime || "-";
  const classDuration = cls?.durationMinutes ?? 60;
  const classGoal = cls?.goal || goal;
  const unitPalette = getUnitPalette(unitLabel, colors);
  const conflictSummary = useMemo(() => {
    if (!clsId) return [];
    const start = toMinutes(startTime.trim());
    const durationValue = parseDuration(duration.trim());
    if (start === null || !durationValue) return [];
    const end = start + durationValue;
    return allClasses
      .filter((item) => item.id !== clsId)
      .filter((item) => (item.unit || "Sem unidade") === currentUnit)
      .filter((item) => item.daysOfWeek.some((day) => daysOfWeek.includes(day)))
      .filter((item) => {
        const otherStart = toMinutes(item.startTime || "");
        if (otherStart === null) return false;
        const otherEnd = otherStart + (item.durationMinutes || 60);
        return start < otherEnd && otherStart < end;
      })
      .map((item) => {
        const sharedDays = item.daysOfWeek.filter((day) =>
          daysOfWeek.includes(day)
        );
        return `${item.name} (${sharedDays.map((day) => dayNames[day]).join(", ")})`;
      });
  }, [allClasses, clsId, currentUnit, daysOfWeek, duration, startTime]);
  const goalSuggestions = useMemo(() => {
    if (!clsUnit) return [];
    const matches = allClasses.filter((item) => item.unit === clsUnit);
    const counts = new Map<string, number>();
    matches.forEach((item) => {
      counts.set(item.goal, (counts.get(item.goal) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([goal]) => goal)
      .filter((goal) => goal && !goals.includes(goal))
      .slice(0, 4);
  }, [allClasses, clsUnit, goals]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClassById(id);
      const list = await getClasses();
      if (alive) {
        setCls(data);
        setAllClasses(list);
        setName(data?.name ?? "");
        setUnit(data?.unit ?? "");
        setAgeBand(data?.ageBand ?? "8-9");
        setStartTime(data?.startTime ?? "14:00");
        setDuration(String(data?.durationMinutes ?? 60));
        setDaysOfWeek(data?.daysOfWeek ?? []);
        setGoal(data?.goal ?? "Fundamentos");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!cls) {
    return (
      <SafeAreaView
        style={{ flex: 1, padding: 16, backgroundColor: colors.background }}
      >
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Turma nao encontrada
        </Text>
      </SafeAreaView>
    );
  }

  const toggleDay = (value: number) => {
    setDaysOfWeek((prev) =>
      prev.includes(value) ? prev.filter((day) => day !== value) : [...prev, value]
    );
  };

  const saveUnit = async () => {
    if (!cls) return;
    const timeValue = startTime.trim();
    if (!isValidTime(timeValue)) {
      setFormError("Horario invalido. Use HH:MM.");
      Vibration.vibrate(40);
      return;
    }
    const durationValue = parseDuration(duration.trim());
    if (!durationValue) {
      setFormError("Duracao invalida. Use minutos entre 30 e 180.");
      Vibration.vibrate(40);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      await updateClass(cls.id, {
        name: name.trim() || cls.name,
        unit: unit.trim() || "Rede Esperanca",
        daysOfWeek,
        goal,
        ageBand: ageBand.trim() || cls.ageBand,
        startTime: timeValue,
        durationMinutes: durationValue,
      });
      Vibration.vibrate(60);
      const fresh = await getClassById(cls.id);
      setCls(fresh);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const onDuplicate = () => {
    if (!cls) return;
    Alert.alert(
      "Duplicar turma",
      "Deseja criar uma copia desta turma?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Duplicar",
          onPress: async () => {
            await duplicateClass(cls);
            router.replace("/classes");
          },
        },
      ]
    );
  };

  const onDelete = () => {
    if (!cls) return;
    Vibration.vibrate([0, 80, 60, 80]);
    confirm({
      title: "Excluir turma?",
      message:
        "Isso remove treinos, chamadas e alunos da turma. Deseja excluir?",
      confirmLabel: "Excluir",
      undoMessage: "Turma excluida. Deseja desfazer?",
      onConfirm: async () => {
        await deleteClassCascade(cls.id);
        router.replace("/classes");
      },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            {className}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <View style={getChipStyle(true, unitPalette)}>
              <Text style={getChipTextStyle(true, unitPalette)}>{unitLabel}</Text>
            </View>
            <View style={getChipStyle(true, { bg: colors.secondaryBg, text: colors.text })}>
              <Text style={getChipTextStyle(true, { bg: colors.secondaryBg, text: colors.text })}>
                {"Faixa " + classAgeBand}
              </Text>
            </View>
          </View>
        </View>

        <View
          style={[
            getSectionCardStyle(colors, "neutral", { radius: 16, padding: 12 }),
            { borderLeftWidth: 3, borderLeftColor: unitPalette.bg },
          ]}
        >
          <Pressable
            onPress={() => {
              animateLayout();
              setShowDetails((prev) => !prev);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderRadius: 10,
              backgroundColor: colors.inputBg,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Informacoes
            </Text>
            <MaterialCommunityIcons
              name={showDetails ? "chevron-down" : "chevron-right"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          {showDetailsContent ? (
            <Animated.View style={detailsAnimStyle}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: unitPalette.bg,
                  }}
                />
                <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                  {(() => {
                    const parsed = parseTime(classStartTime);
                    if (!parsed) return className;
                    return `${formatTimeRange(parsed.hour, parsed.minute, classDuration)} - ${className}`;
                  })()}
                </Text>
              </View>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                {"Faixa: " + classAgeBand}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Dias</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {formatDays(classDays)}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Horario</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classStartTime}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Duracao</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classDuration + " min"}
                  </Text>
                </View>
                <View style={{ minWidth: "45%" }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Objetivo</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>
                    {classGoal}
                  </Text>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </View>

        <View style={getSectionCardStyle(colors, "primary", { radius: 18 })}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            Acoes rapidas
          </Text>
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={() =>
                router.push({ pathname: "/class/[id]/session", params: { id } })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.primaryBg,
              }}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 15 }}>
                Ver aula do dia
              </Text>
              <Text style={{ color: colors.primaryText, marginTop: 6, opacity: 0.85 }}>
                Plano e cronometro
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/class/[id]/attendance",
                  params: { id },
                })
              }
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 16,
                backgroundColor: colors.successBg,
              }}
            >
              <Text style={{ color: colors.successText, fontWeight: "700", fontSize: 15 }}>
                Fazer chamada
              </Text>
              <Text style={{ color: colors.successText, marginTop: 6, opacity: 0.7 }}>
                Presenca rapida
              </Text>
            </Pressable>
          </View>
        </View>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}





