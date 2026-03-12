import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.js";

import { useLocalSearchParams, useRouter } from "expo-router";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Alert, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "../../src/ui/Pressable";



import { useCopilotActions, useCopilotContext } from "../../src/copilot/CopilotProvider";
import { normalizeAgeBand, parseAgeBandRange } from "../../src/core/age-band";
import {
  buildCompetitiveClassPlan,
  buildCompetitiveWeekMeta,
  isCompetitivePlanningMode,
  toCompetitiveClassPlans,
} from "../../src/core/competitive-periodization";
import {
  buildElCartelCalendarExceptions,
  buildElCartelClassPlans,
  buildElCartelCompetitiveProfile,
} from "../../src/core/elcartel-periodization";
import {
  formatPlannedLoad,
  getPlannedLoads,
} from "../../src/core/periodization-load";

import type {
  ClassCalendarException,
  ClassCompetitiveProfile,
  ClassGroup,
  ClassPlan,
} from "../../src/core/models";

import { normalizeUnitKey } from "../../src/core/unit-key";

import {
  createClassPlan,
  deleteClassCalendarException,
  deleteClassCompetitiveProfile,
  deleteClassPlansByClass,
  deleteTrainingPlansByClassAndDate,
  getClassCalendarExceptions,
  getClassCompetitiveProfile,
  getClasses,

  getClassPlansByClass,

  getSessionLogsByRange,
  saveClassCalendarException,
  saveClassCompetitiveProfile,
  saveClassPlans,
  saveTrainingPlan,
  updateClassAcwrLimits,

  updateClassPlan,
} from "../../src/db/seed";
import { useOrganization } from "../../src/providers/OrganizationProvider";

import { logAction } from "../../src/observability/breadcrumbs";

import { markRender, measure, measureAsync } from "../../src/observability/perf";

import { exportPdf, safeFileName } from "../../src/pdf/export-pdf";

import { PeriodizationDocument } from "../../src/pdf/periodization-document";

import { periodizationHtml } from "../../src/pdf/templates/periodization";

import { AnchoredDropdown } from "../../src/ui/AnchoredDropdown";

import { type ThemeColors, useAppTheme } from "../../src/ui/app-theme";

import { ClassGenderBadge } from "../../src/ui/ClassGenderBadge";
import { useConfirmDialog } from "../../src/ui/confirm-dialog";


import { ModalSheet } from "../../src/ui/ModalSheet";

import { getSectionCardStyle } from "../../src/ui/section-styles";

import { getUnitPalette } from "../../src/ui/unit-colors";

import { useCollapsibleAnimation } from "../../src/ui/use-collapsible";

import { useModalCardStyle } from "../../src/ui/use-modal-card-style";

import { usePersistedState } from "../../src/ui/use-persisted-state";



type VolumeLevel = "baixo" | "médio" | "alto";

type PeriodizationModel = "iniciacao" | "formacao" | "competitivo";

type SportProfile = "voleibol" | "futebol" | "basquete" | "funcional";



type WeekPlan = {

  week: number;

  title: string;

  focus: string;

  volume: VolumeLevel;

  notes: string[];

  dateRange?: string;

  sessionDatesLabel?: string;

  jumpTarget: string;

  PSETarget: string;

  plannedSessionLoad: number;

  plannedWeeklyLoad: number;

  source: "AUTO" | "MANUAL";

};

type WeekTemplate = Pick<WeekPlan, "week" | "title" | "focus" | "volume" | "notes">;

type ImportedPlanRow = {
  date: string;
  title: string;
  tags: string;
  warmup: string;
  main: string;
  cooldown: string;
  warmup_time: string;
  main_time: string;
  cooldown_time: string;
};

const xlsxWithCodepage = XLSX as typeof XLSX & {
  set_cptable?: (value: unknown) => void;
};
if (typeof xlsxWithCodepage.set_cptable === "function") {
  xlsxWithCodepage.set_cptable(cptable);
}



const ageBands = ["06-08", "09-11", "12-14"] as const;

const cycleOptions = [2, 3, 4, 5, 6, 8, 10, 12, 18] as const;

const sessionsOptions = [

  2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,

] as const;

const volumeOrder: VolumeLevel[] = ["baixo", "médio", "alto"];

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const dayNumbersByLabelIndex = [1, 2, 3, 4, 5, 6, 0];

const weekAgendaDayOrder = [0, 1, 2, 3, 4, 5, 6];



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

  plannedSessionLoad: 0,

  plannedWeeklyLoad: 0,

  source: "AUTO",

};

const volumeToRatio: Record<VolumeLevel, number> = {

  baixo: 0.35,

  "médio": 0.65,

  alto: 0.9,

};

const splitSegmentLengths = (total: number, parts: number) => {
  if (total <= 0 || parts <= 0) return [] as number[];
  const base = Math.floor(total / parts);
  let remainder = total % parts;
  const lengths: number[] = [];
  for (let i = 0; i < parts; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    lengths.push(Math.max(1, base + extra));
  }
  return lengths;
};

const getDemandIndexForModel = (
  volume: VolumeLevel,
  model: PeriodizationModel,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
) => {
  const frequencyDelta = sessionsPerWeek <= 1 ? -1 : sessionsPerWeek >= 3 ? 1 : 0;
  const sportDelta = sport === "funcional" ? -1 : sport === "futebol" || sport === "basquete" ? 1 : 0;
  if (model === "iniciacao") {
    const base = volume === "alto" ? 5 : volume === "médio" ? 4 : 3;
    return Math.max(2, Math.min(6, base + frequencyDelta + Math.min(0, sportDelta)));
  }
  if (model === "formacao") {
    const base = volume === "alto" ? 7 : volume === "médio" ? 6 : 4;
    return Math.max(3, Math.min(8, base + frequencyDelta + sportDelta));
  }
  const base = Math.round(volumeToRatio[volume] * 10);
  return Math.max(4, Math.min(10, base + frequencyDelta + sportDelta));
};

const getLoadLabelForModel = (volume: VolumeLevel, model: PeriodizationModel) => {
  if (model === "iniciacao" && volume === "alto") return "Média";
  if (volume === "alto") return "Alta";
  if (volume === "médio") return "Média";
  return "Baixa";
};

const resolveSportProfile = (modality: string | null | undefined): SportProfile => {
  const normalized = normalizeText(String(modality ?? "")).toLowerCase().trim();
  if (normalized.includes("fut")) return "futebol";
  if (normalized.includes("basq")) return "basquete";
  if (normalized.includes("func")) return "funcional";
  return "voleibol";
};

const getSportLabel = (sport: SportProfile) => {
  if (sport === "futebol") return "futebol";
  if (sport === "basquete") return "basquete";
  if (sport === "funcional") return "treinamento funcional";
  return "voleibol";
};

const normalizeImportDate = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
};

