export type ImportedPlanRow = {
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

const normalizeImportDate = (value: string) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return raw;
};

export const detectImportDelimiter = (value: string) => {
  const firstLine =
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
};

export const parseDelimitedImportRows = (
  value: string,
  delimiter: "," | ";"
): string[][] => {
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

export const parseImportRowsFromMatrix = (rows: string[][]): ImportedPlanRow[] => {
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
