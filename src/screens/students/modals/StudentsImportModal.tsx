import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";

import type { ClassGroup } from "../../../core/models";
import {
    applyStudentsSync,
    previewStudentsSync,
    type ImportPolicy,
    type StudentImportFunctionResult,
    type StudentImportRow,
} from "../../../services/students-sync-service";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useConfirmDialog } from "../../../ui/confirm-dialog";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";
import {
  assertImportAssetWithinLimits,
  normalizeSpreadsheetMatrixForImport,
} from "../../../utils/import-file-guards";
import { loadXlsx } from "../../../utils/load-xlsx";

type StudentsImportModalProps = {
  visible: boolean;
  organizationId: string | null;
  classes: ClassGroup[];
  onClose: () => void;
  onImportApplied?: () => void;
};

type LoadedImportFile = {
  sourceFilename: string;
  rows: StudentImportRow[];
};

const FLAG_DETAILS: Record<string, { title: string; hint: string }> = {
  BIRTHDATE_CONFLICT: {
    title: "Data de nascimento diferente",
    hint: "Ja existe aluno com data diferente da planilha.",
  },
  RG_CONFLICT: {
    title: "RG diferente",
    hint: "RG informado nao bate com o cadastro atual.",
  },
  CLASS_NOT_FOUND: {
    title: "Turma nao encontrada",
    hint: "Turma da planilha nao existe na organizacao ativa.",
  },
  DUPLICATE_INPUT_ROW: {
    title: "Linha duplicada na planilha",
    hint: "A mesma pessoa aparece mais de uma vez no arquivo.",
  },
  LOW_CONFIDENCE_MATCH: {
    title: "Correspondencia fraca",
    hint: "O sistema nao teve seguranca para atualizar automaticamente.",
  },
  ROW_ERROR: {
    title: "Erro de linha",
    hint: "A linha nao pode ser processada automaticamente.",
  },
  AMBIGUOUS_MATCH: {
    title: "Mais de um cadastro possível",
    hint: "Confira qual aluno deve receber os dados da planilha.",
  },
  NAME_REQUIRED: {
    title: "Nome inválido",
    hint: "Nome vazio impede a atualização do aluno existente.",
  },
  EXTERNAL_ID_CONFLICT: {
    title: "Id externo com conflito",
    hint: "Registro existente tem id externo diferente do importado.",
  },
  RA_CONFLICT: {
    title: "RA em conflito",
    hint: "RA diverge do cadastro existente.",
  },
  GUARDIAN_CPF_CONFLICT: {
    title: "CPF do responsável em conflito",
    hint: "CPF do responsável diverge do cadastro atual.",
  },
  GUARDIAN_NAME_CONFLICT: {
    title: "Nome do responsável em conflito",
    hint: "Nome do responsável diverge do cadastro atual.",
  },
  PHONE_CONFLICT: {
    title: "Telefone em conflito",
    hint: "Telefone diverge do cadastro atual.",
  },
  LOGIN_EMAIL_CONFLICT: {
    title: "Email em conflito",
    hint: "Email diverge do cadastro atual.",
  },
  NAME_CONFLICT: {
    title: "Nome em conflito",
    hint: "Nome divergente impede atualização automática.",
  },
  CLASS_CONFLICT: {
    title: "Turma em conflito",
    hint: "Turma atual permanece para não sobrescrever registro existente.",
  },
  BIRTHDATE_SUSPECT: {
    title: "Data em padrão improvável",
    hint: "Data fora do intervalo esperado para esse perfil.",
  },
};

const getFlagDetail = (flag: string) =>
  FLAG_DETAILS[flag] ?? {
    title: flag.replace(/_/g, " ").toLowerCase(),
    hint: "Revisao manual recomendada.",
  };

type ConflictResolutionMode = "KEEP_EXISTING" | "OVERWRITE" | "SKIP";

