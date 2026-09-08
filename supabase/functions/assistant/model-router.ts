import { resolveAssistantModel } from "./model-policy.ts";

type Message = { role: string; content: string };
export type AssistantRoute = {
  model: ReturnType<typeof resolveAssistantModel>;
  reason: "manual" | "server_override" | "proactive" | "routine" | "planning" | "complex_analysis";
  maxOutputTokens: number;
};
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function initialGreeting(messages: Message[]): string | null {
  if (messages.length !== 1 || messages[0].role !== "user") return null;
  return /^(oi|ola|bom dia|boa tarde|boa noite)[!?.\s]*$/.test(normalize(messages[0].content).trim())
    ? "Olá! Como posso ajudar você hoje?" : null;
}
const complex = (text: string) => {
  const analysis = /\b(analis\w*|compar\w*|reorganiz\w*|replanej\w*|avali\w*|cruz\w*|mont\w*|cri\w*|planej\w*)\b/.test(text);
  const longitudinal = /\b(periodiz\w*|macrocicl\w*|mesocicl\w*|temporada|trimestre|semestre|historico|evolucao|varias turmas|multiplas turmas)\b/.test(text);
  const plan = /\b(aula|treino|plano|planejamento)\b/.test(text);
  const constraints = [/\b(lesao|lesoes|dor|limitacao|limitacoes)\b/, /\b(material|materiais|espaco|quadra|equipamento)\b/, /\b(iniciante\w*|avancad\w*|niveis|idades|faixas etarias)\b/, /\b(carga|fadiga|recuperacao)\b/].filter(rule => rule.test(text)).length;
  return (analysis && longitudinal) || (analysis && plan && constraints >= 3);
};

/** Explicit choices are allowlisted; the server retains token budgets and operator restrictions. */
export function routeAssistant(input: { messages: Message[]; proactive?: boolean; lessonAction?: string | null; modelPreference?: unknown }, configured?: string): AssistantRoute {
  if (input.modelPreference !== undefined && input.modelPreference !== "auto") {
    if (typeof input.modelPreference !== "string" || !input.modelPreference.trim()) throw new Error("Modelo inválido.");
    const model = resolveAssistantModel(input.modelPreference);
    if (input.modelPreference !== model) throw new Error("Modelo inválido.");
    if (configured?.trim() && resolveAssistantModel(configured) !== model) throw new Error("Este modelo está indisponível na configuração atual. Use Automático.");
    if (input.proactive) throw new Error("Seleção manual disponível apenas no chat.");
    return { model, reason: "manual", maxOutputTokens: 4000 };
  }
  if (configured?.trim()) return { model: resolveAssistantModel(configured), reason: "server_override", maxOutputTokens: 4000 };
  if (input.proactive) return { model: "gpt-5.6-luna", reason: "proactive", maxOutputTokens: 1200 };
  const turns = input.messages.filter(message => message.role === "user").slice(-3).map(message => normalize(message.content));
  const latest = turns.at(-1) ?? "";
  // Short continuation inherits the recent task; a new substantive request resets routing.
  const followup = /^(sim|continue|prossiga|pode continuar|detalhe|explique melhor|ajuste isso)[.!?\s]*$/.test(latest);
  const task = followup ? turns.slice(0, -1).join("\n") : latest;
  if (complex(task)) return { model: "gpt-5.6-terra", reason: "complex_analysis", maxOutputTokens: 4000 };
  if (input.lessonAction === "draft" || /\b(mont\w*|cri\w*|adapt\w*|planej\w*)\b[\s\S]*\b(aula|treino|plano)\b/.test(task)) {
    return { model: "gpt-5.6-luna", reason: "planning", maxOutputTokens: 4000 };
  }
  return { model: "gpt-5.6-luna", reason: "routine", maxOutputTokens: input.lessonAction === "auto" ? 4000 : 1800 };
}
