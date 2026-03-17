import type { StudentImportRow } from "../../api/student-import";
import { mapGoogleFormsRowToAthleteIntake } from "../../core/athlete-intake";

export type GoogleFormsRawRow = Record<string, string>;

export type LoadedGoogleFormsSheet = {
  sheetId: string;
  csvUrl: string;
  sourceFilename: string;
  rows: StudentImportRow[];
  rawRows: GoogleFormsRawRow[];
};

const toKey = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const matchesHeaderToken = (normalizedHeader: string, token: string) => {
  const normalizedToken = toKey(token);
  if (!normalizedToken) return false;
  if (normalizedHeader === normalizedToken) return true;
  if (normalizedToken.length <= 2) {
    return normalizedHeader.split(" ").includes(normalizedToken);
  }
  return normalizedHeader.includes(normalizedToken);
};

const findValue = (row: GoogleFormsRawRow, includes: string[]) => {
  const entries = Object.entries(row);
  for (const [header, value] of entries) {
    const normalizedHeader = toKey(header);
    if (includes.some((token) => matchesHeaderToken(normalizedHeader, token))) {
      return String(value ?? "").trim();
    }
  }
  return "";
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

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (inQuotes) {
      if (char === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
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

const parseCsvRows = (value: string) => parseDelimitedRows(value, detectCsvDelimiter(value));

const mapMatrixToObjects = (matrix: string[][]): GoogleFormsRawRow[] => {
  const nonEmpty = matrix.filter((row) => row.some((cell) => String(cell ?? "").trim()));
  if (nonEmpty.length < 2) return [];
  const headers = nonEmpty[0].map((value) => String(value ?? "").trim());
  return nonEmpty.slice(1).map((row) => {
    const record: GoogleFormsRawRow = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = String(row[index] ?? "").trim();
    });
    return record;
  });
};

export const mapGoogleFormsCsvToRawRows = (csvText: string): GoogleFormsRawRow[] =>
  mapMatrixToObjects(parseCsvRows(csvText));

const extractGid = (value: string) => {
  try {
    const url = new URL(value);
    const searchGid = url.searchParams.get("gid");
    if (searchGid) return searchGid;
    const hashGid = url.hash.match(/gid=([0-9]+)/)?.[1];
    return hashGid ?? null;
  } catch {
    return null;
  }
};

export const extractGoogleSheetsId = (value: string): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const directIdMatch = raw.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (directIdMatch) return directIdMatch[0];

  try {
    const url = new URL(raw);
    const match = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] ?? null;
  } catch {
    const pathMatch = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return pathMatch?.[1] ?? null;
  }
};

export const buildGoogleSheetsCsvUrl = (value: string): string | null => {
  const sheetId = extractGoogleSheetsId(value);
  if (!sheetId) return null;
  const gid = extractGid(value);
  const url = new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
  url.searchParams.set("format", "csv");
  if (gid) url.searchParams.set("gid", gid);
  return url.toString();
};

const mapGoogleFormsObjectToImportRow = (
  row: GoogleFormsRawRow,
  sourceRowNumber: number
): StudentImportRow | null => {
  const intake = mapGoogleFormsRowToAthleteIntake(row);
  if (!intake.fullName.trim()) return null;

  return {
    sourceRowNumber,
    name: intake.fullName,
    ra: intake.ra ?? undefined,
    birthDate: intake.birthDate ?? undefined,
    loginEmail: intake.email ?? undefined,
    rg: findValue(row, ["rg", "documento"] ) || undefined,
    guardianName:
      findValue(row, ["nome do responsavel", "responsavel legal", "responsavel", "nome responsavel"]) ||
      undefined,
    guardianPhone:
      findValue(row, [
        "telefone do responsavel",
        "celular do responsavel",
        "whatsapp do responsavel",
        "telefone responsavel",
      ]) || undefined,
    guardianCpf:
      findValue(row, ["cpf do responsavel", "cpf responsavel", "cpf mae", "cpf pai"]) ||
      undefined,
    phone:
      findValue(row, ["telefone do aluno", "telefone do atleta", "celular do aluno", "telefone"]) ||
      undefined,
    className: findValue(row, ["turma", "categoria", "grupo"]) || undefined,
    unit: findValue(row, ["unidade", "polo", "campus", "local"]) || undefined,
  };
};

export const mapGoogleFormsCsvToImportRows = (csvText: string): StudentImportRow[] => {
  const objects = mapGoogleFormsCsvToRawRows(csvText);
  return objects
    .map((row, index) => mapGoogleFormsObjectToImportRow(row, index + 2))
    .filter((item): item is StudentImportRow => Boolean(item));
};

export async function loadGoogleFormsSheetImport(
  value: string,
  fetcher: typeof fetch = fetch
): Promise<LoadedGoogleFormsSheet> {
  const sheetId = extractGoogleSheetsId(value);
  if (!sheetId) {
    throw new Error("Cole um link valido do Google Sheets ou o ID da planilha.");
  }

  const csvUrl = buildGoogleSheetsCsvUrl(value);
  if (!csvUrl) {
    throw new Error("Nao foi possivel gerar a URL CSV da planilha.");
  }

  const response = await fetcher(csvUrl, {
    method: "GET",
    headers: { Accept: "text/csv, text/plain;q=0.9, */*;q=0.1" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel acessar a planilha. Verifique se ela esta publicada ou compartilhada.");
  }

  const csvText = await response.text();
  const normalizedText = csvText.trim().toLowerCase();
  if (!normalizedText) {
    throw new Error("A planilha nao retornou dados.");
  }
  if (normalizedText.startsWith("<!doctype html") || normalizedText.startsWith("<html")) {
    throw new Error("A planilha nao esta acessivel como CSV. Verifique o compartilhamento do Google Sheets.");
  }

  const rawRows = mapGoogleFormsCsvToRawRows(csvText);
  const rows = rawRows
    .map((row, index) => mapGoogleFormsObjectToImportRow(row, index + 2))
    .filter((item): item is StudentImportRow => Boolean(item));
  if (!rows.length) {
    throw new Error("Nenhuma resposta valida foi encontrada na planilha.");
  }

  return {
    sheetId,
    csvUrl,
    sourceFilename: `google-forms-${sheetId}.csv`,
    rows,
    rawRows,
  };
}