const RESOLUTION_OPTIONS: {
  id: ConflictResolutionMode;
  label: string;
  description: string;
  tone: "neutral" | "warning" | "danger";
}[] = [
  {
    id: "KEEP_EXISTING",
    label: "Manter atual",
    description: "Não altera o aluno existente.",
    tone: "neutral",
  },
  {
    id: "OVERWRITE",
    label: "Sobrescrever",
    description: "Usa os dados da planilha nos campos divergentes.",
    tone: "warning",
  },
  {
    id: "SKIP",
    label: "Pular",
    description: "Ignora essa linha por enquanto.",
    tone: "danger",
  },
];

const INTERNAL_IMPORT_POLICY: ImportPolicy = "misto";

const HEADER_ALIASES: Record<string, string[]> = {
  externalId: ["externalid", "external_id", "id externo", "id_externo", "id legado"],
  name: ["nome", "name", "aluno", "atleta", "nome aluno"],
  ra: ["ra", "r a", "registro academico", "matricula", "matricula aluno"],
  birthDate: [
    "nascimento",
    "data nasc",
    "data nascimento",
    "dt nascimento",
    "birthdate",
    "birth_date",
  ],
  rg: ["rg", "rg aluno", "doc", "documento"],
  classId: ["classid", "class_id", "id turma", "id_turma"],
  className: ["turma", "nome turma", "categoria", "classname", "class_name"],
  unit: ["unidade", "polo", "local", "unit"],
  guardianName: ["responsavel", "nome responsavel", "guardianname", "guardian_name"],
  guardianPhone: [
    "telefone responsavel",
    "fone responsavel",
    "celular responsavel",
    "guardianphone",
    "guardian_phone",
  ],
  guardianCpf: ["cpf responsavel", "cpf mae", "cpf pai", "guardiancpf", "guardian_cpf"],
  phone: ["telefone", "celular", "phone"],
  loginEmail: ["email", "e-mail", "email aluno", "loginemail", "login_email"],
};

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normalizeDate = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
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

const parseDelimitedRows = (value: string, delimiter: "," | ";"): string[][] => {
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

type ImportRowForPreview = {
  rowNumber: number;
  studentLabel: string;
  className: string;
};

type ClassImpact = {
  className: string;
  create: number;
  update: number;
  conflict: number;
  skip: number;
  error: number;
};

const parseCsvRows = (value: string): string[][] =>
  parseDelimitedRows(value, detectCsvDelimiter(value));

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

type ImportSourceReader = {
  sourceFilename: string;
  sourceMimeType?: string | null;
  sourceSize?: number | null;
  readArrayBuffer: () => Promise<ArrayBuffer>;
  readText: () => Promise<string>;
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

const readWebAssetText = async (asset: DocumentPicker.DocumentPickerAsset): Promise<string> => {
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

const readNativeArrayBuffer = async (uri: string) => {
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  return dataUriBase64ToArrayBuffer(`data:application/octet-stream;base64,${base64}`);
};

const parseImportedFileSource = async (source: ImportSourceReader): Promise<LoadedImportFile> => {
  assertImportAssetWithinLimits({ name: source.sourceFilename, size: source.sourceSize });

  const sourceFilename = String(source.sourceFilename ?? "").trim() || "students-import.xlsx";
  const lowerName = sourceFilename.toLowerCase();
  const isSpreadsheet =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    source.sourceMimeType?.includes("spreadsheet") ||
    source.sourceMimeType?.includes("excel");

  let rowsMatrix: string[][] = [];
  if (isSpreadsheet) {
    const XLSX = await loadXlsx();
    const workbook = XLSX.read(await source.readArrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Planilha vazia.");
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) throw new Error("Nao foi possivel ler a primeira aba da planilha.");
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];
    rowsMatrix = parseSpreadsheetRows(normalizeSpreadsheetMatrixForImport(rows));
  } else {
    rowsMatrix = parseCsvRows(await source.readText());
  }

  const rows = mapRawRowsToImport(rowsMatrix);
  if (!rows.length) throw new Error("Nenhuma linha valida encontrada no arquivo.");

  return { sourceFilename, rows };
};

const createImportedSourceReaderFromPickerAsset = (
  asset: DocumentPicker.DocumentPickerAsset
): ImportSourceReader => {
  const sourceFilename = String(asset.name ?? "").trim() || "students-import.xlsx";
  return {
    sourceFilename,
    sourceMimeType: asset.mimeType,
    sourceSize: asset.size,
    readArrayBuffer: () =>
      Platform.OS === "web" ? readWebAssetArrayBuffer(asset) : readNativeArrayBuffer(asset.uri),
    readText: () =>
      Platform.OS === "web" ? readWebAssetText(asset) : readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 }),
  };
};

