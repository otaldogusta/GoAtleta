type PrintableActivity = {
  name?: string | null;
  organization?: string | null;
  execution?: string | null;
  description?: string | null;
  notes?: string | null;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const ensureSentence = (value: string | null | undefined) => {
  const text = normalizeText(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

export const buildActivityPlanText = (activity: PrintableActivity) => {
  const organization = ensureSentence(activity.organization);
  const execution = ensureSentence(activity.execution);
  const practicalText = [organization, execution].filter(Boolean).join(" ");

  if (practicalText) {
    return practicalText;
  }

  return normalizeText(activity.description) || normalizeText(activity.notes);
};

export const buildPrintableActivityBlock = (activity: PrintableActivity) => {
  const name = normalizeText(activity.name);
  const planText = buildActivityPlanText(activity);
  return [name, planText].filter(Boolean).join("\n");
};
