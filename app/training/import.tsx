import { useMemo, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { useSaveToast } from "../../src/ui/save-toast";
import {
  deleteTrainingPlansByClassAndDate,
  getClasses,
  saveTrainingPlan,
} from "../../src/db/seed";
import type { ClassGroup, TrainingPlan } from "../../src/core/models";
import { normalizeAgeBand } from "../../src/core/age-band";
import { normalizeUnitKey } from "../../src/core/unit-key";

type CsvRow = Record<string, string>;

type TitleInfo = {
  unit: string;
  timeRange: string;
  startTime: string;
  ageBand: string;
};

type PreviewRow = {
  row: CsvRow;
  classId?: string;
  className?: string;
  errors: string[];
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === "\"" && text[i + 1] === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
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

  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  return rows
    .filter((items) => items.some((value) => value.trim().length))
    .map((items) => {
      const record: CsvRow = {};
      header.forEach((key, index) => {
        record[key] = (items[index] ?? "").trim();
      });
      return record;
    });
};

const splitList = (value: string) =>
  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const pad2 = (value: number) => String(value).padStart(2, "0");

const normalizeTimeRange = (value: string) => {
  const match = value.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return "";
  const startHour = pad2(Number(match[1]));
  const startMin = pad2(Number(match[2]));
  const endHour = pad2(Number(match[3]));
  const endMin = pad2(Number(match[4]));
  return `${startHour}:${startMin}-${endHour}:${endMin}`;
};

const extractTitleInfo = (title: string): TitleInfo => {
  const parts = title
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const unit = parts[0] ?? "";
  const timePart = parts.find((part) =>
    /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(part)
  );
  const agePart = parts.find((part) => /\d{1,2}\s*-\s*\d{1,2}/.test(part));
  const timeRange = timePart ? normalizeTimeRange(timePart) : "";
  const ageBand = agePart ? normalizeAgeBand(agePart) : "";
  const startTime = timeRange ? timeRange.split("-")[0] : "";
  return { unit, timeRange, startTime, ageBand };
};

const isValidIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
};

const getWeekday = (dateIso: string) => {
  const date = new Date(`${dateIso}T00:00:00`);
  return date.getDay();
};

const buildMain = (row: CsvRow) => {
  const mainItems = splitList(row.main || "");
  const extras: string[] = [];
  if (row.objective_general) {
    extras.push(`Objetivo geral: ${row.objective_general}`);
  }
  if (row.objective_specific) {
    extras.push(`Objetivo especifico: ${row.objective_specific}`);
  }
  if (row.observations) {
    extras.push(`Observacoes: ${row.observations}`);
  }
  return [...extras, ...mainItems];
};

const matchClass = (
  classes: ClassGroup[],
  row: CsvRow,
  titleInfo: TitleInfo,
  unitHint: string
) => {
  const weekday = getWeekday(row.date);
  let candidates = classes;

  const resolvedUnit = titleInfo.unit || unitHint;
  if (normalizeUnitKey(resolvedUnit)) {
    const resolvedKey = normalizeUnitKey(resolvedUnit);
    candidates = candidates.filter(
      (cls) => normalizeUnitKey(cls.unit) === resolvedKey
    );
  }
  if (titleInfo.startTime) {
    candidates = candidates.filter(
      (cls) => (cls.startTime || "") === titleInfo.startTime
    );
  }
  if (titleInfo.ageBand) {
    candidates = candidates.filter(
      (cls) => normalizeAgeBand(cls.ageBand) === titleInfo.ageBand
    );
  }
  candidates = candidates.filter((cls) => {
    if (!Array.isArray(cls.daysOfWeek) || !cls.daysOfWeek.length) return true;
    return cls.daysOfWeek.includes(weekday);
  });

  return candidates;
};

const buildPlanRow = (row: CsvRow, classId: string): TrainingPlan => {
  const nowIso = new Date().toISOString();
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    classId,
    title: row.title,
    tags: ["importado", "planejamento"],
    warmup: splitList(row.warmup || ""),
    main: buildMain(row),
    cooldown: splitList(row.cooldown || ""),
    warmupTime: row.warmup_time || "",
    mainTime: row.main_time || "",
    cooldownTime: row.cooldown_time || "",
    applyDays: [],
    applyDate: row.date,
    createdAt: nowIso,
  };
};

