import { useMemo, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";
import { ScreenHeader } from "../../src/ui/ScreenHeader";
import { useSaveToast } from "../../src/ui/save-toast";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.js";
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
  classId: string;
  className: string;
  errors: string[];
};

const xlsxWithCodepage = XLSX as typeof XLSX & {
  set_cptable?: (value: unknown) => void;
};
if (typeof xlsxWithCodepage.set_cptable === "function") {
  xlsxWithCodepage.set_cptable(cptable);
}

const normalizeCsvDate = (value: string) => {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    return `${year}-${month}-${day}`;
  }
  return raw;
};

const formatDatePtBr = (value: string) => {
  const match = (value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const detectCsvDelimiter = (value: string) => {
  const firstLine =
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

const parseDelimitedRows = (text: string, delimiter: "," | ";") => {
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

const mapRawRowsToImportRows = (rows: string[][]) => {
  const todayIso = new Date().toISOString().slice(0, 10);
  const normalizeHeaderKey = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const aliasMap: Record<string, string[]> = {
    date: ["date", "data", "dia", "data inicio", "data aplicacao"],
    title: ["title", "titulo", "titulo do planejamento", "nome", "planejamento"],
    tags: ["tags", "tag", "etiquetas"],
    warmup: ["warmup", "aquecimento"],
    main: ["main", "parte principal", "principal"],
    cooldown: ["cooldown", "volta a calma", "volta calma"],
    warmup_time: ["warmup time", "warmup_time", "tempo aquecimento"],
    main_time: ["main time", "main_time", "tempo principal"],
    cooldown_time: ["cooldown time", "cooldown_time", "tempo volta calma", "tempo volta a calma"],
  };

  const resolveCanonicalKey = (headerValue: string) => {
    const normalized = normalizeHeaderKey(headerValue);
    const entries = Object.entries(aliasMap);
    for (const [canonical, aliases] of entries) {
      if (aliases.includes(normalized)) return canonical;
    }
    return "";
  };

  const firstRow = rows[0] ?? [];
  const firstRowCanonical = firstRow.map(resolveCanonicalKey).filter(Boolean);
  const hasHeader = firstRowCanonical.length >= 2;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const headerCanonical = hasHeader ? firstRow.map(resolveCanonicalKey) : [];

  return dataRows
    .filter((items) => items.some((value) => value.trim().length))
    .map((items) => {
      const record: CsvRow = {
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
        headerCanonical.forEach((key, index) => {
          if (!key) return;
          const cell = (items[index] ?? "").trim();
          record[key] = key === "date" ? normalizeCsvDate(cell) : cell;
        });
      } else {
        const cells = items.map((value) => (value ?? "").trim());
        const firstCellDate = normalizeCsvDate(cells[0] ?? "");
        const startsWithDate = isValidIsoDate(firstCellDate);
        if (startsWithDate) {
          record.date = firstCellDate;
          record.title = cells[1] ?? "";
          record.tags = cells[2] ?? "";
          record.warmup = cells[3] ?? "";
          record.main = cells[4] ?? "";
          record.cooldown = cells[5] ?? "";
          record.warmup_time = cells[6] ?? "";
          record.main_time = cells[7] ?? "";
          record.cooldown_time = cells[8] ?? "";
        } else {
          record.title = cells[0] ?? "";
          record.tags = cells[1] ?? "";
          record.warmup = cells[2] ?? "";
          record.main = cells[3] ?? "";
          record.cooldown = cells[4] ?? "";
          record.warmup_time = cells[5] ?? "";
          record.main_time = cells[6] ?? "";
          record.cooldown_time = cells[7] ?? "";
        }
      }

      if (!record.date) {
        record.date = todayIso;
        record.__autoDate = "1";
      }

      return record;
    });
};

const parseCsv = (text: string) =>
  mapRawRowsToImportRows(parseDelimitedRows(text, detectCsvDelimiter(text)));

const parseSpreadsheetRows = (value: unknown[][]): string[][] =>
  value.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []
  );

const dataUriBase64ToArrayBuffer = (value: string): ArrayBuffer => {
  const data = value.includes(",") ? value.split(",")[1] ?? "" : value;
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const readWebAssetArrayBuffer = async (
  asset: DocumentPicker.DocumentPickerAsset
): Promise<ArrayBuffer> => {
  if (asset.file && typeof asset.file.arrayBuffer === "function") {
    return asset.file.arrayBuffer();
  }
  if (asset.base64) {
    return dataUriBase64ToArrayBuffer(asset.base64);
  }
  if (asset.uri.startsWith("data:")) {
    return dataUriBase64ToArrayBuffer(asset.uri);
  }
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error("Nao foi possivel ler o arquivo selecionado no navegador.");
  }
  return response.arrayBuffer();
};

const readWebAssetText = async (
  asset: DocumentPicker.DocumentPickerAsset
): Promise<string> => {
  if (asset.file && typeof asset.file.text === "function") {
    return asset.file.text();
  }
  if (asset.base64) {
    return atob(asset.base64);
  }
  if (asset.uri.startsWith("data:")) {
    const buffer = dataUriBase64ToArrayBuffer(asset.uri);
    return new TextDecoder("utf-8").decode(new Uint8Array(buffer));
  }
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error("Nao foi possivel ler o arquivo selecionado no navegador.");
  }
  return response.text();
};

const splitList = (value: string) =>
  value
    .split(/\r?\n|\|/g)
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
  // Only treat first segment as unit when metadata is explicitly pipe-separated.
  const unit = parts.length > 1 ? parts[0] ?? "" : "";
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
    extras.push(`Objetivo específico: ${row.objective_specific}`);
  }
  if (row.observations) {
    extras.push(`Observações: ${row.observations}`);
  }
  return [...extras, ...mainItems];
};

