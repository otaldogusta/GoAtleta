import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, ScrollView, Text, View } from "react-native";
import { Pressable } from "../../src/ui/Pressable";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { type ThemeColors, useAppTheme } from "../../src/ui/app-theme";
import { getSectionCardStyle } from "../../src/ui/section-styles";
import { getClasses } from "../../src/db/seed";
import type { ClassGroup } from "../../src/core/models";
import { ModalSheet } from "../../src/ui/ModalSheet";
import { useModalCardStyle } from "../../src/ui/use-modal-card-style";
import { getUnitPalette } from "../../src/ui/unit-colors";
import { usePersistedState } from "../../src/ui/use-persisted-state";
import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";

type VolumeLevel = "baixo" | "medio" | "alto";

type WeekPlan = {
  week: number;
  title: string;
  focus: string;
  volume: VolumeLevel;
  notes: string[];
};

const ageBands = ["6-8", "9-11", "12-14"] as const;
const cycleOptions = [2, 3, 4, 5, 6] as const;
const sessionsOptions = [
  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
] as const;
const volumeOrder: VolumeLevel[] = ["baixo", "medio", "alto"];
const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];
const dayNumbersByLabelIndex = [1, 2, 3, 4, 5, 6, 0];

const pseTitle = "Percepcao Subjetiva de Esforco";

const volumeToRpe: Record<VolumeLevel, string> = {
  baixo: "PSE 4-5",
  medio: "PSE 5-6",
  alto: "PSE 6-7",
};

const volumeToRatio: Record<VolumeLevel, number> = {
  baixo: 0.35,
  medio: 0.65,
  alto: 0.9,
};

type SectionKey =
  | "params"
  | "summary"
  | "load"
  | "guides"
  | "cycle"
  | "week";

type PeriodizationTab = "geral" | "ciclo" | "semana";

const getVolumePalette = (level: VolumeLevel, colors: ThemeColors) => {
  if (level === "baixo") {
    return {
      bg: colors.successBg,
      text: colors.successText,
      border: colors.successBg,
    };
  }
  if (level === "medio") {
    return {
      bg: colors.warningBg,
      text: colors.warningText,
      border: colors.warningBg,
    };
  }
  return {
    bg: colors.dangerBg,
    text: colors.dangerText,
    border: colors.dangerBorder,
  };
};

const basePlans: Record<(typeof ageBands)[number], WeekPlan[]> = {
  "6-8": [
    {
      week: 1,
      title: "Base ludica",
      focus: "Coordenacao, brincadeiras e jogos simples",
      volume: "baixo",
      notes: ["Bola leve, rede baixa", "1x1 e 2x2"],
    },
    {
      week: 2,
      title: "Fundamentos",
      focus: "Toque, manchete e controle basico",
      volume: "medio",
      notes: ["Series curtas", "Feedback simples"],
    },
    {
      week: 3,
      title: "Jogo reduzido",
      focus: "Cooperacao e tomada de decisao",
      volume: "medio",
      notes: ["Jogos 2x2/3x3", "Regras simples"],
    },
    {
      week: 4,
      title: "Recuperacao",
      focus: "Revisao e prazer pelo jogo",
      volume: "baixo",
      notes: ["Menos repeticoes", "Mais variacao"],
    },
  ],
  "9-11": [
    {
      week: 1,
      title: "Base tecnica",
      focus: "Fundamentos e controle de bola",
      volume: "medio",
      notes: ["2-3 sessoes/semana", "Equilibrio e core"],
    },
    {
      week: 2,
      title: "Tomada de decisao",
      focus: "Leitura simples de jogo e cooperacao",
      volume: "medio",
      notes: ["Jogos condicionados", "Ritmo moderado"],
    },
    {
      week: 3,
      title: "Intensidade controlada",
      focus: "Velocidade e saltos com controle",
      volume: "alto",
      notes: ["Monitorar saltos", "Pausas ativas"],
    },
    {
      week: 4,
      title: "Recuperacao",
      focus: "Tecnica leve e prevencao",
      volume: "baixo",
      notes: ["Volleyveilig simples", "Mobilidade"],
    },
  ],
  "12-14": [
    {
      week: 1,
      title: "Base tecnica",
      focus: "Refino de fundamentos e posicao",
      volume: "medio",
      notes: ["Sessoes 60-90 min", "Ritmo controlado"],
    },
    {
      week: 2,
      title: "Potencia controlada",
      focus: "Salto, deslocamento e reacao",
      volume: "alto",
      notes: ["Pliometria leve", "Forca 50-70% 1RM"],
    },
    {
      week: 3,
      title: "Sistema de jogo",
      focus: "Transicao defesa-ataque e 4x4/6x6",
      volume: "alto",
      notes: ["Leitura de bloqueio", "Decisao rapida"],
    },
    {
      week: 4,
      title: "Recuperacao",
      focus: "Prevencao e consolidacao tecnica",
      volume: "baixo",
      notes: ["Volleyveilig completo", "Menos saltos"],
    },
  ],
};

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const nextDateForDayNumber = (dayNumber: number) => {
  const now = new Date();
  const diff = (dayNumber - now.getDay() + 7) % 7;
  const target = new Date(now);
  target.setDate(now.getDate() + diff);
  return target;
};

