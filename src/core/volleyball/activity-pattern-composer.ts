import type { SessionPlanningContext } from "../session-planning-context";
import type {
  ActivityPatternActivitySpec,
  ActivityPatternAgeStage,
  ActivityPatternSelectionContext,
} from "./activity-pattern-engine";
import type { ActivityKnowledgePattern } from "./activity-knowledge-patterns";

const normalizeInline = (value: string | null | undefined) =>
  String(value ?? "").replace(/\s+/g, " ").trim();

const ensureSentence = (value: string | null | undefined) => {
  const text = normalizeInline(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

type AgeOverrideKey =
  | "name"
  | "players"
  | "setup"
  | "starter"
  | "action"
  | "rotation"
  | "constraint"
  | "scoring"
  | "progression"
  | "space";

const ageOverride = (
  pattern: ActivityKnowledgePattern,
  ageStage: ActivityPatternAgeStage,
  key: AgeOverrideKey
) => {
  const override = pattern.ageText?.[ageStage] as
    | Partial<Record<AgeOverrideKey, string>>
    | undefined;
  return override?.[key] ?? pattern[key];
};

const formatEventDate = (value: string) => {
  const normalized = String(value ?? "").slice(0, 10);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : normalized;
};

const eventReminder = (events?: SessionPlanningContext["upcomingEvents"]) => {
  const event = events?.[0];
  if (!event?.title) return "";
  const date = formatEventDate(event.date);
  return date
    ? `Aviso rápido: ${event.title} em ${date}.`
    : `Aviso rápido: ${event.title}.`;
};

export const composeActivityPattern = (
  pattern: ActivityKnowledgePattern,
  context: ActivityPatternSelectionContext
): ActivityPatternActivitySpec => {
  const ageStage = context.ageProfile.stage;
  const name = String(ageOverride(pattern, ageStage, "name"));
  const participants = String(ageOverride(pattern, ageStage, "players"));
  const organization = String(ageOverride(pattern, ageStage, "setup"));
  const starter = String(ageOverride(pattern, ageStage, "starter"));
  const action = String(ageOverride(pattern, ageStage, "action"));
  const rotation = String(ageOverride(pattern, ageStage, "rotation"));
  const simpleRule = String(ageOverride(pattern, ageStage, "constraint") ?? "");
  const scoring = ageOverride(pattern, ageStage, "scoring");
  const progression = String(ageOverride(pattern, ageStage, "progression") ?? "");
  const space = String(ageOverride(pattern, ageStage, "space"));
  const visibleRule = pattern.stage === "cooldown"
    ? [simpleRule, eventReminder(context.upcomingEvents)].filter(Boolean).join(" ")
    : [simpleRule, scoring, progression].filter(Boolean).join(" ");
  const execution = [starter, action, rotation, visibleRule]
    .map((item) => ensureSentence(String(item ?? "")))
    .filter(Boolean)
    .join(" ");
  const commonMistake = pattern.commonMistakes?.[0] ?? "espera longa";
  const adaptation = pattern.adaptations?.[0] ?? "Facilitar reduzindo distância; dificultar aumentando oposição.";

  return {
    id: `${pattern.id}-${ageStage}`,
    stage: pattern.stage,
    name,
    participants,
    organization,
    starter,
    action,
    rotation,
    simpleRule,
    scoring: typeof scoring === "string" ? scoring : undefined,
    materials: pattern.materials,
    space,
    execution,
    coachFocus:
      pattern.stage === "cooldown"
        ? "Registrar uma percepção da turma para orientar a próxima aula."
        : `Observar ${commonMistake} e manter a tarefa com participação alta.`,
    successCriteria:
      pattern.stage === "cooldown"
        ? "A turma encerra sabendo uma decisão que ajudou a atividade."
        : ensureSentence(String(scoring ?? progression ?? "O grupo mantém a bola jogável com troca clara.")),
    adaptation,
    sourcePatternId: pattern.id,
  };
};
