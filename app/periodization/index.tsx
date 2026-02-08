import { Ionicons } from "@expo/vector-icons";

import { useLocalSearchParams, useRouter } from "expo-router";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Animated, ScrollView, Text, TextInput, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { Pressable } from "../../src/ui/Pressable";



import { normalizeAgeBand, parseAgeBandRange } from "../../src/core/age-band";

import type { ClassGroup, ClassPlan } from "../../src/core/models";

import { normalizeUnitKey } from "../../src/core/unit-key";

import {

    createClassPlan,

    deleteClassPlansByClass,

    getClasses,

    getClassPlansByClass,

    getSessionLogsByRange,

    saveClassPlans,

    updateClassAcwrLimits,

    updateClassPlan,

} from "../../src/db/seed";

import { logAction } from "../../src/observability/breadcrumbs";

import { measure } from "../../src/observability/perf";

import { exportPdf, safeFileName } from "../../src/pdf/export-pdf";

import { PeriodizationDocument } from "../../src/pdf/periodization-document";

import { periodizationHtml } from "../../src/pdf/templates/periodization";

import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";

import { type ThemeColors, useAppTheme } from "../../src/ui/app-theme";

import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { ClassContextHeader } from "../../src/ui/ClassContextHeader";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";

import { useGuidance } from "../../src/ui/guidance";

import { ModalSheet } from "../../src/ui/ModalSheet";

import { getSectionCardStyle } from "../../src/ui/section-styles";

import { getUnitPalette } from "../../src/ui/unit-colors";

import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";

import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import { usePersistedState } from "../../src/ui/use-persisted-state";



type VolumeLevel = "baixo" | "médio" | "alto";



type WeekPlan = {

  week: number;

  title: string;

  focus: string;

  volume: VolumeLevel;

  notes: string[];

  jumpTarget: string;

  PSETarget: string;

  source: "AUTO" | "MANUAL";

};



const ageBands = ["06-08", "09-11", "12-14"] as const;

const cycleOptions = [2, 3, 4, 5, 6, 8, 10, 12] as const;

const sessionsOptions = [

  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,

] as const;

const volumeOrder: VolumeLevel[] = ["baixo", "médio", "alto"];

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const dayNumbersByLabelIndex = [1, 2, 3, 4, 5, 6, 0];



const pseTitle = "Percepção Subjetiva de Esforço";



const volumeToPSE: Record<VolumeLevel, string> = {

  baixo: "PSE 4-5",

  "médio": "PSE 5-6",

  alto: "PSE 6-7",

};




const emptyWeek: WeekPlan = {

  week: 1,

  title: "Semana",

  focus: "Sem foco definido",

  volume: "baixo",

  notes: [],

  jumpTarget: "-",

  PSETarget: "PSE 4-5",

  source: "AUTO",

};

const volumeToRatio: Record<VolumeLevel, number> = {

  baixo: 0.35,

  "médio": 0.65,

  alto: 0.9,

};