export default function PeriodizationScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const modalCardStyle = useModalCardStyle({ maxHeight: "100%" });
  const [activeTab, setActiveTab] = useState<PeriodizationTab>("geral");
  const [sectionOpen, setSectionOpen] = usePersistedState<Record<SectionKey, boolean>>(
    "periodization_sections_v1",
    {
      params: true,
      summary: true,
      load: true,
      guides: false,
      cycle: false,
      week: true,
    }
  );
  const [ageBand, setAgeBand] = useState<(typeof ageBands)[number]>("9-11");
  const [cycleLength, setCycleLength] = useState<(typeof cycleOptions)[number]>(4);
  const [sessionsPerWeek, setSessionsPerWeek] = useState<(typeof sessionsOptions)[number]>(2);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [selectedUnit, setSelectedUnit] = useState("Todas");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [showUnitPicker, setShowUnitPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showMesoPicker, setShowMesoPicker] = useState(false);
  const [showMicroPicker, setShowMicroPicker] = useState(false);
  const [classPickerTop, setClassPickerTop] = useState(0);
  const [unitPickerTop, setUnitPickerTop] = useState(0);
  const [mesoPickerTop, setMesoPickerTop] = useState(0);
  const [microPickerTop, setMicroPickerTop] = useState(0);
  const classTriggerRef = useRef<View>(null);
  const unitTriggerRef = useRef<View>(null);
  const [classTriggerLayout, setClassTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [unitTriggerLayout, setUnitTriggerLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const toggleSection = (key: SectionKey) => {
    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const { animatedStyle: paramsAnimStyle, isVisible: showParamsContent } =
    useCollapsibleAnimation(sectionOpen.params);
  const { animatedStyle: summaryAnimStyle, isVisible: showSummaryContent } =
    useCollapsibleAnimation(sectionOpen.summary);
  const { animatedStyle: loadAnimStyle, isVisible: showLoadContent } =
    useCollapsibleAnimation(sectionOpen.load);
  const { animatedStyle: guideAnimStyle, isVisible: showGuideContent } =
    useCollapsibleAnimation(sectionOpen.guides);
  const { animatedStyle: cycleAnimStyle, isVisible: showCycleContent } =
    useCollapsibleAnimation(sectionOpen.cycle);
  const { animatedStyle: weekAnimStyle, isVisible: showWeekContent } =
    useCollapsibleAnimation(sectionOpen.week);
  const { animatedStyle: unitPickerAnimStyle, isVisible: showUnitPickerContent } =
    useCollapsibleAnimation(showUnitPicker);
  const { animatedStyle: classPickerAnimStyle, isVisible: showClassPickerContent } =
    useCollapsibleAnimation(showClassPicker);
  const { animatedStyle: mesoPickerAnimStyle, isVisible: showMesoPickerContent } =
    useCollapsibleAnimation(showMesoPicker);
  const { animatedStyle: microPickerAnimStyle, isVisible: showMicroPickerContent } =
    useCollapsibleAnimation(showMicroPicker);

  useEffect(() => {
    if (!showClassPicker) return;
    requestAnimationFrame(() => {
      classTriggerRef.current?.measureInWindow((x, y, width, height) => {
        setClassTriggerLayout({ x, y, width, height });
      });
    });
  }, [showClassPicker]);

  useEffect(() => {
    if (!showUnitPicker) return;
    requestAnimationFrame(() => {
      unitTriggerRef.current?.measureInWindow((x, y, width, height) => {
        setUnitTriggerLayout({ x, y, width, height });
      });
    });
  }, [showUnitPicker]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const data = await getClasses();
      if (!alive) return;
      setClasses(data);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const unitOptions = useMemo(() => {
    const set = new Set<string>();
    classes.forEach((item) => {
      if (item.unit) set.add(item.unit);
    });
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [classes]);

  const filteredClasses = useMemo(() => {
    if (selectedUnit === "Todas") return classes;
    return classes.filter((item) => item.unit === selectedUnit);
  }, [classes, selectedUnit]);

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  useEffect(() => {
    if (!filteredClasses.length) {
      setSelectedClassId("");
      return;
    }
    if (selectedClassId && filteredClasses.some((item) => item.id === selectedClassId)) {
      return;
    }
    setSelectedClassId(filteredClasses[0].id);
  }, [filteredClasses, selectedClassId]);

  useEffect(() => {
    if (!selectedClass) return;
    const next = selectedClass.ageBand as (typeof ageBands)[number] | undefined;
    if (next && ageBands.includes(next)) {
      setAgeBand(next);
    }
  }, [selectedClass]);

  const weekPlans = useMemo(() => {
    const base = basePlans[ageBand] ?? basePlans["9-11"];
    const weeks: WeekPlan[] = [];
    for (let i = 0; i < cycleLength; i += 1) {
      const template = base[i % base.length];
      weeks.push({
        ...template,
        week: i + 1,
        title: i % base.length === base.length - 1 ? "Recuperacao" : template.title,
      });
    }
    return weeks;
  }, [ageBand, cycleLength]);

  const summary = useMemo(() => {
    if (ageBand === "6-8") {
      return [
        "Foco em alfabetizacao motora e jogo",
        "Sessoes curtas e ludicas",
        "Sem cargas externas",
      ];
    }
    if (ageBand === "9-11") {
      return [
        "Fundamentos + tomada de decisao",
        "Controle de volume e saltos",
        "Aquecimento preventivo simples",
      ];
    }
    return [
      "Tecnica eficiente + sistema de jogo",
      "Forca moderada e pliometria controlada",
      "Monitorar RPE e recuperacao",
    ];
  }, [ageBand]);

  const progressBars = weekPlans.map((week) => volumeToRatio[week.volume]);
  const currentWeek = 2;
  const activeWeek = weekPlans[Math.max(0, Math.min(currentWeek - 1, weekPlans.length - 1))];

  const highLoadStreak = useMemo(() => {
    let streak = 0;
    for (let i = 0; i < weekPlans.length; i += 1) {
      if (weekPlans[i].volume === "alto") {
        streak += 1;
      } else {
        streak = 0;
      }
      if (streak >= 2) return true;
    }
    return false;
  }, [weekPlans]);

  const warningMessage = useMemo(() => {
    if (highLoadStreak) {
      return "Duas semanas seguidas em carga alta. Considere uma semana de recuperacao.";
    }
    if (activeWeek.volume === "alto") {
      return "Semana atual com carga alta. Monitore recuperacao e RPE.";
    }
    return "";
  }, [highLoadStreak, activeWeek.volume]);

  const getWeekSchedule = (week: WeekPlan, sessions: number) => {
    const base = week.focus.split(",")[0] || week.title;
    const classDays = selectedClass?.daysOfWeek ?? [];
    const template: Record<number, number[]> = {
      2: [0, 2],
      3: [0, 2, 4],
      4: [0, 1, 3, 5],
      5: [0, 1, 2, 4, 5],
      6: [0, 1, 2, 3, 4, 5],
      7: [0, 1, 2, 3, 4, 5, 6],
    };
    const orderedClassDays = dayLabels
      .map((_, idx) => idx)
      .filter((idx) => classDays.includes(dayNumbersByLabelIndex[idx]));
    const targetCount = Math.min(sessions, 7);
    const dayIndexes = orderedClassDays.length
      ? orderedClassDays.slice(0, Math.min(targetCount, orderedClassDays.length))
      : template[targetCount] ?? template[2];
    return dayLabels.map((label, idx) => ({
      label,
      dayNumber: dayNumbersByLabelIndex[idx],
      session: dayIndexes.includes(idx) ? base : "",
    }));
  };
  const weekSchedule = getWeekSchedule(activeWeek, sessionsPerWeek);

  const selectedDay = selectedDayIndex !== null ? weekSchedule[selectedDayIndex] : null;
  const selectedDayDate = selectedDay ? nextDateForDayNumber(selectedDay.dayNumber) : null;

  const volumeCounts = useMemo(() => {
    return weekPlans.reduce(
      (acc, week) => {
        acc[week.volume] += 1;
        return acc;
      },
      { baixo: 0, medio: 0, alto: 0 } as Record<VolumeLevel, number>
    );
  }, [weekPlans]);

  const nextSessionDate = useMemo(() => {
    const classDays = selectedClass?.daysOfWeek ?? [];
    if (!classDays.length) return null;
    const dates = classDays.map((day) => nextDateForDayNumber(day));
    dates.sort((a, b) => a.getTime() - b.getTime());
    return dates[0] ?? null;
  }, [selectedClass]);

  const formatShortDate = (value: Date | null) =>
    value
      ? value.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "--";

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={() => {
            if (!showUnitPicker && !showClassPicker) return;
            setShowUnitPicker(false);
            setShowClassPicker(false);
          }}
          pointerEvents={showUnitPicker || showClassPicker ? "auto" : "none"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 0,
          }}
        />
        <ScrollView
          contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
          style={{ zIndex: 1 }}
          onScroll={() => {
            if (showUnitPicker || showClassPicker) {
              setShowUnitPicker(false);
              setShowClassPicker(false);
            }
          }}
          scrollEventThrottle={16}
        >
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
            Periodizacao
          </Text>
          <Text style={{ color: colors.muted }}>
            Estrutura do ciclo, cargas e foco semanal.
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            backgroundColor: colors.secondaryBg,
            padding: 6,
            borderRadius: 999,
          }}
        >
          {[
            { id: "geral", label: "Visao geral" },
            { id: "ciclo", label: "Ciclo" },
            { id: "semana", label: "Semana" },
          ].map((tab) => {
            const selected = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id as PeriodizationTab)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: selected ? colors.primaryBg : "transparent",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: selected ? colors.primaryText : colors.text,
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

        {activeTab === "geral" ? (
        <>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Parametros do ciclo
          </Text>
          <View style={getSectionCardStyle(colors, "info")}>
            <Pressable
              onPress={() => toggleSection("params")}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Parametros
            </Text>
            <Ionicons
              name={sectionOpen.params ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Defina faixa etaria, duracao e dias do microciclo
          </Text>
          {showParamsContent ? (
            <Animated.View style={[{ gap: 8 }, paramsAnimStyle]}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Faixa etaria</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {ageBands.map((band) => {
                  const active = band === ageBand;
                  return (
                    <Pressable
                      key={band}
                      onPress={() => setAgeBand(band)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text
                        style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}
                      >
                        {band}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: colors.muted, fontSize: 12 }}>Mesociclo (semanas)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {cycleOptions.map((value) => {
                  const active = value === cycleLength;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setCycleLength(value)}
                      style={{
                        paddingVertical: 6,
                        paddingHorizontal: 10,
                        borderRadius: 999,
                        backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                      }}
                    >
                      <Text
                        style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}
                      >
                        {value}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={{ color: colors.muted, fontSize: 12 }}>Microciclo (dias)</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {sessionsOptions.map((value) => {
                const active = value === sessionsPerWeek;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setSessionsPerWeek(value)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12 }}>
                      {value}
                    </Text>
                  </Pressable>
                );
              })}
              </View>
            </Animated.View>
          ) : null}
          </View>
        </View>

        <View style={getSectionCardStyle(colors, "primary")}>
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
            Visao geral
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Panorama rapido do ciclo e da turma atual
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 8 }}>
            Turma
          </Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              marginTop: 6,
              overflow: "visible",
            }}
          >
            <View
              style={[
                getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),
                {
                  flexBasis: "48%",
                  zIndex: showClassPicker ? 30 : 1,
                  position: "relative",
                  overflow: "visible",
                },
              ]}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
              <View ref={classTriggerRef} style={{ position: "relative" }}>
                <Pressable
                  onPress={() => {
                    setShowClassPicker((prev) => !prev);
                    setShowUnitPicker(false);
                  }}
                  onLayout={(event) => {
                    setClassPickerTop(event.nativeEvent.layout.height);
                  }}
                  style={{
                    marginTop: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                      {selectedClass?.name ?? "Selecione"}
                    </Text>
                    <Animated.View
                      style={{
                        transform: [{ rotate: showClassPicker ? "180deg" : "0deg" }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.muted} />
                    </Animated.View>
                  </View>
                </Pressable>
              </View>
            </View>
            <View
              style={[
                getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),
                {
                  flexBasis: "48%",
                  zIndex: showUnitPicker ? 30 : 1,
                  position: "relative",
                  overflow: "visible",
                },
              ]}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>Unidade</Text>
              <View ref={unitTriggerRef} style={{ position: "relative" }}>
                <Pressable
                  onPress={() => {
                    setShowUnitPicker((prev) => !prev);
                    setShowClassPicker(false);
                  }}
                  onLayout={(event) => {
                    setUnitPickerTop(event.nativeEvent.layout.height);
                  }}
                  style={{
                    marginTop: 6,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: colors.inputBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                      {selectedUnit === "Todas"
                        ? "Todas"
                        : selectedClass?.unit ?? selectedUnit}
                    </Text>
                    <Animated.View
                      style={{
                        transform: [{ rotate: showUnitPicker ? "180deg" : "0deg" }],
                      }}
                    >
                      <Ionicons name="chevron-down" size={16} color={colors.muted} />
                    </Animated.View>
                  </View>
                </Pressable>

              </View>
            </View>
          </View>
          <View
            style={[
              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),
              { marginTop: 12, zIndex: 0, position: "relative" },
            ]}
          >
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
              Proxima sessao
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: 6,
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                {formatShortDate(nextSessionDate)}
              </Text>
              <View
                style={{
                  width: 1,
                  height: 18,
                  marginHorizontal: 10,
                  backgroundColor: colors.border,
                }}
              />
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {selectedClass?.startTime
                  ? "Horario " + selectedClass.startTime
                  : "Horario indefinido"}
              </Text>
            </View>
          </View>
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Distribuicao de carga</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
              {volumeOrder.map((level) => {
                const palette = getVolumePalette(level, colors);
                const count = volumeCounts[level];
                const height = 20 + count * 10;
                return (
                  <View key={level} style={{ alignItems: "center", gap: 4 }}>
                    <View
                      style={{
                        width: 28,
                        height,
                        borderRadius: 10,
                        backgroundColor: palette.bg,
                        opacity: 0.9,
                      }}
                    />
                    <Text style={{ color: colors.muted, fontSize: 11 }} title={pseTitle}>
                      {level} ({count})
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          <View style={{ marginTop: 8, gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Tendencia de carga</Text>
            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
              {progressBars.map((ratio, index) => {
                const level = weekPlans[index]?.volume ?? "medio";
                const palette = getVolumePalette(level, colors);
                const size = 28;
                return (
                  <View
                    key={`trend-${index}`}
                    style={{
                      width: size,
                      height: size,
                      borderRadius: 8,
                      backgroundColor: palette.bg,
                      opacity: ratio,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 11, fontWeight: "700" }}>
                      {index + 1}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
          {warningMessage ? (
            <View
              style={[
                getSectionCardStyle(colors, "warning", { padding: 12, radius: 14, shadow: true }),
                {
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: colors.warningBg,
                },
              ]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.warningText,
                  }}
                >
                  <Ionicons name="alert-circle" size={14} color={colors.warningBg} />
                </View>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                  Alerta de carga
                </Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 12, marginTop: 6 }}>
                {warningMessage}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Resumo do ciclo
          </Text>
          <View style={getSectionCardStyle(colors, "neutral")}>
            <Pressable
              onPress={() => toggleSection("summary")}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Resumo do ciclo
            </Text>
            <Ionicons
              name={sectionOpen.summary ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Ajuste rapido do ciclo atual
          </Text>
          {showSummaryContent ? (
            <Animated.View style={[{ gap: 12 }, summaryAnimStyle]}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                <View
                  style={[
                    getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 }),
                    { flexBasis: "48%" },
                  ]}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Mesociclo</Text>
                  <View style={{ position: "relative" }}>
                    <Pressable
                      onPress={() => {
                        setShowMesoPicker((prev) => !prev);
                        setShowMicroPicker(false);
                      }}
                      onLayout={(event) => {
                        setMesoPickerTop(event.nativeEvent.layout.height);
                      }}
                      style={{
                        marginTop: 6,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                          {cycleLength} semanas
                        </Text>
                        <Animated.View
                          style={{
                            transform: [{ rotate: showMesoPicker ? "180deg" : "0deg" }],
                          }}
                        >
                          <Ionicons name="chevron-down" size={16} color={colors.muted} />
                        </Animated.View>
                      </View>
                    </Pressable>
                    {showMesoPickerContent ? (
                      <Animated.View
                        style={[
                          {
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: mesoPickerTop + 8,
                            zIndex: 20,
                          },
                          mesoPickerAnimStyle,
                        ]}
                      >
                        <View
                          style={{
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.inputBg,
                            padding: 6,
                          }}
                        >
                          {cycleOptions.map((value, index) => {
                            const active = value === cycleLength;
                            return (
                              <Pressable
                                key={value}
                                onPress={() => {
                                  setCycleLength(value);
                                  setShowMesoPicker(false);
                                }}
                                style={{
                                  paddingVertical: 8,
                                  paddingHorizontal: 10,
                                  borderRadius: 10,
                                  margin: index === 0 ? 4 : 2,
                                  backgroundColor: active ? colors.primaryBg : "transparent",
                                }}
                              >
                                <Text
                                  style={{
                                    color: active ? colors.primaryText : colors.text,
                                    fontSize: 12,
                                    fontWeight: active ? "700" : "500",
                                  }}
                                >
                                  {value} semanas
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </Animated.View>
                    ) : null}
                  </View>
                </View>
                <View
                  style={[
                    getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 }),
                    { flexBasis: "48%" },
                  ]}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>Microciclo</Text>
                  <View style={{ position: "relative" }}>
                    <Pressable
                      onPress={() => {
                        setShowMicroPicker((prev) => !prev);
                        setShowMesoPicker(false);
                      }}
                      onLayout={(event) => {
                        setMicroPickerTop(event.nativeEvent.layout.height);
                      }}
                      style={{
                        marginTop: 6,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>
                          {sessionsPerWeek} dias
                        </Text>
                        <Animated.View
                          style={{
                            transform: [{ rotate: showMicroPicker ? "180deg" : "0deg" }],
                          }}
                        >
                          <Ionicons name="chevron-down" size={16} color={colors.muted} />
                        </Animated.View>
                      </View>
                    </Pressable>
                    {showMicroPickerContent ? (
                      <Animated.View
                        style={[
                          {
                            position: "absolute",
                            left: 0,
                            right: 0,
                            top: microPickerTop + 8,
                            zIndex: 20,
                          },
                          microPickerAnimStyle,
                        ]}
                      >
                        <ScrollView
                          style={{ maxHeight: 180 }}
                          contentContainerStyle={{ padding: 6, gap: 2 }}
                          showsVerticalScrollIndicator
                        >
                          <View
                            style={{
                              borderRadius: 12,
                              borderWidth: 1,
                              borderColor: colors.border,
                              backgroundColor: colors.inputBg,
                            }}
                          >
                            {sessionsOptions.map((value, index) => {
                              const active = value === sessionsPerWeek;
                              return (
                                <Pressable
                                  key={value}
                                  onPress={() => {
                                    setSessionsPerWeek(value);
                                    setShowMicroPicker(false);
                                  }}
                                  style={{
                                    paddingVertical: 8,
                                    paddingHorizontal: 10,
                                    borderRadius: 10,
                                    margin: index === 0 ? 6 : 2,
                                    backgroundColor: active ? colors.primaryBg : "transparent",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: active ? colors.primaryText : colors.text,
                                      fontSize: 12,
                                      fontWeight: active ? "700" : "500",
                                    }}
                                  >
                                    {value} dias
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </Animated.View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Animated.View>
          ) : null}
          </View>
        </View>
        </>
        ) : null}

        {activeTab === "ciclo" ? (
          <>
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Carga semanal
          </Text>
          <View style={getSectionCardStyle(colors, "primary")}>
          <Pressable
            onPress={() => toggleSection("load")}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Carga semanal
            </Text>
            <Ionicons
              name={sectionOpen.load ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Distribuicao de intensidade ao longo do ciclo
          </Text>
          {showLoadContent ? (
            <Animated.View style={[{ gap: 12 }, loadAnimStyle]}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
            {progressBars.map((ratio, index) => {
              const level = weekPlans[index]?.volume ?? "medio";
              const isActive = index + 1 === currentWeek;
              const palette = getVolumePalette(level, colors);
              return (
                <View key={String(index)} style={{ alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 22,
                      height: 120 * ratio + 16,
                      borderRadius: 10,
                      backgroundColor: palette.bg,
                      opacity: isActive ? 1 : 0.55,
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    S{index + 1}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {volumeOrder.map((level) => {
              const palette = getVolumePalette(level, colors);
              return (
                <View
                  key={level}
                  style={{
                    paddingVertical: 3,
                    paddingHorizontal: 8,
                    borderRadius: 999,
                    backgroundColor: palette.bg,
                  }}
                >
                  <Text style={{ color: palette.text, fontSize: 11 }} title={pseTitle}>
                    {level + " - " + volumeToRpe[level]}
                  </Text>
                </View>
                );
              })}
          </View>
            </Animated.View>
          ) : null}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Diretrizes
          </Text>
          <View style={getSectionCardStyle(colors, "neutral")}>
          <Pressable
            onPress={() => toggleSection("guides")}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Diretrizes da faixa
            </Text>
            <Ionicons
              name={sectionOpen.guides ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Principios recomendados para esta faixa
          </Text>
          {showGuideContent ? (
            <Animated.View style={[{ gap: 6 }, guideAnimStyle]}>
              {summary.map((item) => (
                <Text key={item} style={{ color: colors.muted, fontSize: 12 }}>
                  {"- " + item}
                </Text>
              ))}
            </Animated.View>
          ) : null}
          </View>
        </View>

        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Agenda do ciclo
          </Text>
          <View style={getSectionCardStyle(colors, "primary")}>
          <Pressable
            onPress={() => toggleSection("cycle")}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              Agenda do ciclo
            </Text>
            <Ionicons
              name={sectionOpen.cycle ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Semanas com foco e volume definido
          </Text>
          {showCycleContent ? (
            <Animated.View style={[{ gap: 10 }, cycleAnimStyle]}>
            {weekPlans.map((week) => (
              <View
                key={week.week}
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
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {"Semana " + week.week + " - " + week.title}
                  </Text>
                  {(() => {
                    const palette = getVolumePalette(week.volume, colors);
                    return (
                      <View
                        style={{
                          paddingVertical: 2,
                          paddingHorizontal: 8,
                          borderRadius: 999,
                          backgroundColor: palette.bg,
                        }}
                      >
                        <Text style={{ color: palette.text, fontSize: 11 }}>
                          {week.volume}
                        </Text>
                      </View>
                    );
                  })()}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {"Foco: " + week.focus}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11 }}>
                      {sessionsPerWeek + " dias"}
                    </Text>
                  </View>
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11 }} title={pseTitle}>
                      {volumeToRpe[week.volume]}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: 4 }}>
                  {week.notes.map((note) => (
                    <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>
                      {"- " + note}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
            </Animated.View>
          ) : null}
          </View>
        </View>
          </>
        ) : null}

        {activeTab === "semana" ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
            Agenda da semana
          </Text>
          <View style={getSectionCardStyle(colors, "info")}>
          <Pressable
            onPress={() => toggleSection("week")}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {"Agenda da semana " + activeWeek.week}
            </Text>
            <Ionicons
              name={sectionOpen.week ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </Pressable>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Dias com sessao e foco sugerido
          </Text>
          {showWeekContent ? (
            <Animated.View style={[{ gap: 10 }, weekAnimStyle]}>
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                  alignSelf: "flex-start",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11 }}>
                  {sessionsPerWeek + " dias"}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                {weekSchedule.map((item, index) => (
                  <Pressable
                    key={item.label}
                    onPress={() => {
                      setSelectedDayIndex(index);
                      setShowDayModal(true);
                    }}
                    style={{
                      width: "30%",
                      minWidth: 90,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: item.session ? colors.card : colors.inputBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      gap: 6,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {item.label}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                      {item.session || "Descanso"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : null}
          </View>
        </View>
        ) : null}
        </ScrollView>

        {showClassPickerContent && classTriggerLayout ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                left: classTriggerLayout.x,
                top: classTriggerLayout.y + classTriggerLayout.height + 8,
                width: classTriggerLayout.width,
                zIndex: 200,
                elevation: 10,
              },
              classPickerAnimStyle,
            ]}
          >
            <ScrollView
              style={{ maxHeight: 180 }}
              contentContainerStyle={{ padding: 6 }}
              showsVerticalScrollIndicator
            >
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                }}
              >
                {filteredClasses.length ? (
                  filteredClasses.map((cls, index) => {
                    const active = cls.id === selectedClassId;
                    return (
                      <Pressable
                        key={cls.id}
                        onPress={() => {
                          setSelectedClassId(cls.id);
                          if (cls.unit) setSelectedUnit(cls.unit);
                          setShowClassPicker(false);
                        }}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 10,
                          borderRadius: 10,
                          margin: index === 0 ? 6 : 2,
                          backgroundColor: active ? colors.primaryBg : "transparent",
                        }}
                      >
                        <Text
                          style={{
                            color: active ? colors.primaryText : colors.text,
                            fontSize: 12,
                            fontWeight: active ? "700" : "500",
                          }}
                        >
                          {cls.name}
                        </Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
                    Nenhuma turma cadastrada.
                  </Text>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        ) : null}

        {showUnitPickerContent && unitTriggerLayout ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                left: unitTriggerLayout.x,
                top: unitTriggerLayout.y + unitTriggerLayout.height + 8,
                width: unitTriggerLayout.width,
                zIndex: 200,
                elevation: 10,
              },
              unitPickerAnimStyle,
            ]}
          >
            <ScrollView
              style={{ maxHeight: 180 }}
              contentContainerStyle={{ padding: 6 }}
              showsVerticalScrollIndicator
            >
              <View
                style={{
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.inputBg,
                }}
              >
                {unitOptions.map((unit, index) => {
                  const active = unit === selectedUnit;
                  const palette =
                    unit === "Todas"
                      ? { bg: colors.primaryBg, text: colors.primaryText }
                      : getUnitPalette(unit, colors);
                  return (
                    <Pressable
                      key={unit}
                      onPress={() => {
                        setSelectedUnit(unit);
                        setShowUnitPicker(false);
                      }}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        borderRadius: 10,
                        margin: index === 0 ? 6 : 2,
                        backgroundColor: active ? palette.bg : "transparent",
                      }}
                    >
                      <Text
                        style={{
                          color: active ? palette.text : colors.text,
                          fontSize: 12,
                          fontWeight: active ? "700" : "500",
                        }}
                      >
                        {unit}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>

      <ModalSheet
        visible={showDayModal}
        onClose={() => setShowDayModal(false)}
        cardStyle={[modalCardStyle, { paddingBottom: 12 }]}
        position="center"
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
            {selectedDay ? "Sessao de " + selectedDay.label : "Sessao"}
          </Text>
          <Pressable
            onPress={() => setShowDayModal(false)}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.text }}>
              Fechar
            </Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          style={{ maxHeight: "92%" }}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <View style={getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16 })}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Turma</Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {selectedClass?.name ?? "Selecione uma turma"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {selectedClass?.unit ?? "Sem unidade"}
            </Text>
            {selectedDayDate ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {"Data sugerida: " + formatIsoDate(selectedDayDate)}
              </Text>
            ) : null}
          </View>

          <View style={getSectionCardStyle(colors, "info", { padding: 12, radius: 16 })}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {activeWeek.title}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {"Foco: " + activeWeek.focus}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {(() => {
                const palette = getVolumePalette(activeWeek.volume, colors);
                return (
                  <View
                    style={{
                      paddingVertical: 3,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: palette.bg,
                    }}
                  >
                    <Text style={{ color: palette.text, fontSize: 11 }}>
                      {"Volume: " + activeWeek.volume}
                    </Text>
                  </View>
                );
              })()}
              <View
                style={{
                  paddingVertical: 3,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  backgroundColor: colors.secondaryBg,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 11 }} title={pseTitle}>
                  {volumeToRpe[activeWeek.volume]}
                </Text>
              </View>
            </View>
            <View style={{ gap: 4, marginTop: 8 }}>
              {activeWeek.notes.map((note) => (
                <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>
                  {"- " + note}
                </Text>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => {
              if (!selectedClass || !selectedDayDate) return;
              router.push({
                pathname: "/training",
                params: {
                  targetClassId: selectedClass.id,
                  targetDate: formatIsoDate(selectedDayDate),
                  openForm: "1",
                },
              });
              setShowDayModal(false);
            }}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: selectedClass ? colors.primaryBg : colors.primaryDisabledBg,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: selectedClass ? colors.primaryText : colors.secondaryText,
                fontWeight: "700",
              }}
            >
              Criar plano de aula
            </Text>
          </Pressable>
        </ScrollView>
      </ModalSheet>
    </SafeAreaView>
  );
}