export default function ImportTrainingCsvScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [csvText, setCsvText] = useState("");
  const [unitHint, setUnitHint] = useState("");
  const [allowPartial, setAllowPartial] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);

  const hasPreview = preview.length > 0;

  const previewStats = useMemo(() => {
    const ok = preview.filter((item) => item.errors.length === 0).length;
    const errors = preview.filter((item) => item.errors.length > 0).length;
    return { ok, errors, total: preview.length };
  }, [preview]);

  const loadClasses = async () => {
    if (classes.length) return classes;
    const list = await getClasses();
    setClasses(list);
    return list;
  };

  const buildPreview = async () => {
    if (!csvText.trim()) return;
    const classList = await loadClasses();
    const rows = parseCsv(csvText);
    const results: PreviewRow[] = rows.map((row) => {
      const errors: string[] = [];
      if (!row.date || !isValidIsoDate(row.date)) {
        errors.push("Data inválida");
      }
      if (!row.title) {
        errors.push("Título ausente");
      }
      const info = extractTitleInfo(row.title || "");
      if (!normalizeUnitKey(info.unit) && !normalizeUnitKey(unitHint)) {
        errors.push("Unidade não encontrada no título");
      }
      if (!info.timeRange) {
        errors.push("Horário não encontrado no título");
      }
      if (!info.ageBand) {
        errors.push("Faixa etária não encontrada no título");
      }
      let matched: ClassGroup[] = [];
      if (!errors.length) {
        matched = matchClass(classList, row, info, unitHint.trim());
        if (matched.length === 0) {
          errors.push("Turma não encontrada");
        } else if (matched.length > 1) {
          errors.push("Turma ambígua (ajuste o título)");
        }
      }
      return {
        row,
        classId: matched[0]?.id,
        className: matched[0]?.name,
        errors,
      };
    });
    setPreview(results);
  };

  const runImport = async () => {
    if (!preview.length) return;
    const rowsToImport = allowPartial
      ? preview.filter((item) => item.errors.length === 0)
      : preview;
    if (!rowsToImport.length || (!allowPartial && previewStats.errors > 0)) return;
    setLoading(true);
    try {
      for (const item of rowsToImport) {
        if (!item.classId) continue;
        await deleteTrainingPlansByClassAndDate(item.classId, item.row.date);
        const plan = buildPlanRow(item.row, item.classId);
        await saveTrainingPlan(plan);
      }
      if (allowPartial && previewStats.errors > 0) {
        showSaveToast(
          `Importado ${rowsToImport.length} linhas. Ignoradas ${previewStats.errors}.`
        );
      } else {
        showSaveToast("Planejamento importado.");
      }
      router.back();
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <ScreenHeader
          title="Importar CSV"
          subtitle="Cole o CSV do planejamento e revise antes de salvar."
          onBack={() => router.back()}
        />

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Unidade (opcional, se não estiver no título)
          </Text>
          <TextInput
            placeholder="Ex: Rede Esperança"
            value={unitHint}
            onChangeText={setUnitHint}
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
          <Text style={{ color: colors.muted, fontSize: 12 }}>CSV</Text>
          <TextInput
            multiline
            value={csvText}
            onChangeText={setCsvText}
            placeholder="Cole o CSV completo aqui"
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
              minHeight: 160,
              textAlignVertical: "top",
            }}
          />
        </View>

        <Pressable
          onPress={buildPreview}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: colors.primaryBg,
          }}
        >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              Pre-visualizar
            </Text>
          </Pressable>

        <Pressable
          onPress={() => setAllowPartial((prev) => !prev)}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: allowPartial ? colors.primaryBg : colors.border,
            backgroundColor: allowPartial ? colors.primaryBg : colors.card,
          }}
        >
          <Text
            style={{
              color: allowPartial ? colors.primaryText : colors.text,
              fontWeight: "700",
            }}
          >
            Importar apenas linhas validas
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
            Ignora linhas com erro e salva o restante.
          </Text>
        </Pressable>

        {hasPreview ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              padding: 12,
              gap: 8,
            }}
          >
            <Text style={{ fontWeight: "700", color: colors.text }}>
              Resultado
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {previewStats.total} linhas | {previewStats.ok} ok | {previewStats.errors} com erro
            </Text>
            {preview.map((item) => (
              <View
                key={`${item.row.date}-${item.row.title}`}
                style={{
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "600" }}>
                  {item.row.date} - {item.row.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.className ? `Turma: ${item.className}` : "Turma: -"}
                </Text>
                {item.errors.length ? (
                  <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                    {item.errors.join(" | ")}
                  </Text>
                ) : (
                  <Text style={{ color: colors.successText, fontSize: 12 }}>
                    OK
                  </Text>
                )}
              </View>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={runImport}
          disabled={
            !hasPreview ||
            loading ||
            (allowPartial ? previewStats.ok === 0 : previewStats.errors > 0)
          }
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor:
              !hasPreview ||
              loading ||
              (allowPartial ? previewStats.ok === 0 : previewStats.errors > 0)
                ? colors.primaryDisabledBg
                : colors.primaryBg,
          }}
        >
          <Text
            style={{
              color:
                !hasPreview || previewStats.errors > 0 || loading
                  ? colors.secondaryText
                  : colors.primaryText,
              fontWeight: "700",
            }}
          >
            {loading ? "Importando..." : "Importar planejamento"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