const createImportedSourceReaderFromBrowserFile = (file: File): ImportSourceReader => ({
  sourceFilename: file.name || "students-import.xlsx",
  sourceMimeType: file.type,
  sourceSize: file.size,
  readArrayBuffer: () => file.arrayBuffer(),
  readText: () => file.text(),
});

const resolveCanonicalKey = (value: string): keyof StudentImportRow | "" => {
  const header = normalizeHeader(value);
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(header)) return canonical as keyof StudentImportRow;
  }
  return "";
};

const hasHeader = (firstRow: string[]) => {
  const resolved = firstRow.map(resolveCanonicalKey).filter(Boolean);
  return resolved.length >= 2;
};

const mapRawRowsToImport = (rawRows: string[][]): StudentImportRow[] => {
  const parsedRows = rawRows.filter((row) =>
    row.some((cell) => String(cell ?? "").trim().length > 0)
  );
  if (!parsedRows.length) return [];

  const firstRow = parsedRows[0] ?? [];
  const usesHeader = hasHeader(firstRow);
  const dataRows = usesHeader ? parsedRows.slice(1) : parsedRows;
  const headerKeys = usesHeader ? firstRow.map(resolveCanonicalKey) : [];

  return dataRows
    .map((cells, rowIndex) => {
      const base: StudentImportRow = {
        sourceRowNumber: rowIndex + 1,
      };
      if (usesHeader) {
        headerKeys.forEach((key, index) => {
          if (!key) return;
          const raw = String(cells[index] ?? "").trim();
          if (!raw) return;
          if (key === "birthDate") {
            base.birthDate = normalizeDate(raw);
            return;
          }
          (base as Record<string, string | number | undefined>)[key] = raw;
        });
      } else {
        base.name = String(cells[0] ?? "").trim();
        base.ra = String(cells[1] ?? "").trim();
        base.birthDate = normalizeDate(String(cells[2] ?? "").trim());
        base.rg = String(cells[3] ?? "").trim();
        base.className = String(cells[4] ?? "").trim();
        base.unit = String(cells[5] ?? "").trim();
        base.guardianName = String(cells[6] ?? "").trim();
        base.guardianPhone = String(cells[7] ?? "").trim();
        base.guardianCpf = String(cells[8] ?? "").trim();
        base.phone = String(cells[9] ?? "").trim();
        base.loginEmail = String(cells[10] ?? "").trim();
      }
      if (!base.name) return null;
      return base;
    })
    .filter((item): item is StudentImportRow => Boolean(item));
};

const pickImportFileRows = async (): Promise<LoadedImportFile | null> => {
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
    ],
  });

  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) throw new Error("Arquivo invalido.");
  return parseImportedFileSource(createImportedSourceReaderFromPickerAsset(asset));
};

