import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  writeAsStringAsync,
} from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";

export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type XlsxSheetInput = {
  name: string;
  rows: unknown[][];
  options?: {
    freezeHeaderRow?: boolean;
    autoFilterHeaderRow?: boolean;
    columnWidths?: number[];
    autoSizeColumns?: boolean;
    minColumnWidth?: number;
    maxColumnWidth?: number;
  };
};

export type ExportWorkbookInput = {
  fileName: string;
  sheets: XlsxSheetInput[];
  dialogTitle?: string;
};

export type ExportWorkbookResult = {
  fileName: string;
  uri: string;
};

const MOJIBAKE_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["\u00C3\u00A1", "\u00E1"],
  ["\u00C3\u00A0", "\u00E0"],
  ["\u00C3\u00A2", "\u00E2"],
  ["\u00C3\u00A3", "\u00E3"],
  ["\u00C3\u00A4", "\u00E4"],
  ["\u00C3\u00A9", "\u00E9"],
  ["\u00C3\u00A8", "\u00E8"],
  ["\u00C3\u00AA", "\u00EA"],
  ["\u00C3\u00AB", "\u00EB"],
  ["\u00C3\u00AD", "\u00ED"],
  ["\u00C3\u00AC", "\u00EC"],
  ["\u00C3\u00AE", "\u00EE"],
  ["\u00C3\u00AF", "\u00EF"],
  ["\u00C3\u00B3", "\u00F3"],
  ["\u00C3\u00B2", "\u00F2"],
  ["\u00C3\u00B4", "\u00F4"],
  ["\u00C3\u00B5", "\u00F5"],
  ["\u00C3\u00B6", "\u00F6"],
  ["\u00C3\u00BA", "\u00FA"],
  ["\u00C3\u00B9", "\u00F9"],
  ["\u00C3\u00BB", "\u00FB"],
  ["\u00C3\u00BC", "\u00FC"],
  ["\u00C3\u00A7", "\u00E7"],
  ["\u00C3\u00B1", "\u00F1"],
  ["\u00C3\u0081", "\u00C1"],
  ["\u00C3\u0080", "\u00C0"],
  ["\u00C3\u0082", "\u00C2"],
  ["\u00C3\u0083", "\u00C3"],
  ["\u00C3\u0084", "\u00C4"],
  ["\u00C3\u0089", "\u00C9"],
  ["\u00C3\u0088", "\u00C8"],
  ["\u00C3\u008A", "\u00CA"],
  ["\u00C3\u008B", "\u00CB"],
  ["\u00C3\u008D", "\u00CD"],
  ["\u00C3\u008C", "\u00CC"],
  ["\u00C3\u008E", "\u00CE"],
  ["\u00C3\u008F", "\u00CF"],
  ["\u00C3\u0093", "\u00D3"],
  ["\u00C3\u0092", "\u00D2"],
  ["\u00C3\u0094", "\u00D4"],
  ["\u00C3\u0095", "\u00D5"],
  ["\u00C3\u0096", "\u00D6"],
  ["\u00C3\u009A", "\u00DA"],
  ["\u00C3\u0099", "\u00D9"],
  ["\u00C3\u009B", "\u00DB"],
  ["\u00C3\u009C", "\u00DC"],
  ["\u00C3\u0087", "\u00C7"],
  ["\u00E2\u20AC\u201C", "\u2013"],
  ["\u00E2\u20AC\u201D", "\u2014"],
  ["\u00E2\u20AC\u02DC", "\u2018"],
  ["\u00E2\u20AC\u2122", "\u2019"],
  ["\u00E2\u20AC\u0153", "\u201C"],
  ["\u00E2\u20AC\u009D", "\u201D"],
  ["\u00E2\u20AC\u00A6", "\u2026"],
] as const;

const normalizeSpreadsheetText = (input: string) => {
  let value = input.normalize("NFC");
  if (!/[\u00C2\u00C3\u00E2]/.test(value)) return value;

  value = value.replace(/\u00C2(?=[\u00A0-\u00FF])/g, "");

  for (const [from, to] of MOJIBAKE_REPLACEMENTS) {
    if (value.includes(from)) {
      value = value.split(from).join(to);
    }
  }

  return value;
};

