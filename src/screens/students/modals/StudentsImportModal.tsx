import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, ScrollView, Text, View } from "react-native";
import * as XLSX from "xlsx";
import * as cptable from "xlsx/dist/cpexcel.js";

import type { ClassGroup } from "../../../core/models";
import {
    applyStudentsSync,
    previewStudentsSync,
    type StudentImportFunctionResult,
    type StudentImportRow,
} from "../../../services/students-sync-service";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { useModalCardStyle } from "../../../ui/use-modal-card-style";

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
  BIRTHDATE_SUSPECT: {
    title: "Data de nascimento suspeita",
    hint: "Data fora do padrao esperado.",
  },
  PHONE_CONFLICT: {
    title: "Telefone diferente",
    hint: "Telefone da planilha diverge do cadastro.",
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
};

const getFlagDetail = (flag: string) =>
  FLAG_DETAILS[flag] ?? {
    title: flag.replace(/_/g, " ").toLowerCase(),
    hint: "Revisao manual recomendada.",
  };

const xlsxWithCodepage = XLSX as typeof XLSX & {
  set_cptable?: (value: unknown) => void;
};
if (typeof xlsxWithCodepage.set_cptable === "function") {
  xlsxWithCodepage.set_cptable(cptable);
}

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
          base[key] = raw;
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

  const sourceFilename = String(asset.name ?? "").trim() || "students-import.xlsx";
  const lowerName = sourceFilename.toLowerCase();
  const isSpreadsheet =
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    asset.mimeType?.includes("spreadsheet") ||
    asset.mimeType?.includes("excel");

  let rowsMatrix: string[][] = [];
  if (isSpreadsheet) {
    const workbook =
      Platform.OS === "web"
        ? XLSX.read(await readWebAssetArrayBuffer(asset), { type: "array" })
        : XLSX.read(await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 }), {
            type: "base64",
          });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error("Planilha vazia.");
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) throw new Error("Nao foi possivel ler a primeira aba da planilha.");
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as unknown[][];
    rowsMatrix = parseSpreadsheetRows(rows);
  } else {
    const text =
      Platform.OS === "web"
        ? await readWebAssetText(asset)
        : await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
    rowsMatrix = parseCsvRows(text);
  }

  const rows = mapRawRowsToImport(rowsMatrix);
  if (!rows.length) throw new Error("Nenhuma linha valida encontrada no arquivo.");

  return { sourceFilename, rows };
};

export function StudentsImportModal({
  visible,
  organizationId,
  classes,
  onClose,
  onImportApplied,
}: StudentsImportModalProps) {
  const { colors } = useAppTheme();
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
  const hasAutoTriedRef = useRef(false);

  const resetState = useCallback(() => {
    setLoadingMessage(null);
    setFileInfo(null);
    setPreviewResult(null);
    setApplyLoading(false);
    setFlowError(null);
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

  const startFlow = useCallback(async () => {
    if (!organizationId) {
      Alert.alert("Importacao", "Selecione uma organizacao ativa.");
      return;
    }

    try {
      setFlowError(null);
      setLoadingMessage("Selecionando planilha...");
      const selected = await pickImportFileRows();
      if (!selected) {
        setLoadingMessage(null);
        setFlowError("Nenhum arquivo selecionado.");
        return;
      }

      setFileInfo(selected);
      setLoadingMessage("Gerando previa da planilha...");
      const preview = await previewStudentsSync({
        organizationId,
        policy: "misto",
        sourceFilename: selected.sourceFilename,
        rows: selected.rows,
      });

      setPreviewResult(preview);
      setLoadingMessage(null);
    } catch (error) {
      await handleImportError(error);
      setLoadingMessage(null);
    }
  }, [handleImportError, organizationId]);

  useEffect(() => {
    if (!visible) {
      hasAutoTriedRef.current = false;
      resetState();
      return;
    }
    if (hasAutoTriedRef.current) return;
    hasAutoTriedRef.current = true;
    void startFlow();
  }, [resetState, startFlow, visible]);

  const confirmApply = useCallback(async () => {
    if (!organizationId || !fileInfo || !previewResult) return;

    Alert.alert("Adicionar planilha", "Deseja realmente adicionar esta planilha no app?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Adicionar",
        onPress: async () => {
          setApplyLoading(true);
          try {
            const result = await applyStudentsSync({
              organizationId,
              policy: "misto",
              sourceFilename: fileInfo.sourceFilename,
              runId: previewResult.runId,
            });

            Alert.alert(
              "Importacao concluida",
              `Run ${result.runId} | C:${result.summary.create} U:${result.summary.update} X:${result.summary.conflict} S:${result.summary.skip} E:${result.summary.error}`
            );
            onImportApplied?.();
            onClose();
          } catch (error) {
            await handleImportError(error);
          } finally {
            setApplyLoading(false);
          }
        },
      },
    ]);
  }, [fileInfo, handleImportError, onClose, onImportApplied, organizationId, previewResult]);

  const summary = previewResult?.summary ?? null;
  const summaryCards = summary
    ? [
        { label: "Criar", value: summary.create },
        { label: "Atualizar", value: summary.update },
        { label: "Conflitos", value: summary.conflict },
      ]
    : [];
  const computedFlagTotals = useMemo(() => {
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
  }, [previewResult?.rows, summary?.conflict, summary?.flags]);

  const topConflictFlags = useMemo(() => {
    if (!summary) return [];
    return Object.entries(computedFlagTotals)
      .filter(([, total]) => Number(total) > 0)
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 2);
  }, [computedFlagTotals, summary]);
  const canApply = Boolean(summary && summary.create + summary.update > 0);

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
            Selecione a planilha e confirme a adicao.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Turmas na organizacao: {classes.length}
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
          <Ionicons name="close" size={20} color={colors.text} />
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
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 13 }}>
                Selecione o arquivo para gerar a previa.
              </Text>
              {fileInfo ? (
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  Ultimo arquivo: {fileInfo.sourceFilename}
                </Text>
              ) : null}
              <Button label="Selecionar arquivo" variant="outline" onPress={() => void startFlow()} />
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
              <Text style={{ color: colors.text, fontWeight: "700" }} numberOfLines={2}>
                {fileInfo.sourceFilename}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {fileInfo.rows.length} linhas validas
              </Text>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {summaryCards.map((item) => (
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

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Ignorados: {summary.skip} • Erros: {summary.error}
              </Text>

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
                    {summary.conflict} conflitos para revisao
                  </Text>
                  <Text style={{ color: colors.warningText, fontSize: 11 }}>
                    Nao atualiza automaticamente e nao apaga dados existentes.
                  </Text>
                  {topConflictFlags.map(([flag, total]) => {
                    const detail = getFlagDetail(flag);
                    return (
                      <Text key={flag} style={{ color: colors.warningText, fontSize: 11 }}>
                        • {detail.title} ({total})
                      </Text>
                    );
                  })}
                </View>
              ) : null}

              <Text style={{ color: colors.muted, fontSize: 11 }}>
                Ao adicionar, sincroniza com o banco da organizacao.
              </Text>

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
                    Nao ha linhas aplicaveis nesta previa.
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <View style={{ minWidth: 120, flex: 1 }}>
                  <Button label="Cancelar" variant="outline" onPress={onClose} />
                </View>
                <View style={{ minWidth: 150, flex: 1 }}>
                  <Button
                    label="Adicionar planilha"
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
