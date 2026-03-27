import { normalizeAgeBand } from "../age-band";
import type { ClassGroup } from "../models";
import { canonicalizeUnitLabel } from "../unit-label";

export type FormsClassSuggestionConfidence = "high" | "medium" | "low";

export type FormsClassSuggestion = {
  rowNumber: number;
  incomingClassName: string;
  incomingUnit: string;
  suggestedClassId: string;
  suggestedClassName: string;
  suggestedUnit: string;
  score: number;
  confidence: FormsClassSuggestionConfidence;
  reasons: string[];
};

export type FormsClassSuggestionDiagnostics = {
  autoMappedCount: number;
  suggestedCount: number;
  unresolvedCount: number;
  suggestions: FormsClassSuggestion[];
  unresolvedClassNames: Array<{ className: string; unit: string; count: number }>;
};

const normalizeText = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const tokenize = (value: string | null | undefined) =>
  normalizeText(value)
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);

const extractAgeBandHint = (value: string | null | undefined) => {
  const raw = String(value ?? "");
  const match = raw.match(/(\d{1,2})\s*[-a]\s*(\d{1,2})/i) ?? raw.match(/(\d{1,2})\s*[–-]\s*(\d{1,2})/i);
  if (!match) return "";
  return normalizeAgeBand(`${match[1]}-${match[2]}`);
};

const hasVolleyballSignal = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  return normalized.includes("volei") || normalized.includes("voleibol");
};

const scoreTokenOverlap = (left: string[], right: string[]) => {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  const intersection = left.filter((item) => rightSet.has(item));
  return Math.round((intersection.length / Math.max(left.length, right.length)) * 30);
};

const buildDisplayKey = (className: string, unit: string) => `${className}::${unit}`;

export const buildFormsClassSuggestions = (input: {
  rows: Array<{ sourceRowNumber?: number; classId?: string; className?: string; unit?: string }>;
  classes: ClassGroup[];
}) => {
  const suggestions: FormsClassSuggestion[] = [];
  const unresolved = new Map<string, { className: string; unit: string; count: number }>();

  for (const row of input.rows) {
    if (row.classId?.trim()) continue;

    const incomingClassName = String(row.className ?? "").trim();
    const incomingUnit = canonicalizeUnitLabel(row.unit ?? null);
    if (!incomingClassName) continue;

    const incomingClassNorm = normalizeText(incomingClassName);
    const incomingUnitNorm = normalizeText(incomingUnit);
    const incomingTokens = tokenize(incomingClassName);
    const incomingAgeBand = extractAgeBandHint(incomingClassName);
    const incomingHasVolleyball = hasVolleyballSignal(incomingClassName);

    const ranked = input.classes
      .map((item) => {
        const reasons: string[] = [];
        let score = 0;
        const classNorm = normalizeText(item.name);
        const classTokens = tokenize(item.name);

        if (incomingClassNorm === classNorm) {
          score += 90;
          reasons.push("nome exato da turma");
        } else {
          if (incomingClassNorm && classNorm.includes(incomingClassNorm)) {
            score += 28;
            reasons.push("nome da planilha contido no cadastro");
          }
          if (incomingClassNorm && incomingClassNorm.includes(classNorm)) {
            score += 24;
            reasons.push("cadastro contido no nome da planilha");
          }
        }

        const tokenScore = scoreTokenOverlap(incomingTokens, classTokens);
        if (tokenScore > 0) {
          score += tokenScore;
          reasons.push("tokens semelhantes");
        }

        if (incomingUnitNorm) {
          const classUnitNorm = normalizeText(item.unit);
          if (incomingUnitNorm === classUnitNorm) {
            score += 26;
            reasons.push("unidade igual");
          }
        }

        if (incomingAgeBand && incomingAgeBand === normalizeAgeBand(item.ageBand)) {
          score += 32;
          reasons.push("faixa etaria igual");
        }

        if (incomingHasVolleyball && item.modality === "voleibol") {
          score += 6;
          reasons.push("modalidade compativel");
        }

        if (incomingUnitNorm && incomingAgeBand && score > 0) {
          score += 4;
        }

        return {
          item,
          score,
          reasons,
        };
      })
      .sort((left, right) => right.score - left.score);

    const best = ranked[0] ?? null;
    const second = ranked[1] ?? null;
    const lead = best ? best.score - (second?.score ?? 0) : 0;

    if (!best || best.score < 38) {
      const unresolvedKey = buildDisplayKey(incomingClassName, incomingUnit);
      const existing = unresolved.get(unresolvedKey);
      unresolved.set(unresolvedKey, {
        className: incomingClassName,
        unit: incomingUnit,
        count: (existing?.count ?? 0) + 1,
      });
      continue;
    }

    const confidence: FormsClassSuggestionConfidence =
      best.score >= 70 && lead >= 10
        ? "high"
        : best.score >= 52 && lead >= 6
          ? "medium"
          : "low";

    suggestions.push({
      rowNumber: Number(row.sourceRowNumber ?? 0),
      incomingClassName,
      incomingUnit,
      suggestedClassId: best.item.id,
      suggestedClassName: best.item.name,
      suggestedUnit: best.item.unit,
      score: best.score,
      confidence,
      reasons: best.reasons,
    });
  }

  const autoMappedCount = suggestions.filter((item) => item.confidence === "high").length;
  const suggestedCount = suggestions.filter((item) => item.confidence === "medium").length;

  return {
    autoMappedCount,
    suggestedCount,
    unresolvedCount: Array.from(unresolved.values()).reduce((sum, item) => sum + item.count, 0),
    suggestions: suggestions.sort((left, right) => left.rowNumber - right.rowNumber),
    unresolvedClassNames: Array.from(unresolved.values()).sort((left, right) => right.count - left.count),
  } satisfies FormsClassSuggestionDiagnostics;
};