type SectionKey =

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

  if (level === "médio") {

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

  "06-08": [

    {

      week: 1,

      title: "Base lúdica",

      focus: "Coordenação, brincadeiras e jogos simples",

      volume: "baixo",

      notes: ["Bola leve, rede baixa", "1x1 e 2x2"],

    },

    {

      week: 2,

      title: "Fundamentos",

      focus: "Toque, manchete e controle básico",

      volume: "médio",

      notes: ["Series curtas", "Feedback simples"],

    },

    {

      week: 3,

      title: "Jogo reduzido",

      focus: "Cooperação e tomada de decisão",

      volume: "médio",

      notes: ["Jogos 2x2/3x3", "Regras simples"],

    },

    {

      week: 4,

      title: "Recuperação",

      focus: "Revisão e prazer pelo jogo",

      volume: "baixo",

      notes: ["Menos repetições", "Mais variação"],

    },

  ],

  "09-11": [

    {

      week: 1,

      title: "Base técnica",

      focus: "Fundamentos e controle de bola",

      volume: "médio",

      notes: ["2-3 sessões/semana", "Equilíbrio e core"],

    },

    {

      week: 2,

      title: "Tomada de decisão",

      focus: "Leitura simples de jogo e cooperação",

      volume: "médio",

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

      title: "Recuperação",

      focus: "Técnica leve e prevenção",

      volume: "baixo",

      notes: ["Volleyveilig simples", "Mobilidade"],

    },

  ],

  "12-14": [

    {

      week: 1,

      title: "Base técnica",

      focus: "Refino de fundamentos e posição",

      volume: "médio",

      notes: ["Sessões 60-90 min", "Ritmo controlado"],

    },

    {

      week: 2,

      title: "Potência controlada",

      focus: "Salto, deslocamento e reação",

      volume: "alto",

      notes: ["Pliometria leve", "Força 50-70% 1RM"],

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

      title: "Recuperação",

      focus: "Prevenção e consolidação técnica",

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



const parseIsoDate = (value: string | null) => {

  if (!value) return null;

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;

};



const decodeUnicodeEscapes = (value: string) => {
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    const next = current
      .replace(/\\\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      )
      .replace(/\\U([0-9a-fA-F]{8})/g, (_, code) =>
        String.fromCharCode(parseInt(code, 16))
      );
    if (next === current) break;
    current = next;
  }
  return current;
};

const tryJsonDecode = (value: string) => {
  try {
    const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return JSON.parse(`"${escaped}"`) as string;
  } catch {
    return value;
  }
};

const normalizeText = (value: string) => {
  if (!value) return value;
  let current = String(value);
  for (let i = 0; i < 2; i += 1) {
    current = current.replace(/\\\\u/gi, "\\u").replace(/\\\\U/gi, "\\U");
  }
  for (let i = 0; i < 3; i += 1) {
    const decoded = decodeUnicodeEscapes(tryJsonDecode(current));
    if (decoded === current) break;
    current = decoded;
  }
  if (/\\u[0-9a-fA-F]{4}/.test(current) || /\\U[0-9a-fA-F]{8}/.test(current)) {
    current = decodeUnicodeEscapes(current);
  }
  if (!/[ÃÂ�]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[ÃÂ�]/.test(current)) break;
  }
  return current;
};

const resolvePlanBand = (value: string): (typeof ageBands)[number] => {

  const range = parseAgeBandRange(value);

  if (!Number.isFinite(range.end)) return "09-11";

  if (range.end <= 8) return "06-08";

  if (range.end <= 11) return "09-11";

  return "12-14";

};



const getPhysicalFocus = (band: (typeof ageBands)[number]) => {

  if (band === "06-08") return "Coordenação e equilíbrio";

  if (band === "09-11") return "Força leve e agilidade";

  return "Potência controlada";

};



const getMvFormat = (band: (typeof ageBands)[number]) => {

  if (band === "06-08") return "1x1/2x2";

  if (band === "09-11") return "2x2/3x3";

  return "4x4/6x6";

};



const getMvLevel = (mvLevel: string, band: (typeof ageBands)[number]) => {

  if (mvLevel && mvLevel.trim()) return mvLevel;

  if (band === "06-08") return "MV1";

  if (band === "09-11") return "MV2";

  return "MV3";

};



const getJumpTarget = (mvLevel: string, band: (typeof ageBands)[number]) => {

  const level = getMvLevel(mvLevel, band);

  if (level === "MV1") return "10-20";

  if (level === "MV2") return "20-40";

  return "30-60";

};



const getPhaseForWeek = (weekNumber: number, cycleLength: number) => {

  if (cycleLength >= 9) {

    if (weekNumber <= 4) return "Base";

    if (weekNumber <= 8) return "Desenvolvimento";

    return "Consolidação";

  }

  const chunk = Math.max(1, Math.ceil(cycleLength / 3));

  if (weekNumber <= chunk) return "Base";

  if (weekNumber <= chunk * 2) return "Desenvolvimento";

  return "Consolidação";

};



const getPSETarget = (phase: string) => {

  if (phase === "Base") return "4-5";

  if (phase === "Desenvolvimento") return "5-6";

  return "6-7";

};



const validateAcwrLimits = (next: { high: string; low: string }) => {

  const highValue = Number(next.high);

  const lowValue = Number(next.low);

  if (!Number.isFinite(highValue) || !Number.isFinite(lowValue)) {

    return { ok: false, message: "Informe limites válidos para o ACWR." };

  }

  if (highValue <= 0 || lowValue <= 0) {

    return { ok: false, message: "Limites do ACWR devem ser maiores que zero." };

  }

  if (lowValue >= highValue) {

    return { ok: false, message: "O limite baixo deve ser menor que o limite alto." };

  }

  return { ok: true, message: "", highValue, lowValue };

};



const buildClassPlan = (options: {

  classId: string;

  ageBand: (typeof ageBands)[number];

  startDate: string;

  weekNumber: number;

  source: "AUTO" | "MANUAL";

  mvLevel: string;

  cycleLength: number;

}): ClassPlan => {

  const base = basePlans[options.ageBand] ?? basePlans["09-11"];

  const template = base[(options.weekNumber - 1) % base.length];

  const phase = getPhaseForWeek(

    options.weekNumber,

    options.cycleLength ?? 12

  );

  const createdAt = new Date().toISOString();

  return {

    id: `cp_${options.classId}_${Date.now()}_${options.weekNumber}`,

    classId: options.classId,

    startDate: options.startDate,

    weekNumber: options.weekNumber,

    phase,

    theme: template.focus,

    technicalFocus: template.focus,

    physicalFocus: getPhysicalFocus(options.ageBand),

    constraints: template.notes[0] ?? "",

    mvFormat: getMvFormat(options.ageBand),

    warmupProfile: template.notes[1] ?? "",

    jumpTarget: getJumpTarget(options.mvLevel, options.ageBand),

    rpeTarget: getPSETarget(phase),

    source: options.source,

    createdAt,

    updatedAt: createdAt,

  };

};



const toClassPlans = (options: {

  classId: string;

  ageBand: (typeof ageBands)[number];

  cycleLength: number;

  startDate: string;

  mvLevel: string;

}): ClassPlan[] => {

  return Array.from({ length: options.cycleLength }).map((_, index) =>

    buildClassPlan({

      classId: options.classId,

      ageBand: options.ageBand,

      startDate: options.startDate,

      weekNumber: index + 1,

      source: "AUTO",

      mvLevel: options.mvLevel,

      cycleLength: options.cycleLength,

    })

  );

};



export default function PeriodizationScreen() {

  const router = useRouter();
  const { classId: initialClassId, unit: initialUnit } = useLocalSearchParams<{
    classId: string;
    unit: string;
  }>();
  const hasInitialClass =
    typeof initialClassId === "string" && initialClassId.trim().length > 0;
  const { colors } = useAppTheme();
  const { setGuidance } = useGuidance();

  const { confirm: confirmDialog } = useConfirmDialog();

  const modalCardStyle = useModalCardStyle({ maxHeight: "100%" });

  const [activeTab, setActiveTab] = useState<PeriodizationTab>("geral");

  const [sectionOpen, setSectionOpen] = usePersistedState<Record<SectionKey, boolean>>(

    "periodization_sections_v1",

    {

      load: true,

      guides: false,

      cycle: false,

      week: true,

    }

  );

  const [ageBand, setAgeBand] = useState<(typeof ageBands)[number]>("09-11");

  const [cycleLength, setCycleLength] = useState<(typeof cycleOptions)[number]>(12);

  const [sessionsPerWeek, setSessionsPerWeek] = useState<(typeof sessionsOptions)[number]>(2);

  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [selectedUnit, setSelectedUnit] = useState("");

  const [selectedClassId, setSelectedClassId] = useState("");

  const [allowEmptyClass, setAllowEmptyClass] = useState(false);

  const [didApplyParams, setDidApplyParams] = useState(false);

  const [unitMismatchWarning, setUnitMismatchWarning] = useState("");

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const [showDayModal, setShowDayModal] = useState(false);

  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);

  const [isSavingPlans, setIsSavingPlans] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const [showWeekEditor, setShowWeekEditor] = useState(false);

  const [editingWeek, setEditingWeek] = useState(1);

  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);

  const [editPhase, setEditPhase] = useState("");

  const [editTheme, setEditTheme] = useState("");

  const [editTechnicalFocus, setEditTechnicalFocus] = useState("");

  const [editPhysicalFocus, setEditPhysicalFocus] = useState("");

  const [editConstraints, setEditConstraints] = useState("");

  const [editMvFormat, setEditMvFormat] = useState("");

  const [editWarmupProfile, setEditWarmupProfile] = useState("");

  const [editJumpTarget, setEditJumpTarget] = useState("");

  const [editPSETarget, setEditPSETarget] = useState("");

  const [editSource, setEditSource] = useState<"AUTO" | "MANUAL">("AUTO");

  const [applyWeeks, setApplyWeeks] = useState<number[]>([]);

  const [cycleFilter, setCycleFilter] = useState<"all" | "manual" | "auto">("all");

  const [isSavingWeek, setIsSavingWeek] = useState(false);

  const [acwrRatio, setAcwrRatio] = useState<number | null>(null);

  const [acwrMessage, setAcwrMessage] = useState("");

  const [acwrLimitError, setAcwrLimitError] = useState("");

  const [painAlert, setPainAlert] = useState("");

  const [painAlertDates, setPainAlertDates] = useState<string[]>([]);

  const [acwrLimits, setAcwrLimits] = useState({ high: "1.3", low: "0.8" });

  const acwrSavedRef = useRef({ high: "1.3", low: "0.8" });

  const [showUnitPicker, setShowUnitPicker] = useState(false);

  const [showClassPicker, setShowClassPicker] = useState(false);

  const [showMesoPicker, setShowMesoPicker] = useState(false);

  const [showMicroPicker, setShowMicroPicker] = useState(false);

  const isPickerOpen =

    showUnitPicker || showClassPicker || showMesoPicker || showMicroPicker;

  const [classPickerTop, setClassPickerTop] = useState(0);

  const [unitPickerTop, setUnitPickerTop] = useState(0);

  const containerRef = useRef<View>(null);

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

  const [containerWindow, setContainerWindow] = useState<{ x: number; y: number } | null>(null);

  const mesoTriggerRef = useRef<View>(null);

  const microTriggerRef = useRef<View>(null);

  const [mesoTriggerLayout, setMesoTriggerLayout] = useState<{

    x: number;

    y: number;

    width: number;

    height: number;

  } | null>(null);

  const [microTriggerLayout, setMicroTriggerLayout] = useState<{

    x: number;

    y: number;

    width: number;

    height: number;

  } | null>(null);



  const toggleSection = useCallback((key: SectionKey) => {

    setSectionOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  }, [setSectionOpen]);



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



  const syncPickerLayouts = useCallback(() => {

    if (!isPickerOpen) return;

    requestAnimationFrame(() => {

      if (showClassPicker) {

        classTriggerRef.current.measureInWindow((x, y, width, height) => {

          setClassTriggerLayout({ x, y, width, height });

        });

      }

      if (showUnitPicker) {

        unitTriggerRef.current.measureInWindow((x, y, width, height) => {

          setUnitTriggerLayout({ x, y, width, height });

        });

      }

      if (showMesoPicker) {

        mesoTriggerRef.current.measureInWindow((x, y, width, height) => {

          setMesoTriggerLayout({ x, y, width, height });

        });

      }

      if (showMicroPicker) {

        microTriggerRef.current.measureInWindow((x, y, width, height) => {

          setMicroTriggerLayout({ x, y, width, height });

        });

      }

      containerRef.current.measureInWindow((x, y) => {

        setContainerWindow({ x, y });

      });

    });

  }, [

    isPickerOpen,

    showClassPicker,

    showUnitPicker,

    showMesoPicker,

    showMicroPicker,

  ]);



  const closeAllPickers = useCallback(() => {

    setShowUnitPicker(false);

    setShowClassPicker(false);

    setShowMesoPicker(false);

    setShowMicroPicker(false);

  }, []);



  const togglePicker = useCallback(

    (target: "unit" | "class" | "meso" | "micro") => {

      setShowUnitPicker((prev) => (target === "unit" ? !prev : false));

      setShowClassPicker((prev) => (target === "class" ? !prev : false));

      setShowMesoPicker((prev) => (target === "meso" ? !prev : false));

      setShowMicroPicker((prev) => (target === "micro" ? !prev : false));

    },

    []

  );



  useEffect(() => {

    if (!showClassPicker) return;

    requestAnimationFrame(() => {

      classTriggerRef.current.measureInWindow((x, y, width, height) => {

        setClassTriggerLayout({ x, y, width, height });

      });

    });

  }, [showClassPicker]);



  useEffect(() => {

    if (!showUnitPicker) return;

    requestAnimationFrame(() => {

      unitTriggerRef.current.measureInWindow((x, y, width, height) => {

        setUnitTriggerLayout({ x, y, width, height });

      });

    });

  }, [showUnitPicker]);



  useEffect(() => {

    if (!showMesoPicker) return;

    requestAnimationFrame(() => {

      mesoTriggerRef.current.measureInWindow((x, y, width, height) => {

        setMesoTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMesoPicker]);



  useEffect(() => {

    if (!showMicroPicker) return;

    requestAnimationFrame(() => {

      microTriggerRef.current.measureInWindow((x, y, width, height) => {

        setMicroTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMicroPicker]);



  useEffect(() => {

    if (!showUnitPicker && !showClassPicker && !showMesoPicker && !showMicroPicker) return;

    requestAnimationFrame(() => {

      containerRef.current.measureInWindow((x, y) => {

        setContainerWindow({ x, y });

      });

    });

  }, [showUnitPicker, showClassPicker, showMesoPicker, showMicroPicker]);



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



  useEffect(() => {

    if (didApplyParams) return;

    if (!classes.length) return;

    const classParam = typeof initialClassId === "string" ? initialClassId : "";

    const unitParam = typeof initialUnit === "string" ? initialUnit : "";

    if (classParam) {

      const match = classes.find((item) => item.id === classParam);

      if (match) {

        if (match.unit) setSelectedUnit(match.unit);

        setSelectedClassId(match.id);

        setAllowEmptyClass(false);

        setDidApplyParams(true);

        return;

      }

    }

    if (unitParam) {

      setSelectedUnit(unitParam);

    }

    setDidApplyParams(true);

  }, [classes, didApplyParams, initialClassId, initialUnit]);



  const unitOptions = useMemo(() => {

    const map = new Map<string, string>();

    classes.forEach((item) => {

      const label = (item.unit ?? "").trim() || "Sem unidade";

      const key = normalizeUnitKey(label);

      if (!map.has(key)) map.set(key, label);

    });

    return ["", ...Array.from(map.values()).sort((a, b) => a.localeCompare(b))];

  }, [classes]);



  const hasUnitSelected = selectedUnit.trim() !== "";



  const filteredClasses = useMemo(() => {

    const selectedKey = normalizeUnitKey(selectedUnit);

    if (!hasUnitSelected) return [];

    const list = classes.filter(

      (item) => normalizeUnitKey(item.unit) === selectedKey

    );

    return [...list].sort((a, b) => {

      const aRange = parseAgeBandRange(a.ageBand || a.name);

      const bRange = parseAgeBandRange(b.ageBand || b.name);

      if (aRange.start !== bRange.start) return aRange.start - bRange.start;

      if (aRange.end !== bRange.end) return aRange.end - bRange.end;

      return aRange.label.localeCompare(bRange.label);

    });

  }, [classes, hasUnitSelected, selectedUnit]);



  const selectedClass = useMemo(

    () => classes.find((item) => item.id === selectedClassId) ?? null,

    [classes, selectedClassId]

  );

  const classNameLabel = normalizeText(selectedClass?.name ?? "Turma");
  const classUnitLabel = normalizeText(
    selectedClass?.unit ?? (selectedUnit || "Selecione")
  );
  const classAgeBandLabel = normalizeText(selectedClass?.ageBand ?? "09-11");
  const classGenderLabel = normalizeText(selectedClass?.gender ?? "misto");
  const classStartTimeLabel = selectedClass?.startTime
    ? normalizeText(`Horário ${selectedClass.startTime}`)
    : normalizeText("Horário indefinido");



  useEffect(() => {

    if (!hasUnitSelected) {

      setSelectedClassId("");

      return;

    }

    if (!filteredClasses.length) {

      setSelectedClassId("");

      return;

    }

    if (allowEmptyClass && !selectedClassId) {

      return;

    }

    if (selectedClassId && filteredClasses.some((item) => item.id === selectedClassId)) {

      return;

    }

    setSelectedClassId(filteredClasses[0].id);

  }, [allowEmptyClass, filteredClasses, hasUnitSelected, selectedClassId]);



  useEffect(() => {

    if (!hasUnitSelected) {

      setUnitMismatchWarning("");

      return;

    }

    if (

      selectedClass &&

      normalizeUnitKey(selectedClass.unit) !== normalizeUnitKey(selectedUnit)

    ) {

      setSelectedClassId("");

      setUnitMismatchWarning(

        "A turma selecionada pertence a outra unidade. Selecione uma turma desta unidade."

      );

      return;

    }

    setUnitMismatchWarning("");

  }, [hasUnitSelected, selectedClass, selectedUnit]);



  useEffect(() => {

    if (!selectedClass) return;

    const next = resolvePlanBand(normalizeAgeBand(selectedClass.ageBand));

    setAgeBand(next);

    if (typeof selectedClass.cycleLengthWeeks === "number") {

      const cycleValue = selectedClass.cycleLengthWeeks as (typeof cycleOptions)[number];

      if (cycleOptions.includes(cycleValue)) {

        setCycleLength(cycleValue);

      }

    }

    if (selectedClass.daysOfWeek.length) {

      const nextSessions =

        selectedClass.daysOfWeek.length as (typeof sessionsOptions)[number];

      if (sessionsOptions.includes(nextSessions)) {

        setSessionsPerWeek(nextSessions);

      }

    }

  }, [selectedClass]);



  useEffect(() => {

    if (!selectedClass) {

      setAcwrLimits({ high: "1.3", low: "0.8" });

      acwrSavedRef.current = { high: "1.3", low: "0.8" };

      return;

    }

    const nextHigh =

      typeof selectedClass.acwrHigh === "number"
      ? String(selectedClass.acwrHigh)

        : "1.3";

    const nextLow =

      typeof selectedClass.acwrLow === "number" ? String(selectedClass.acwrLow) : "0.8";

    const next = { high: nextHigh, low: nextLow };

    setAcwrLimits(next);

    acwrSavedRef.current = next;

  }, [selectedClass]);



  useEffect(() => {

    const validation = validateAcwrLimits(acwrLimits);

    setAcwrLimitError(validation.ok ? "" : validation.message);

  }, [acwrLimits.high, acwrLimits.low]);



  const persistAcwrLimits = useCallback(

    async (next: { high: string; low: string }) => {

      if (!selectedClassId) return;

      const validation = validateAcwrLimits(next);

      if (!validation.ok) return;

      const { highValue, lowValue } = validation;

      if (

        acwrSavedRef.current.high === next.high &&

        acwrSavedRef.current.low === next.low

      ) {

        return;

      }

      try {

        await updateClassAcwrLimits(selectedClassId, {

          high: highValue,

          low: lowValue,

        });

        acwrSavedRef.current = { high: next.high, low: next.low };

        setClasses((prev) =>

          prev.map((item) =>

            item.id === selectedClassId
            ? { ...item, acwrHigh: highValue, acwrLow: lowValue }
            : item

          )

        );

      } catch (error) {

        logAction("acwr_limits_save_failed", {

          classId: selectedClassId,

          high: next.high,

          low: next.low,

        });

      }

    },

    [selectedClassId]

  );



  useEffect(() => {

    if (!selectedClassId) return;

    const handle = setTimeout(() => {

      void persistAcwrLimits(acwrLimits);

    }, 600);

    return () => clearTimeout(handle);

  }, [acwrLimits.high, acwrLimits.low, persistAcwrLimits, selectedClassId]);



  useEffect(() => {

    let alive = true;

    if (!selectedClassId) {

      setClassPlans([]);

      return;

    }

    (async () => {

      const plans = await getClassPlansByClass(selectedClassId);

      if (!alive) return;

      setClassPlans(plans);

      if (plans.length && cycleOptions.includes(plans.length as (typeof cycleOptions)[number])) {

        setCycleLength(plans.length as (typeof cycleOptions)[number]);

      }

    })();

    return () => {

      alive = false;

    };

  }, [selectedClassId]);



  useEffect(() => {

    let alive = true;

    if (!selectedClassId || !selectedClass) {

      setAcwrRatio(null);

      setAcwrMessage("");

      setPainAlert("");

      setPainAlertDates([]);

      return;

    }

    (async () => {

      const end = new Date();

      const start = new Date();

      start.setDate(end.getDate() - 28);

      const logs = await getSessionLogsByRange(start.toISOString(), end.toISOString());

      if (!alive) return;

      const classLogs = logs.filter((log) => log.classId === selectedClassId);

      const duration = selectedClass.durationMinutes ?? 60;

      const validation = validateAcwrLimits(acwrLimits);

      if (!validation.ok) {

        setAcwrRatio(null);

        setAcwrMessage("");

        return;

      }

      const { highValue: highLimit, lowValue: lowLimit } = validation;

      const weekKeyForDate = (value: string) => {

        const parsed = new Date(value);

        if (Number.isNaN(parsed.getTime())) return null;

        parsed.setHours(0, 0, 0, 0);

        const day = parsed.getDay();

        const diff = day === 0 ? -6 : 1 - day;

        parsed.setDate(parsed.getDate() + diff);

        return parsed.toISOString().slice(0, 10);

      };

      const acuteStart = new Date();

      acuteStart.setDate(end.getDate() - 7);

      const acuteLoad = classLogs

        .filter((log) => new Date(log.createdAt) >= acuteStart)

        .reduce((sum, log) => sum + log.PSE * duration, 0);

      const weeklyTotals: Record<string, number> = {};

      classLogs.forEach((log) => {

        const key = weekKeyForDate(log.createdAt);

        if (!key) return;

        weeklyTotals[key] = (weeklyTotals[key] ?? 0) + log.PSE * duration;

      });

      const weeklyLoads = Object.values(weeklyTotals);

      const chronicLoad = weeklyLoads.length
        ? weeklyLoads.reduce((sum, value) => sum + value, 0) / weeklyLoads.length
        : 0;

      if (chronicLoad > 0) {

        const ratio = Number((acuteLoad / chronicLoad).toFixed(2));

        const acuteLabel = Math.round(acuteLoad);

        const chronicLabel = Math.round(chronicLoad);

        setAcwrRatio(ratio);

        if (ratio > highLimit) {

          setAcwrMessage(

            `Carga subiu acima de ${highLimit}. (7d ${acuteLabel} / 28d ${chronicLabel})`

          );

        } else if (ratio < lowLimit) {

          setAcwrMessage(

            `Carga abaixo de ${lowLimit}. (7d ${acuteLabel} / 28d ${chronicLabel})`

          );

        } else {

          setAcwrMessage(

            `Carga dentro do esperado. (7d ${acuteLabel} / 28d ${chronicLabel})`

          );

        }

      } else {

        setAcwrRatio(null);

        setAcwrMessage("");

      }



      const painLogs = classLogs

        .filter((log) => typeof log.painScore === "number")

        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

        .slice(0, 3);

      const painHits = painLogs.filter((log) => (log.painScore ?? 0) >= 2);

      if (painHits.length >= 3) {

        setPainAlert("Dor nível 2+ por 3 registros. Considere avaliar com profissional.");

        setPainAlertDates(painHits.map((log) => formatDisplayDate(log.createdAt)));

      } else {

        setPainAlert("");

        setPainAlertDates([]);

      }

    })();

    return () => {

      alive = false;

    };

  }, [acwrLimits.high, acwrLimits.low, selectedClassId, selectedClass]);



  const weekPlans = useMemo(() => {
    if (!selectedClass) return [];

    const base = basePlans[ageBand] ?? basePlans["09-11"];

    const length = classPlans.length || cycleLength;

    if (classPlans.length) {
      return classPlans.map((plan, index) => {
        const template = base[index % base.length];
        const normalizedPhase = normalizeText(plan.phase);
        const normalizedTheme = normalizeText(plan.theme);
        const normalizedConstraints = normalizeText(plan.constraints);
        const normalizedWarmup = normalizeText(plan.warmupProfile);
        const normalizedJump = normalizeText(plan.jumpTarget);
        const normalizedRpe = normalizeText(plan.rpeTarget);
        const phaseForPse = normalizedPhase || plan.phase;

        return {
          week: plan.weekNumber,
          title: normalizedPhase,
          focus: normalizedTheme,
          volume: template.volume,
          notes: [normalizedConstraints, normalizedWarmup].filter(Boolean),
          jumpTarget:
            normalizedJump || getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),
          PSETarget: normalizedRpe || getPSETarget(phaseForPse),
          source: plan.source || "AUTO",
        };
      });
    }

    const weeks: WeekPlan[] = [];

    for (let i = 0; i < length; i += 1) {

      const template = base[i % base.length];

      weeks.push({

        ...template,

        week: i + 1,

        title: getPhaseForWeek(i + 1, length),

        jumpTarget: getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),

        PSETarget: getPSETarget(getPhaseForWeek(i + 1, length)),

        source: "AUTO",

      });

    }

    return weeks;

  }, [ageBand, cycleLength, classPlans, selectedClass?.mvLevel]);



  const filteredWeekPlans = useMemo(() => {

    if (cycleFilter === "all") return weekPlans;

    const target = cycleFilter === "manual" ? "MANUAL" : "AUTO";

    return weekPlans.filter((week) => week.source === target);

  }, [cycleFilter, weekPlans]);



  const periodizationRows = useMemo(() => {

    if (!selectedClass) return [];

    if (classPlans.length) {

      return [...classPlans]

        .sort((a, b) => a.weekNumber - b.weekNumber)

        .map((plan) => ({

          week: plan.weekNumber,

          phase: normalizeText(plan.phase),

          theme: normalizeText(plan.theme),

          technicalFocus: normalizeText(plan.technicalFocus),

          physicalFocus: normalizeText(plan.physicalFocus),

          constraints: normalizeText(plan.constraints),

          mvFormat: normalizeText(plan.mvFormat),

          jumpTarget: normalizeText(plan.jumpTarget),

          rpeTarget: normalizeText(plan.rpeTarget),

          source: plan.source,

        }));

    }

    return weekPlans.map((week) => ({

      week: week.week,

      phase: normalizeText(week.title),

      theme: normalizeText(week.focus),

      technicalFocus: normalizeText(week.focus),

      physicalFocus: normalizeText(getPhysicalFocus(ageBand)),

      constraints: normalizeText(week.notes.join(" | ")),

      mvFormat: normalizeText(getMvFormat(ageBand)),

      jumpTarget: normalizeText(week.jumpTarget),

      rpeTarget: normalizeText(week.PSETarget),

      source: "AUTO",

    }));

  }, [ageBand, classPlans, selectedClass, weekPlans]);



  const summary = useMemo(() => {

    if (ageBand === "06-08") {

      return [

        "Foco em alfabetização motora e jogo",

        "Sessões curtas e lúdicas",

        "Sem cargas externas",

      ];

    }

    if (ageBand === "09-11") {

      return [

        "Fundamentos + tomada de decisão",

        "Controle de volume e saltos",

        "Aquecimento preventivo simples",

      ];

    }

    return [

      "Técnica eficiente + sistema de jogo",

      "Força moderada e pliometria controlada",

      "Monitorar PSE e recuperação",

    ];

  }, [ageBand]);



  const progressBars = weekPlans.map((week) => volumeToRatio[week.volume]);

  const currentWeek = useMemo(() => {

    const start =
      parseIsoDate(selectedClass?.cycleStartDate ?? "") ??
      parseIsoDate(classPlans[0]?.startDate ?? "");

    if (!start || !weekPlans.length) return 1;

    const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));

    const week = Math.floor(diffDays / 7) + 1;

    return Math.max(1, Math.min(week, weekPlans.length));

  }, [selectedClass?.cycleStartDate, classPlans, weekPlans.length]);

  const hasWeekPlans = weekPlans.length > 0;

  const activeWeekIndex = hasWeekPlans
    ? Math.max(0, Math.min(currentWeek - 1, weekPlans.length - 1))
    : 0;

  const activeWeek = hasWeekPlans ? weekPlans[activeWeekIndex] : emptyWeek;



  // Removido: criação automatica de semanas ao entrar na tela.



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

      return "Duas semanas seguidas em carga alta. Considere uma semana de recuperação.";

    }

    if (activeWeek.volume === "alto") {

      return "Semana atual com carga alta. Monitore recuperação e PSE.";

    }

    return "";

  }, [highLoadStreak, activeWeek.volume]);



  useEffect(() => {

    if (activeTab !== "geral" && activeTab !== "ciclo") {

      setGuidance(null);

      return;

    }

    const acwrSummary = acwrRatio !== null ? `ACWR ${acwrRatio}` : "";

    const items = [warningMessage, acwrSummary].filter(Boolean);

    if (!items.length) {

      setGuidance(null);

      return;

    }

    const details: Record<string, string> = {};

    if (acwrSummary) {

      details[acwrSummary] =

        "ACWR e a razao entre a carga da última semana e a media das últimas 4.";

    }

    setGuidance({ title: "Alerta de carga", items, tone: "warning", details });

    return () => {

      setGuidance(null);

    };

  }, [acwrRatio, activeTab, setGuidance, warningMessage]);



  const openWeekEditor = useCallback((weekNumber: number) => {

    if (!selectedClass) return;

    const existing = classPlans.find((plan) => plan.weekNumber === weekNumber);

    const startDate =

      selectedClass.cycleStartDate || formatIsoDate(new Date());

    const plan =
      existing ??
      buildClassPlan({
        classId: selectedClass.id,
        ageBand,
        startDate,
        weekNumber,
        source: "AUTO",
        mvLevel: selectedClass.mvLevel,
        cycleLength,
      });

    setEditingWeek(weekNumber);

    setEditingPlanId(existing?.id ?? null);

    setEditPhase(normalizeText(plan.phase));

    setEditTheme(normalizeText(plan.theme));

    setEditTechnicalFocus(normalizeText(plan.technicalFocus));

    setEditPhysicalFocus(normalizeText(plan.physicalFocus));

    setEditConstraints(normalizeText(plan.constraints));

    setEditMvFormat(plan.mvFormat);

    setEditWarmupProfile(normalizeText(plan.warmupProfile));

    setEditJumpTarget(normalizeText(plan.jumpTarget));

    setEditPSETarget(normalizeText(plan.rpeTarget));

    setEditSource(existing ? plan.source : "AUTO");

    setApplyWeeks([]);

    setShowWeekEditor(true);

  }, [ageBand, classPlans, cycleLength, selectedClass]);



  const buildManualPlanForWeek = useCallback(

    (weekNumber: number, existing: ClassPlan | null): ClassPlan | null => {

      if (!selectedClass) return null;

      const startDate = selectedClass.cycleStartDate || formatIsoDate(new Date());

      const nowIso = new Date().toISOString();

      return {
        id: existing?.id ?? `cp_${selectedClass.id}_${Date.now()}_${weekNumber}`,

        classId: selectedClass.id,

        startDate,

        weekNumber,

        phase: editPhase.trim() || getPhaseForWeek(weekNumber, cycleLength),

        theme: editTheme.trim() || "Fundamentos",

        technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || "Fundamentos",

        physicalFocus: editPhysicalFocus.trim() || getPhysicalFocus(ageBand),

        constraints: editConstraints.trim(),

        mvFormat: editMvFormat.trim() || getMvFormat(ageBand),

        warmupProfile: editWarmupProfile.trim(),

        jumpTarget: editJumpTarget.trim() || getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),

        rpeTarget: editPSETarget.trim() || getPSETarget(getPhaseForWeek(weekNumber, cycleLength)),

        source: "MANUAL",

        createdAt: existing?.createdAt ?? nowIso,

        updatedAt: nowIso,

      };

    },

    [

      ageBand,

      cycleLength,

      editConstraints,

      editJumpTarget,

      editMvFormat,

      editPSETarget,

      editPhase,

      editPhysicalFocus,

      editTechnicalFocus,

      editTheme,

      editWarmupProfile,

      selectedClass,

    ]

  );



  const hasPlanChanges = useCallback(

    (existing: ClassPlan | null, draft: ClassPlan) => {

      if (!existing) return true;

      return (

        existing.phase !== draft.phase ||

        existing.theme !== draft.theme ||

        existing.technicalFocus !== draft.technicalFocus ||

        existing.physicalFocus !== draft.physicalFocus ||

        existing.constraints !== draft.constraints ||

        existing.mvFormat !== draft.mvFormat ||

        existing.warmupProfile !== draft.warmupProfile ||

        existing.jumpTarget !== draft.jumpTarget ||

        existing.rpeTarget !== draft.rpeTarget

      );

    },

    []

  );



  const refreshPlans = useCallback(async () => {

    if (!selectedClass) return;

    const plans = await getClassPlansByClass(selectedClass.id);

    setClassPlans(plans);

  }, [selectedClass]);



  const applyDraftToWeeks = useCallback(

    async (weeks: number[]) => {

      if (!selectedClass) return;

      const targets = weeks.filter(

        (week) => week >= 1 && week <= cycleLength && week !== editingWeek

      );

      if (!targets.length) return;

      const byWeek = new Map(classPlans.map((plan) => [plan.weekNumber, plan]));

      const toCreate: ClassPlan[] = [];

      const toUpdate: ClassPlan[] = [];

      targets.forEach((week) => {

        const existing = byWeek.get(week) ?? null;

        const plan = buildManualPlanForWeek(week, existing);

        if (!plan) return;

        if (existing) {

          toUpdate.push(plan);

        } else {

          toCreate.push(plan);

        }

      });

      if (toCreate.length) {

        await measure("saveClassPlans", () => saveClassPlans(toCreate));

      }

      if (toUpdate.length) {

        await Promise.all(

          toUpdate.map((plan) => measure("updateClassPlan", () => updateClassPlan(plan)))

        );

      }

      await refreshPlans();

      setApplyWeeks([]);

    },

    [

      buildManualPlanForWeek,

      classPlans,

      cycleLength,

      editingWeek,

      refreshPlans,

      selectedClass,

    ]

  );



  const buildAutoPlanForWeek = useCallback(

    (weekNumber: number, existing: ClassPlan | null) => {

      if (!selectedClass) return null;

      const startDate = selectedClass.cycleStartDate || formatIsoDate(new Date());

      const plan = buildClassPlan({

        classId: selectedClass.id,

        ageBand,

        startDate,

        weekNumber,

        source: "AUTO",

        mvLevel: selectedClass.mvLevel,

        cycleLength,

      });

      if (existing) {

        plan.id = existing.id;

        plan.createdAt = existing.createdAt;

      }

      return plan;

    },

    [ageBand, cycleLength, selectedClass]

  );



  const resetWeekToAuto = useCallback(() => {

    if (!selectedClass) return;

    const existing = classPlans.find((plan) => plan.weekNumber === editingWeek) ?? null;

    const plan = buildAutoPlanForWeek(editingWeek, existing);

    if (!plan) return;

    setEditPhase(normalizeText(plan.phase));

    setEditTheme(normalizeText(plan.theme));

    setEditTechnicalFocus(normalizeText(plan.technicalFocus));

    setEditPhysicalFocus(normalizeText(plan.physicalFocus));

    setEditConstraints(normalizeText(plan.constraints));

    setEditMvFormat(plan.mvFormat);

    setEditWarmupProfile(normalizeText(plan.warmupProfile));

    setEditJumpTarget(normalizeText(plan.jumpTarget));

    setEditPSETarget(normalizeText(plan.rpeTarget));

    setEditSource("AUTO");

  }, [buildAutoPlanForWeek, classPlans, editingWeek, selectedClass]);



  const handleSaveWeek = async () => {

    if (!selectedClass) return;

    const startDate =

      selectedClass.cycleStartDate || formatIsoDate(new Date());

    const nowIso = new Date().toISOString();

    const plan: ClassPlan = {
      id: editingPlanId ?? `cp_${selectedClass.id}_${Date.now()}_${editingWeek}`,

      classId: selectedClass.id,

      startDate,

      weekNumber: editingWeek,

      phase: editPhase.trim() || getPhaseForWeek(editingWeek, cycleLength),

      theme: editTheme.trim() || "Fundamentos",

      technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || "Fundamentos",

      physicalFocus: editPhysicalFocus.trim() || getPhysicalFocus(ageBand),

      constraints: editConstraints.trim(),

      mvFormat: editMvFormat.trim() || getMvFormat(ageBand),

      warmupProfile: editWarmupProfile.trim(),

      jumpTarget: editJumpTarget.trim() || getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),

      rpeTarget: editPSETarget.trim() || getPSETarget(getPhaseForWeek(editingWeek, cycleLength)),

      source: editSource,

      createdAt: editingPlanId
        ? classPlans.find((p) => p.id === editingPlanId)?.createdAt ?? nowIso
        : nowIso,

      updatedAt: nowIso,

    };

    const existing = editingPlanId
      ? classPlans.find((p) => p.id === editingPlanId) ?? null

      : null;

    if (hasPlanChanges(existing, plan)) {

      plan.source = "MANUAL";

      setEditSource("MANUAL");

    } else if (existing) {

      plan.source = existing.source;

    }

    setIsSavingWeek(true);

    try {

      if (editingPlanId) {

        await measure("updateClassPlan", () => updateClassPlan(plan));

        setClassPlans((prev) =>

          prev

            .map((item) => (item.id === editingPlanId ? plan : item))

            .sort((a, b) => a.weekNumber - b.weekNumber)

        );

      } else {

        await measure("createClassPlan", () => createClassPlan(plan));

        setClassPlans((prev) => [...prev, plan].sort((a, b) => a.weekNumber - b.weekNumber));

      }

      logAction("Salvar periodizacao", {

        classId: selectedClass.id,

        weekNumber: editingWeek,

        source: plan.source,

      });

      setShowWeekEditor(false);

      setEditingPlanId(null);

    } finally {

      setIsSavingWeek(false);

    }

  };



  const handleSelectDay = useCallback((index: number) => {

    setSelectedDayIndex(index);

    setShowDayModal(true);

  }, []);



  const handleSelectUnit = useCallback((unit: string) => {

    if (!unit) {

      setSelectedUnit("");

      setSelectedClassId("");

      setAllowEmptyClass(true);

      setUnitMismatchWarning("");

      setShowUnitPicker(false);

      return;

    }

    const nextKey = normalizeUnitKey(unit);

    const currentKey = normalizeUnitKey(selectedUnit);

    const changed = nextKey !== currentKey;



    if (changed) {

      setSelectedClassId("");

      setAllowEmptyClass(true);

      setUnitMismatchWarning("");

    } else {

      setAllowEmptyClass(false);

    }

    setSelectedUnit(unit);

    setShowUnitPicker(false);

    if (!changed && selectedClass && normalizeUnitKey(selectedClass.unit) !== nextKey) {

      setSelectedClassId("");

      setUnitMismatchWarning(

        "A turma selecionada pertence a outra unidade. Selecione uma turma desta unidade."

      );

    } else if (!changed) {

      setUnitMismatchWarning("");

    }

  }, [selectedClass, selectedUnit]);



  const handleSelectClass = useCallback((cls: ClassGroup) => {

    setSelectedClassId(cls.id);

    setAllowEmptyClass(false);

    if (cls.unit) setSelectedUnit(cls.unit);

    setUnitMismatchWarning("");

    setShowClassPicker(false);

  }, []);



  const handleClearClass = useCallback(() => {

    setSelectedClassId("");

    setAllowEmptyClass(true);

    setUnitMismatchWarning("");

    setShowClassPicker(false);

  }, []);



  const handleSelectMeso = useCallback((value: (typeof cycleOptions)[number]) => {

    setCycleLength(value);

    setShowMesoPicker(false);

  }, []);



  const handleSelectMicro = useCallback(

    (value: (typeof sessionsOptions)[number]) => {

      setSessionsPerWeek(value);

      setShowMicroPicker(false);

    },

    []

  );



  const UnitOption = useMemo(

    () =>

      memo(function UnitOptionItem({

        unit,

        active,

        palette,

        onSelect,

        isFirst,

      }: {

        unit: string;

        active: boolean;

        palette: { bg: string; text: string };

        onSelect: (value: string) => void;

        isFirst: boolean;

      }) {

        return (

          <Pressable

            onPress={() => onSelect(unit)}

            style={{

              paddingVertical: 8,

              paddingHorizontal: 10,

              borderRadius: 10,

              margin: isFirst ? 6 : 2,

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

              {unit || "Selecione"}

            </Text>

          </Pressable>

        );

      }),

    [colors]

  );



  const ClassOption = useMemo(

    () =>

      memo(function ClassOptionItem({

        cls,

        active,

        onSelect,

        isFirst,

      }: {

        cls: ClassGroup;

        active: boolean;

        onSelect: (value: ClassGroup) => void;

        isFirst: boolean;

      }) {

          return (

            <Pressable

              onPress={() => onSelect(cls)}

              style={{

                paddingVertical: 8,

                paddingHorizontal: 10,

                borderRadius: 10,

                margin: isFirst ? 6 : 2,

                backgroundColor: active ? colors.primaryBg : "transparent",

              }}

            >

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>

                <Text

                  style={{

                    color: active ? colors.primaryText : colors.text,

                    fontSize: 12,

                    fontWeight: active ? "700" : "500",

                  }}

                >

                  {cls.name}

                </Text>

                <ClassGenderBadge gender={cls.gender} />

              </View>

            </Pressable>

          );

        }),

    [colors]

  );



  const MesoOption = useMemo(

    () =>

      memo(function MesoOptionItem({

        value,

        active,

        onSelect,

        isFirst,

      }: {

        value: (typeof cycleOptions)[number];

        active: boolean;

        onSelect: (value: (typeof cycleOptions)[number]) => void;

        isFirst: boolean;

      }) {

        return (

          <Pressable

            onPress={() => onSelect(value)}

            style={{

              paddingVertical: 8,

              paddingHorizontal: 10,

              borderRadius: 10,

              margin: isFirst ? 6 : 2,

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

      }),

    [colors]

  );



  const MicroOption = useMemo(

    () =>

      memo(function MicroOptionItem({

        value,

        active,

        onSelect,

        isFirst,

      }: {

        value: (typeof sessionsOptions)[number];

        active: boolean;

        onSelect: (value: (typeof sessionsOptions)[number]) => void;

        isFirst: boolean;

      }) {

        return (

          <Pressable

            onPress={() => onSelect(value)}

            style={{

              paddingVertical: 8,

              paddingHorizontal: 10,

              borderRadius: 10,

              margin: isFirst ? 6 : 2,

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

      }),

    [colors]

  );



  const handleGenerateMode = useCallback(

    async (mode: "fill" | "auto" | "all") => {

      if (!selectedClass) return;

      setIsSavingPlans(true);

      try {

        const existing = await getClassPlansByClass(selectedClass.id);

        const byWeek = new Map(existing.map((plan) => [plan.weekNumber, plan]));

        if (mode === "all") {

          const startDate = selectedClass.cycleStartDate || formatIsoDate(new Date());

          const plans = toClassPlans({

            classId: selectedClass.id,

            ageBand,

            cycleLength,

            startDate,

            mvLevel: selectedClass.mvLevel,

          });

          await measure("deleteClassPlansByClass", () =>

            deleteClassPlansByClass(selectedClass.id)

          );

          await measure("saveClassPlans", () => saveClassPlans(plans));

          setClassPlans(plans);

          logAction("Regerar planejamento", {

            classId: selectedClass.id,

            weeks: plans.length,

          });

          return;

        }



        const toCreate: ClassPlan[] = [];

        const toUpdate: ClassPlan[] = [];

        for (let week = 1; week <= cycleLength; week += 1) {

          const existingPlan = byWeek.get(week) ?? null;

          if (!existingPlan) {

            const plan = buildAutoPlanForWeek(week);

            if (plan) toCreate.push(plan);

            continue;

          }

          if (mode === "auto" && existingPlan.source === "AUTO") {

            const plan = buildAutoPlanForWeek(week, existingPlan);

            if (plan) {

              plan.updatedAt = new Date().toISOString();

              toUpdate.push(plan);

            }

          }

        }

        if (toCreate.length) {

          await measure("saveClassPlans", () => saveClassPlans(toCreate));

        }

        if (toUpdate.length) {

          await Promise.all(

            toUpdate.map((plan) => measure("updateClassPlan", () => updateClassPlan(plan)))

          );

        }

        await refreshPlans();

      } finally {

        setIsSavingPlans(false);

        setShowGenerateModal(false);

      }

    },

    [ageBand, buildAutoPlanForWeek, cycleLength, refreshPlans, selectedClass]

  );



  const handleGenerateAction = useCallback(

    (mode: "fill" | "auto" | "all") => {

      if (mode === "all") {

        confirmDialog({

          title: "Regerar tudo?",

          message:

            "Isso substitui semanas AUTO e MANUAL. Use apenas se quiser recriar todo o ciclo.",

          confirmLabel: "Regerar tudo",

          cancelLabel: "Cancelar",

          onConfirm: () => handleGenerateMode("all"),

        });

        return;

      }

      handleGenerateMode(mode);

    },

    [confirmDialog, handleGenerateMode]

  );



  const getWeekSchedule = (week: WeekPlan | undefined, sessions: number) => {

    const base = (week?.focus ?? week?.title ?? "").split(",")[0] || "";

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
      : template[targetCount]
        ? template[targetCount]
        : template[2];

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

      { baixo: 0, "médio": 0, alto: 0 } as Record<VolumeLevel, number>

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



  const formatDisplayDate = (value: string | null) => {

    if (!value) return "";

    const parsed = parseIsoDate(value);

    if (!parsed) return value;

    return parsed.toLocaleDateString("pt-BR");

  };



  const buildPdfData = (rows: typeof periodizationRows) => ({
    className: normalizeText(selectedClass?.name ?? "Turma"),

    unitLabel: normalizeText(selectedClass?.unit ?? ""),

    ageGroup: normalizeText(selectedClass?.ageBand ?? ""),

    cycleStart:
      selectedClass?.cycleStartDate ??
      classPlans[0]?.startDate ??
      undefined,

    cycleLength: rows.length,

    generatedAt: new Date().toLocaleDateString("pt-BR"),

    rows,

  });



  const handleExportCycle = async () => {

    if (!selectedClass || !periodizationRows.length || !hasWeekPlans) return;

    const data = buildPdfData(periodizationRows);

    const fileName = safeFileName(

      `periodizacao_${selectedClass.name}_${formatDisplayDate(data.cycleStart)}`

    );

    await exportPdf({

      html: periodizationHtml(data),

      fileName: `${fileName || "periodizacao"}.pdf`,

      webDocument: <PeriodizationDocument data={data} />,

    });

  };



  const handleExportWeek = async () => {

    if (!selectedClass || !periodizationRows.length || !hasWeekPlans) return;

    const weekRow = periodizationRows.find((row) => row.week === activeWeek.week);

    if (!weekRow) return;

    const data = buildPdfData([weekRow]);

    const fileName = safeFileName(

      `periodizacao_semana_${weekRow.week}_${selectedClass.name}`

    );

    await exportPdf({

      html: periodizationHtml(data),

      fileName: `${fileName || "periodizacao"}.pdf`,

      webDocument: <PeriodizationDocument data={data} />,

    });

  };



  return (

    <SafeAreaView

      style={{ flex: 1, padding: 16, backgroundColor: colors.background, overflow: "visible" }}

    >

      <View ref={containerRef} style={{ flex: 1, position: "relative", overflow: "visible" }}>

        <Pressable

          onPress={() => {

            if (!isPickerOpen) return;

            closeAllPickers();

          }}

          pointerEvents={

            showUnitPicker || showClassPicker || showMesoPicker || showMicroPicker

              ? "auto"

              : "none"

          }

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

          onScroll={syncPickerLayouts}

          scrollEventThrottle={16}

        >

        { selectedClass ? (
          <ClassContextHeader
            title={normalizeText("Periodização")}
            className={classNameLabel}
            unit={classUnitLabel}
            ageBand={classAgeBandLabel}
            gender={classGenderLabel}
            classColorKey={selectedClass?.colorKey}
          />
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
              {normalizeText("Periodização")}
            </Text>
            <Text style={{ color: colors.muted }}>
              {normalizeText("Estrutura do ciclo, cargas e foco semanal")}
            </Text>
          </View>
        )}


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

            { id: "geral", label: normalizeText("Visão geral") },
            { id: "ciclo", label: normalizeText("Ciclo") },

            { id: "semana", label: normalizeText("Semana") },

          ].map((tab) => {

            const selected = activeTab === tab.id;

            return (

                <Pressable

                  key={tab.id}

                  onPress={() => {

                    closeAllPickers();

                    setActiveTab(tab.id as PeriodizationTab);

                  }}

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



        { activeTab === "geral" ? (

        <>

        <View style={getSectionCardStyle(colors, "primary")}>

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            {normalizeText("Visão geral")}

          </Text>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {normalizeText("Panorama rápido do ciclo e da turma atual")}

          </Text>

          <View

            style={[

              getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

              { marginTop: 12, zIndex: 0, position: "relative" },

            ]}

          >

            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>

              {normalizeText("Próxima sessão")}

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

                {classStartTimeLabel}

              </Text>

            </View>

          </View>

          { !hasInitialClass ? (
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

                    if (!hasUnitSelected) return;

                    togglePicker("class");

                  }}

                  disabled={!hasUnitSelected}

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

                    opacity: hasUnitSelected ? 1 : 0.6,

                  }}

                >

                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>

                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 }}>

                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>

                          {normalizeText(selectedClass?.name ?? "Selecione")}

                        </Text>

                        { selectedClass ? (

                          <ClassGenderBadge gender={selectedClass?.gender ?? "misto"} />

                        ) : null}

                      </View>

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

                  onPress={() => togglePicker("unit")}

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

                      {selectedUnit
                        ? normalizeText(selectedClass?.unit ?? selectedUnit)
                        : normalizeText("Selecione")}

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

          ) : null}
          { unitMismatchWarning ? (

            <View

              style={[

                getSectionCardStyle(colors, "warning", { padding: 10, radius: 12, shadow: false }),

                { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "center" },

              ]}

            >

              <Ionicons name="alert-circle" size={16} color={colors.warningText} />

              <Text style={{ color: colors.warningText, fontSize: 12, flex: 1 }}>

                {unitMismatchWarning}

              </Text>

            </View>

          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>

            <View

              style={[

                getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

                { flexBasis: "48%" },

              ]}

            >

              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText("Mesociclo")}
              </Text>

              <View ref={mesoTriggerRef} style={{ position: "relative" }}>

                <Pressable

                  onPress={() => togglePicker("meso")}

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

              </View>

            </View>

            <View

              style={[

                getSectionCardStyle(colors, "neutral", { padding: 12, radius: 16, shadow: false }),

                { flexBasis: "48%" },

              ]}

            >

              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText("Microciclo")}
              </Text>

              <View ref={microTriggerRef} style={{ position: "relative" }}>

                <Pressable

                  onPress={() => togglePicker("micro")}

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

              </View>

            </View>

          </View>

          <View style={{ marginTop: 8, gap: 8 }}>

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Distribuição de carga")}
            </Text>

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

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Tendência de carga")}
            </Text>

            <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>

              {progressBars.map((ratio, index) => {

                const level = weekPlans[index]?.volume ?? "médio";

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

          { painAlert ? (

            <View

              style={[

                getSectionCardStyle(colors, "warning", { padding: 12, radius: 14 }),

                { marginTop: 10 },

              ]}

            >

              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>

                Alerta de dor

              </Text>

              <Text style={{ color: colors.text, fontSize: 12, marginTop: 4 }}>

                {painAlert}

              </Text>

              { painAlertDates.length ? (

                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>

                  Datas: {painAlertDates.join(" | ")}

                </Text>

              ) : null}

              <Pressable

                onPress={() => router.push({ pathname: "/reports" })}

                style={{

                  alignSelf: "flex-start",

                  marginTop: 8,

                  paddingVertical: 6,

                  paddingHorizontal: 10,

                  borderRadius: 999,

                  backgroundColor: colors.secondaryBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>

                  Abrir relatórios

                </Text>

              </Pressable>

            </View>

          ) : null}

        </View>



        <View style={getSectionCardStyle(colors, "info")}>

          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

            Planejamento da turma

          </Text>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {classPlans.length

              ? "Planejamento salvo para esta turma."

              : "Gere o planejamento semanal para esta turma."}

          </Text>

          <Pressable

            onPress={() => {

              if (!selectedClass || isSavingPlans) return;

              setShowGenerateModal(true);

            }}

            disabled={!selectedClass || isSavingPlans}

            style={{

              marginTop: 10,

              paddingVertical: 10,

              borderRadius: 12,

              alignItems: "center",

              backgroundColor:

                !selectedClass || isSavingPlans

                  ? colors.primaryDisabledBg

                  : colors.primaryBg,

              }}

            >

            <Text

              style={{

                color:

                  !selectedClass || isSavingPlans

                    ? colors.secondaryText

                    : colors.primaryText,

                fontWeight: "700",

              }}

            >

              {isSavingPlans ? "Salvando..." : "Gerar ciclo"}

            </Text>

          </Pressable>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>

            <Pressable

              onPress={handleExportWeek}

              disabled={!selectedClass || !periodizationRows.length}

              style={{

                flex: 1,

                paddingVertical: 10,

                borderRadius: 10,

                alignItems: "center",

                backgroundColor: colors.secondaryBg,

                borderWidth: 1,

                borderColor: colors.border,

                opacity: !selectedClass || !periodizationRows.length ? 0.6 : 1,

              }}

            >

              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>

                Exportar semana

              </Text>

            </Pressable>

            <Pressable

              onPress={handleExportCycle}

              disabled={!selectedClass || !periodizationRows.length}

              style={{

                flex: 1,

                paddingVertical: 10,

                borderRadius: 10,

                alignItems: "center",

                backgroundColor: colors.secondaryBg,

                borderWidth: 1,

                borderColor: colors.border,

                opacity: !selectedClass || !periodizationRows.length ? 0.6 : 1,

              }}

            >

              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>

                Exportar ciclo

              </Text>

            </Pressable>

          </View>

        </View>

        </>

        ) : null}



        { activeTab === "ciclo" ? (

          <>

        <View style={{ gap: 10 }}>

          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>

            {normalizeText("Carga semanal")}

          </Text>

          <View style={getSectionCardStyle(colors, "primary")}>

          <Pressable

            onPress={() => toggleSection("load")}

            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

          >

            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

              {normalizeText("Carga semanal")}

            </Text>

            <Ionicons

              name={sectionOpen.load ? "chevron-up" : "chevron-down"}

              size={18}

              color={colors.muted}

            />

          </Pressable>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {normalizeText("Distribuição de intensidade ao longo do ciclo")}

          </Text>

          { showLoadContent ? (

            <Animated.View style={[{ gap: 12 }, loadAnimStyle]}>

              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>

            {progressBars.map((ratio, index) => {

              const level = weekPlans[index]?.volume ?? "médio";

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

                    {normalizeText(`${level} - ${volumeToPSE[level]}`)}

                  </Text>

                </View>

                );

              })}

          </View>

          <View style={{ gap: 10 }}>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              Limites de alerta (ACWR)

            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>

              <View style={{ flex: 1, gap: 6 }}>

                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                  Alto

                </Text>

                <TextInput

                  value={acwrLimits.high}

                  onChangeText={(value) =>

                    setAcwrLimits((prev) => ({

                      ...prev,

                      high: value.replace(",", "."),

                    }))

                  }

                  keyboardType="numeric"

                  placeholder="1.3"

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

              <View style={{ flex: 1, gap: 6 }}>

                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                  Baixo

                </Text>

                <TextInput

                  value={acwrLimits.low}

                  onChangeText={(value) =>

                    setAcwrLimits((prev) => ({

                      ...prev,

                      low: value.replace(",", "."),

                    }))

                  }

                  keyboardType="numeric"

                  placeholder="0.8"

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

            </View>

            { acwrLimitError ? (

              <Text style={{ color: colors.dangerText, fontSize: 12 }}>

                {acwrLimitError}

              </Text>

            ) : null}

            { !acwrLimitError && acwrMessage ? (

              <Text style={{ color: colors.muted, fontSize: 12 }}>

                {acwrMessage}

              </Text>

            ) : null}

          </View>

            </Animated.View>

          ) : null}

          </View>

        </View>



        <Pressable

          onPress={() => toggleSection("guides")}

          style={[

            getSectionCardStyle(colors, "neutral"),

            {

              flexDirection: "row",

              alignItems: "center",

              gap: 10,

              paddingVertical: 10,

            },

          ]}

        >

          <View

            style={{

              width: 26,

              height: 26,

              borderRadius: 13,

              alignItems: "center",

              justifyContent: "center",

              backgroundColor: colors.secondaryBg,

            }}

          >

            <Ionicons name="information" size={16} color={colors.text} />

          </View>

          <View style={{ flex: 1 }}>

            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>

              Diretrizes da faixa

            </Text>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {normalizeText("Toque para ver as recomendações")}

            </Text>

          </View>

          <Ionicons

            name={sectionOpen.guides ? "chevron-up" : "chevron-down"}

            size={18}

            color={colors.muted}

          />

        </Pressable>

        { showGuideContent ? (

          <Animated.View style={[{ gap: 6 }, guideAnimStyle]}>

            {summary.map((item) => (

              <Text key={item} style={{ color: colors.muted, fontSize: 12 }}>

                {"- " + item}

              </Text>

            ))}

          </Animated.View>

        ) : null}



        <View style={{ gap: 10 }}>

          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>

            {normalizeText("Agenda do ciclo")}

          </Text>

          <View style={getSectionCardStyle(colors, "primary")}>

          <Pressable

            onPress={() => toggleSection("cycle")}

            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

          >

            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

              {normalizeText("Agenda do ciclo")}

            </Text>

            <Ionicons

              name={sectionOpen.cycle ? "chevron-up" : "chevron-down"}

              size={18}

              color={colors.muted}

            />

          </Pressable>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {normalizeText("Semanas com foco e volume definido")}

          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>

            {([

              { id: "all", label: "Todas" },

              { id: "auto", label: "Somente AUTO" },

              { id: "manual", label: "Somente MANUAL" },

            ] as const).map((item) => {

              const active = cycleFilter === item.id;

              return (

                <Pressable

                  key={item.id}

                  onPress={() => setCycleFilter(item.id)}

                  style={{

                    paddingVertical: 4,

                    paddingHorizontal: 10,

                    borderRadius: 999,

                    backgroundColor: active ? colors.primaryBg : colors.secondaryBg,

                    borderWidth: 1,

                    borderColor: colors.border,

                  }}

                >

                  <Text

                    style={{

                      color: active ? colors.primaryText : colors.text,

                      fontSize: 11,

                      fontWeight: active ? "700" : "500",

                    }}

                  >

                    {item.label}

                  </Text>

                </Pressable>

              );

            })}

          </View>

          { showCycleContent ? (

            <Animated.View style={[{ gap: 10 }, cycleAnimStyle]}>

            { !selectedClass ? (

              <View

                style={{

                  padding: 12,

                  borderRadius: 14,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <Text style={{ color: colors.muted, fontSize: 12 }}>

                  {normalizeText("Selecione uma turma para editar o ciclo.")}

                </Text>

              </View>

            ) : filteredWeekPlans.length ? (

              filteredWeekPlans.map((week, index) => (

              <Pressable

                key={`${week.week}-${index}`}

                onPress={() => openWeekEditor(week.week)}

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

                    {normalizeText("Semana " + week.week + " - " + week.title)}

                  </Text>

                  {(() => {

                    const palette = getVolumePalette(week.volume, colors);

                    const sourcePalette =

                      week.source === "MANUAL"

                        ? { bg: colors.warningBg, text: colors.warningText }

                        : { bg: colors.secondaryBg, text: colors.text };

                    return (

                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>

                        <View

                          style={{

                            paddingVertical: 2,

                            paddingHorizontal: 8,

                            borderRadius: 999,

                            backgroundColor: palette.bg,

                          }}

                        >

                          <Text style={{ color: palette.text, fontSize: 11 }}>

                            {normalizeText(week.volume)}

                          </Text>

                        </View>

                        <View

                          style={{

                            paddingVertical: 2,

                            paddingHorizontal: 8,

                            borderRadius: 999,

                            backgroundColor: sourcePalette.bg,

                            borderWidth: 1,

                            borderColor: colors.border,

                          }}

                        >

                          <Text

                            style={{

                              color: sourcePalette.text,

                              fontSize: 11,

                              fontWeight: "700",

                            }}

                          >

                            {week.source}

                          </Text>

                        </View>

                        <View

                          style={{

                            paddingVertical: 2,

                            paddingHorizontal: 8,

                            borderRadius: 999,

                            backgroundColor: colors.secondaryBg,

                          }}

                        >

                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>

                            Editar

                          </Text>

                        </View>

                      </View>

                    );

                  })()}

                </View>

                <Text style={{ color: colors.muted, fontSize: 12 }}>

                  {normalizeText("Foco: " + week.focus)}

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

                      {normalizeText(volumeToPSE[week.volume])}

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

                    <Text style={{ color: colors.text, fontSize: 11 }}>

                      {normalizeText(`PSE alvo: ${week.PSETarget}`)}

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

                    <Text style={{ color: colors.text, fontSize: 11 }}>

                      {normalizeText("Saltos: " + week.jumpTarget)}

                    </Text>

                  </View>

                </View>

                <View style={{ gap: 4 }}>

                  {week.notes.map((note) => (

                    <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>

                      {normalizeText("- " + note)}

                    </Text>

                  ))}

                </View>

              </Pressable>

            ))

            ) : (

              <View

                style={{

                  padding: 12,

                  borderRadius: 14,

                  backgroundColor: colors.inputBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                }}

              >

                <Text style={{ color: colors.muted, fontSize: 12 }}>

                  {normalizeText("Nenhuma semana encontrada para esse filtro.")}

                </Text>

              </View>

            )}

            </Animated.View>

          ) : null}

        </View>

        </View>

          </>

        ) : null}



        { activeTab === "semana" ? (

        <View style={{ gap: 10 }}>

          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>

            {normalizeText("Agenda da semana")}

          </Text>

          <View style={getSectionCardStyle(colors, "info")}>

          <Pressable

            onPress={() => toggleSection("week")}

            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}

          >

            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>

              {normalizeText(`Agenda da semana ${activeWeek.week}`)}

            </Text>

            <Ionicons

              name={sectionOpen.week ? "chevron-up" : "chevron-down"}

              size={18}

              color={colors.muted}

            />

          </Pressable>

          <Text style={{ color: colors.muted, fontSize: 12 }}>

            {normalizeText("Dias com sessão e foco sugerido")}

          </Text>

          { showWeekContent ? (

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

                    onPress={() => handleSelectDay(index)}

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



        <AnchoredDropdown

          visible={showClassPickerContent}

          layout={classTriggerLayout}

          container={containerWindow}

          animationStyle={classPickerAnimStyle}

          zIndex={300}

          maxHeight={220}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.inputBg,

          }}

          scrollContentStyle={{ padding: 4 }}

        >

          { filteredClasses.length ? (

            <>

              <Pressable

                onPress={handleClearClass}

                style={{

                  paddingVertical: 8,

                  paddingHorizontal: 10,

                  borderRadius: 10,

                  margin: 6,

                  backgroundColor: !selectedClassId ? colors.primaryBg : "transparent",

                }}

              >

                <Text

                  style={{

                    color: !selectedClassId ? colors.primaryText : colors.text,

                    fontSize: 12,

                    fontWeight: !selectedClassId ? "700" : "500",

                  }}

                >

                  Selecione

                </Text>

              </Pressable>

              {filteredClasses.map((cls, index) => (

                <ClassOption

                  key={cls.id}

                  cls={cls}

                  active={cls.id === selectedClassId}

                  onSelect={handleSelectClass}

                  isFirst={index === 0}

                />

              ))}

            </>

          ) : (

            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>

              {hasUnitSelected ? "Nenhuma turma cadastrada." : "Selecione uma unidade."}

            </Text>

          )}

        </AnchoredDropdown>



        <AnchoredDropdown

          visible={showUnitPickerContent}

          layout={unitTriggerLayout}

          container={containerWindow}

          animationStyle={unitPickerAnimStyle}

          zIndex={300}

          maxHeight={220}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.inputBg,

          }}

          scrollContentStyle={{ padding: 4 }}

        >

          {unitOptions.map((unit, index) => {

            const active = unit === selectedUnit;

            const palette = unit

              ? getUnitPalette(unit, colors)

              : { bg: colors.secondaryBg, text: colors.text };

            return (

              <UnitOption

                key={unit || "select"}

                unit={unit}

                active={active}

                palette={palette}

                onSelect={handleSelectUnit}

                isFirst={index === 0}

              />

            );

          })}

        </AnchoredDropdown>



        <AnchoredDropdown

          visible={showMesoPickerContent}

          layout={mesoTriggerLayout}

          container={containerWindow}

          animationStyle={mesoPickerAnimStyle}

          zIndex={999}

          maxHeight={220}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.inputBg,

          }}

          scrollContentStyle={{ padding: 4, gap: 2 }}

        >

          {cycleOptions.map((value, index) => (

            <MesoOption

              key={value}

              value={value}

              active={value === cycleLength}

              onSelect={handleSelectMeso}

              isFirst={index === 0}

            />

          ))}

        </AnchoredDropdown>



        <AnchoredDropdown

          visible={showMicroPickerContent}

          layout={microTriggerLayout}

          container={containerWindow}

          animationStyle={microPickerAnimStyle}

          zIndex={999}

          maxHeight={220}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.inputBg,

          }}

          scrollContentStyle={{ padding: 4, gap: 2 }}

        >

          {sessionsOptions.map((value, index) => (

            <MicroOption

              key={value}

              value={value}

              active={value === sessionsPerWeek}

              onSelect={handleSelectMicro}

              isFirst={index === 0}

            />

          ))}

        </AnchoredDropdown>

      </View>



      <ModalSheet

        visible={showDayModal}

        onClose={() => setShowDayModal(false)}

        cardStyle={[modalCardStyle, { paddingBottom: 12 }]}

        position="center"

      >

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>

            {selectedDay
              ? normalizeText(`Sessão de ${selectedDay.label}`)
              : normalizeText("Sessão")}

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

              {normalizeText(selectedClass?.name ?? "Selecione uma turma")}

            </Text>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {normalizeText(selectedClass?.unit ?? "Sem unidade")}

            </Text>

            { selectedDayDate ? (

              <Text style={{ color: colors.muted, fontSize: 12 }}>

                {"Data sugerida: " + formatIsoDate(selectedDayDate)}

              </Text>

            ) : null}

          </View>



          <View style={getSectionCardStyle(colors, "info", { padding: 12, radius: 16 })}>

            <Text style={{ color: colors.text, fontWeight: "700" }}>

              {normalizeText(activeWeek.title)}

            </Text>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {normalizeText(`Foco: ${activeWeek.focus}`)}

            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>

              {(() => {

                const palette = getVolumePalette(activeWeek.volume, colors);

                const sourcePalette =

                  activeWeek.source === "MANUAL"

                    ? { bg: colors.warningBg, text: colors.warningText }

                    : { bg: colors.secondaryBg, text: colors.text };

                return (

                  <>

                    <View

                      style={{

                        paddingVertical: 3,

                        paddingHorizontal: 8,

                        borderRadius: 999,

                        backgroundColor: palette.bg,

                      }}

                    >

                      <Text style={{ color: palette.text, fontSize: 11 }}>

                        {normalizeText(`Volume: ${activeWeek.volume}`)}

                      </Text>

                    </View>

                    <View

                      style={{

                        paddingVertical: 3,

                        paddingHorizontal: 8,

                        borderRadius: 999,

                        backgroundColor: sourcePalette.bg,

                        borderWidth: 1,

                        borderColor: colors.border,

                      }}

                    >

                      <Text style={{ color: sourcePalette.text, fontSize: 11, fontWeight: "700" }}>

                        {activeWeek.source}

                      </Text>

                    </View>

                  </>

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

                  {normalizeText(volumeToPSE[activeWeek.volume])}

                </Text>

              </View>

            </View>

            <View style={{ gap: 4, marginTop: 8 }}>

              {activeWeek.notes.map((note) => (

                <Text key={note} style={{ color: colors.muted, fontSize: 12 }}>

                  {normalizeText(`- ${note}`)}

                </Text>

              ))}

            </View>

          </View>



          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

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



      <ModalSheet

        visible={showGenerateModal}

        onClose={() => setShowGenerateModal(false)}

        cardStyle={[modalCardStyle, { paddingBottom: 16 }]}

        position="center"

      >

        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

          Gerar ciclo

        </Text>

        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>

          Escolha como preencher as semanas do ciclo.

        </Text>

        <View style={{ gap: 10, marginTop: 12 }}>

          <Pressable

            onPress={() => handleGenerateAction("fill")}

            disabled={isSavingPlans}

            style={{

              paddingVertical: 12,

              borderRadius: 12,

              alignItems: "center",

              backgroundColor: colors.secondaryBg,

              borderWidth: 1,

              borderColor: colors.border,

            }}

          >

            <Text style={{ color: colors.text, fontWeight: "700" }}>

              Completar faltantes

            </Text>

          </Pressable>

          <Pressable

            onPress={() => handleGenerateAction("auto")}

            disabled={isSavingPlans}

            style={{

              paddingVertical: 12,

              borderRadius: 12,

              alignItems: "center",

              backgroundColor: colors.primaryBg,

            }}

          >

            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>

              Regerar apenas AUTO

            </Text>

          </Pressable>

          <Pressable

            onPress={() => handleGenerateAction("all")}

            disabled={isSavingPlans}

            style={{

              paddingVertical: 12,

              borderRadius: 12,

              alignItems: "center",

              backgroundColor: colors.dangerSolidBg,

            }}

          >

            <Text style={{ color: colors.dangerSolidText, fontWeight: "700" }}>

              Regerar tudo (AUTO + MANUAL)

            </Text>

          </Pressable>

        </View>

      </ModalSheet>



      <ModalSheet

        visible={showWeekEditor}

        onClose={() => setShowWeekEditor(false)}

        cardStyle={[
          modalCardStyle,
          {
            paddingBottom: 0,
            maxHeight: "92%",
            height: "92%",
            minHeight: 0,
            overflow: "hidden",
          },
        ]}

        position="center"

      >

        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>

          <View>

            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

              {"Semana " + editingWeek}

            </Text>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              {normalizeText(selectedClass?.name ?? "Turma")}

            </Text>

          </View>

          <Pressable

            onPress={() => setShowWeekEditor(false)}

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

        <View style={{ flex: 1, minHeight: 0, marginTop: 16 }}>
          <ScrollView
            contentContainerStyle={{
              gap: 10,
              paddingBottom: 32,
              paddingHorizontal: 12,
            }}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Fase")}
              </Text>

              <TextInput

                placeholder={normalizeText("Fase (ex: Base, Recuperação)")}

                value={editPhase}

                onChangeText={setEditPhase}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Tema")}
              </Text>

              <TextInput

                placeholder={normalizeText("Tema (ex: Manchete, Saque)")}

                value={editTheme}

                onChangeText={setEditTheme}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Foco técnico")}
              </Text>

              <TextInput

                placeholder={normalizeText("Foco técnico")}

                value={editTechnicalFocus}

                onChangeText={setEditTechnicalFocus}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Foco físico")}
              </Text>

              <TextInput

                placeholder={normalizeText("Foco físico")}

                value={editPhysicalFocus}

                onChangeText={setEditPhysicalFocus}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

          </View>

          <View style={{ gap: 4 }}>

            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {normalizeText("Restrições")}
            </Text>

            <TextInput

              placeholder={normalizeText("Restrições / regras")}

              value={editConstraints}

              onChangeText={setEditConstraints}

              multiline

              textAlignVertical="top"

              placeholderTextColor={colors.placeholder}

              style={{

                borderWidth: 1,

                borderColor: colors.border,

                padding: 10,

                borderRadius: 12,

                backgroundColor: colors.inputBg,

                minHeight: 84,

                color: colors.inputText,

                fontSize: 13,

              }}

            />

          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Formato MV")}
              </Text>

              <TextInput

                placeholder={normalizeText("Formato MV (ex: 2x2, 3x3)")}

                value={editMvFormat}

                onChangeText={setEditMvFormat}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Warmup profile")}
              </Text>

              <TextInput

                placeholder={normalizeText("Warmup profile")}

                value={editWarmupProfile}

                onChangeText={setEditWarmupProfile}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("Jump target")}
              </Text>

              <TextInput

                placeholder={normalizeText("Saltos alvo (ex: 20-40)")}

                value={editJumpTarget}

                onChangeText={setEditJumpTarget}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

            <View style={{ flex: 1, minWidth: 160, gap: 4 }}>

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {normalizeText("PSE target")}
              </Text>

              <TextInput

                placeholder={normalizeText("PSE alvo (0-10, ex: 3-4)")}

                value={editPSETarget}

                onChangeText={setEditPSETarget}

                placeholderTextColor={colors.placeholder}

                style={{

                  borderWidth: 1,

                  borderColor: colors.border,

                  padding: 10,

                  borderRadius: 12,

                  backgroundColor: colors.inputBg,

                  color: colors.inputText,

                  fontSize: 13,

                }}

              />

            </View>

          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

            {(["AUTO", "MANUAL"] as const).map((value) => {

              const active = editSource === value;

              return (

                <Pressable

                  key={value}

                  onPress={() => setEditSource(value)}

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

          <View style={{ gap: 8 }}>

            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {normalizeText("Ações rápidas")}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

              <Pressable

                onPress={() =>

                  confirmDialog({

                    title: normalizeText("Resetar para AUTO?"),

                    message: normalizeText(
                      "O plano volta para o modelo automático desta semana."
                    ),

                    confirmLabel: normalizeText("Resetar"),

                    cancelLabel: normalizeText("Cancelar"),

                    onConfirm: () => resetWeekToAuto(),

                  })

                }

                style={{

                  paddingVertical: 8,

                  paddingHorizontal: 12,

                  borderRadius: 999,

                  backgroundColor: colors.secondaryBg,

                }}

              >

                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>

                  Resetar para AUTO

                </Text>

              </Pressable>

              <Pressable

                onPress={() => applyDraftToWeeks([editingWeek + 1])}

                disabled={editingWeek >= cycleLength}

                style={{

                  paddingVertical: 8,

                  paddingHorizontal: 12,

                  borderRadius: 999,

                  backgroundColor:

                    editingWeek >= cycleLength ? colors.primaryDisabledBg : colors.primaryBg,

                }}

              >

                <Text

                  style={{

                    color:

                      editingWeek >= cycleLength ? colors.secondaryText : colors.primaryText,

                    fontSize: 12,

                    fontWeight: "700",

                  }}

                >

                  Duplicar semana

                </Text>

              </Pressable>

              <Pressable

                onPress={() => applyDraftToWeeks([editingWeek + 1])}

                disabled={editingWeek >= cycleLength}

                style={{

                  paddingVertical: 8,

                  paddingHorizontal: 12,

                  borderRadius: 999,

                  backgroundColor:

                    editingWeek >= cycleLength ? colors.primaryDisabledBg : colors.primaryBg,

                }}

              >

                <Text

                  style={{

                    color:

                      editingWeek >= cycleLength ? colors.secondaryText : colors.primaryText,

                    fontSize: 12,

                    fontWeight: "700",

                  }}

                >

                  Copiar para próxima

                </Text>

              </Pressable>

            </View>

          </View>

          <View style={{ gap: 8 }}>

            <Text style={{ color: colors.muted, fontSize: 12 }}>

              Aplicar estrutura para outras semanas

            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

              {Array.from({ length: cycleLength }, (_, index) => index + 1).map((week) => {

                const active = applyWeeks.includes(week);

                const disabled = week === editingWeek;

                return (

                  <Pressable

                    key={`apply-week-${week}`}

                    onPress={() => {

                      if (disabled) return;

                      setApplyWeeks((prev) =>

                        prev.includes(week)

                          ? prev.filter((item) => item !== week)

                          : [...prev, week]

                      );

                    }}

                    style={{

                      paddingVertical: 6,

                      paddingHorizontal: 10,

                      borderRadius: 999,

                      backgroundColor: disabled

                        ? colors.secondaryBg

                        : active

                          ? colors.primaryBg

                          : colors.card,

                      borderWidth: 1,

                      borderColor: colors.border,

                      opacity: disabled ? 0.6 : 1,

                    }}

                  >

                    <Text

                      style={{

                        color: active ? colors.primaryText : colors.text,

                        fontSize: 12,

                        fontWeight: active ? "700" : "500",

                      }}

                    >

                      {week}

                    </Text>

                  </Pressable>

                );

              })}

            </View>

            <Pressable

              onPress={() => applyDraftToWeeks(applyWeeks)}

              disabled={!applyWeeks.length}

              style={{

                paddingVertical: 10,

                borderRadius: 12,

                alignItems: "center",

                backgroundColor: applyWeeks.length ? colors.primaryBg : colors.primaryDisabledBg,

              }}

            >

              <Text

                style={{

                  color: applyWeeks.length ? colors.primaryText : colors.secondaryText,

                  fontWeight: "700",

                }}

              >

                Aplicar semanas selecionadas

              </Text>

            </Pressable>

          </View>

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

          <Pressable

            onPress={handleSaveWeek}

            disabled={isSavingWeek}

            style={{

              paddingVertical: 10,

              borderRadius: 12,

              alignItems: "center",

              backgroundColor: isSavingWeek ? colors.primaryDisabledBg : colors.primaryBg,

            }}

          >

            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>

              {isSavingWeek ? "Salvando..." : "Salvar plano"}

            </Text>

          </Pressable>

          </ScrollView>
        </View>

      </ModalSheet>

    </SafeAreaView>

  );

}






