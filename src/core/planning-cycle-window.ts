export type PlanningCycleWindow = {
  startDate: string;
  endDate: string;
  year: number;
  label: string;
  isPartialYear: boolean;
};

const formatIsoDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateInput = (value: string | null | undefined) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? raw
    : /^\d{4}-\d{2}-\d{2}T/.test(raw)
      ? raw.slice(0, 10)
      : "";

  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const monthLabelPtBr = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  const label = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(parsed);
  return label.replace(".", "").replace(/^./, (char) => char.toUpperCase());
};

export const resolvePlanningCycleWindow = (
  classStartDate: string | null | undefined,
  selectedYear: number
): PlanningCycleWindow => {
  const currentYear = new Date().getFullYear();
  const year = Number.isFinite(selectedYear) && selectedYear > 1970
    ? Math.floor(selectedYear)
    : currentYear;

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const classStart = parseDateInput(classStartDate);
  const classStartYear = classStart?.getFullYear() ?? null;

  let startDate = yearStart;

  // Preferência de produto: no ano atual, manter planejamento anual completo (Jan-Dez)
  // sempre que possível, evitando abrir ciclos parciais por data de cadastro da turma.
  if (year !== currentYear && classStart && classStartYear === year) {
    const parsedYearStart = new Date(`${yearStart}T00:00:00`);
    startDate = classStart >= parsedYearStart ? formatIsoDate(classStart) : yearStart;
  }

  const isPartialYear = startDate !== yearStart;
  const label = isPartialYear
    ? `${monthLabelPtBr(startDate)}-Dez ${year}`
    : `Jan-Dez ${year}`;

  return {
    startDate,
    endDate: yearEnd,
    year,
    label,
    isPartialYear,
  };
};