export function StudentsImportModal({
  visible,
  organizationId,
  onClose,
  onImportApplied,
}: StudentsImportModalProps) {
  const { colors } = useAppTheme();
  const { confirm: confirmDialog } = useConfirmDialog();
  const cardStyle = useModalCardStyle({
    maxWidth: 560,
    maxHeight: "80%",
    padding: 16,
    radius: 20,
  });

  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<LoadedImportFile | null>(null);
  const [previewResult, setPreviewResult] = useState<StudentImportFunctionResult | null>(null);
  const [applyLoading, setApplyLoading] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<number, ConflictResolutionMode>>({});
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragZoneRef = useRef<HTMLDivElement | null>(null);

  const resetState = useCallback(() => {
    setLoadingMessage(null);
    setFileInfo(null);
    setPreviewResult(null);
    setApplyLoading(false);
    setFlowError(null);
    setConflictResolutions({});
  }, []);

  const handleImportError = useCallback(
    async (error: unknown) => {
      const message = error instanceof Error ? error.message : "Falha ao processar planilha.";
      const normalized = message.toLowerCase();
      const isAuthError =
        normalized.includes("sessao expirada") ||
        normalized.includes("invalid jwt") ||
        normalized.includes("unauthorized");

      if (isAuthError) {
        setFlowError("Sessao expirada. Faca login novamente.");
        Alert.alert("Sessao expirada", "Faça login novamente para importar planilhas.");
        return;
      }

      setFlowError(message);
      Alert.alert("Importacao", message);
    },
    []
  );

  const generatePreview = useCallback(
    async (selected: LoadedImportFile) => {
      if (!organizationId) return;
      try {
        setLoadingMessage("Lendo os alunos da planilha...");
        const preview = await previewStudentsSync({
          organizationId,
          policy: INTERNAL_IMPORT_POLICY,
          sourceFilename: selected.sourceFilename,
          rows: selected.rows,
        });
        setPreviewResult(preview);
        const defaults: Record<number, ConflictResolutionMode> = {};
        for (const row of preview.rows) {
          if (row.action === "conflict") {
            defaults[row.rowNumber] = "KEEP_EXISTING";
          }
        }
        setConflictResolutions(defaults);
        setLoadingMessage(null);
      } catch (error) {
        await handleImportError(error);
        setLoadingMessage(null);
      }
    },
    [handleImportError, organizationId]
  );

  const loadParsedImport = useCallback(
    async (parsed: LoadedImportFile | null) => {
      if (!organizationId) return;
      if (!parsed) {
        setLoadingMessage(null);
        setFlowError("Nenhum arquivo selecionado.");
        return;
      }
      setFileInfo(parsed);
      setPreviewResult(null);
      setLoadingMessage(null);
    },
    [organizationId]
  );

  const startFlow = useCallback(async () => {
    if (!organizationId) {
      Alert.alert("Importacao", "Selecione uma organizacao ativa.");
      return;
    }

    setFlowError(null);
    setLoadingMessage("Selecionando planilha...");
    try {
      const selected = await pickImportFileRows();
      await loadParsedImport(selected);
    } catch (error) {
      await handleImportError(error);
      setLoadingMessage(null);
    }
  }, [handleImportError, loadParsedImport, organizationId]);

  const openFileInput = useCallback(() => {
    if (Platform.OS !== "web" || !fileInputRef.current) {
      void startFlow();
      return;
    }
    fileInputRef.current.click();
  }, [startFlow]);

  const handleImportDropFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!organizationId) {
        Alert.alert("Importacao", "Selecione uma organizacao ativa.");
        return;
      }
      try {
        setFlowError(null);
        setLoadingMessage("Selecionando planilha...");
        const parsed = await parseImportedFileSource(createImportedSourceReaderFromBrowserFile(file));
        await loadParsedImport(parsed);
      } catch (error) {
        await handleImportError(error);
        setLoadingMessage(null);
      }
    },
    [handleImportError, loadParsedImport, organizationId]
  );

  const handleImportFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const target = event.currentTarget;
      const selected = target.files?.[0] ?? null;
      target.value = "";
      if (selected) {
        void handleImportDropFile(selected);
      }
    },
    [handleImportDropFile]
  );

  useEffect(() => {
    if (Platform.OS !== "web" || !visible) return;

    const dropZone = dragZoneRef.current;
    if (!dropZone) return;

    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(true);
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const onDragLeave = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const related = event.relatedTarget as Node | null;
      if (!related || !dropZone.contains(related)) {
        setIsDragActive(false);
      }
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);
      const dropped = event.dataTransfer?.files?.[0] ?? null;
      if (!dropped) return;
      void handleImportDropFile(dropped);
    };

    dropZone.addEventListener("dragover", onDragOver);
    dropZone.addEventListener("dragleave", onDragLeave);
    dropZone.addEventListener("drop", onDrop);

    return () => {
      dropZone.removeEventListener("dragover", onDragOver);
      dropZone.removeEventListener("dragleave", onDragLeave);
      dropZone.removeEventListener("drop", onDrop);
    };
  }, [handleImportDropFile, visible]);

  useEffect(() => {
    if (!visible || !fileInfo || !organizationId) return;
    void generatePreview(fileInfo);
  }, [generatePreview, fileInfo, organizationId, visible]);

  useEffect(() => {
    if (!visible) {
      Promise.resolve().then(() => {
        resetState();
      });
    }
  }, [resetState, visible]);

  const summary = previewResult?.summary ?? null;
  const conflictRows = useMemo(
    () => previewResult?.rows?.filter((row) => row.action === "conflict") ?? [],
    [previewResult?.rows]
  );
  const sourceRowsByNumber = useMemo(() => {
    const map = new Map<number, StudentImportRow>();
    if (!fileInfo?.rows?.length) return map;
    for (const item of fileInfo.rows) {
      if (typeof item.sourceRowNumber === "number" && Number.isFinite(item.sourceRowNumber)) {
        map.set(item.sourceRowNumber, item);
      }
    }
    return map;
  }, [fileInfo?.rows]);
  const previewImpactSamples = useMemo(() => {
    const byAction: Record<string, ImportRowForPreview[]> = {
      create: [],
      update: [],
      conflict: [],
      skip: [],
      error: [],
    };
    if (!previewResult?.rows) return byAction;
    for (const row of previewResult.rows) {
      const sourceRow = sourceRowsByNumber.get(row.rowNumber);
      byAction[row.action] = byAction[row.action] ?? [];
      const className = String(row.className ?? sourceRow?.className ?? row.matchedBy ?? "Sem turma");
      byAction[row.action].push({
        rowNumber: row.rowNumber,
        studentLabel: sourceRow?.name || `Linha ${row.rowNumber}`,
        className,
      });
    }
    return byAction;
  }, [previewResult?.rows, sourceRowsByNumber]);
  const classImpact = useMemo(() => {
    const map = new Map<string, ClassImpact>();
    if (!previewResult?.rows?.length) return [];
    for (const row of previewResult.rows) {
      const sourceRow = sourceRowsByNumber.get(row.rowNumber);
      const className = String(row.className ?? sourceRow?.className ?? "Sem turma");
      const snapshot = map.get(className) ?? {
        className,
        create: 0,
        update: 0,
        conflict: 0,
        skip: 0,
        error: 0,
      };
      if (row.action in snapshot) {
        (snapshot[row.action as keyof Omit<ClassImpact, "className">] as number) += 1;
      }
      map.set(className, snapshot);
    }
    return Array.from(map.values())
      .sort((a, b) => b.create + b.update + b.conflict - (a.create + a.update + a.conflict))
      .slice(0, 4);
  }, [previewResult?.rows, sourceRowsByNumber]);
  const unresolvedConflictRows = useMemo(
    () => conflictRows.filter((row) => !conflictResolutions[row.rowNumber]),
    [conflictResolutions, conflictRows]
  );
  const estimatedApplyCount = useMemo(() => {
    if (!summary) return 0;
    const overwriteCount = conflictRows.filter(
      (row) => conflictResolutions[row.rowNumber] === "OVERWRITE"
    ).length;
    return summary.create + summary.update + overwriteCount;
  }, [conflictRows, conflictResolutions, summary]);

  const actionSummaryRows = useMemo(
    () =>
      [
        { label: "Novos alunos", value: summary?.create ?? 0 },
        { label: "Cadastros a completar", value: summary?.update ?? 0 },
        { label: "Precisam de revisão", value: summary?.conflict ?? 0 },
        { label: "Sem alterações", value: summary?.skip ?? 0 },
        { label: "Não reconhecidos", value: summary?.error ?? 0 },
      ]
        .filter((item) => Number(item.value) > 0)
        .map((item) => item),
    [summary]
  );

  const hasUnresolvedConflicts = unresolvedConflictRows.length > 0;
  const applyPreviewCards = actionSummaryRows;
  const computedFlagTotals = (() => {
    const totals: Record<string, number> = {};
    if (summary?.flags) {
      for (const [flag, total] of Object.entries(summary.flags)) {
        const numeric = Number(total ?? 0);
        if (numeric > 0) totals[flag] = numeric;
      }
    }
    if (!Object.keys(totals).length && previewResult?.rows?.length) {
      for (const row of previewResult.rows) {
        const flags = Array.isArray(row.flags) ? row.flags : [];
        for (const flag of flags) {
          totals[flag] = (totals[flag] ?? 0) + 1;
        }
      }
    }
    if (!Object.keys(totals).length && (summary?.conflict ?? 0) > 0) {
      totals.LOW_CONFIDENCE_MATCH = Number(summary?.conflict ?? 0);
    }
    return totals;
  })();
  const topConflictFlags = useMemo(() => {
    if (!summary) return [];
    return Object.entries(computedFlagTotals)
      .filter(([, total]) => Number(total) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 2);
  }, [computedFlagTotals, summary]);
  const canApply = Boolean(summary && estimatedApplyCount > 0 && !hasUnresolvedConflicts);
  const confirmApply = useCallback(async () => {
    if (!organizationId || !fileInfo || !previewResult) return;
    if (hasUnresolvedConflicts) {
      Alert.alert(
        "Importacao",
        "Resolva os conflitos pendentes antes de aplicar. Selecione 'Manter atual' ou 'Pular' ou 'Sobrescrever'."
      );
      return;
    }

    const shouldApply = await confirmDialog({
      title: "Importar lista de alunos",
      message: `A lista adicionará ${summary?.create ?? 0} alunos e completará ${summary?.update ?? 0} cadastros. Deseja aplicar essas alterações?`,
      confirmLabel: "Importar lista",
      cancelLabel: "Cancelar",
      tone: "default",
      onConfirm: async () => {},
    });
    if (!shouldApply) return;

    setApplyLoading(true);
    try {
      const result = await applyStudentsSync({
        organizationId,
        policy: INTERNAL_IMPORT_POLICY,
        sourceFilename: fileInfo.sourceFilename,
        runId: previewResult.runId,
        resolutions: conflictRows.reduce<Record<string, ConflictResolutionMode>>((acc, row) => {
          acc[String(row.rowNumber)] = conflictResolutions[row.rowNumber] ?? "KEEP_EXISTING";
          return acc;
        }, {}),
      });

      Alert.alert(
        "Lista importada",
        `${result.summary.create} alunos adicionados e ${result.summary.update} cadastros atualizados.${
          result.summary.skip > 0 ? ` ${result.summary.skip} registros permaneceram sem alterações.` : ""
        }`
      );
      onImportApplied?.();
      onClose();
    } catch (error) {
      await handleImportError(error);
    } finally {
      setApplyLoading(false);
    }
  }, [
    confirmDialog,
    fileInfo,
    handleImportError,
    onClose,
    onImportApplied,
    organizationId,
    hasUnresolvedConflicts,
    conflictRows,
    conflictResolutions,
    previewResult,
    summary?.create,
    summary?.update,
  ]);

  const setResolution = (rowNumber: number, resolution: ConflictResolutionMode) => {
    setConflictResolutions((previous) => ({
      ...previous,
      [rowNumber]: resolution,
    }));
  };

  return (
    <ModalSheet visible={visible} onClose={onClose} cardStyle={cardStyle} position="center">
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
            Importar alunos
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13 }}>
            Carregue a lista para conferir os alunos antes de importar.
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.secondaryBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="close" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ marginTop: 10, maxHeight: 440 }}>
        <ScrollView
          showsVerticalScrollIndicator
          nestedScrollEnabled
          contentContainerStyle={{ gap: 8, paddingBottom: 2 }}
        >
          {flowError ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.dangerSolidBg,
                borderRadius: 10,
                backgroundColor: colors.dangerBg,
                padding: 9,
                gap: 2,
              }}
            >
              <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                Falha ao importar
              </Text>
              <Text style={{ color: colors.dangerText, fontSize: 11 }}>{flowError}</Text>
            </View>
          ) : null}

          {!loadingMessage && !previewResult ? (
            <View style={{ gap: 8 }}>
              {Platform.OS === "web" ? (
                <div
                  ref={(node) => {
                    dragZoneRef.current = node;
                  }}
                  onClick={() => void openFileInput()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      void openFileInput();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  style={{
                    borderWidth: 1,
                    borderColor: isDragActive ? colors.primary : colors.border,
                    borderRadius: 12,
                    backgroundColor: isDragActive ? colors.secondaryBg : colors.background,
                    padding: "22px 12px",
                    gap: 4,
                    cursor: "pointer",
                    borderStyle: "dashed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    transition: "all 0.16s ease",
                  }}
                >
                  <GoAtletaIcon name="upload" size={22} color={isDragActive ? colors.primary : colors.text} />
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    Arraste a lista ou clique para selecionar
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Arquivos aceitos: .csv, .xlsx, .xls
                  </Text>
                  {isDragActive ? (
                    <Text style={{ color: colors.primary, fontSize: 11 }}>
                      Solte o arquivo para processar
                    </Text>
                  ) : null}
                  <input
                    aria-label="Arquivo de importacao"
                    accept=".csv,.xlsx,.xls"
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportFileInputChange}
                    style={{ display: "none" }}
                  />
                </div>
              ) : (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    backgroundColor: colors.background,
                    padding: 12,
                    gap: 4,
                    borderStyle: "dashed",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                    Clique em &quot;Selecionar arquivo&quot; para carregar a lista.
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Arquivos aceitos: .csv, .xlsx, .xls
                  </Text>
                </View>
              )}

              {Platform.OS !== "web" ? (
                <Button
                  label="Selecionar arquivo"
                  variant="outline"
                  onPress={() => void openFileInput()}
                />
              ) : null}
            </View>
          ) : null}

          {loadingMessage ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.background,
                padding: 12,
                gap: 6,
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>{loadingMessage}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Aguarde...</Text>
            </View>
          ) : null}

          {fileInfo && summary ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.background,
                padding: 10,
                gap: 8,
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
                <View style={{ minWidth: 0, flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={1}>
                    {fileInfo.sourceFilename}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {fileInfo.rows.length} alunos encontrados na planilha
                  </Text>
                </View>
                <Button label="Trocar arquivo" variant="outline" onPress={() => void openFileInput()} />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {applyPreviewCards.map((item) => (
                  <View
                    key={item.label}
                    style={{
                      minWidth: 92,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      backgroundColor: colors.card,
                      gap: 1,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ color: colors.text, fontWeight: "800", fontSize: 16 }}>{item.value}</Text>
                  </View>
                ))}
              </View>

              {classImpact.length ? (
                <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    Distribuição por turma
                  </Text>
                  {classImpact.map((item) => {
                    return (
                      <Text
                        key={item.className}
                        style={{ color: colors.muted, fontSize: 10 }}
                      >
                        {item.className} · {item.create} novos · {item.update} para completar
                        {item.conflict > 0 ? ` · ${item.conflict} para revisar` : ""}
                      </Text>
                    );
                  })}
                </View>
              ) : null}

              {previewImpactSamples.create.length || previewImpactSamples.update.length ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    padding: 8,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>
                    Alunos encontrados
                  </Text>
                  {previewImpactSamples.create.slice(0, 2).map((item) => (
                    <Text
                      key={`sample-create-${item.rowNumber}`}
                      style={{ color: colors.muted, fontSize: 10 }}
                    >
                      {item.studentLabel} · {item.className} · novo aluno
                    </Text>
                  ))}
                  {previewImpactSamples.update.slice(0, 2).map((item) => (
                    <Text
                      key={`sample-update-${item.rowNumber}`}
                      style={{ color: colors.muted, fontSize: 10 }}
                    >
                      {item.studentLabel} · {item.className} · completar cadastro
                    </Text>
                  ))}
                  {Math.max(0, previewImpactSamples.create.length - 2) +
                    Math.max(0, previewImpactSamples.update.length - 2) >
                  0 ? (
                    <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700" }}>
                      +
                      {Math.max(0, previewImpactSamples.create.length - 2) +
                        Math.max(0, previewImpactSamples.update.length - 2)}{" "}
                      outros alunos na lista
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {summary.conflict > 0 ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.warningBg,
                    borderRadius: 10,
                    backgroundColor: colors.warningBg,
                    padding: 9,
                    gap: 4,
                  }}
                >
                  <Text style={{ color: colors.warningText, fontWeight: "800", fontSize: 12 }}>
                    {summary.conflict} casos para conferir
                  </Text>
                  <Text style={{ color: colors.warningText, fontSize: 11 }}>
                    Confira somente estes casos antes de importar. Nenhum cadastro existente será apagado.
                  </Text>
                  {topConflictFlags.map(([flag, total]) => {
                    const detail = getFlagDetail(flag);
                    return (
                      <Text key={flag} style={{ color: colors.warningText, fontSize: 11 }}>
                        • {detail.title} ({total})
                      </Text>
                    );
                  })}
                  {hasUnresolvedConflicts ? (
                    <Text style={{ color: colors.warningText, fontSize: 11, fontWeight: "700" }}>
                      Existem {unresolvedConflictRows.length} conflitos sem decisão.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {conflictRows.length ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    backgroundColor: colors.card,
                    padding: 8,
                    gap: 6,
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                    Confira antes de importar
                  </Text>
                  {conflictRows.slice(0, 10).map((row) => {
                    const decision = conflictResolutions[row.rowNumber] ?? "KEEP_EXISTING";
                    return (
                      <View
                        key={`conflict_${row.rowNumber}`}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: 8,
                          backgroundColor: colors.background,
                          padding: 8,
                          gap: 5,
                        }}
                      >
                        <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>
                          {sourceRowsByNumber.get(row.rowNumber)?.name || `Aluno da linha ${row.rowNumber}`}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>
                          {String(
                            row.className ??
                              sourceRowsByNumber.get(row.rowNumber)?.className ??
                              "Sem turma"
                          )}
                        </Text>
                        <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                          {RESOLUTION_OPTIONS.map((item) => {
                            const selected = decision === item.id;
                            return (
                              <Pressable
                                key={item.id}
                                onPress={() => setResolution(row.rowNumber, item.id)}
                                style={{
                                  borderWidth: 1,
                                  borderColor:
                                    selected
                                      ? item.tone === "warning"
                                        ? colors.warningBg
                                        : item.tone === "danger"
                                          ? colors.dangerBg
                                          : colors.border
                                      : colors.border,
                                  borderRadius: 999,
                                  paddingHorizontal: 9,
                                  paddingVertical: 5,
                                  backgroundColor: selected ? colors.secondaryBg : colors.background,
                                }}
                              >
                                <Text
                                  style={{
                                    color: selected ? colors.text : colors.muted,
                                    fontSize: 10,
                                    fontWeight: "700",
                                  }}
                                >
                                  {item.label}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                        <Text style={{ color: colors.muted, fontSize: 10 }}>
                          {RESOLUTION_OPTIONS.find((item) => item.id === decision)?.description}
                        </Text>
                      </View>
                    );
                  })}
                  {conflictRows.length > 10 ? (
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      Mostrando 10 de {conflictRows.length} conflitos.
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {!canApply ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: colors.infoBg,
                    borderRadius: 8,
                    backgroundColor: colors.infoBg,
                    paddingVertical: 7,
                    paddingHorizontal: 8,
                  }}
                >
                  <Text style={{ color: colors.infoText, fontSize: 11, fontWeight: "700" }}>
                    {hasUnresolvedConflicts
                      ? "Resolva todos os conflitos para habilitar a aplicacao."
                      : "Nao ha linhas aplicaveis nesta previa."}
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={{ minWidth: 150, flex: 1 }}>
                  <Button
                    label={`Importar ${estimatedApplyCount} alterações`}
                    variant="success"
                    onPress={() => void confirmApply()}
                    disabled={!canApply}
                    loading={applyLoading}
                  />
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </ModalSheet>
  );
}
