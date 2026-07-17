const textValue = (value: unknown) => String(value ?? "").trim();

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number(code) || 32)
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16) || 32)
    );

const htmlCellText = (value: string) =>
  decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, " / ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();

export const convertDocumentHtmlToStructuredText = (html: string) => {
  const tableBlocks: string[] = [];
  let working = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, (table) => {
      const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
        .map((row) =>
          [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
            .map((cell) => htmlCellText(cell[1]))
            .filter((cell, index, values) => cell || values.length === 1),
        )
        .filter((row) => row.some(Boolean));
      if (!rows.length) return "\n";
      const block = [
        `[TABELA ${tableBlocks.length + 1}]`,
        ...rows.map(
          (row, rowIndex) =>
            `Linha ${rowIndex + 1}: ${row
              .map((cell, cellIndex) => `Coluna ${cellIndex + 1} = ${cell}`)
              .join(" | ")}`,
        ),
        `[/TABELA ${tableBlocks.length + 1}]`,
      ].join("\n");
      const token = `__GOATLETA_TABLE_${tableBlocks.length}__`;
      tableBlocks.push(block);
      return `\n${token}\n`;
    });

  working = working
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  let text = decodeHtmlEntities(working)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  tableBlocks.forEach((block, index) => {
    text = text.replace(`__GOATLETA_TABLE_${index}__`, block);
  });
  return text.replace(/\n{3,}/g, "\n\n").trim();
};

export const formatWorkbookRows = (
  sheets: { name: string; rows: unknown[][] }[],
) =>
  sheets
    .slice(0, 40)
    .map(({ name, rows }) => {
      const normalizedRows = rows
        .slice(0, 5_000)
        .map((row) => (Array.isArray(row) ? row : []))
        .map((row) => row.map((cell) => textValue(cell).replace(/\s+/g, " ")))
        .filter((row) => row.some(Boolean));
      if (!normalizedRows.length) return "";
      return [
        `[PLANILHA: ${textValue(name)}]`,
        ...normalizedRows.map(
          (row, rowIndex) =>
            `Linha ${rowIndex + 1}: ${row
              .map((cell, cellIndex) => `Coluna ${cellIndex + 1} = ${cell}`)
              .join(" | ")}`,
        ),
        `[/PLANILHA: ${textValue(name)}]`,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();

export const convertWorkbookToStructuredText = async (buffer: ArrayBuffer) => {
  // Deno Edge resolves pinned npm specifiers; the app-side ESLint resolver does not.
  // eslint-disable-next-line import/no-unresolved
  const XLSX = await import("npm:@e965/xlsx@0.20.3");
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    dense: true,
  });
  return formatWorkbookRows(
    workbook.SheetNames.map((sheetName) => ({
      name: sheetName,
      rows: XLSX.utils.sheet_to_json<unknown[]>(
        workbook.Sheets[sheetName],
        {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        },
      ),
    })),
  );
};