const detectImportDelimiter = (value: string) => {
  const firstLine =
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

const parseDelimitedImportRows = (value: string, delimiter: "," | ";"): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (inQuotes) {
      if (char === '"' && value[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

const normalizeImportHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const IMPORT_ALIAS_MAP: Record<keyof ImportedPlanRow, string[]> = {
  date: ["date", "data", "dia", "data inicio", "data aplicacao"],
  title: ["title", "titulo", "titulo do planejamento", "nome", "planejamento", "atividade"],
  tags: ["tags", "tag", "etiquetas"],
  warmup: ["warmup", "aquecimento"],
  main: ["main", "parte principal", "principal"],
  cooldown: ["cooldown", "volta a calma", "volta calma"],
  warmup_time: ["warmup time", "warmup_time", "tempo aquecimento"],
  main_time: ["main time", "main_time", "tempo principal"],
  cooldown_time: ["cooldown time", "cooldown_time", "tempo volta calma", "tempo volta a calma"],
};

const resolveImportKey = (value: string): keyof ImportedPlanRow | "" => {
  const normalized = normalizeImportHeader(value);
  for (const [key, aliases] of Object.entries(IMPORT_ALIAS_MAP)) {
    if (aliases.includes(normalized)) return key as keyof ImportedPlanRow;
  }
  return "";
};

const parseImportRowsFromMatrix = (rows: string[][]): ImportedPlanRow[] => {
  const nonEmptyRows = rows.filter((items) => items.some((value) => String(value ?? "").trim()));
  if (!nonEmptyRows.length) return [];

  const firstRow = nonEmptyRows[0] ?? [];
  const firstResolved = firstRow.map(resolveImportKey).filter(Boolean);
  const hasHeader = firstResolved.length >= 2;
  const dataRows = hasHeader ? nonEmptyRows.slice(1) : nonEmptyRows;
  const headerKeys = hasHeader ? firstRow.map(resolveImportKey) : [];
  const todayIso = new Date().toISOString().slice(0, 10);

  return dataRows
    .map((items) => {
      const row: ImportedPlanRow = {
        date: "",
        title: "",
        tags: "",
        warmup: "",
        main: "",
        cooldown: "",
        warmup_time: "",
        main_time: "",
        cooldown_time: "",
      };

      if (hasHeader) {
        headerKeys.forEach((key, index) => {
          if (!key) return;
          const cell = String(items[index] ?? "").trim();
          row[key] = key === "date" ? normalizeImportDate(cell) : cell;
        });
      } else {
        const cells = items.map((cell) => String(cell ?? "").trim());
        row.date = normalizeImportDate(cells[0] ?? "");
        row.title = cells[1] ?? "";
        row.tags = cells[2] ?? "";
        row.warmup = cells[3] ?? "";
        row.main = cells[4] ?? "";
        row.cooldown = cells[5] ?? "";
        row.warmup_time = cells[6] ?? "";
        row.main_time = cells[7] ?? "";
        row.cooldown_time = cells[8] ?? "";
      }

      if (!row.date) row.date = todayIso;
      return row;
    })
    .filter((row) => Boolean(row.title.trim()));
};

const splitImportList = (value: string) =>
  String(value ?? "")
    .split(/\r?\n|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);



type SectionKey =

  | "load"

  | "guides"

  | "cycle"

  | "week";

type CompetitiveBlockKey = "profile" | "calendar" | "exceptions";



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

const getPhaseTrackPalette = (phase: string, colors: ThemeColors) => {
  const normalized = normalizeText(phase).toLowerCase();
  if (normalized.includes("recuper")) {
    return { bg: colors.successBg, text: colors.successText };
  }
  if (
    normalized.includes("base") ||
    normalized.includes("prepara") ||
    normalized.includes("desenvol") ||
    normalized.includes("consol")
  ) {
    return { bg: colors.warningBg, text: colors.warningText };
  }
  if (normalized.includes("compet")) {
    return { bg: colors.dangerBg, text: colors.dangerText };
  }
  return { bg: colors.secondaryBg, text: colors.text };
};



const basePlans: Record<(typeof ageBands)[number], WeekTemplate[]> = {

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

const formatDateInputMask = (value: string) => {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const parseDateInputToIso = (value: string | null) => {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  const isValid =
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day;
  if (!isValid) return null;

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const formatDateForInput = (value: string | null) => {
  if (!value) return "";
  const iso = parseDateInputToIso(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
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
  if (!/[\uFFFD?]/.test(current)) return current;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      current = decodeURIComponent(escape(current));
    } catch {
      break;
    }
    if (!/[\uFFFD?]/.test(current)) break;
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



const getPhaseForWeek = (
  weekNumber: number,
  cycleLength: number,
  model: PeriodizationModel = "competitivo",
  sport: SportProfile = "voleibol"
) => {
  if (model === "iniciacao") {
    if (sport === "funcional") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Coordenação geral";
      if (weekNumber <= chunk * 2) return "Padrões básicos";
      return "Consolidação funcional";
    }
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Exploração motora";
    if (weekNumber <= chunk * 2) return "Fundamentos básicos";
    return "Consolidação lúdica";
  }

  if (model === "formacao") {
    if (sport === "futebol") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Base técnica";
      if (weekNumber <= chunk * 2) return "Desenvolvimento tático";
      return "Integração de jogo";
    }
    if (sport === "basquete") {
      const chunk = Math.max(1, Math.ceil(cycleLength / 3));
      if (weekNumber <= chunk) return "Fundamentos de quadra";
      if (weekNumber <= chunk * 2) return "Tomada de decisão";
      return "Integração coletiva";
    }
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Base técnica";
    if (weekNumber <= chunk * 2) return "Desenvolvimento técnico";
    return "Integração tática";
  }

  if (sport !== "voleibol") {
    const chunk = Math.max(1, Math.ceil(cycleLength / 3));
    if (weekNumber <= chunk) return "Base";
    if (weekNumber <= chunk * 2) return sport === "funcional" ? "Progressão funcional" : "Desenvolvimento";
    return sport === "funcional" ? "Consolidação" : "Competição";
  }

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



const getPSETarget = (
  phase: string,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
) => {
  const normalized = normalizeText(phase).toLowerCase();

  const adjustByFrequency = (target: string) => {
    if (sessionsPerWeek > 1) return target;
    if (target === "6-7") return "5-6";
    if (target === "5-6") return "4-5";
    if (target === "4-5") return "3-4";
    return target;
  };

  if (normalized.includes("explor") || normalized.includes("ludic")) return adjustByFrequency("3-4");
  if (normalized.includes("fundamento")) return adjustByFrequency("4-5");
  if (normalized.includes("base tecnica")) return adjustByFrequency("4-5");
  if (normalized.includes("desenvolvimento tecnico") || normalized.includes("integracao tatica")) return adjustByFrequency("5-6");

  if (phase === "Base") return adjustByFrequency("4-5");

  if (phase === "Desenvolvimento") return adjustByFrequency("5-6");

  const base = adjustByFrequency("6-7");
  if (sport === "funcional") {
    if (base === "6-7") return "5-6";
    if (base === "5-6") return "4-5";
  }
  return base;

};

const getVolumeForModel = (
  volume: VolumeLevel,
  model: PeriodizationModel,
  sessionsPerWeek = 2,
  sport: SportProfile = "voleibol"
): VolumeLevel => {
  if (model === "iniciacao") {
    if (sessionsPerWeek <= 1 && volume !== "baixo") return "baixo";
    if (volume === "alto") return "médio";
    if (sport === "funcional" && volume === "médio") return "baixo";
    return volume;
  }
  if (model === "formacao") {
    if (sessionsPerWeek <= 1 && volume === "alto") return "médio";
    if (sport === "funcional" && volume === "alto") return "médio";
    return volume;
  }
  if (sport === "funcional" && volume === "alto") return "médio";
  return volume;
};

const getVolumeFromTargets = (phase: string, rpeTarget: string): VolumeLevel => {
  const normalizedRpe = normalizeText(rpeTarget).toLowerCase();
  const normalizedPhase = normalizeText(phase).toLowerCase();
  if (
    normalizedRpe.includes("6-7") ||
    normalizedRpe.includes("6 a 7") ||
    normalizedPhase.includes("pre-compet") ||
    normalizedPhase.includes("pre compet")
  ) {
    return "alto";
  }
  if (
    normalizedRpe.includes("5-6") ||
    normalizedRpe.includes("5 a 6") ||
    normalizedPhase.includes("desenvolvimento")
  ) {
    return "médio";
  }
  return "baixo";
};

type AcwrValidationResult =
  | { ok: false; message: string }
  | { ok: true; message: string; highValue: number; lowValue: number };

const isIsoDateValue = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value.trim());



const validateAcwrLimits = (next: { high: string; low: string }): AcwrValidationResult => {

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

  model: PeriodizationModel;

  sessionsPerWeek: number;

  sport: SportProfile;

}): ClassPlan => {

  const base = basePlans[options.ageBand] ?? basePlans["09-11"];

  const template = base[(options.weekNumber - 1) % base.length];

  const phase = getPhaseForWeek(

    options.weekNumber,

    options.cycleLength ?? 12,

    options.model,

    options.sport

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

    rpeTarget: getPSETarget(phase, options.sessionsPerWeek, options.sport),

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

  model: PeriodizationModel;

  sessionsPerWeek: number;

  sport: SportProfile;

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

      model: options.model,

      sessionsPerWeek: options.sessionsPerWeek,

      sport: options.sport,

    })

  );

};



export default function PeriodizationScreen() {
  markRender("screen.periodization.render.root");

  const router = useRouter();
  const { classId: initialClassId, unit: initialUnit } = useLocalSearchParams<{
    classId: string;
    unit: string;
  }>();
  const hasInitialClass =
    typeof initialClassId === "string" && initialClassId.trim().length > 0;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { activeOrganization } = useOrganization();
  const isOrgAdmin = (activeOrganization?.role_level ?? 0) >= 50;

  const { confirm: confirmDialog } = useConfirmDialog();

  const modalCardStyle = useModalCardStyle({ maxHeight: "100%" });

  const [activeTab, setActiveTab] = useState<PeriodizationTab>("geral");
  const tabAnim = useRef<Record<PeriodizationTab, Animated.Value>>({
    geral: new Animated.Value(1),
    ciclo: new Animated.Value(0),
    semana: new Animated.Value(0),
  }).current;

  useEffect(() => {
    (Object.keys(tabAnim) as PeriodizationTab[]).forEach((tabKey) => {
      Animated.timing(tabAnim[tabKey], {
        toValue: activeTab === tabKey ? 1 : 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    });
  }, [activeTab, tabAnim]);

  useCopilotContext(
    useMemo(
      () => ({
        screen: "periodization_index",
        title: "Periodização",
        subtitle: "Macrociclo, blocos dominantes e demanda semanal",
      }),
      []
    )
  );

  const [sectionOpen, setSectionOpen] = usePersistedState<Record<SectionKey, boolean>>(

    "periodization_sections_v1",

    {

      load: true,

      guides: false,

      cycle: false,

      week: true,

    }

  );
  const [competitiveBlocksOpen, setCompetitiveBlocksOpen] = usePersistedState<
    Record<CompetitiveBlockKey, boolean>
  >("periodization_competitive_blocks_v1", {
    profile: true,
    calendar: true,
    exceptions: true,
  });
  const [customCycleTitles, setCustomCycleTitles] = usePersistedState<Record<string, string>>(
    "periodization_cycle_titles_v1",
    {}
  );
  const [isEditingCycleTitle, setIsEditingCycleTitle] = useState(false);
  const [cycleTitleDraft, setCycleTitleDraft] = useState("");

  const [ageBand, setAgeBand] = useState<(typeof ageBands)[number]>("09-11");

  const [cycleLength, setCycleLength] = useState<(typeof cycleOptions)[number]>(12);

  const [sessionsPerWeek, setSessionsPerWeek] = useState<(typeof sessionsOptions)[number]>(2);

  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const [selectedUnit, setSelectedUnit] = useState("");

  const [selectedClassId, setSelectedClassId] = useState("");

  const [competitiveProfile, setCompetitiveProfile] = useState<ClassCompetitiveProfile | null>(
    null
  );
  const [calendarExceptions, setCalendarExceptions] = useState<ClassCalendarException[]>([]);
  const [isSavingCompetitiveProfile, setIsSavingCompetitiveProfile] = useState(false);
  const [isSavingCalendarException, setIsSavingCalendarException] = useState(false);
  const [exceptionDateInput, setExceptionDateInput] = useState("");
  const [exceptionReasonInput, setExceptionReasonInput] = useState("");
  const [competitiveTargetDateInput, setCompetitiveTargetDateInput] = useState("");
  const [competitiveCycleStartDateInput, setCompetitiveCycleStartDateInput] = useState("");

  const [allowEmptyClass, setAllowEmptyClass] = useState(false);

  const [didApplyParams, setDidApplyParams] = useState(false);

  const [unitMismatchWarning, setUnitMismatchWarning] = useState("");

  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  const [showDayModal, setShowDayModal] = useState(false);

  const [classPlans, setClassPlans] = useState<ClassPlan[]>([]);

  const [isSavingPlans, setIsSavingPlans] = useState(false);

  const [showGenerateModal, setShowGenerateModal] = useState(false);

  const [showWeekEditor, setShowWeekEditor] = useState(false);
  const [agendaWeekNumber, setAgendaWeekNumber] = useState<number | null>(null);

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
  const [isImportingPlansFile, setIsImportingPlansFile] = useState(false);
  const [showPlanActionsModal, setShowPlanActionsModal] = useState(false);

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
  const competitiveScrollRef = useRef<ScrollView>(null);

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

  const scrollToCompetitiveBlock = useCallback((key: CompetitiveBlockKey) => {
    const targetByKey: Record<CompetitiveBlockKey, number> = {
      profile: 0,
      calendar: 120,
      exceptions: 260,
    };
    setTimeout(() => {
      competitiveScrollRef.current?.scrollTo({ y: targetByKey[key], animated: true });
    }, 220);
  }, []);

  const toggleCompetitiveBlock = useCallback((key: CompetitiveBlockKey) => {
    setCompetitiveBlocksOpen((prev) => {
      const nextValue = !prev[key];
      if (nextValue) {
        scrollToCompetitiveBlock(key);
      }
      return {
        profile: false,
        calendar: false,
        exceptions: false,
        [key]: nextValue,
      };
    });
  }, [scrollToCompetitiveBlock, setCompetitiveBlocksOpen]);



  const { animatedStyle: loadAnimStyle, isVisible: showLoadContent } =

    useCollapsibleAnimation(sectionOpen.load);

  const { animatedStyle: guideAnimStyle, isVisible: showGuideContent } =

    useCollapsibleAnimation(sectionOpen.guides);

  const { animatedStyle: cycleAnimStyle, isVisible: showCycleContent } =

    useCollapsibleAnimation(sectionOpen.cycle);

  const { animatedStyle: weekAnimStyle, isVisible: showWeekContent } =

    useCollapsibleAnimation(sectionOpen.week);

  const {
    animatedStyle: competitiveProfileAnimStyle,
    isVisible: showCompetitiveProfileContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.profile);

  const {
    animatedStyle: competitiveCalendarAnimStyle,
    isVisible: showCompetitiveCalendarContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.calendar);

  const {
    animatedStyle: competitiveExceptionsAnimStyle,
    isVisible: showCompetitiveExceptionsContent,
  } = useCollapsibleAnimation(competitiveBlocksOpen.exceptions);

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

        classTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setClassTriggerLayout({ x, y, width, height });

        });

      }

      if (showUnitPicker) {

        unitTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setUnitTriggerLayout({ x, y, width, height });

        });

      }

      if (showMesoPicker) {

        mesoTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setMesoTriggerLayout({ x, y, width, height });

        });

      }

      if (showMicroPicker) {

        microTriggerRef.current?.measureInWindow((x, y, width, height) => {

          setMicroTriggerLayout({ x, y, width, height });

        });

      }

      containerRef.current?.measureInWindow((x, y) => {

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

    if (!showMesoPicker) return;

    requestAnimationFrame(() => {

      mesoTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setMesoTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMesoPicker]);



  useEffect(() => {

    if (!showMicroPicker) return;

    requestAnimationFrame(() => {

      microTriggerRef.current?.measureInWindow((x, y, width, height) => {

        setMicroTriggerLayout({ x, y, width, height });

      });

    });

  }, [showMicroPicker]);



  useEffect(() => {

    if (!showUnitPicker && !showClassPicker && !showMesoPicker && !showMicroPicker) return;

    requestAnimationFrame(() => {

      containerRef.current?.measureInWindow((x, y) => {

        setContainerWindow({ x, y });

      });

    });

  }, [showUnitPicker, showClassPicker, showMesoPicker, showMicroPicker]);



  useEffect(() => {

    let alive = true;

    (async () => {

      const data = await measureAsync(
        "screen.periodization.load.classes",
        () => getClasses(),
        { screen: "periodization" }
      );

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
  const isCompetitiveMode = isCompetitivePlanningMode(competitiveProfile?.planningMode);
  const activeCycleStartDate =
    competitiveProfile?.cycleStartDate?.trim() ||
    selectedClass?.cycleStartDate ||
    formatIsoDate(new Date());
  const chatbotConflictBottom = Math.max(insets.bottom + 92, 108);
  const plansFabBottom = Math.max(insets.bottom + 166, 182);
  const plansFabRight = 16;
  const plansFabPositionStyle =
    Platform.OS === "web"
      ? ({ position: "fixed", right: plansFabRight, bottom: plansFabBottom } as any)
      : { position: "absolute" as const, right: plansFabRight, bottom: plansFabBottom };

  const classNameLabel = normalizeText(selectedClass?.name ?? "Turma");
  const classUnitLabel = normalizeText(
    selectedClass?.unit ?? (selectedUnit || "Selecione")
  );
  const classAgeBandLabel = normalizeText(selectedClass?.ageBand ?? "09-11");
  const classGenderLabel = selectedClass?.gender ?? "misto";
  const classStartTimeLabel = selectedClass?.startTime
    ? normalizeText(`Horário ${selectedClass.startTime}`)
    : normalizeText("Horário indefinido");
  const sportProfile = useMemo<SportProfile>(
    () => resolveSportProfile(selectedClass?.modality ?? "voleibol"),
    [selectedClass?.modality]
  );
  const sportLabel = useMemo(() => getSportLabel(sportProfile), [sportProfile]);
  const weeklySessions = useMemo(() => {
    const classDays = selectedClass?.daysOfWeek?.length ?? 0;
    return Math.max(1, classDays || sessionsPerWeek || 2);
  }, [selectedClass, sessionsPerWeek]);
  const periodizationModel = useMemo<PeriodizationModel>(() => {
    if (isCompetitiveMode) return "competitivo";
    if (ageBand === "12-14") return "formacao";
    return "iniciacao";
  }, [ageBand, isCompetitiveMode]);
  const baseCyclePanelTitle = useMemo(() => {
    if (periodizationModel === "iniciacao") {
      return `Macrociclo — Desenvolvimento motor da ${classNameLabel}`;
    }
    if (periodizationModel === "formacao") {
      return `Macrociclo — Formação técnico-tática da ${classNameLabel}`;
    }
    const target = normalizeText(competitiveProfile?.targetCompetition ?? "").trim();
    if (target) return `Macrociclo — Preparação para ${target}`;
    return `Macrociclo — Preparação competitiva de ${sportLabel} da ${classNameLabel}`;
  }, [classNameLabel, competitiveProfile?.targetCompetition, periodizationModel, sportLabel]);
  const cyclePanelTitle = useMemo(() => {
    const custom = selectedClassId ? normalizeText(customCycleTitles[selectedClassId] ?? "").trim() : "";
    return custom || baseCyclePanelTitle;
  }, [baseCyclePanelTitle, customCycleTitles, selectedClassId]);

  const openCycleTitleEditor = useCallback(() => {
    if (!selectedClassId) return;
    setCycleTitleDraft(cyclePanelTitle);
    setIsEditingCycleTitle(true);
  }, [cyclePanelTitle, selectedClassId]);

  const cancelCycleTitleEditor = useCallback(() => {
    setCycleTitleDraft(cyclePanelTitle);
    setIsEditingCycleTitle(false);
  }, [cyclePanelTitle]);

  const saveCycleTitleEditor = useCallback(() => {
    if (!selectedClassId) {
      setIsEditingCycleTitle(false);
      return;
    }
    const next = normalizeText(cycleTitleDraft).trim();
    setCustomCycleTitles((prev) => {
      const copy = { ...prev };
      if (!next || next === baseCyclePanelTitle) {
        delete copy[selectedClassId];
      } else {
        copy[selectedClassId] = next;
      }
      return copy;
    });
    setIsEditingCycleTitle(false);
  }, [baseCyclePanelTitle, cycleTitleDraft, selectedClassId, setCustomCycleTitles]);

  useEffect(() => {
    if (!selectedClassId) {
      setCompetitiveProfile(null);
      setCalendarExceptions([]);
      setExceptionDateInput("");
      setExceptionReasonInput("");
      setCompetitiveTargetDateInput("");
      setCompetitiveCycleStartDateInput("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [profile, exceptions] = await Promise.all([
          getClassCompetitiveProfile(selectedClassId, {
            organizationId: activeOrganization?.id ?? null,
          }),
          getClassCalendarExceptions(selectedClassId, {
            organizationId: activeOrganization?.id ?? null,
          }),
        ]);
        if (cancelled) return;
        setCompetitiveProfile(profile);
        setCalendarExceptions(exceptions);
        setExceptionDateInput("");
        setExceptionReasonInput("");
      } catch (error) {
        if (cancelled) return;
        setCompetitiveProfile(null);
        setCalendarExceptions([]);
        logAction("periodization_competitive_load_failed", {
          classId: selectedClassId,
          organizationId: activeOrganization?.id ?? null,
          error: String(error),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrganization?.id, selectedClassId]);

  useEffect(() => {
    if (!selectedClass) {
      setCompetitiveTargetDateInput("");
      setCompetitiveCycleStartDateInput("");
      return;
    }

    setCompetitiveTargetDateInput(formatDateForInput(competitiveProfile?.targetDate ?? ""));
    setCompetitiveCycleStartDateInput(
      formatDateForInput(
        competitiveProfile?.cycleStartDate ?? selectedClass.cycleStartDate ?? formatIsoDate(new Date())
      )
    );
  }, [competitiveProfile?.cycleStartDate, competitiveProfile?.targetDate, selectedClass]);

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

      const plans = await measureAsync(
        "screen.periodization.load.classPlans",
        () => getClassPlansByClass(selectedClassId),
        { screen: "periodization", classId: selectedClassId }
      );

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

      const logs = await measureAsync(
        "screen.periodization.load.sessionLogs",
        () => getSessionLogsByRange(start.toISOString(), end.toISOString()),
        { screen: "periodization", classId: selectedClassId }
      );

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



  const competitivePreviewPlans = useMemo(() => {
    if (!selectedClass || !isCompetitiveMode) return [];
    return toCompetitiveClassPlans({
      classId: selectedClass.id,
      cycleLength,
      cycleStartDate: activeCycleStartDate,
      daysOfWeek: selectedClass.daysOfWeek,
      exceptions: calendarExceptions,
      profile: {
        planningMode: "adulto-competitivo",
        targetCompetition: competitiveProfile?.targetCompetition ?? "",
        tacticalSystem: competitiveProfile?.tacticalSystem ?? "5x1",
      },
    });
  }, [
    activeCycleStartDate,
    calendarExceptions,
    competitiveProfile?.targetCompetition,
    competitiveProfile?.tacticalSystem,
    cycleLength,
    isCompetitiveMode,
    selectedClass,
  ]);

  const weekPlans = useMemo(() => {
    if (!selectedClass) return [];

    const base = basePlans[ageBand] ?? basePlans["09-11"];
    const sourcePlans = classPlans.length ? classPlans : competitivePreviewPlans;
    const length = sourcePlans.length || cycleLength;
    const durationMinutes = Math.max(15, Number(selectedClass.durationMinutes ?? 60));

    if (sourcePlans.length) {
      return sourcePlans.map((plan, index) => {
        const template = base[index % base.length];
        const normalizedPhase = normalizeText(plan.phase);
        const normalizedTheme = normalizeText(plan.theme);
        const normalizedConstraints = normalizeText(plan.constraints);
        const normalizedWarmup = normalizeText(plan.warmupProfile);
        const normalizedJump = normalizeText(plan.jumpTarget);
        const normalizedRpe = normalizeText(plan.rpeTarget);
        const phaseForPse = normalizedPhase || plan.phase;
        const resolvedPSETarget = normalizedRpe || getPSETarget(phaseForPse, weeklySessions, sportProfile);
        const plannedLoads = getPlannedLoads(resolvedPSETarget, durationMinutes, weeklySessions);
        const meta = isCompetitiveMode
          ? buildCompetitiveWeekMeta({
              weekNumber: plan.weekNumber,
              cycleStartDate: activeCycleStartDate,
              daysOfWeek: selectedClass.daysOfWeek,
              exceptions: calendarExceptions,
            })
          : null;

        return {
          week: plan.weekNumber,
          title: normalizedPhase,
          focus: normalizedTheme,
          volume: isCompetitiveMode
            ? getVolumeFromTargets(plan.phase, plan.rpeTarget)
            : getVolumeForModel(template.volume, periodizationModel, weeklySessions, sportProfile),
          notes: [normalizedConstraints, normalizedWarmup].filter(Boolean),
          dateRange: meta?.dateRangeLabel,
          sessionDatesLabel: meta?.sessionDatesLabel,
          jumpTarget:
            normalizedJump || getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),
          PSETarget: resolvedPSETarget,
          plannedSessionLoad: plannedLoads.plannedSessionLoad,
          plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
          source: plan.source || "AUTO",
        };
      });
    }

    const weeks: WeekPlan[] = [];

    for (let i = 0; i < length; i += 1) {
      const template = base[i % base.length];
      const phase = getPhaseForWeek(i + 1, length, periodizationModel, sportProfile);
      const pseTarget = getPSETarget(phase, weeklySessions, sportProfile);
      const plannedLoads = getPlannedLoads(pseTarget, durationMinutes, weeklySessions);
      weeks.push({
        ...template,
        week: i + 1,
        title: phase,
        volume: getVolumeForModel(template.volume, periodizationModel, weeklySessions, sportProfile),
        jumpTarget: getJumpTarget(selectedClass?.mvLevel ?? "", ageBand),
        PSETarget: pseTarget,
        plannedSessionLoad: plannedLoads.plannedSessionLoad,
        plannedWeeklyLoad: plannedLoads.plannedWeeklyLoad,
        source: "AUTO",
      });
    }

    return weeks;
  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    classPlans,
    competitivePreviewPlans,
    cycleLength,
    isCompetitiveMode,
    periodizationModel,
    sportProfile,
    selectedClass,
    weeklySessions,
  ]);



  const filteredWeekPlans = useMemo(() => {

    if (cycleFilter === "all") return weekPlans;

    const target = cycleFilter === "manual" ? "MANUAL" : "AUTO";

    return weekPlans.filter((week) => week.source === target);

  }, [cycleFilter, weekPlans]);



  const periodizationRows = useMemo(() => {
    if (!selectedClass) return [];

    const sourcePlans = classPlans.length ? classPlans : competitivePreviewPlans;

    if (sourcePlans.length) {
      return [...sourcePlans]
        .sort((a, b) => a.weekNumber - b.weekNumber)
        .map((plan) => {
          const meta = isCompetitiveMode
            ? buildCompetitiveWeekMeta({
                weekNumber: plan.weekNumber,
                cycleStartDate: activeCycleStartDate,
                daysOfWeek: selectedClass.daysOfWeek,
                exceptions: calendarExceptions,
              })
            : null;
          return {
            week: plan.weekNumber,
            dateRange: meta?.dateRangeLabel ?? "",
            sessionDates: meta?.sessionDatesLabel ?? "",
            phase: normalizeText(plan.phase),
            theme: normalizeText(plan.theme),
            technicalFocus: normalizeText(plan.technicalFocus),
            physicalFocus: normalizeText(plan.physicalFocus),
            constraints: normalizeText(plan.constraints),
            mvFormat: normalizeText(plan.mvFormat),
            jumpTarget: normalizeText(plan.jumpTarget),
            rpeTarget: normalizeText(plan.rpeTarget),
            source: plan.source,
          };
        });
    }

    return weekPlans.map((week) => ({
      week: week.week,
      dateRange: week.dateRange ?? "",
      sessionDates: week.sessionDatesLabel ?? "",
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
  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    classPlans,
    competitivePreviewPlans,
    isCompetitiveMode,
    selectedClass,
    weekPlans,
  ]);



  const summary = useMemo(() => {
    if (isCompetitiveMode) {
      return [
        "Planejamento competitivo por turma com datas reais",
        `Sistema tatico: ${competitiveProfile?.tacticalSystem?.trim() || "5x1"}`,
        competitiveProfile?.targetCompetition?.trim()
          ? `Competicao-alvo: ${competitiveProfile.targetCompetition.trim()}`
          : "Sem competicao-alvo definida",
      ];
    }

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

  }, [ageBand, competitiveProfile?.targetCompetition, competitiveProfile?.tacticalSystem, isCompetitiveMode]);



  const progressBars = weekPlans.map((week) => volumeToRatio[week.volume]);

  const currentWeek = useMemo(() => {

    const start =
      parseIsoDate(activeCycleStartDate ?? "") ??
      parseIsoDate(classPlans[0]?.startDate ?? "");

    if (!start || !weekPlans.length) return 1;

    const diffDays = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));

    const week = Math.floor(diffDays / 7) + 1;

    return Math.max(1, Math.min(week, weekPlans.length));

  }, [activeCycleStartDate, classPlans, weekPlans.length]);

  const hasWeekPlans = weekPlans.length > 0;

  const cyclePanelCellWidth = 64;
  const cyclePanelCellGap = 6;
  const cyclePanelLabelWidth = 100;
  const cyclePanelRowHeight = 32;
  const cyclePanelRowGap = 5;

  const cyclePanelScrollRef = useRef<ScrollView>(null);
  const weekSwitchOpacity = useRef(new Animated.Value(1)).current;
  const weekSwitchTranslateX = useRef(new Animated.Value(0)).current;
  const weekSwitchDirectionRef = useRef<-1 | 1>(1);

  const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  const monthSegments = useMemo(() => {
    const start =
      parseIsoDate(activeCycleStartDate ?? "") ??
      parseIsoDate(classPlans[0]?.startDate ?? "");
    if (!start || !weekPlans.length) {
      return [{ label: "Ciclo", length: weekPlans.length }] as Array<{ label: string; length: number }>;
    }
    const segments: Array<{ label: string; length: number }> = [];
    weekPlans.forEach((_, idx) => {
      const d = new Date(start.getTime() + idx * 7 * 86400000);
      const label = MONTHS_PT[d.getMonth()];
      const last = segments[segments.length - 1];
      if (last && last.label === label) {
        last.length += 1;
      } else {
        segments.push({ label, length: 1 });
      }
    });
    return segments;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCycleStartDate, classPlans, weekPlans]);

  const macroSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;
    const lengths = splitSegmentLengths(weekPlans.length, 3);
    if (periodizationModel === "iniciacao") {
      return [
        { label: normalizeText("Período de Exploração Motora"), length: lengths[0] ?? 1 },
        { label: normalizeText("Período de Fundamentos Básicos"), length: lengths[1] ?? 1 },
        { label: normalizeText("Período de Consolidação Lúdica"), length: lengths[2] ?? 1 },
      ];
    }
    if (periodizationModel === "formacao") {
      return [
        { label: normalizeText("Período de Base Técnica"), length: lengths[0] ?? 1 },
        { label: normalizeText("Período de Desenvolvimento Técnico"), length: lengths[1] ?? 1 },
        { label: normalizeText("Período de Integração de Jogo"), length: lengths[2] ?? 1 },
      ];
    }
    return [
      { label: normalizeText("Período Preparatório Geral"), length: lengths[0] ?? 1 },
      { label: normalizeText("Período Preparatório Específico"), length: lengths[1] ?? 1 },
      { label: normalizeText("Período Competitivo"), length: lengths[2] ?? 1 },
    ];
  }, [periodizationModel, weekPlans.length]);

  const mesoSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;
    const desiredBlocks = Math.min(4, Math.max(2, Math.ceil(weekPlans.length / 4)));
    const baseSize = Math.floor(weekPlans.length / desiredBlocks);
    let remainder = weekPlans.length % desiredBlocks;
    const segments: Array<{ label: string; length: number }> = [];

    for (let i = 0; i < desiredBlocks; i += 1) {
      const extra = remainder > 0 ? 1 : 0;
      remainder = Math.max(0, remainder - 1);
      const length = Math.max(1, baseSize + extra);
      segments.push({ label: `Meso ${i + 1}`, length });
    }

    return segments;
  }, [weekPlans.length]);

  const mesoWeekNumbers = useMemo(() => {
    const result: number[] = [];
    mesoSegments.forEach((seg) => {
      for (let i = 1; i <= seg.length; i += 1) {
        result.push(i);
      }
    });
    return result;
  }, [mesoSegments]);

  const dominantBlockSegments = useMemo(() => {
    if (!weekPlans.length) return [] as Array<{ label: string; length: number }>;

    if (periodizationModel === "iniciacao") {
      const lengths = splitSegmentLengths(weekPlans.length, 4);
      return [
        { label: normalizeText("Exploração motora"), length: lengths[0] ?? 1 },
        { label: normalizeText("Fundamentos básicos"), length: lengths[1] ?? 1 },
        { label: normalizeText("Jogos reduzidos"), length: lengths[2] ?? 1 },
        { label: normalizeText("Consolidação"), length: lengths[3] ?? 1 },
      ].filter((seg) => seg.length > 0);
    }

    if (periodizationModel === "formacao") {
      const lengths = splitSegmentLengths(weekPlans.length, 3);
      return [
        { label: normalizeText("Base técnica"), length: lengths[0] ?? 1 },
        { label: normalizeText("Desenvolvimento técnico"), length: lengths[1] ?? 1 },
        { label: normalizeText("Integração tática"), length: lengths[2] ?? 1 },
      ].filter((seg) => seg.length > 0);
    }

    const prepGeneral = macroSegments[0]?.length ?? 0;
    const prepSpecific = macroSegments[1]?.length ?? 0;
    const competitive = macroSegments[2]?.length ?? 0;

    const specificDev = Math.max(1, Math.round(prepSpecific * 0.5));
    const specificPower = Math.max(1, prepSpecific - specificDev);
    const compPre = Math.max(1, Math.round(competitive * 0.65));
    const compMain = Math.max(1, competitive - compPre);

    return [
      { label: normalizeText("Base estrutural"), length: Math.max(1, prepGeneral) },
      { label: normalizeText("Desenvolvimento"), length: specificDev },
      { label: normalizeText("Potência específica"), length: specificPower },
      { label: normalizeText("Pré-competitivo"), length: compPre },
      { label: normalizeText("Competitivo"), length: compMain },
    ].filter((seg) => seg.length > 0);
  }, [macroSegments, periodizationModel, weekPlans.length]);

  const periodizationCopilotSnapshot = useMemo(() => {
    const classLabel = normalizeText(selectedClass?.name ?? "Turma ativa");
    const periodSummary = macroSegments
      .map((seg) => `${seg.label} (${seg.length} sem)`)
      .join(" | ");
    const dominantSummary = dominantBlockSegments
      .map((seg) => `${seg.label} (${seg.length} sem)`)
      .join(" | ");
    const nextWeek = weekPlans.find((week) => week.week >= currentWeek) ?? weekPlans[weekPlans.length - 1];
    const nextDemand = nextWeek
      ? `${getDemandIndexForModel(nextWeek.volume, periodizationModel, weeklySessions, sportProfile)}/10`
      : "sem dados";
    const durationMinutes = Math.max(15, Number(selectedClass?.durationMinutes ?? 60));

    return {
      classLabel,
      model: periodizationModel,
      sport: sportProfile,
      sportLabel,
      durationMinutes,
      periodSummary,
      dominantSummary,
      weeks: weekPlans.length,
      currentWeek,
      nextWeekLabel: nextWeek ? `Semana ${nextWeek.week}` : "sem semana ativa",
      nextDemand,
      nextPse: nextWeek ? normalizeText(nextWeek.PSETarget) : "sem meta",
      nextPlannedLoad: nextWeek ? formatPlannedLoad(nextWeek.plannedWeeklyLoad) : "sem carga",
      nextLoad: nextWeek ? getLoadLabelForModel(nextWeek.volume, periodizationModel) : "Baixa",
    };
  }, [
    currentWeek,
    dominantBlockSegments,
    macroSegments,
    periodizationModel,
    selectedClass?.durationMinutes,
    selectedClass?.name,
    sportLabel,
    sportProfile,
    weekPlans,
    weeklySessions,
  ]);

  const periodizationCopilotActions = useMemo(
    () => [
      {
        id: "periodization_review_modern_model",
        title: "Revisar ciclo atual",
        description: "Analisa a coerência do macrociclo e dos blocos dominantes.",
        requires: () => (weekPlans.length ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          const highlights = [
            `Turma: ${periodizationCopilotSnapshot.classLabel}`,
            `Esporte: ${periodizationCopilotSnapshot.sportLabel}`,
            `Ciclo: ${periodizationCopilotSnapshot.weeks} semanas (semana atual ${periodizationCopilotSnapshot.currentWeek})`,
            `Períodos: ${periodizationCopilotSnapshot.periodSummary}`,
            `Blocos dominantes: ${periodizationCopilotSnapshot.dominantSummary}`,
          ];
          const suggestions = [
            "Mantenha transição progressiva de demanda entre blocos para evitar salto brusco.",
            "No competitivo, prefira redução de volume na semana-alvo com intensidade técnica alta.",
            "Valide semanalmente o desvio entre demanda planejada e PSE real para ajustar o bloco seguinte.",
          ];
          return `${highlights.join("\n")}\n\nAjustes recomendados:\n1. ${suggestions[0]}\n2. ${suggestions[1]}\n3. ${suggestions[2]}`;
        },
      },
      {
        id: "periodization_next_week_adjust",
        title: "Ajustar próxima semana",
        description: "Propõe ajustes de carga e PSE da próxima semana.",
        requires: () => (weekPlans.length ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          const demandValue = Number.parseInt(periodizationCopilotSnapshot.nextDemand, 10);
          const targetLoad = demandValue >= 9 ? "Média" : periodizationCopilotSnapshot.nextLoad;
          const targetDemand = demandValue >= 9 ? "8/10" : periodizationCopilotSnapshot.nextDemand;
          const targetPse = demandValue >= 9 ? "5-6" : periodizationCopilotSnapshot.nextPse;
          const focus = targetLoad === "Alta" ? "potência específica com controle de volume" : "qualidade técnica e consistência tática";

          return [
            `Referência: ${periodizationCopilotSnapshot.nextWeekLabel} (${periodizationCopilotSnapshot.classLabel})`,
            `Esporte base da turma: ${periodizationCopilotSnapshot.sportLabel}`,
            `Planejado atual: carga ${periodizationCopilotSnapshot.nextLoad}, demanda ${periodizationCopilotSnapshot.nextDemand}, PSE ${periodizationCopilotSnapshot.nextPse}`,
            `Ajuste sugerido: carga ${targetLoad}, demanda ${targetDemand}, PSE ${targetPse}`,
            `Foco da semana: ${focus}.`,
          ].join("\n");
        },
      },
      {
        id: "periodization_plan_vs_real",
        title: "Planejado vs real",
        description: "Gera roteiro para comparar demanda planejada com PSE real coletado.",
        requires: () => (weekPlans.length ? null : "Gere o ciclo para habilitar esta análise."),
        run: () => {
          return [
            `Checklist Planejado vs Real (${periodizationCopilotSnapshot.classLabel})`,
            `Esporte: ${periodizationCopilotSnapshot.sportLabel}`,
            "1. Registrar demanda planejada da semana (ex.: 7/10).",
            "2. Coletar PSE médio real da turma ao fim das sessões.",
            "3. Calcular desvio: real - planejado.",
            "4. Decisão: |desvio| <= 1 mantém bloco; desvio > 1 reduz próxima carga; desvio < -1 pode progredir.",
            "5. Documentar ajuste aplicado no próximo microciclo.",
          ].join("\n");
        },
      },
    ],
    [periodizationCopilotSnapshot, weekPlans.length]
  );

  useCopilotActions(periodizationCopilotActions);

  useEffect(() => {
    if (!hasWeekPlans || currentWeek <= 1) return;
    const scrollToX = Math.max(0, (currentWeek - 1) * (cyclePanelCellWidth + cyclePanelCellGap) - cyclePanelCellWidth);
    const timer = setTimeout(() => {
      cyclePanelScrollRef.current?.scrollTo({ x: scrollToX, animated: true });
    }, 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasWeekPlans, currentWeek]);

  const activeWeekIndex = hasWeekPlans
    ? Math.max(
        0,
        Math.min(
          (agendaWeekNumber ?? currentWeek) - 1,
          weekPlans.length - 1
        )
      )
    : 0;

  const activeWeek = hasWeekPlans ? weekPlans[activeWeekIndex] : emptyWeek;

  useEffect(() => {
    if (!hasWeekPlans) {
      setAgendaWeekNumber(null);
      return;
    }

    const fallbackWeek = Math.max(1, Math.min(currentWeek, weekPlans.length));
    setAgendaWeekNumber((prev) => {
      if (prev == null) return fallbackWeek;
      return Math.max(1, Math.min(prev, weekPlans.length));
    });
  }, [currentWeek, hasWeekPlans, weekPlans.length]);

  useEffect(() => {
    setSelectedDayIndex(null);
  }, [activeWeek.week]);

  useEffect(() => {
    if (!hasWeekPlans) return;
    weekSwitchOpacity.setValue(0.65);
    weekSwitchTranslateX.setValue(weekSwitchDirectionRef.current * 12);
    Animated.parallel([
      Animated.timing(weekSwitchOpacity, {
        toValue: 1,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(weekSwitchTranslateX, {
        toValue: 0,
        duration: 190,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeWeek.week, hasWeekPlans, weekSwitchOpacity, weekSwitchTranslateX]);

  const goToPreviousAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = -1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.max(1, current - 1);
    });
  }, [currentWeek, hasWeekPlans]);

  const goToNextAgendaWeek = useCallback(() => {
    weekSwitchDirectionRef.current = 1;
    setAgendaWeekNumber((prev) => {
      if (!hasWeekPlans) return prev;
      const current = prev ?? currentWeek;
      return Math.min(weekPlans.length, current + 1);
    });
  }, [currentWeek, hasWeekPlans, weekPlans.length]);



  // Removido: criação automática de semanas ao entrar na tela.



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



  const openWeekEditor = useCallback((weekNumber: number) => {

    if (!selectedClass) return;

    const existing = classPlans.find((plan) => plan.weekNumber === weekNumber);
    const plan =
      existing ??
      (isCompetitiveMode
        ? buildCompetitiveClassPlan({
            classId: selectedClass.id,
            weekNumber,
            cycleLength,
            cycleStartDate: activeCycleStartDate,
            daysOfWeek: selectedClass.daysOfWeek ?? [],
            exceptions: calendarExceptions,
            profile: competitiveProfile,
            source: "AUTO",
          })
        : buildClassPlan({
            classId: selectedClass.id,
            ageBand,
            startDate: activeCycleStartDate,
            weekNumber,
            source: "AUTO",
            mvLevel: selectedClass.mvLevel,
            cycleLength,
            model: periodizationModel,
            sessionsPerWeek: weeklySessions,
            sport: sportProfile,
          }));

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

  }, [
    activeCycleStartDate,
    ageBand,
    calendarExceptions,
    classPlans,
    competitiveProfile,
    cycleLength,
    isCompetitiveMode,
    periodizationModel,
    sportProfile,
    selectedClass,
    weeklySessions,
  ]);



  const buildManualPlanForWeek = useCallback(

    (weekNumber: number, existing: ClassPlan | null): ClassPlan | null => {

      if (!selectedClass) return null;

      const autoPlan = isCompetitiveMode
        ? buildCompetitiveClassPlan({
            classId: selectedClass.id,
            weekNumber,
            cycleLength,
            cycleStartDate: activeCycleStartDate,
            daysOfWeek: selectedClass.daysOfWeek ?? [],
            exceptions: calendarExceptions,
            profile: competitiveProfile,
            source: existing?.source === "MANUAL" ? "MANUAL" : "AUTO",
            existingId: existing?.id,
            existingCreatedAt: existing?.createdAt,
          })
        : buildClassPlan({
            classId: selectedClass.id,
            ageBand,
            startDate: activeCycleStartDate,
            weekNumber,
            source: existing?.source === "MANUAL" ? "MANUAL" : "AUTO",
            mvLevel: selectedClass.mvLevel,
            cycleLength,
            model: periodizationModel,
            sessionsPerWeek: weeklySessions,
            sport: sportProfile,
          });

      const nowIso = new Date().toISOString();

      return {
        id: existing?.id ?? `cp_${selectedClass.id}_${Date.now()}_${weekNumber}`,

        classId: selectedClass.id,

        startDate: autoPlan.startDate,

        weekNumber,

        phase: editPhase.trim() || autoPlan.phase,

        theme: editTheme.trim() || autoPlan.theme,

        technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || autoPlan.technicalFocus,

        physicalFocus: editPhysicalFocus.trim() || autoPlan.physicalFocus,

        constraints: editConstraints.trim(),

        mvFormat: editMvFormat.trim() || autoPlan.mvFormat,

        warmupProfile: editWarmupProfile.trim() || autoPlan.warmupProfile,

        jumpTarget: editJumpTarget.trim() || autoPlan.jumpTarget,

        rpeTarget: editPSETarget.trim() || autoPlan.rpeTarget,

        source: "MANUAL",

        createdAt: existing?.createdAt ?? nowIso,

        updatedAt: nowIso,

      };

    },

    [

      activeCycleStartDate,

      ageBand,

      calendarExceptions,

      cycleLength,

      competitiveProfile,

      editConstraints,

      editJumpTarget,

      editMvFormat,

      editPSETarget,

      editPhase,

      editPhysicalFocus,

      editTechnicalFocus,

      editTheme,

      editWarmupProfile,

      isCompetitiveMode,

      periodizationModel,

      sportProfile,

      selectedClass,

      weeklySessions,

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

        // Preserve manually curated weeks and only propagate to AUTO/missing slots.
        if (existing?.source === "MANUAL") return;

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

    (weekNumber: number, existing: ClassPlan | null = null) => {

      if (!selectedClass) return null;

      const plan = isCompetitiveMode
        ? buildCompetitiveClassPlan({
            classId: selectedClass.id,
            weekNumber,
            cycleLength,
            cycleStartDate: activeCycleStartDate,
            daysOfWeek: selectedClass.daysOfWeek ?? [],
            exceptions: calendarExceptions,
            profile: competitiveProfile,
            source: "AUTO",
            existingId: existing?.id,
            existingCreatedAt: existing?.createdAt,
          })
        : buildClassPlan({
            classId: selectedClass.id,
            ageBand,
            startDate: activeCycleStartDate,
            weekNumber,
            source: "AUTO",
            mvLevel: selectedClass.mvLevel,
            cycleLength,
            model: periodizationModel,
            sessionsPerWeek: weeklySessions,
            sport: sportProfile,
          });

      if (existing) {

        plan.id = existing.id;

        plan.createdAt = existing.createdAt;

      }

      return plan;

    },

    [
      activeCycleStartDate,
      ageBand,
      calendarExceptions,
      competitiveProfile,
      cycleLength,
      isCompetitiveMode,
      periodizationModel,
      sportProfile,
      selectedClass,
      weeklySessions,
    ]

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
    const existing = editingPlanId
      ? classPlans.find((p) => p.id === editingPlanId) ?? null
      : null;
    const autoPlan = isCompetitiveMode
      ? buildCompetitiveClassPlan({
          classId: selectedClass.id,
          weekNumber: editingWeek,
          cycleLength,
          cycleStartDate: activeCycleStartDate,
          daysOfWeek: selectedClass.daysOfWeek ?? [],
          exceptions: calendarExceptions,
          profile: competitiveProfile,
          source: editSource,
          existingId: existing?.id,
          existingCreatedAt: existing?.createdAt,
        })
      : buildClassPlan({
          classId: selectedClass.id,
          ageBand,
          startDate: activeCycleStartDate,
          weekNumber: editingWeek,
          source: editSource,
          mvLevel: selectedClass.mvLevel,
          cycleLength,
          model: periodizationModel,
          sessionsPerWeek: weeklySessions,
          sport: sportProfile,
        });

    const nowIso = new Date().toISOString();

    const plan: ClassPlan = {
      id: editingPlanId ?? `cp_${selectedClass.id}_${Date.now()}_${editingWeek}`,

      classId: selectedClass.id,

      startDate: autoPlan.startDate,

      weekNumber: editingWeek,

      phase: editPhase.trim() || autoPlan.phase,

      theme: editTheme.trim() || autoPlan.theme,

      technicalFocus: editTechnicalFocus.trim() || editTheme.trim() || autoPlan.technicalFocus,

      physicalFocus: editPhysicalFocus.trim() || autoPlan.physicalFocus,

      constraints: editConstraints.trim(),

      mvFormat: editMvFormat.trim() || autoPlan.mvFormat,

      warmupProfile: editWarmupProfile.trim() || autoPlan.warmupProfile,

      jumpTarget: editJumpTarget.trim() || autoPlan.jumpTarget,

      rpeTarget: editPSETarget.trim() || autoPlan.rpeTarget,

      source: editSource,

      createdAt: editingPlanId
        ? classPlans.find((p) => p.id === editingPlanId)?.createdAt ?? nowIso
        : nowIso,

      updatedAt: nowIso,

    };

    const shouldPropagateForward = hasPlanChanges(existing, plan);

    if (shouldPropagateForward) {

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

      if (shouldPropagateForward) {
        const forwardWeeks = Array.from(
          { length: Math.max(0, cycleLength - editingWeek) },
          (_, idx) => editingWeek + idx + 1
        );
        await applyDraftToWeeks(forwardWeeks);
      }

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

                paddingHorizontal: 12,

                borderRadius: 14,

                marginVertical: 3,

                backgroundColor: active ? colors.primaryBg : colors.card,

              }}

            >

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>

                <Text

                  style={{

                    color: active ? colors.primaryText : colors.text,

                    fontSize: 14,

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

              paddingVertical: 12,

              paddingHorizontal: 12,

              borderRadius: 14,

              marginVertical: 3,

              backgroundColor: active ? colors.primaryBg : colors.card,

            }}

          >

            <Text

              style={{

                color: active ? colors.primaryText : colors.text,

                fontSize: 14,

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

              paddingVertical: 12,

              paddingHorizontal: 12,

              borderRadius: 14,

              marginVertical: 3,

              backgroundColor: active ? colors.primaryBg : colors.card,

            }}

          >

            <Text

              style={{

                color: active ? colors.primaryText : colors.text,

                fontSize: 14,

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
          const plans = isCompetitiveMode
            ? toCompetitiveClassPlans({
                classId: selectedClass.id,
                cycleLength,
                cycleStartDate: activeCycleStartDate,
                daysOfWeek: selectedClass.daysOfWeek ?? [],
                exceptions: calendarExceptions,
                profile: competitiveProfile,
              })
            : toClassPlans({
                classId: selectedClass.id,
                ageBand,
                cycleLength,
                startDate: activeCycleStartDate,
                mvLevel: selectedClass.mvLevel,
                model: periodizationModel,
                sessionsPerWeek: weeklySessions,
                sport: sportProfile,
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

    [
      activeCycleStartDate,
      ageBand,
      buildAutoPlanForWeek,
      calendarExceptions,
      competitiveProfile,
      cycleLength,
      isCompetitiveMode,
      periodizationModel,
      sportProfile,
      refreshPlans,
      selectedClass,
      weeklySessions,
    ]

  );

  const handleApplyElCartelPreset = useCallback(async () => {
    if (!selectedClass) return;
    confirmDialog({
      title: normalizeText("Aplicar preset ElCartel?"),
      message: normalizeText(
        "Isto vai substituir o ciclo atual por 18 semanas no modelo 2x/semana e configurar perfil competitivo com feriados de 21/04 e 04/06."
      ),
      confirmLabel: normalizeText("Aplicar preset"),
      cancelLabel: normalizeText("Cancelar"),
      tone: "default",
      onConfirm: async () => {
        setIsSavingPlans(true);
        try {
          const plans = buildElCartelClassPlans({
            classId: selectedClass.id,
            gender: selectedClass.gender,
          });
          await measure("deleteClassPlansByClass", () =>
            deleteClassPlansByClass(selectedClass.id)
          );
          await measure("saveClassPlans", () => saveClassPlans(plans));

          const profile = buildElCartelCompetitiveProfile({
            classId: selectedClass.id,
            organizationId: selectedClass.organizationId,
          });
          await saveClassCompetitiveProfile(profile);

          const existingExceptions = await getClassCalendarExceptions(selectedClass.id, {
            organizationId: selectedClass.organizationId,
          });
          await Promise.all(
            existingExceptions.map((item) => deleteClassCalendarException(item.id))
          );
          const exceptions = buildElCartelCalendarExceptions({
            classId: selectedClass.id,
            organizationId: selectedClass.organizationId,
          });
          await Promise.all(exceptions.map((item) => saveClassCalendarException(item)));

          setClassPlans(plans);
          setCycleLength(18);
          setSessionsPerWeek(2);
          setCompetitiveProfile(profile);
          setCalendarExceptions(exceptions);
          setExceptionDateInput("");
          setExceptionReasonInput("");
          setShowPlanActionsModal(false);

          Alert.alert(
            normalizeText("Periodização"),
            normalizeText("Preset ElCartel aplicado com sucesso para a turma.")
          );
        } catch (error) {
          Alert.alert(
            normalizeText("Periodização"),
            error instanceof Error
              ? error.message
              : normalizeText("Falha ao aplicar preset ElCartel.")
          );
        } finally {
          setIsSavingPlans(false);
        }
      },
    });
  }, [confirmDialog, selectedClass]);



  const handleGenerateAction = useCallback(

    (mode: "fill" | "auto" | "all") => {

      if (mode === "all") {

        confirmDialog({

          title: "Regerar tudo?",

          message:

            "Isso substitui semanas AUTO e MANUAL. Use apenas se quiser recriar todo o ciclo.",

          confirmLabel: "Regerar tudo",

          cancelLabel: "Cancelar",

          tone: "danger",

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

    if (isCompetitiveMode && week?.week) {
      const meta = buildCompetitiveWeekMeta({
        weekNumber: week.week,
        cycleStartDate: activeCycleStartDate,
        daysOfWeek: selectedClass?.daysOfWeek ?? [],
        exceptions: calendarExceptions,
      });
      const sessionDateByDayNumber = new Map<number, string>();
      meta.sessionDates.forEach((sessionDate) => {
        const parsed = parseIsoDate(sessionDate);
        if (!parsed) return;
        sessionDateByDayNumber.set(parsed.getDay(), sessionDate);
      });

      return weekAgendaDayOrder.map((dayNumber) => {
        const labelIndex = dayNumbersByLabelIndex.indexOf(dayNumber);
        const label = labelIndex >= 0 ? dayLabels[labelIndex] : "--";
        const date = sessionDateByDayNumber.get(dayNumber) ?? formatIsoDate(nextDateForDayNumber(dayNumber));
        return {
          label,
          dayNumber,
          session: sessionDateByDayNumber.has(dayNumber) ? base : "",
          date,
        };
      });
    }

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

    const selectedDayNumbers = dayIndexes.map((idx) => dayNumbersByLabelIndex[idx]);

    return weekAgendaDayOrder.map((dayNumber) => {
      const labelIndex = dayNumbersByLabelIndex.indexOf(dayNumber);
      const label = labelIndex >= 0 ? dayLabels[labelIndex] : "--";
      return {
        label,
        dayNumber,
        date: formatIsoDate(nextDateForDayNumber(dayNumber)),
        session: selectedDayNumbers.includes(dayNumber) ? base : "",
      };
    });

  };

  const weekSchedule = getWeekSchedule(activeWeek, sessionsPerWeek);



  const selectedDay = selectedDayIndex !== null ? weekSchedule[selectedDayIndex] : null;
  const isSelectedDayRest = selectedDay ? !normalizeText(selectedDay.session ?? "").trim() : false;

  const selectedDayDate = selectedDay
    ? (selectedDay.date ? parseIsoDate(selectedDay.date) : nextDateForDayNumber(selectedDay.dayNumber))
    : null;



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



  function formatShortDate(value: Date | null) {
    return value
      ? value.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
      : "--";
  }



  const formatDisplayDate = (value: string | null) => {

    if (!value) return "";

    const parsed = parseIsoDate(value);

    if (!parsed) return value;

    return parsed.toLocaleDateString("pt-BR");

  };

  const formatWeekSessionLabel = (value: string) => {
    const normalized = normalizeText(value).trim();
    if (!normalized || normalized.toLowerCase() === "descanso") return "Descanso";
    if (normalized.length <= 18) return normalized;

    const midpoint = Math.floor(normalized.length / 2);
    let splitIndex = normalized.indexOf(" ", midpoint);
    if (splitIndex < 0) splitIndex = normalized.lastIndexOf(" ", midpoint);
    if (splitIndex < 0) return normalized;

    return `${normalized.slice(0, splitIndex)}\n${normalized.slice(splitIndex + 1)}`;
  };



  const buildPdfData = (rows: typeof periodizationRows) => ({
    className: normalizeText(selectedClass?.name ?? "Turma"),

    unitLabel: normalizeText(selectedClass?.unit ?? ""),

    ageGroup: normalizeText(selectedClass?.ageBand ?? ""),

    cycleStart: activeCycleStartDate || classPlans[0]?.startDate || undefined,

    cycleLength: rows.length,

    generatedAt: new Date().toLocaleDateString("pt-BR"),

    planningMode: competitiveProfile?.planningMode ?? undefined,

    targetCompetition: competitiveProfile?.targetCompetition?.trim() || undefined,

    targetDate: competitiveProfile?.targetDate?.trim() || undefined,

    tacticalSystem: competitiveProfile?.tacticalSystem?.trim() || undefined,

    currentPhase: competitiveProfile?.currentPhase?.trim() || undefined,

    rows,

  });



  const handleExportCycle = async () => {

    if (!selectedClass || !periodizationRows.length || !hasWeekPlans) return;

    const data = buildPdfData(periodizationRows);

    const fileName = safeFileName(

      `periodizacao_${selectedClass.name}_${formatDisplayDate(data.cycleStart ?? null)}`

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

  const handleImportPlansFile = useCallback(async () => {
    if (!selectedClass) {
      Alert.alert("Importacao", "Selecione uma turma antes de importar.");
      return;
    }

    setIsImportingPlansFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "application/pdf",
        ],
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error("Arquivo invalido.");
      const fileName = String(asset.name ?? "").trim().toLowerCase();
      if (fileName.endsWith(".pdf") || asset.mimeType === "application/pdf") {
        Alert.alert("Importacao", "PDF nao e suportado para importacao direta. Use CSV/XLSX.");
        return;
      }

      const isSpreadsheet =
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        asset.mimeType?.includes("spreadsheet") ||
        asset.mimeType?.includes("excel");

      let importedRows: ImportedPlanRow[] = [];
      if (isSpreadsheet) {
        const workbook =
          typeof window !== "undefined"
            ? XLSX.read(await (await fetch(asset.uri)).arrayBuffer(), { type: "array" })
            : XLSX.read(await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 }), {
                type: "base64",
              });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) throw new Error("Planilha vazia.");
        const worksheet = workbook.Sheets[firstSheet];
        if (!worksheet) throw new Error("Nao foi possivel ler a primeira aba.");
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as unknown[][];
        const matrix = rows.map((row) =>
          Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []
        );
        importedRows = parseImportRowsFromMatrix(matrix);
      } else {
        const csvText =
          typeof window !== "undefined"
            ? await (await fetch(asset.uri)).text()
            : await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
        const matrix = parseDelimitedImportRows(
          csvText,
          detectImportDelimiter(csvText)
        );
        importedRows = parseImportRowsFromMatrix(matrix);
      }

      if (!importedRows.length) {
        throw new Error("Nenhuma linha válida encontrada no arquivo.");
      }

      for (const row of importedRows) {
        await deleteTrainingPlansByClassAndDate(selectedClass.id, row.date);
        await saveTrainingPlan({
          id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          classId: selectedClass.id,
          title: row.title,
          tags: splitImportList(row.tags).length
            ? splitImportList(row.tags)
            : ["importado", "planejamento"],
          warmup: splitImportList(row.warmup),
          main: splitImportList(row.main),
          cooldown: splitImportList(row.cooldown),
          warmupTime: row.warmup_time || "",
          mainTime: row.main_time || "",
          cooldownTime: row.cooldown_time || "",
          applyDays: [],
          applyDate: row.date,
          createdAt: new Date().toISOString(),
        });
      }

      Alert.alert("Importacao", `Planejamento importado com ${importedRows.length} linha(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar arquivo.";
      Alert.alert("Importacao", message);
    } finally {
      setIsImportingPlansFile(false);
    }
  }, [selectedClass]);

  const updateCompetitiveProfileDraft = useCallback(
    (
      patch: Partial<
        Omit<ClassCompetitiveProfile, "classId" | "organizationId" | "createdAt" | "updatedAt">
      >
    ) => {
      if (!selectedClass) return;
      setCompetitiveProfile((prev) => ({
        classId: selectedClass.id,
        organizationId: selectedClass.organizationId,
        planningMode: "adulto-competitivo",
        cycleStartDate: prev?.cycleStartDate ?? selectedClass.cycleStartDate ?? formatIsoDate(new Date()),
        targetCompetition: prev?.targetCompetition ?? "",
        targetDate: prev?.targetDate ?? "",
        tacticalSystem: prev?.tacticalSystem ?? "",
        currentPhase: prev?.currentPhase ?? "Base",
        notes: prev?.notes ?? "",
        createdAt: prev?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...prev,
        ...patch,
      }));
    },
    [selectedClass]
  );

  const handleSaveCompetitiveProfile = useCallback(async () => {
    if (!selectedClass) return;
    const cycleStartDateIso =
      parseDateInputToIso(competitiveCycleStartDateInput) ||
      competitiveProfile?.cycleStartDate?.trim() ||
      selectedClass.cycleStartDate ||
      formatIsoDate(new Date());
    const targetDateIso = parseDateInputToIso(competitiveTargetDateInput) || "";

    const payload: ClassCompetitiveProfile = {
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      planningMode: "adulto-competitivo",
      cycleStartDate: cycleStartDateIso,
      targetCompetition: competitiveProfile?.targetCompetition?.trim() || "",
      targetDate: targetDateIso,
      tacticalSystem: competitiveProfile?.tacticalSystem?.trim() || "",
      currentPhase: competitiveProfile?.currentPhase?.trim() || "Base",
      notes: competitiveProfile?.notes?.trim() || "",
      createdAt: competitiveProfile?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setIsSavingCompetitiveProfile(true);
    try {
      await saveClassCompetitiveProfile(payload);
      setCompetitiveProfile(payload);
      Alert.alert("Periodização", "Perfil competitivo salvo para a turma.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar perfil competitivo.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCompetitiveProfile(false);
    }
  }, [competitiveCycleStartDateInput, competitiveProfile, competitiveTargetDateInput, selectedClass]);

  const handleDisableCompetitiveMode = useCallback(async () => {
    if (!selectedClass) return;
    Alert.alert(
      "Desativar modo competitivo",
      "O perfil competitivo desta turma sera removido. Os planos ja salvos permanecem.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Desativar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsSavingCompetitiveProfile(true);
              try {
                await deleteClassCompetitiveProfile(selectedClass.id);
                setCompetitiveProfile(null);
                Alert.alert("Periodização", "Modo competitivo desativado para a turma.");
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : "Falha ao desativar modo competitivo.";
                Alert.alert("Periodização", message);
              } finally {
                setIsSavingCompetitiveProfile(false);
              }
            })();
          },
        },
      ]
    );
  }, [selectedClass]);

  const handleAddCalendarException = useCallback(async () => {
    if (!selectedClass) return;
    const date = parseDateInputToIso(exceptionDateInput.trim());
    if (!date || !isIsoDateValue(date)) {
      Alert.alert("Periodização", "Informe uma data válida no formato DD/MM/AAAA.");
      return;
    }
    const payload: ClassCalendarException = {
      id: `exc_${selectedClass.id}_${date}_${Date.now()}`,
      classId: selectedClass.id,
      organizationId: selectedClass.organizationId,
      date,
      reason: exceptionReasonInput.trim() || "Sem treino",
      kind: "no_training",
      createdAt: new Date().toISOString(),
    };
    setIsSavingCalendarException(true);
    try {
      await saveClassCalendarException(payload);
      setCalendarExceptions((prev) =>
        [...prev.filter((item) => !(item.date === payload.date && item.kind === payload.kind)), payload].sort((a, b) =>
          a.date.localeCompare(b.date)
        )
      );
      setExceptionDateInput("");
      setExceptionReasonInput("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar excecao.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCalendarException(false);
    }
  }, [exceptionDateInput, exceptionReasonInput, selectedClass]);

  const handleDeleteCalendarException = useCallback(async (exceptionId: string) => {
    setIsSavingCalendarException(true);
    try {
      await deleteClassCalendarException(exceptionId);
      setCalendarExceptions((prev) => prev.filter((item) => item.id !== exceptionId));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao remover excecao.";
      Alert.alert("Periodização", message);
    } finally {
      setIsSavingCalendarException(false);
    }
  }, []);

  const competitiveBlockPadding = 14;
  const competitiveExceptionsMaxHeight = 180;
  const competitiveContentHeight = 220;

  const competitiveAgendaCard = selectedClass ? (
    <View
      style={[
        getSectionCardStyle(colors, "neutral", { padding: 24, radius: 16, shadow: false }),
        { gap: 14, borderWidth: 1, borderColor: colors.border },
      ]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
            {normalizeText("Modo competitivo da turma")}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText(
              isCompetitiveMode
                ? "Perfil competitivo ativo para gerar semanas com datas reais."
                : "Complete os dados para ativar a periodização competitiva desta turma."
            )}
          </Text>
        </View>
        {isCompetitiveMode ? (
          <Pressable
            onPress={() => {
              void handleDisableCompetitiveMode();
            }}
            disabled={isSavingCompetitiveProfile}
            style={{
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: isSavingCompetitiveProfile ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
              {normalizeText("Desativar")}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={competitiveScrollRef}
        style={{ height: competitiveContentHeight }}
        contentContainerStyle={{ gap: 14, paddingRight: 2 }}
        showsVerticalScrollIndicator
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("profile")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText("Dados da competição")}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.profile ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveProfileContent ? (
        <Animated.View style={[{ gap: 10 }, competitiveProfileAnimStyle]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Competição-alvo")}</Text>
            <TextInput
              value={competitiveProfile?.targetCompetition ?? ""}
              onChangeText={(value) => updateCompetitiveProfileDraft({ targetCompetition: value })}
              placeholder={normalizeText("Ex.: Supertaça Unificada da Saúde")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Data-alvo")}</Text>
            <TextInput
              value={competitiveTargetDateInput}
              onChangeText={(value) => setCompetitiveTargetDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Início do ciclo")}</Text>
            <TextInput
              value={competitiveCycleStartDateInput}
              onChangeText={(value) => setCompetitiveCycleStartDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Sistema tático")}</Text>
            <TextInput
              value={competitiveProfile?.tacticalSystem ?? ""}
              onChangeText={(value) => updateCompetitiveProfileDraft({ tacticalSystem: value })}
              placeholder={normalizeText("Ex.: 5x1")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 160, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Fase atual")}</Text>
            <TextInput
              value={competitiveProfile?.currentPhase ?? "Base"}
              onChangeText={(value) => updateCompetitiveProfileDraft({ currentPhase: value })}
              placeholder={normalizeText("Base")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Observações")}</Text>
          <TextInput
            value={competitiveProfile?.notes ?? ""}
            onChangeText={(value) => updateCompetitiveProfileDraft({ notes: value })}
            placeholder={normalizeText("Contexto competitivo, foco do bloco e observações gerais")}
            placeholderTextColor={colors.placeholder}
            multiline
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.background,
              minHeight: 80,
              color: colors.inputText,
              fontSize: 13,
              textAlignVertical: "top",
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => {
              void handleSaveCompetitiveProfile();
            }}
            disabled={isSavingCompetitiveProfile}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: isSavingCompetitiveProfile ? colors.primaryDisabledBg : colors.primaryBg,
              alignItems: "center",
            }}
          >
            <Text style={{ color: isSavingCompetitiveProfile ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
              {normalizeText(isSavingCompetitiveProfile ? "Salvando..." : "Salvar alterações")}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => updateCompetitiveProfileDraft({
              targetCompetition: "",
              tacticalSystem: "",
              currentPhase: "Base",
              notes: "",
            })}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {normalizeText("Limpar campos")}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            setCompetitiveTargetDateInput("");
            setCompetitiveCycleStartDateInput("");
          }}
          style={{
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
            {normalizeText("Limpar datas")}
          </Text>
        </Pressable>
        </Animated.View>
        ) : null}
      </View>

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("calendar")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText("Calendário da turma")}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.calendar ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveCalendarContent ? (
        <Animated.View style={[{ gap: 10 }, competitiveCalendarAnimStyle]}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Data sem treino")}</Text>
            <TextInput
              value={exceptionDateInput}
              onChangeText={(value) => setExceptionDateInput(formatDateInputMask(value))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
          <View style={{ flex: 1, minWidth: 140, flexBasis: 0, gap: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{normalizeText("Motivo")}</Text>
            <TextInput
              value={exceptionReasonInput}
              onChangeText={setExceptionReasonInput}
              placeholder={normalizeText("Feriado, viagem, pausa...")}
              placeholderTextColor={colors.placeholder}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                padding: 10,
                fontSize: 13,
                borderRadius: 12,
                backgroundColor: colors.background,
                color: colors.inputText,
              }}
            />
          </View>
        </View>

        <Pressable
          onPress={() => {
            void handleAddCalendarException();
          }}
          disabled={isSavingCalendarException}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: isSavingCalendarException ? colors.primaryDisabledBg : colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: isSavingCalendarException ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>
            {normalizeText(isSavingCalendarException ? "Salvando..." : "Adicionar exceção")}
          </Text>
        </Pressable>

        </Animated.View>
        ) : null}
      </View>

      <View
        style={{
          gap: 10,
          padding: competitiveBlockPadding,
          borderRadius: 12,
          backgroundColor: colors.secondaryBg,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => toggleCompetitiveBlock("exceptions")}
          style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
            {normalizeText(`Exceções cadastradas (${calendarExceptions.length})`)}
          </Text>
          <Ionicons
            name={competitiveBlocksOpen.exceptions ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.muted}
          />
        </Pressable>

        {showCompetitiveExceptionsContent ? (
        <Animated.View style={[{ gap: 8 }, competitiveExceptionsAnimStyle]}>
        {calendarExceptions.length ? (
          <ScrollView
            style={{ maxHeight: competitiveExceptionsMaxHeight, minHeight: 120 }}
            contentContainerStyle={{ gap: 8, paddingRight: 2 }}
            showsVerticalScrollIndicator
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {calendarExceptions.map((item) => (
              <View
                key={item.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {formatDisplayDate(item.date)}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {normalizeText(item.reason || "Sem treino")}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    confirmDialog({
                      title: normalizeText("Remover exceção?"),
                      message: normalizeText("Essa data será removida do calendário competitivo da turma."),
                      confirmLabel: normalizeText("Remover"),
                      cancelLabel: normalizeText("Cancelar"),
                      tone: "danger",
                      onConfirm: () => {
                        void handleDeleteCalendarException(item.id);
                      },
                    });
                  }}
                  disabled={isSavingCalendarException}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.secondaryBg,
                    opacity: isSavingCalendarException ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    {normalizeText("Remover")}
                  </Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {normalizeText("Nenhuma exceção cadastrada para esta turma.")}
          </Text>
        )}
        </Animated.View>
        ) : null}
      </View>

      </ScrollView>
    </View>
  ) : null;



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

          style={{ zIndex: 1, backgroundColor: colors.background }}
          stickyHeaderIndices={[0]}

          onScrollBeginDrag={() => {
            closeAllPickers();
          }}
          onScroll={syncPickerLayouts}

          scrollEventThrottle={16}

        >

        <View
          style={{
            gap: 16,
            backgroundColor: colors.background,
            paddingBottom: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.background,
            position: "relative",
            zIndex: 20,
          }}
        >

        <View style={{ gap: 10, position: "relative", zIndex: 40 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative", zIndex: 40 }}>
            <Pressable
              onPress={() => {
                if (router.canGoBack()) {
                  router.back();
                  return;
                }
                router.replace("/");
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
              <Text style={{ fontSize: 26, fontWeight: "700", color: colors.text }}>
                {normalizeText("Periodização")}
              </Text>
            </Pressable>

            {selectedClass ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, position: "relative" }}>
                <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "700", color: colors.text, maxWidth: 130 }}>
                  {classNameLabel}
                </Text>
                <ClassGenderBadge gender={classGenderLabel} size="md" />
              </View>
            ) : null}
          </View>

          {!selectedClass ? (
            <Text style={{ color: colors.muted }}>
              {normalizeText("Estrutura do ciclo, cargas e foco semanal")}
            </Text>
          ) : null}
        </View>


        <View

          style={{

            flexDirection: "row",

            gap: 8,

            backgroundColor: colors.secondaryBg,

            padding: 6,

            borderRadius: 999,

            position: "relative",

            zIndex: 1,

          }}

        >

          {[

            { id: "geral", label: normalizeText("Visão geral") },
            { id: "ciclo", label: normalizeText("Ciclo") },

            { id: "semana", label: normalizeText("Agenda") },

          ].map((tab) => {
            const tabId = tab.id as PeriodizationTab;
            const tabProgress = tabAnim[tabId];
            const tabScale = tabProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.95, 1],
            });
            const tabOpacity = tabProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.68, 1],
            });
            const tabBackground = tabProgress.interpolate({
              inputRange: [0, 1],
              outputRange: ["transparent", colors.primaryBg],
            });
            const tabTextColor = tabProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.text, colors.primaryText],
            });

            return (

                <Animated.View
                  key={tab.id}

                  style={{

                  flex: 1,

                  borderRadius: 999,

                  opacity: tabOpacity,

                  transform: [{ scale: tabScale }],

                  backgroundColor: tabBackground,

                }}

              >

                <Pressable
                  onPress={() => {

                    closeAllPickers();

                    setActiveTab(tab.id as PeriodizationTab);

                  }}

                  style={{

                  paddingVertical: 8,

                  borderRadius: 999,

                  alignItems: "center",

                }}

              >

                <Animated.Text

                  style={{

                    color: tabTextColor,

                    fontWeight: "700",

                    fontSize: 12,

                  }}

                >

                  {tab.label}

                </Animated.Text>

              </Pressable>

              </Animated.View>

            );

          })}

        </View>

  </View>

        { activeTab === "geral" ? (

        <>

        <View
          style={[
            getSectionCardStyle(colors, "primary"),
            { borderLeftWidth: 1, borderLeftColor: colors.border },
          ]}
        >

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

                    <Text style={{ color: colors.muted, fontSize: 11 }}>

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

              {isOrgAdmin ? (
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
              ) : null}

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

        </View>

        </>

        ) : null}



        { activeTab === "ciclo" ? (

          <>

        <View
          style={[
            getSectionCardStyle(colors, "primary"),
            { borderLeftWidth: 1, borderLeftColor: colors.border, gap: 10 },
          ]}
        >
          <View>
            {isEditingCycleTitle ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={cycleTitleDraft}
                  onChangeText={setCycleTitleDraft}
                  placeholder={normalizeText("Digite o título do macrociclo")}
                  placeholderTextColor={colors.muted}
                  onSubmitEditing={saveCycleTitleEditor}
                  autoFocus
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    borderRadius: 10,
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: "700",
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                  }}
                />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pressable
                    onPress={saveCycleTitleEditor}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "700" }}>
                      Salvar
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={cancelCycleTitleEditor}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                      Cancelar
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={openCycleTitleEditor}
                style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  {normalizeText(cyclePanelTitle)}
                </Text>
                <Ionicons name="create-outline" size={14} color={colors.muted} />
              </Pressable>
            )}
          </View>

          {hasWeekPlans ? (
            <View style={{ flexDirection: "row" }}>
              {/* ── Coluna de labels fixada ── */}
              <View style={{ gap: cyclePanelRowGap, marginRight: 8 }}>
                {(["Mês", "Semana", "Frequência", "Período", "Mesociclo", "Bloco dominante", "Carga planejada", "Índice de demanda", "PSE alvo", "Carga interna"] as const).map((label) => (
                  <View
                    key={label}
                    style={{
                      width: cyclePanelLabelWidth,
                      height: cyclePanelRowHeight,
                      justifyContent: "center",
                      paddingHorizontal: 10,
                      borderRadius: 8,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                      {normalizeText(label)}
                    </Text>
                  </View>
                ))}
              </View>

              {/* ── Conteúdo scrollável ── */}
              <ScrollView
                ref={cyclePanelScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ flex: 1 }}
              >
                <View style={{ gap: cyclePanelRowGap, paddingBottom: 2 }}>

                  {/* Linha de meses */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {monthSegments.map((seg, idx) => (
                      <View
                        key={`month-${idx}`}
                        style={{
                          width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                          height: cyclePanelRowHeight,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: colors.inputBg,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                          {seg.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Linha de semanas */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {weekPlans.map((week, weekIdx) => {
                      const isActive = week.week === currentWeek;
                      const isPast = week.week < currentWeek;
                      const mesoNum = mesoWeekNumbers[weekIdx] ?? week.week;
                      return (
                        <Pressable
                          key={`head-${week.week}`}
                          onPress={() => openWeekEditor(week.week)}
                          style={{
                            width: cyclePanelCellWidth,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 3,
                            backgroundColor: colors.secondaryBg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: isActive ? "700" : "400" }}>
                            {`${mesoNum}`}
                          </Text>
                          {isActive ? (
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.text }} />
                          ) : (
                            <View style={{ width: 4, height: 4 }} />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Frequência semanal */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    <View
                      style={{
                        width: weekPlans.length * cyclePanelCellWidth + Math.max(0, weekPlans.length - 1) * cyclePanelCellGap,
                        height: cyclePanelRowHeight,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: colors.inputBg,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                        {`${weeklySessions} ${weeklySessions === 1 ? "sessão" : "sessões"}/semana`}
                      </Text>
                    </View>
                  </View>

                  {/* Macrociclo */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                      {macroSegments.map((seg, idx) => {
                        const bgColors = [colors.inputBg, colors.secondaryBg, colors.card];
                        return (
                          <View
                            key={`macro-${idx}`}
                            style={{
                              width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                              height: cyclePanelRowHeight,
                              borderRadius: 8,
                              alignItems: "center",
                              justifyContent: "center",
                              paddingHorizontal: 6,
                              backgroundColor: bgColors[idx % bgColors.length],
                              borderWidth: 1,
                              borderColor: colors.border,
                            }}
                          >
                            <Text numberOfLines={1} style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                              {seg.label}
                            </Text>
                          </View>
                        );
                      })}
                  </View>

                  {/* Mesociclos */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {mesoSegments.map((seg, idx) => (
                      <View
                        key={`meso-${idx}`}
                        style={{
                          width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                          height: cyclePanelRowHeight,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: idx % 2 === 0 ? colors.secondaryBg : colors.card,
                          borderWidth: 1,
                          borderColor: colors.border,
                        }}
                      >
                        <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                          {normalizeText(seg.label)}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Bloco dominante */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {dominantBlockSegments.map((seg, idx) => {
                      const bgColors = [colors.secondaryBg, colors.card, colors.inputBg, colors.card, colors.secondaryBg];
                      return (
                        <View
                          key={`dominant-${idx}`}
                          style={{
                            width: seg.length * cyclePanelCellWidth + Math.max(0, seg.length - 1) * cyclePanelCellGap,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            paddingHorizontal: 6,
                            backgroundColor: bgColors[idx % bgColors.length],
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                            {seg.label}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Carga */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {weekPlans.map((week) => {
                      const palette = getVolumePalette(week.volume, colors);
                      const isPast = week.week < currentWeek;
                      return (
                        <View
                          key={`load-${week.week}`}
                          style={{
                            width: cyclePanelCellWidth,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: palette.bg,
                            opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ color: palette.text, fontSize: 10, fontWeight: "700" }}>
                            {getLoadLabelForModel(week.volume, periodizationModel)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Índice */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {weekPlans.map((week) => {
                      const isPast = week.week < currentWeek;
                      const intensity = getDemandIndexForModel(
                        week.volume,
                        periodizationModel,
                        weeklySessions,
                        sportProfile
                      );
                      return (
                        <View
                          key={`idx-${week.week}`}
                          style={{
                            width: cyclePanelCellWidth,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>
                            {`${intensity}/10`}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Meta PSE */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {weekPlans.map((week) => {
                      const isPast = week.week < currentWeek;
                      return (
                        <View
                          key={`pse-${week.week}`}
                          style={{
                            width: cyclePanelCellWidth,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 10, fontWeight: "600" }}>
                            {normalizeText(week.PSETarget)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Carga interna */}
                  <View style={{ flexDirection: "row", gap: cyclePanelCellGap }}>
                    {weekPlans.map((week) => {
                      const isPast = week.week < currentWeek;
                      return (
                        <View
                          key={`internal-load-${week.week}`}
                          style={{
                            width: cyclePanelCellWidth,
                            height: cyclePanelRowHeight,
                            borderRadius: 8,
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: colors.card,
                            borderWidth: 1,
                            borderColor: colors.border,
                            opacity: isPast ? 0.45 : 1,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 9, fontWeight: "700" }}>
                            {formatPlannedLoad(week.plannedWeeklyLoad)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                </View>
              </ScrollView>
            </View>
          ) : (
            <View
              style={{
                padding: 12,
                borderRadius: 12,
                backgroundColor: colors.inputBg,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                {normalizeText("Gere o ciclo para visualizar o painel semanal.")}
              </Text>
            </View>
          )}
        </View>

          <View
            style={[
              getSectionCardStyle(colors, "primary"),
              { borderLeftWidth: 1, borderLeftColor: colors.border },
            ]}
          >

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

                  <Text style={{ color: palette.text, fontSize: 11 }}>

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



          <View
            style={[
              getSectionCardStyle(colors, "primary"),
              { borderLeftWidth: 1, borderLeftColor: colors.border },
            ]}
          >

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

              { id: "auto", label: "Automáticas" },

              { id: "manual", label: "Ajustadas" },

            ] as const).map((item) => {

              const active = cycleFilter === item.id;

              return (

                <Pressable

                  key={item.id}

                  onPress={() => setCycleFilter(item.id)}

                  style={{

                    paddingVertical: 8,

                    paddingHorizontal: 12,

                    borderRadius: 999,

                    backgroundColor: active ? colors.primaryBg : colors.background,

                    borderWidth: 1,

                    borderColor: active ? colors.primaryBg : colors.border,

                  }}

                >

                  <Text

                    style={{

                      color: active ? colors.primaryText : colors.text,

                      fontSize: 12,

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

                  backgroundColor: colors.secondaryBg,

                  borderWidth: 1,

                  borderColor: colors.border,

                  gap: 10,

                }}

              >

                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

                  <Text style={{ color: colors.text, fontWeight: "700" }}>

                    {normalizeText("Semana " + week.week + " - " + week.title)}

                  </Text>

                  {(() => {
                    const palette = getVolumePalette(week.volume, colors);
                    return (
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 999,
                            backgroundColor: palette.bg,
                          }}
                        >
                          <Text style={{ color: palette.text, fontSize: 11, fontWeight: "700" }}>
                            {normalizeText(week.volume)}
                          </Text>
                        </View>
                        <View
                          style={{
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            backgroundColor: colors.background,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                            Abrir editor
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

                      paddingVertical: 6,

                      paddingHorizontal: 10,

                      borderRadius: 999,

                      backgroundColor: colors.background,

                      borderWidth: 1,

                      borderColor: colors.border,

                    }}

                  >

                    <Text style={{ color: colors.text, fontSize: 11 }}>

                      {sessionsPerWeek + " dias"}

                    </Text>

                  </View>

                  <View

                    style={{

                      paddingVertical: 6,

                      paddingHorizontal: 10,

                      borderRadius: 999,

                      backgroundColor: colors.background,

                      borderWidth: 1,

                      borderColor: colors.border,

                    }}

                  >

                    <Text style={{ color: colors.text, fontSize: 11 }}>

                      {normalizeText(volumeToPSE[week.volume])}

                    </Text>

                  </View>

                  <View

                    style={{

                      paddingVertical: 6,

                      paddingHorizontal: 10,

                      borderRadius: 999,

                      backgroundColor: colors.background,

                      borderWidth: 1,

                      borderColor: colors.border,

                    }}

                  >

                    <Text style={{ color: colors.text, fontSize: 11 }}>

                      {normalizeText(`PSE alvo: ${week.PSETarget}`)}

                    </Text>

                  </View>

                  <View

                    style={{

                      paddingVertical: 6,

                      paddingHorizontal: 10,

                      borderRadius: 999,

                      backgroundColor: colors.background,

                      borderWidth: 1,

                      borderColor: colors.border,

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

          </>

        ) : null}



        { activeTab === "semana" ? (

        <View style={{ gap: 10 }}>

          <View style={getSectionCardStyle(colors, "info")}>

            <View style={{ gap: 10 }}>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Pressable
                  onPress={goToPreviousAgendaWeek}
                  disabled={!hasWeekPlans || activeWeek.week <= 1}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: !hasWeekPlans || activeWeek.week <= 1 ? 0.45 : 1,
                  }}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.text} />
                </Pressable>

                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                  {`Semana ${activeWeek.week} de ${Math.max(1, weekPlans.length)}`}
                </Text>

                <Pressable
                  onPress={goToNextAgendaWeek}
                  disabled={!hasWeekPlans || activeWeek.week >= weekPlans.length}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 999,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    opacity: !hasWeekPlans || activeWeek.week >= weekPlans.length ? 0.45 : 1,
                  }}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.text} />
                </Pressable>
              </View>

              <Animated.View
                style={{
                  opacity: weekSwitchOpacity,
                  transform: [{ translateX: weekSwitchTranslateX }],
                  gap: 10,
                }}
              >
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

                      width: "31%",

                      minWidth: 74,

                      maxWidth: 100,

                      aspectRatio: 1,

                      padding: 8,

                      borderRadius: 12,

                      backgroundColor: colors.secondaryBg,

                      borderWidth: 1,

                      borderColor: colors.border,

                      gap: 6,

                    }}

                  >

                    <Text style={{ color: colors.muted, fontSize: 11 }}>

                      {item.label}

                    </Text>

                    <Text
                      numberOfLines={2}
                      style={{ color: colors.text, fontSize: 11, fontWeight: "700", lineHeight: 14 }}
                    >

                      {formatWeekSessionLabel(item.session || "Descanso")}

                    </Text>

                  </Pressable>

                ))}

              </View>

              </Animated.View>

            </View>

          </View>

          {competitiveAgendaCard}

        </View>

        ) : null}

        </ScrollView>

        <Pressable
          onPress={() => setShowPlanActionsModal(true)}
          disabled={!selectedClass || isImportingPlansFile}
          style={[
            plansFabPositionStyle,
            {
              width: 56,
              height: 56,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              zIndex: 6200,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
              opacity: !selectedClass || isImportingPlansFile ? 0.7 : 1,
            },
          ]}
        >
          <Ionicons name="add" size={24} color={colors.primaryText} />
        </Pressable>



        <AnchoredDropdown

          visible={showClassPickerContent}

          layout={classTriggerLayout}

          container={containerWindow}

          animationStyle={classPickerAnimStyle}

          zIndex={300}

          maxHeight={220}
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.inputBg,

          }}

          scrollContentStyle={{ padding: 8, gap: 6 }}

        >

          { filteredClasses.length ? (

            <>

              <Pressable

                onPress={handleClearClass}

                style={{

                  paddingVertical: 12,

                  paddingHorizontal: 12,

                  borderRadius: 14,

                  marginVertical: 3,

                  backgroundColor: !selectedClassId ? colors.primaryBg : colors.card,

                }}

              >

                <Text

                  style={{

                    color: !selectedClassId ? colors.primaryText : colors.text,

                    fontSize: 14,

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
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.card,

          }}

          scrollContentStyle={{ padding: 8, gap: 6 }}

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
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.card,

          }}

          scrollContentStyle={{ padding: 8, gap: 6 }}

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
          nestedScrollEnabled
          onRequestClose={closeAllPickers}

          panelStyle={{

            borderWidth: 1,

            borderColor: colors.border,

            backgroundColor: colors.card,

          }}

          scrollContentStyle={{ padding: 8, gap: 6 }}

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
        visible={showPlanActionsModal}
        onClose={() => setShowPlanActionsModal(false)}
        cardStyle={[modalCardStyle, { paddingBottom: 16 }]}
        position="center"
      >
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
          {normalizeText("Ações da periodização")}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
          {normalizeText("Escolha o que deseja fazer nesta turma.")}
        </Text>

        <View style={{ gap: 10, marginTop: 12 }}>
          <Pressable
            onPress={() => {
              void handleApplyElCartelPreset();
            }}
            disabled={!selectedClass || isSavingPlans}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.primaryBg,
              opacity: !selectedClass || isSavingPlans ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {normalizeText(isSavingPlans ? "Aplicando preset..." : "Aplicar preset ElCartel (18 semanas)")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setShowPlanActionsModal(false);
              void handleImportPlansFile();
            }}
            disabled={!selectedClass || isImportingPlansFile}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: !selectedClass || isImportingPlansFile ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {normalizeText(isImportingPlansFile ? "Importando..." : "Importar planejamento")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setShowPlanActionsModal(false);
              void handleExportWeek();
            }}
            disabled={!selectedClass || !periodizationRows.length || !hasWeekPlans}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: !selectedClass || !periodizationRows.length || !hasWeekPlans ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {normalizeText("Exportar semana")}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setShowPlanActionsModal(false);
              void handleExportCycle();
            }}
            disabled={!selectedClass || !periodizationRows.length || !hasWeekPlans}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.primaryBg,
              opacity: !selectedClass || !periodizationRows.length || !hasWeekPlans ? 0.6 : 1,
            }}
          >
            <Text
              style={{
                color:
                  !selectedClass || !periodizationRows.length || !hasWeekPlans
                    ? colors.secondaryText
                    : colors.primaryText,
                fontWeight: "700",
              }}
            >
              {normalizeText("Exportar ciclo")}
            </Text>
          </Pressable>
        </View>
      </ModalSheet>

      <ModalSheet

        visible={showDayModal}

        onClose={() => setShowDayModal(false)}

        cardStyle={[modalCardStyle, { paddingBottom: 12 }]}

        position="center"

      >

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>

            {selectedDay
              ? isSelectedDayRest
                ? normalizeText(`Descanso de ${selectedDay.label}`)
                : normalizeText(`Sessão de ${selectedDay.label}`)
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

                {"Data sugerida: " + formatDisplayDate(formatIsoDate(selectedDayDate))}

              </Text>

            ) : null}

          </View>



          <View style={getSectionCardStyle(colors, "info", { padding: 12, radius: 16 })}>

            {isSelectedDayRest ? (
              <>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {normalizeText("Dia de descanso")}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {normalizeText("Sem sessão planejada para este dia.")}
                </Text>
              </>
            ) : (
              <>
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

                <Text style={{ color: colors.text, fontSize: 11 }}>

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
              </>
            )}

          </View>



          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

          <Pressable

            onPress={() => {

              if (!selectedClass || !selectedDayDate || isSelectedDayRest) return;

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

              backgroundColor:
                selectedClass && !isSelectedDayRest ? colors.primaryBg : colors.primaryDisabledBg,

              alignItems: "center",

            }}

          >

            <Text

              style={{

                color:
                  selectedClass && !isSelectedDayRest
                    ? colors.primaryText
                    : colors.secondaryText,

                fontWeight: "700",

              }}

            >

              {isSelectedDayRest ? "Dia de descanso" : "Criar plano de aula"}

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

        <View style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>

          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 8 }}>

            <View>

              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>

                {`Editar agenda da semana ${editingWeek}`}

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

          <KeyboardAvoidingView
            style={{ width: "100%", flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
          <ScrollView
            contentContainerStyle={{
              gap: 12,
              paddingBottom: 24,
              paddingHorizontal: 12,
              paddingTop: 16,
            }}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >

          <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
              {normalizeText("Planejamento da semana")}
            </Text>

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
                {normalizeText("Meta de saltos")}
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
                {normalizeText("Meta de PSE")}
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
          </View>

          <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>
              {normalizeText("Parâmetros da sessão")}
            </Text>

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

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>

            {(["AUTO", "MANUAL"] as const).map((value) => {

              const active = editSource === value;

              return (

                <Pressable

                  key={value}

                  onPress={() => setEditSource(value)}

                  style={{

                    paddingVertical: 8,

                    paddingHorizontal: 12,

                    borderRadius: 999,

                    backgroundColor: active ? colors.primaryBg : colors.background,

                    borderWidth: 1,

                    borderColor: active ? colors.primaryBg : colors.border,

                  }}

                >

                  <Text style={{ color: active ? colors.primaryText : colors.text, fontSize: 12, fontWeight: "700" }}>

                    {value}

                  </Text>

                </Pressable>

              );

            })}

          </View>
          </View>

          <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>

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

          <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>

            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
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

                    tone: "default",

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

                  Copiar para próxima

                </Text>

              </Pressable>

            </View>

          </View>

          <View style={{ gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>

            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>

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

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable

              onPress={handleSaveWeek}

              disabled={isSavingWeek}

              style={{

                flex: 1,

                paddingVertical: 10,

                borderRadius: 12,

                alignItems: "center",

                backgroundColor: isSavingWeek ? colors.primaryDisabledBg : colors.primaryBg,

              }}

            >

              <Text style={{ color: isSavingWeek ? colors.secondaryText : colors.primaryText, fontWeight: "700" }}>

                {isSavingWeek ? "Salvando..." : "Salvar alterações"}

              </Text>

            </Pressable>

            <Pressable
              onPress={() => setShowWeekEditor(false)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 12,
                backgroundColor: colors.background,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Cancelar
              </Text>
            </Pressable>
          </View>

          </ScrollView>
          </KeyboardAvoidingView>
        </View>

      </ModalSheet>

    </SafeAreaView>

  );

}









