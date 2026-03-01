import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import * as XLSX from "xlsx";

import type { ClassGroup } from "../../core/models";
import { markRender } from "../../observability/perf";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import {
  applyStudentsImport,
  getStudentImportRunLogs,
  listStudentImportRuns,
  previewStudentsImport,
  type ImportPolicy,
  type StudentImportFunctionResult,
  type StudentImportLog,
  type StudentImportRow,
  type StudentImportRun,
} from "../../api/student-import";

type Props = {
  organizationId: string | null;
  classes: ClassGroup[];
  onImportApplied?: () => void;
};

const HEADER_ALIASES: Record<string, string[]> = {
  externalId: ["externalid", "external_id", "id externo", "id_externo", "id legado"],
  name: ["nome", "name", "aluno", "atleta", "nome aluno"],
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

const POLICY_OPTIONS: { id: ImportPolicy; label: string; disabled?: boolean }[] = [
  { id: "conservador", label: "Conservador" },
  { id: "misto", label: "Misto" },
  { id: "agressivo", label: "Agressivo (em breve)", disabled: true },
];

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
      if (char === "\"" && value[i + 1] === "\"") {
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

const parseCsvRows = (value: string): string[][] =>
  parseDelimitedRows(value, detectCsvDelimiter(value));

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
        base.birthDate = normalizeDate(String(cells[1] ?? "").trim());
        base.rg = String(cells[2] ?? "").trim();
        base.className = String(cells[3] ?? "").trim();
        base.unit = String(cells[4] ?? "").trim();
        base.guardianName = String(cells[5] ?? "").trim();
        base.guardianPhone = String(cells[6] ?? "").trim();
        base.guardianCpf = String(cells[7] ?? "").trim();
        base.phone = String(cells[8] ?? "").trim();
        base.loginEmail = String(cells[9] ?? "").trim();
      }
      if (!base.name) return null;
      return base;
    })
    .filter((item): item is StudentImportRow => Boolean(item));
};

const parseSpreadsheetRows = (value: unknown[][]): string[][] =>
  value.map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []
  );

const formatDateTime = (value: string) => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "-";
  return new Date(ms).toLocaleString("pt-BR");
};

const summarizeRun = (run: StudentImportRun) => {
  const summary = run.summary;
  if (!summary) return "Sem resumo.";
  return `C:${summary.create} U:${summary.update} X:${summary.conflict} S:${summary.skip} E:${summary.error}`;
};

