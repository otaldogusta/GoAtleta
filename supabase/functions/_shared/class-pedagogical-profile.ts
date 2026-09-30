/** Shared, dependency-free domain contract. Narrative and evidence are data, never instructions. */
export const PROFILE_LABELS = {
  gameFormat: "Formato de jogo", netHeight: "Altura da rede", space: "Espaço",
  fundamentals: "Fundamentos", organization: "Organização coletiva", continuity: "Continuidade",
  bounce: "Quique", rules: "Regras adaptadas", difficulties: "Dificuldades",
  priorities: "Prioridades", objectives: "Objetivos", resources: "Recursos", constraints: "Restrições",
  legacyContext: "Relato anterior",
} as const;
export type ProfileKey = keyof typeof PROFILE_LABELS;
export type GameFormat = "1x1" | "2x2" | "3x3" | "4x4" | "6x6";
export type ProfileFact = {
  value: string; quote: string; sourceId: string; authorId: string; updatedAt: string;
  origin: "teacher" | "selector" | "legacy" | "evolution";
  claims?: Omit<ProfileFact, "claims">[];
};
export type PedagogicalProfile = {
  schemaVersion: 1;
  facts: Partial<Record<ProfileKey, ProfileFact>>;
};
export type ProfileRecord = {
  organization_id: string; class_id: string; version: number; profile: PedagogicalProfile; updated_at: string;
};
export type ProfilePatch = { key: ProfileKey; value: string | null; quote: string; operation?: "append" | "replace" | "remove"; evidence?: { id: string; quote: string }[] };
export type ProfileInterpretation = {
  kind: "report" | "question" | "hypothesis";
  changes: ProfilePatch[]; question: string; reply: string;
};
export const emptyProfile = (): PedagogicalProfile => ({ schemaVersion: 1, facts: {} });
export function profileSummary(profile?: PedagogicalProfile | null): string {
  return Object.entries(profile?.facts ?? {}).map(([key, fact]) =>
    `${PROFILE_LABELS[key as ProfileKey]}: ${fact.value}`).join("\n");
}
export function profileGameFormat(profile?: PedagogicalProfile | null): GameFormat | undefined {
  const value = profile?.facts.gameFormat?.value;
  return ["1x1", "2x2", "3x3", "4x4", "6x6"].includes(value ?? "") ? value as GameFormat : undefined;
}
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
/** Validate evidence before any model-produced change reaches persistence. */
export function reconcileProfileInterpretation(raw: unknown, message: string, profile: PedagogicalProfile, sentAt?: string): ProfileInterpretation {
  const input = raw as Partial<ProfileInterpretation> | null;
  if (!input || !["report", "question", "hypothesis"].includes(input.kind ?? "") ||
      !Array.isArray(input.changes) || typeof input.reply !== "string" || typeof input.question !== "string") {
    throw new Error("INVALID_PROFILE_INTERPRETATION");
  }
  const changes: ProfilePatch[] = [];
  let question = input.question.slice(0, 500);
  if (input.kind === "report") for (const change of input.changes) {
    if (!Object.prototype.hasOwnProperty.call(PROFILE_LABELS, change?.key) ||
        typeof change.quote !== "string" || change.quote.trim().length < 3 ||
        !normalize(message).includes(normalize(change.quote)) ||
        (change.value !== null && (typeof change.value !== "string" || !change.value.trim() || change.value.length > 1000 || !normalize(message).includes(normalize(change.value))))) {
      throw new Error("UNGROUNDED_PROFILE_CHANGE");
    }
    // Selectors are explicit choices. A narrative may discuss another format without choosing it.
    if (change.key === "gameFormat" || change.key === "netHeight") {
      if (change.value !== profile.facts[change.key]?.value) {
        question = `Você quer alterar ${PROFILE_LABELS[change.key].toLowerCase()}? Confirme no seletor da quadra.`;
      }
      continue;
    }
    if (sentAt && Date.parse(profile.facts[change.key]?.updatedAt ?? "") > Date.parse(sentAt)) {
      question = `${PROFILE_LABELS[change.key]} mudou após o envio deste relato. Você quer corrigir a informação atual?`;
      continue;
    }
    if (changes.some(item => item.key === change.key)) throw new Error("DUPLICATE_PROFILE_KEY");
    if (change.operation && !["append", "replace", "remove"].includes(change.operation)) throw new Error("INVALID_PROFILE_OPERATION");
    if (change.operation === "remove" && change.value !== null) throw new Error("INVALID_PROFILE_OPERATION");
    if (change.operation === "append" && profile.facts[change.key]?.claims?.some(claim => normalize(claim.value) === normalize(change.value ?? ""))) continue;
    if ((profile.facts[change.key]?.value ?? null) !== change.value) changes.push(change);
  }
  return { kind: input.kind!, changes, question, reply: input.reply.slice(0, 1400) };
}
/** Conservative transfer: game format is not a proxy for technical mastery or training load. */
export function profilePlanningGuidance(profile?: PedagogicalProfile | null) {
  const format = profileGameFormat(profile);
  const facts = profile?.facts ?? {};
  const priorities = [facts.priorities?.value, facts.difficulties?.value, facts.objectives?.value].filter(Boolean) as string[];
  const adaptations = [facts.bounce?.value, facts.rules?.value, facts.constraints?.value, facts.resources?.value,
    facts.space?.value ? `Espaço: ${facts.space.value}` : undefined,
    facts.netHeight?.value ? `Rede: ${facts.netHeight.value.replace(".", ",")} m` : undefined,
  ].filter(Boolean) as string[];
  return {
    format, priorities, adaptations,
    progression: format ? [
      priorities[0] || `Organização e continuidade no ${format}`,
      priorities[1] || `Leitura do jogo e cooperação no ${format}`,
      priorities[2] || `Decisões e transições no ${format}`,
      `Aplicação no ${format}, mantendo as adaptações da turma`,
    ] : priorities,
    summary: profileSummary(profile),
    rule: format ? `Jogo de referência: ${format}. Jogos reduzidos somente como tarefa específica, com transferência para ${format}. Não inferir domínio técnico pelo formato. ${adaptations.join("; ")}` : adaptations.join("; "),
  };
}

export type EvolutionEvidence = { id: string; date: string; text: string };
export type EvolutionCandidate = { changes: ProfilePatch[]; evidenceIds: string[]; contradictory: boolean; summary: string };
export function validateEvolution(candidate: EvolutionCandidate, reports: EvolutionEvidence[]): boolean {
  if (candidate.contradictory || !candidate.changes.length) return false;
  const evidence = reports.filter(item => candidate.evidenceIds.includes(item.id));
  return new Set(evidence.map(item => item.date)).size >= 2 && candidate.changes.every(change =>
    Object.prototype.hasOwnProperty.call(PROFILE_LABELS, change.key) &&
    !["gameFormat", "netHeight"].includes(change.key) &&
    typeof change.quote === "string" && change.quote.trim().length >= 3 &&
    new Set((change.evidence ?? []).flatMap(citation => {
      const source = evidence.find(item => item.id === citation.id);
      return source && citation.quote.trim().length >= 3 && normalize(source.text).includes(normalize(citation.quote)) ? [source.date] : [];
    })).size >= 2 && evidence.some(item => normalize(item.text).includes(normalize(change.quote))) &&
    (change.value === null || (typeof change.value === "string" && change.value.length > 0 && change.value.length <= 1000 && evidence.some(item => normalize(item.text).includes(normalize(change.value!))))));
}