const normalizeText = (value: string) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const resolveAmbiguousClass = (candidates: ClassGroup[], title: string) => {
  if (candidates.length <= 1) return candidates[0] ?? null;

  const normalizedNames = new Set(candidates.map((item) => normalizeText(item.name)));
  if (normalizedNames.size === 1) return candidates[0];

  const titleHintRaw = (title ?? "").split("-")[0]?.trim() ?? "";
  const titleHint = normalizeText(titleHintRaw);
  if (!titleHint) return null;

  const exact = candidates.filter((item) => normalizeText(item.name) === titleHint);
  if (exact.length === 1) return exact[0];

  const contains = candidates.filter((item) => {
    const name = normalizeText(item.name);
    return name.includes(titleHint) || titleHint.includes(name);
  });
  if (contains.length === 1) return contains[0];

  const tokens = titleHint.split(/\s+/).filter((token) => token.length >= 2);
  if (!tokens.length) return null;

  let best: ClassGroup | null = null;
  let bestScore = 0;
  let tie = false;

  candidates.forEach((item) => {
    const normalizedName = normalizeText(item.name);
    const score = tokens.reduce(
      (total, token) => total + (normalizedName.includes(token) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      best = item;
      bestScore = score;
      tie = false;
      return;
    }
    if (score === bestScore && score > 0) {
      tie = true;
    }
  });

  if (best && bestScore > 0 && !tie) return best;
  return null;
};

const matchClass = (
  classes: ClassGroup[],
  row: CsvRow,
  titleInfo: TitleInfo,
  unitHint: string,
  classIdHint?: string
) => {
  let candidates = classes;
  const fixedClassId = String(classIdHint ?? "").trim();
  if (fixedClassId) {
    candidates = candidates.filter((cls) => cls.id === fixedClassId);
  }

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
  const shouldFilterWeekday =
    row.__autoDate !== "1" && Boolean(row.date) && isValidIsoDate(row.date);
  if (shouldFilterWeekday) {
    const weekday = getWeekday(row.date);
    candidates = candidates.filter((cls) => {
      if (!Array.isArray(cls.daysOfWeek) || !cls.daysOfWeek.length) return true;
      return cls.daysOfWeek.includes(weekday);
    });
  }

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
  return <Redirect href="/training" />;

  const { classId: classIdHintParam, unit: unitHintParam } = useLocalSearchParams<{
    classId?: string;
    unit?: string;
  }>();
  const router = useRouter();
  const { colors } = useAppTheme();
  const { showSaveToast } = useSaveToast();
  const [csvText, setCsvText] = useState("");
  const [loadedRows, setLoadedRows] = useState<CsvRow[] | null>(null);
  const [unitHint, setUnitHint] = useState(String(unitHintParam ?? ""));
  const [allowPartial, setAllowPartial] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const classIdHint = String(classIdHintParam ?? "").trim();

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

  const pickImportFile = async () => {
    try {
      setFileLoading(true);
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

      const sourceFilename = String(asset.name ?? "").trim().toLowerCase();
      if (sourceFilename.endsWith(".pdf") || asset.mimeType === "application/pdf") {
        showSaveToast({
          message: "PDF nao e suportado para importacao direta. Use CSV/XLSX.",
          variant: "info",
        });
        return;
      }

      const isSpreadsheet =
        sourceFilename.endsWith(".xlsx") ||
        sourceFilename.endsWith(".xls") ||
        asset.mimeType?.includes("spreadsheet") ||
        asset.mimeType?.includes("excel");

      let rows: CsvRow[] = [];
      if (isSpreadsheet) {
        const workbook =
          Platform.OS === "web"
            ? XLSX.read(await readWebAssetArrayBuffer(asset), { type: "array" })
            : XLSX.read(await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 }), {
                type: "base64",
              });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) throw new Error("Planilha vazia.");
        const worksheet = workbook.Sheets[firstSheet];
        if (!worksheet) throw new Error("Nao foi possivel ler a primeira aba.");
        const matrix = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as unknown[][];
        rows = mapRawRowsToImportRows(parseSpreadsheetRows(matrix));
      } else {
        const text =
          Platform.OS === "web"
            ? await readWebAssetText(asset)
            : await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
        rows = parseCsv(text);
      }

      if (!rows.length) {
        throw new Error("Nenhuma linha valida encontrada no arquivo.");
      }

      setPreview([]);
      setLoadedRows(rows);
      showSaveToast({
        message: `${rows.length} linhas carregadas. Clique em Pre-visualizar.`,
        variant: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ler arquivo.";
      showSaveToast({ message, variant: "error" });
    } finally {
      setFileLoading(false);
    }
  };

  const buildPreview = async () => {
    if (!loadedRows && !csvText.trim()) return;
    const classList = await loadClasses();
    const rows = loadedRows ?? parseCsv(csvText);
    const results: PreviewRow[] = rows.map((row) => {
      const errors: string[] = [];
      if (row.date && !isValidIsoDate(row.date)) {
        errors.push("Data inválida");
      }
      if (!row.title) {
        errors.push("Título ausente");
      }
      const info = extractTitleInfo(row.title || "");
      let matched: ClassGroup[] = [];
      if (!errors.length) {
        matched = matchClass(classList, row, info, unitHint.trim(), classIdHint);
        if (matched.length === 0) {
          errors.push("Turma não encontrada");
        } else if (matched.length > 1) {
          const resolved = resolveAmbiguousClass(matched, row.title || "");
          if (resolved) {
            matched = [resolved];
          } else {
            errors.push("Turma ambígua (ajuste o título)");
          }
        }
      }
      const selectedClass = matched[0] ?? null;
      return {
        row,
        classId: selectedClass?.id ?? "",
        className: selectedClass?.name ?? "",
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
          title="Importar planejamento"
          subtitle="Selecione planilha (.csv/.xls/.xlsx) ou cole CSV e revise antes de salvar."
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
          <Pressable
            onPress={() => void pickImportFile()}
            disabled={fileLoading}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: colors.secondaryBg,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: fileLoading ? 0.7 : 1,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {fileLoading ? "Lendo arquivo..." : "Selecionar arquivo (.csv/.xls/.xlsx)"}
            </Text>
          </Pressable>
          {loadedRows ? (
            <Text style={{ color: colors.successText, fontSize: 12 }}>
              Arquivo carregado com {loadedRows.length} linhas.
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>CSV</Text>
          <TextInput
            multiline
            value={csvText}
            onChangeText={(value) => {
              setLoadedRows(null);
              setCsvText(value);
            }}
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

        { hasPreview ? (
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
                  {formatDatePtBr(item.row.date)} - {item.row.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.className ? `Turma: ${item.className}` : "Turma: -"}
                </Text>
                { item.errors.length ? (
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