const normalizeSpreadsheetCell = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  return normalizeSpreadsheetText(value);
};

const normalizeSpreadsheetRows = (rows: unknown[][]): unknown[][] =>
  rows.map((row) => row.map(normalizeSpreadsheetCell));

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const estimateColumnWidths = (
  rows: unknown[][],
  minColumnWidth: number,
  maxColumnWidth: number
) => {
  const colCount = rows.reduce((acc, row) => Math.max(acc, row.length), 0);
  if (!colCount) return [];
  const widths: number[] = Array.from({ length: colCount }, () => minColumnWidth);
  for (const row of rows) {
    for (let col = 0; col < colCount; col += 1) {
      const raw = row[col];
      const text = String(raw ?? "");
      if (!text) continue;
      const estimated = clamp(text.length + 2, minColumnWidth, maxColumnWidth);
      if (estimated > widths[col]) widths[col] = estimated;
    }
  }
  return widths;
};

const applyWorksheetPresentation = (
  worksheet: XLSX.WorkSheet,
  rows: unknown[][],
  options?: XlsxSheetInput["options"]
) => {
  const colCount = rows.reduce((acc, row) => Math.max(acc, row.length), 0);
  if (!colCount) return;

  const minColumnWidth = options?.minColumnWidth ?? 10;
  const maxColumnWidth = options?.maxColumnWidth ?? 42;
  const fromAutosize =
    options?.autoSizeColumns === false
      ? []
      : estimateColumnWidths(rows, minColumnWidth, maxColumnWidth);
  const finalWidths =
    options?.columnWidths && options.columnWidths.length > 0
      ? Array.from({ length: colCount }, (_, index) => {
          const explicit = options.columnWidths?.[index];
          if (typeof explicit === "number" && explicit > 0) {
            return clamp(explicit, minColumnWidth, maxColumnWidth);
          }
          return fromAutosize[index] ?? minColumnWidth;
        })
      : fromAutosize;

  if (finalWidths.length) {
    worksheet["!cols"] = finalWidths.map((wch) => ({ wch }));
  }

  if (options?.autoFilterHeaderRow) {
    worksheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(colCount - 1)}1`,
    };
  }

  if (options?.freezeHeaderRow) {
    (worksheet as Record<string, unknown>)["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    };
  }
};

const sanitizeSheetName = (value: string) => {
  const raw = String(value ?? "").trim();
  const safe =
    raw
      .replace(/[\\/*?:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || "Planilha";
  return safe;
};

export const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export async function exportWorkbookXlsx(
  input: ExportWorkbookInput
): Promise<ExportWorkbookResult> {
  const workbook = XLSX.utils.book_new();

  input.sheets.forEach((sheet, index) => {
    const normalizedRows = normalizeSpreadsheetRows(sheet.rows);
    const worksheet = XLSX.utils.aoa_to_sheet(normalizedRows);
    applyWorksheetPresentation(worksheet, normalizedRows, sheet.options);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sanitizeSheetName(sheet.name || `Planilha ${index + 1}`)
    );
  });

  if (Platform.OS === "web") {
    if (typeof window === "undefined" || typeof document === "undefined") {
      throw new Error("Exportacao XLSX indisponivel neste ambiente web.");
    }
    const workbookArray = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([workbookArray], { type: XLSX_MIME });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = input.fileName;
    link.rel = "noopener";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { fileName: input.fileName, uri: url };
  }

  const baseDir = documentDirectory ?? cacheDirectory ?? "";
  if (!baseDir) {
    throw new Error("Storage indisponivel para exportar XLSX.");
  }

  const uri = `${baseDir}${input.fileName}`;
  const workbookBase64 = XLSX.write(workbook, { bookType: "xlsx", type: "base64" });
  await writeAsStringAsync(uri, workbookBase64, { encoding: EncodingType.Base64 });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      dialogTitle: input.dialogTitle ?? "Exportar planilha",
      mimeType: XLSX_MIME,
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    });
  }

  return { fileName: input.fileName, uri };
}
