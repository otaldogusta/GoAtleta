export const IMPORT_FILE_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 80,
  maxCellChars: 500,
} as const;

type ImportAssetLike = {
  name?: string | null;
  size?: number | null;
};

const formatMegabytes = (bytes: number) =>
  `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

export function assertImportAssetWithinLimits(asset: ImportAssetLike) {
  const size = typeof asset.size === "number" ? asset.size : null;
  if (size !== null && size > IMPORT_FILE_LIMITS.maxBytes) {
    throw new Error(
      `Arquivo muito grande. Limite: ${formatMegabytes(IMPORT_FILE_LIMITS.maxBytes)}.`
    );
  }
}

export function normalizeSpreadsheetMatrixForImport(rows: unknown[][]): string[][] {
  if (rows.length > IMPORT_FILE_LIMITS.maxRows + 1) {
    throw new Error(
      `Planilha muito extensa. Limite: ${IMPORT_FILE_LIMITS.maxRows} linhas de dados.`
    );
  }

  return rows.map((row) => {
    if (!Array.isArray(row)) return [];
    if (row.length > IMPORT_FILE_LIMITS.maxColumns) {
      throw new Error(
        `Planilha com muitas colunas. Limite: ${IMPORT_FILE_LIMITS.maxColumns} colunas.`
      );
    }

    return row.map((cell) => {
      const value = String(cell ?? "").trim();
      if (value.length > IMPORT_FILE_LIMITS.maxCellChars) {
        throw new Error(
          `Celula muito longa. Limite: ${IMPORT_FILE_LIMITS.maxCellChars} caracteres.`
        );
      }
      return value;
    });
  });
}
