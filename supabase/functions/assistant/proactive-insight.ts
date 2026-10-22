import { requestAssistantCompletion } from "./model-policy.ts";

const CLASS_FIELDS = "ageband,modality,goal,mv_level,level,duration,days,daysperweek";
const MODALITIES = ["voleibol", "voleibol_areia", "futsal", "futebol", "basquete", "fitness"] as const;
const GOALS = [
  "Fundamentos", "Força Geral", "Potência/Agilidade", "Força+Potência", "Velocidade",
  "Agilidade", "Resistência", "Potência", "Mobilidade", "Coordenação", "Prevenção de lesões",
  "Fundamentos + jogo reduzido", "Coordenação + bola + jogo", "Fundamentos + continuidade",
  "Fundamentos + jogo + ataque progressivo",
] as const;
const LEVELS = ["MV1", "MV2", "MV3"] as const;

type QueryResult = { data: unknown; error?: unknown; count?: number | null };
type ContextQuery = PromiseLike<QueryResult> & {
  select: (columns: string, options?: { count: "exact"; head: true }) => ContextQuery;
  eq: (column: string, value: string) => ContextQuery;
  maybeSingle: () => PromiseLike<QueryResult>;
};
type ContextClient = { from: (table: string) => { select: ContextQuery["select"] } };

export class ProactiveContextUnavailableError extends Error {
  constructor() { super("PROACTIVE_CONTEXT_UNAVAILABLE"); }
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const integer = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
const categoryKey = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function category<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string" || value.length > 100) return null;
  const key = categoryKey(value.trim());
  // Emit the known constant, never the original string or a substring of it.
  return allowed.find(item => categoryKey(item) === key) ?? null;
}
function ageRange(value: unknown): { min: number; max: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2})\s*[-–]\s*(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const min = Number(match[1]), max = Number(match[2]);
  return min <= max && max <= 99 ? { min, max } : null;
}

/** This is an allowlist, not a redactor. Free text is never an input to the model. */
export function buildProactiveGroupContext(classRow: unknown, studentCount: unknown) {
  const row = record(classRow);
  const days = Array.isArray(row.days) && row.days.every(day => integer(day, 0, 6) !== null)
    ? new Set(row.days).size : null;
  const numericLevel = integer(row.level, 1, 3);
  return {
    modality: category(row.modality, MODALITIES),
    ageRange: ageRange(row.ageband),
    goal: category(row.goal, GOALS),
    developmentLevel: category(row.mv_level, LEVELS) ?? (numericLevel ? LEVELS[numericLevel - 1] : null),
    sessionsPerWeek: days ?? integer(row.daysperweek, 0, 7),
    durationMinutes: integer(row.duration, 10, 240),
    registeredStudentCount: integer(studentCount, 0, 100_000),
  };
}

const proactiveSystemPrompt = [
  "Você é um copiloto pedagógico para treinadores esportivos.",
  "O contexto contém somente categorias e números da turma, sem identificação ou histórico individual.",
  "Produza uma recomendação coletiva breve para adequar complexidade, organização ou volume à modalidade, faixa etária, objetivo e nível informados.",
  "Use apenas fatos presentes no contexto; campos null representam informação indisponível.",
  "Não deduza condições médicas, restrições, contatos, nomes ou necessidades de uma pessoa a partir desses agregados.",
  "O campo 'insight' contém a recomendação; 'based_on' lista somente categorias e números recebidos.",
  "O campo 'action' deve ser null: este modo não dispõe de destinatários nem de pendências individuais.",
  "Se o contexto não sustentar uma recomendação altamente relevante, retorne insight null e confiança baixa.",
  "Use português simples, conciso e profissional. Retorne apenas JSON válido.",
].join(" ");

// Keep the client response contract; individual actions are suppressed server-side.
const proactiveResponseSchema = {
  type: "object",
  properties: {
    insight: { anyOf: [{ type: "string" }, { type: "null" }] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    based_on: { type: "array", items: { type: "string" } },
    action: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            type: { type: "string" }, label: { type: "string" },
            params: {
              type: "object", properties: { phone: { type: "string" }, message: { type: "string" } },
              required: ["phone", "message"], additionalProperties: false,
            },
          },
          required: ["type", "label", "params"], additionalProperties: false,
        },
      ],
    },
  },
  required: ["insight", "confidence", "based_on", "action"],
  additionalProperties: false,
};

/** Called only after the assistant's existing JWT, workspace and class checks. */
export async function requestProactiveInsight(
  supabase: ContextClient, organizationId: string, classId: string, apiKey: string, model: string,
) {
  if (!organizationId || !classId) throw new ProactiveContextUnavailableError();
  const [classResult, rosterResult] = await Promise.all([
    supabase.from("classes").select(CLASS_FIELDS).eq("organization_id", organizationId).eq("id", classId).maybeSingle(),
    // HEAD counts records under the caller's RLS; no athlete identifiers or health rows are fetched.
    supabase.from("students").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("classid", classId),
  ]);
  if (classResult.error || !classResult.data || rosterResult.error || integer(rosterResult.count, 0, 100_000) === null)
    throw new ProactiveContextUnavailableError();
  const context = buildProactiveGroupContext(classResult.data, rosterResult.count);
  return requestAssistantCompletion(apiKey, {
    model,
    messages: [
      { role: "system", content: proactiveSystemPrompt },
      { role: "user", content: JSON.stringify({ group: context, request: "Sugira uma decisão pedagógica coletiva para esta turma." }) },
    ],
    response_format: {
      json_schema: { name: "proactive_insight_response", schema: proactiveResponseSchema, strict: true },
    },
    max_tokens: 300,
  });
}
