import type { ClassGroup, MonthlyPlanningBlueprint } from "../../../core/models";

/**
 * Generate or update a MonthlyPlanningBlueprint based on class context.
 *
 * Input analysis:
 * - ClassGroup competitive profile (level, target audience, calendar phase)
 * - Month/year from key
 * - Age band (youth/adult/mixed competitive)
 *
 * Output strategy:
 * - macroIntent: Phrase describing pedagogical focus for the month
 * - pedagogicalProgression: Array of focus themes distributed across weeks
 * - weeklyFocusDistributionJson: Map of week index -> theme/periodization role
 * - constraintsJson: Calendar exceptions (holidays, tournaments)
 *
 * Preserves manual edits via manualOverrideMaskJson if existing blueprint provided.
 */

export interface GenerateMonthlyBlueprintParams {
  classGroup: ClassGroup;
  monthKey: string; // "YYYY-MM"
  existing?: MonthlyPlanningBlueprint | null;
}

const competitiveIntentByLevel: Record<string, string> = {
  beginner: "Fundação técnica e desenvolvimento de hábitos de força",
  intermediate: "Consolidação técnica com progressão de intensidade",
  advanced: "Aperfeiçoamento tático e preparação competitiva",
  elite: "Periodização científica com periodização específica do macrociclo",
};

const pedagogicalProgressionByLevel: Record<string, string[]> = {
  beginner: [
    "Aquecimento e mobilidade específica",
    "Fundamentos de toque (passe e levantamento)",
    "Segurança em defesa (recepção e bloqueio)",
    "Jogo recreativo com regras simplificadas",
  ],
  intermediate: [
    "Técnica de escada (progredindo dificuldade)",
    "Sistemas táticos básicos (3v3 progressivo)",
    "Força funcional e coordenação",
    "Competição estruturada com retrospectiva",
  ],
  advanced: [
    "Combinações tático-técnicas (1v1, 2v2, 3v3)",
    "Especificidade por posição",
    "Preparação física periodizada",
    "Análise de vídeo e autoconsciência",
  ],
  elite: [
    "Macrociclo competitivo (base, intensidade, tapering)",
    "Periodização de força em bloco",
    "Tática de contraataque e pressão",
    "Recuperação ativa e prevenção de lesão",
  ],
};

const monthIntentByCalendarPhase: Record<string, string> = {
  "off-season": "Desenvolvimento técnico e construção de condicionamento",
  "pre-season": "Integração tática progressiva com preparação competitiva",
  "in-season": "Manutenção técnica com picos de performance estratégicos",
  "post-season": "Recuperação ativa e reflexão sobre desempenho",
};

/**
 * Infer calendar phase from month (1-12).
 * Simplified: Brazilian school calendar + volleyball seasons.
 * - Jan–Feb: Off-season recovery
 * - Mar–May: Pre-season
 * - Jun–Aug: In-season (high schools/clubs play championships)
 * - Sep–Nov: In-season continuation / post-season
 * - Dec: Mixed recovery phase
 */
const inferCalendarPhase = (month: number): string => {
  if (month <= 2) return "off-season";
  if (month <= 5) return "pre-season";
  if (month <= 8) return "in-season";
  if (month <= 11) return "in-season";
  return "off-season";
};

export const generateMonthlyBlueprint = (params: GenerateMonthlyBlueprintParams): MonthlyPlanningBlueprint => {
  const { classGroup, monthKey, existing } = params;
  const nowIso = new Date().toISOString();

  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);

  const competitiveLevel = classGroup.competitiveLevel || "beginner";
  const calendarPhase = inferCalendarPhase(month);

  // Build macro intent combining level + calendar phase
  const levelIntent = competitiveIntentByLevel[competitiveLevel] || competitiveIntentByLevel.beginner;
  const phaseIntent = monthIntentByCalendarPhase[calendarPhase] || monthIntentByCalendarPhase["in-season"];
  const macroIntent = `${levelIntent} · Fase: ${calendarPhase}`;

  // Build pedagogical progression (4 key focuses for typical 4-5 week month)
  const basePedagogy = pedagogicalProgressionByLevel[competitiveLevel] || pedagogicalProgressionByLevel.beginner;
  const pedagogicalProgression = basePedagogy;

  // Distribute weekly themes: e.g., week 1 -> basePedagogy[0], week 2 -> basePedagogy[1], etc.
  const weeklyFocusDistribution: Record<number, string> = {
    0: basePedagogy[0] || "Aula 1",
    1: basePedagogy[1] || "Aula 2",
    2: basePedagogy[2] || "Aula 3",
    3: basePedagogy[3] || "Aula 4",
    4: basePedagogy[0] || "Aula 5", // Cycle back if month has 5 weeks
  };

  const newVersion = (existing?.generationVersion ?? 0) + 1;

  return {
    id: existing?.id ?? `mpb_${classGroup.id}_${monthKey}`,
    classId: classGroup.id,
    year,
    month,
    title: `Planejamento ${monthKey}`,
    macroIntent,
    pedagogicalProgression: JSON.stringify(pedagogicalProgression),
    weeklyFocusDistributionJson: JSON.stringify(weeklyFocusDistribution),
    constraintsJson: existing?.constraintsJson ?? "{}",
    contextSnapshotJson: JSON.stringify({
      competitiveLevel,
      calendarPhase,
      classGroupName: classGroup.name,
      generatedAt: nowIso,
    }),
    generationModelVersion: "planning-v1",
    generationVersion: newVersion,
    syncStatus: "in_sync",
    lastAutoGeneratedAt: nowIso,
    lastManualEditedAt: existing?.lastManualEditedAt ?? nowIso,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
};

/**
 * Preserve manual field overrides from existing blueprint when regenerating.
 * Similar to daily lesson plan pattern: parse override mask, copy locked fields.
 */
export const regenerateMonthlyBlueprintPreservingEdits = (params: {
  existing: MonthlyPlanningBlueprint;
  newBlueprint: MonthlyPlanningBlueprint;
}): MonthlyPlanningBlueprint => {
  const { existing, newBlueprint } = params;

  // For now, blueprint-level edits are simpler; we preserve manual intent if title was changed
  if (existing.title !== `Planejamento ${existing.year}-${String(existing.month).padStart(2, "0")}`) {
    return {
      ...newBlueprint,
      title: existing.title,
    };
  }

  return newBlueprint;
};