export function StudentsImportTab({ organizationId, classes, onImportApplied }: Props) {
  const { colors } = useAppTheme();
  markRender("screen.studentsImport.render.root", {
    hasOrganization: Boolean(organizationId),
    classes: classes.length,
  });

  const [selectedFileName, setSelectedFileName] = useState("");
  const [importRows, setImportRows] = useState<StudentImportRow[]>([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [policy, setPolicy] = useState<ImportPolicy>("misto");
  const [previewResult, setPreviewResult] = useState<StudentImportFunctionResult | null>(null);
  const [applyResult, setApplyResult] = useState<StudentImportFunctionResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runs, setRuns] = useState<StudentImportRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<StudentImportRun | null>(null);
  const [selectedRunLogs, setSelectedRunLogs] = useState<StudentImportLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedFlagFilter, setSelectedFlagFilter] = useState("Todas");

  const effectiveSourceFilename = useMemo(() => {
    const selected = selectedFileName.trim();
    if (selected) return selected;
    return "students-import.xlsx";
  }, [selectedFileName]);

  const conflictRows = useMemo(() => {
    const rows = previewResult?.rows ?? [];
    return rows.filter((row) => row.action === "conflict" || row.action === "error");
  }, [previewResult]);

  const availableFlags = useMemo(() => {
    const set = new Set<string>();
    for (const row of conflictRows) {
      for (const flag of row.flags ?? []) set.add(flag);
    }
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [conflictRows]);

  const filteredConflictRows = useMemo(() => {
    if (selectedFlagFilter === "Todas") return conflictRows;
    return conflictRows.filter((row) => row.flags?.includes(selectedFlagFilter));
  }, [conflictRows, selectedFlagFilter]);

  const latestRun = runs[0] ?? null;

  const loadRuns = useCallback(async () => {
    if (!organizationId) return;
    setHistoryLoading(true);
    try {
      const list = await listStudentImportRuns(organizationId, 20);
      setRuns(list);
      if (!selectedRun && list.length) setSelectedRun(list[0]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar historico.";
      Alert.alert("Importacao", message);
    } finally {
      setHistoryLoading(false);
    }
  }, [organizationId, selectedRun]);

  const loadRunLogs = useCallback(async (runId: string) => {
    setLogsLoading(true);
    try {
      const logs = await getStudentImportRunLogs(runId, 150, 0);
      setSelectedRunLogs(logs);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar logs.";
      Alert.alert("Importacao", message);
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    setPreviewResult(null);
    setApplyResult(null);
    setSelectedFlagFilter("Todas");
  }, [importRows, policy, selectedFileName]);

  const pickImportFile = useCallback(async () => {
    setFileLoading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          "text/csv",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        throw new Error("Arquivo invalido.");
      }

      const fileName = String(asset.name ?? "").trim() || "students-import.xlsx";
      const lowerName = fileName.toLowerCase();
      const isSpreadsheet =
        lowerName.endsWith(".xlsx") ||
        lowerName.endsWith(".xls") ||
        asset.mimeType?.includes("spreadsheet") ||
        asset.mimeType?.includes("excel");

      let rowsMatrix: string[][] = [];
      if (isSpreadsheet) {
        const base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
        const workbook = XLSX.read(base64, { type: "base64" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error("Planilha vazia.");
        }
        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          throw new Error("Nao foi possivel ler a primeira aba da planilha.");
        }
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as unknown[][];
        rowsMatrix = parseSpreadsheetRows(rows);
      } else {
        const text = await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
        rowsMatrix = parseCsvRows(text);
      }

      const mappedRows = mapRawRowsToImport(rowsMatrix);
      if (!mappedRows.length) {
        throw new Error("Nenhuma linha valida encontrada no arquivo.");
      }

      setSelectedFileName(fileName);
      setImportRows(mappedRows);
      Alert.alert("Importacao", `Arquivo carregado: ${fileName} (${mappedRows.length} linhas).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao ler arquivo.";
      Alert.alert("Importacao", message);
    } finally {
      setFileLoading(false);
    }
  }, []);

  const runPreview = useCallback(async () => {
    if (!organizationId) {
      Alert.alert("Importacao", "Selecione uma organizacao ativa.");
      return;
    }
    if (!importRows.length) {
      Alert.alert("Importacao", "Selecione um arquivo .csv, .xls ou .xlsx com pelo menos 1 linha.");
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await previewStudentsImport({
        organizationId,
        policy,
        sourceFilename: effectiveSourceFilename,
        rows: importRows,
      });
      setPreviewResult(result);
      setApplyResult(null);
      await loadRuns();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao gerar preview.";
      Alert.alert("Importacao", message);
    } finally {
      setPreviewLoading(false);
    }
  }, [effectiveSourceFilename, importRows, loadRuns, organizationId, policy]);

  const runApply = useCallback(async () => {
    if (!organizationId) return;
    if (!previewResult) {
      Alert.alert("Importacao", "Gere o preview antes de aplicar.");
      return;
    }
    const payloadRows = importRows;
    if (!payloadRows.length) {
      Alert.alert("Importacao", "Selecione um arquivo antes de aplicar.");
      return;
    }
    Alert.alert("Aplicar importacao", "Confirmar aplicacao das alteracoes?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aplicar",
        style: "default",
        onPress: async () => {
          setApplyLoading(true);
          try {
            const result = await applyStudentsImport({
              organizationId,
              policy,
              sourceFilename: effectiveSourceFilename,
              rows: payloadRows,
            });
            setApplyResult(result);
            await loadRuns();
            if ((result.summary.create ?? 0) + (result.summary.update ?? 0) > 0) {
              onImportApplied?.();
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Falha ao aplicar importacao.";
            Alert.alert("Importacao", message);
          } finally {
            setApplyLoading(false);
          }
        },
      },
    ]);
  }, [effectiveSourceFilename, importRows, loadRuns, onImportApplied, organizationId, policy, previewResult]);

  const currentSummary = applyResult?.summary ?? previewResult?.summary ?? null;

  return (
    <View
      style={{
        gap: 12,
        padding: 14,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Importar alunos</Text>
        <Text style={{ color: colors.muted }}>
          Preview obrigatorio antes do apply. O merge e auditavel por execucao.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Turmas na organizacao: {classes.length}</Text>
      </View>

      <View
        style={{
          gap: 10,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.background,
          padding: 12,
        }}
      >
        <Button
          label={fileLoading ? "Carregando arquivo..." : "Selecionar arquivo (.csv/.xls/.xlsx)"}
          variant="outline"
          onPress={() => void pickImportFile()}
          loading={fileLoading}
        />
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Arquivo: {selectedFileName || "Nenhum arquivo selecionado"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          Linhas validas para importacao: {importRows.length}
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Politica</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {POLICY_OPTIONS.map((item) => {
            const selected = policy === item.id;
            return (
              <Pressable
                key={item.id}
                disabled={item.disabled}
                onPress={() => setPolicy(item.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? colors.primaryBg : colors.border,
                  backgroundColor: selected ? colors.primaryBg : colors.background,
                  opacity: item.disabled ? 0.5 : 1,
                }}
              >
                <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <View style={{ minWidth: 160, flex: 1 }}>
          <Button label="Gerar preview" onPress={() => void runPreview()} loading={previewLoading} />
        </View>
        <View style={{ minWidth: 160, flex: 1 }}>
          <Button
            label="Aplicar importacao"
            variant="success"
            onPress={() => void runApply()}
            disabled={!previewResult}
            loading={applyLoading}
          />
        </View>
      </View>

      {currentSummary ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            backgroundColor: colors.background,
            padding: 10,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Resumo {applyResult ? "(apply)" : "(preview)"} - run {applyResult?.runId ?? previewResult?.runId}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["Criar", currentSummary.create],
              ["Atualizar", currentSummary.update],
              ["Conflitos", currentSummary.conflict],
              ["Ignorados", currentSummary.skip],
              ["Erros", currentSummary.error],
            ].map(([label, value]) => (
              <View
                key={String(label)}
                style={{
                  minWidth: 96,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
                <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>{value}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Confianca high/medium/low: {currentSummary.confidenceHigh}/{currentSummary.confidenceMedium}/
            {currentSummary.confidenceLow}
          </Text>
        </View>
      ) : null}

      {conflictRows.length ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Conflitos do preview</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {availableFlags.map((flag) => {
                const selected = selectedFlagFilter === flag;
                return (
                  <Pressable
                    key={flag}
                    onPress={() => setSelectedFlagFilter(flag)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? colors.primaryBg : colors.border,
                      backgroundColor: selected ? colors.primaryBg : colors.background,
                    }}
                  >
                    <Text style={{ color: selected ? colors.primaryText : colors.text, fontWeight: "700" }}>
                      {flag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
          <View style={{ gap: 8 }}>
            {filteredConflictRows.slice(0, 30).map((row) => (
              <View
                key={`conflict_${row.rowNumber}`}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  backgroundColor: colors.background,
                  padding: 10,
                  gap: 4,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Linha {row.rowNumber} - {row.action}
                </Text>
                <Text style={{ color: colors.muted }}>
                  Match: {row.matchedBy ?? "-"} | Confianca: {row.confidence}
                </Text>
                {row.flags?.length ? (
                  <Text style={{ color: colors.muted }}>Flags: {row.flags.join(", ")}</Text>
                ) : null}
                {row.errorMessage ? <Text style={{ color: colors.dangerText }}>{row.errorMessage}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.background,
          padding: 10,
          gap: 8,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>Historico</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button label="Atualizar" variant="outline" onPress={() => void loadRuns()} loading={historyLoading} />
            <Button
              label="Ver ultimo resultado"
              variant="secondary"
              onPress={() => {
                if (!latestRun) return;
                setSelectedRun(latestRun);
                void loadRunLogs(latestRun.id);
              }}
              disabled={!latestRun}
            />
          </View>
        </View>
        {latestRun ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Ultimo run: {latestRun.id} | {latestRun.status} | {formatDateTime(latestRun.createdAt)}
          </Text>
        ) : (
          <Text style={{ color: colors.muted }}>Sem execucoes ainda.</Text>
        )}
        {runs.slice(0, 5).map((run) => (
          <Pressable
            key={run.id}
            onPress={() => {
              setSelectedRun(run);
              void loadRunLogs(run.id);
            }}
            style={{
              borderWidth: 1,
              borderColor: selectedRun?.id === run.id ? colors.primaryBg : colors.border,
              borderRadius: 10,
              backgroundColor: selectedRun?.id === run.id ? colors.primaryBgSoft : colors.card,
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {run.mode} | {run.policy} | {run.status}
            </Text>
            <Text style={{ color: colors.muted }}>{summarizeRun(run)}</Text>
          </Pressable>
        ))}
        {selectedRun ? (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Logs run {selectedRun.id} {logsLoading ? "(carregando...)" : ""}
            </Text>
            {selectedRunLogs.slice(0, 15).map((log) => (
              <View
                key={log.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 10,
                  backgroundColor: colors.card,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  gap: 2,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Linha {log.rowNumber} - {log.action}
                </Text>
                <Text style={{ color: colors.muted }}>
                  {log.matchedBy ?? "-"} | {log.confidence}
                </Text>
                {log.flags.length ? <Text style={{ color: colors.muted }}>{log.flags.join(", ")}</Text> : null}
                {log.errorMessage ? <Text style={{ color: colors.dangerText }}>{log.errorMessage}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
