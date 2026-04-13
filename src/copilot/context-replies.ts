import type { OperationalContextResult } from "./operational-context";
import type { CopilotAction, CopilotSignal } from "./types";

type PanelState = OperationalContextResult["panel"];

type ScreenKey =
  | "nfc"
  | "class"
  | "classes"
  | "coordination"
  | "events"
  | "periodization";

type ResolveComposerSubmissionParams = {
  prompt: string;
  screen: string | null | undefined;
  panel: PanelState;
  actions: CopilotAction[];
};

type BuildDefaultContextReplyParams = {
  screen: string | null | undefined;
  panel: PanelState;
  actions: CopilotAction[];
};

type BuildNfcQuickActionReplyParams = {
  actionId: string;
  screen: string | null | undefined;
  signals: CopilotSignal[];
};

export type ComposerSubmissionResolution =
  | { mode: "context_reply"; message: string }
  | { mode: "assistant" };

const GLOBAL_INTENT_KEYWORDS = [
  "todas as turmas",
  "organizacao inteira",
  "organizacao geral",
  "fora dessa tela",
  "fora desta tela",
  "assistente geral",
  "chat geral",
  "pesquisa cientifica",
  "artigo cientifico",
  "benchmark",
];

const GENERIC_CONTEXT_KEYWORDS = [
  "aqui",
  "dessa tela",
  "desta tela",
  "neste contexto",
  "agora",
  "pendencia",
  "alerta",
];

const SCREEN_KEYWORDS_BY_PREFIX: Record<ScreenKey, string[]> = {
  nfc: ["nfc", "tag", "duplicad", "presenca", "checkin", "sincron"],
  class: ["turma", "aluno", "falta", "engajamento", "presenca", "relatorio"],
  classes: ["turma", "aluno", "falta", "engajamento", "presenca", "relatorio"],
  coordination: ["coordenacao", "relatorio", "pendencia", "engajamento", "organizacao"],
  events: ["torneio", "regulamento", "chaveamento", "evento", "regras"],
  periodization: ["periodizacao", "microciclo", "treino", "carga"],
};

const CONTEXT_NAME_BY_SCREEN: Record<ScreenKey, string> = {
  nfc: "NFC",
  class: "turma atual",
  classes: "lista de turmas",
  coordination: "coordenacao",
  events: "eventos e torneios",
  periodization: "periodizacao",
};

const normalizeComposerText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const hasAnyKeyword = (input: string, keywords: string[]) =>
  keywords.some((keyword) => input.includes(keyword));

const resolveScreenKey = (screen: string | null | undefined): ScreenKey | null => {
  const normalizedScreen = String(screen ?? "").toLowerCase();
  return (
    (Object.keys(SCREEN_KEYWORDS_BY_PREFIX) as ScreenKey[]).find((key) =>
      normalizedScreen.startsWith(key)
    ) ?? null
  );
};

const resolveContextName = (screenKey: ScreenKey | null) =>
  screenKey ? CONTEXT_NAME_BY_SCREEN[screenKey] : "tela atual";

const buildContextualComposerReply = (
  params: ResolveComposerSubmissionParams
): string | null => {
  const normalizedPrompt = normalizeComposerText(params.prompt);
  if (!normalizedPrompt) return null;

  if (hasAnyKeyword(normalizedPrompt, GLOBAL_INTENT_KEYWORDS)) return null;

  const screenKey = resolveScreenKey(params.screen);
  const screenKeywords = screenKey ? SCREEN_KEYWORDS_BY_PREFIX[screenKey] : [];
  const hasContextHint =
    hasAnyKeyword(normalizedPrompt, screenKeywords) ||
    hasAnyKeyword(normalizedPrompt, GENERIC_CONTEXT_KEYWORDS);

  if (!hasContextHint) return null;

  const attentionSignals = params.panel.attentionSignals.slice(0, 2);
  const quickActions = params.actions.slice(0, 3).map((item) => item.title);
  const hasAlerts = attentionSignals.length > 0;
  const topAlerts = attentionSignals.map((item) => item.title).join(" | ");
  const contextName = resolveContextName(screenKey);

  const wantsSummary = hasAnyKeyword(normalizedPrompt, [
    "resumo",
    "status",
    "situacao",
    "como ta",
    "como esta",
  ]);
  const wantsActions = hasAnyKeyword(normalizedPrompt, [
    "proxima",
    "proximas",
    "passos",
    "acao",
    "acoes",
    "o que fazer",
  ]);
  const wantsDuplicates = hasAnyKeyword(normalizedPrompt, [
    "duplicad",
    "duplo",
    "repetid",
  ]);
  const wantsRegulation = hasAnyKeyword(normalizedPrompt, [
    "regra",
    "regras",
    "regulamento",
    "vigencia",
    "vigencia",
    "pendente",
    "pending",
  ]);

  if (screenKey === "nfc" && wantsDuplicates) {
    const duplicateSignal = attentionSignals.find((item) =>
      normalizeComposerText(`${item.title} ${item.summary}`).includes("duplicad")
    );
    if (!duplicateSignal) {
      return "No NFC atual, nao encontrei padrao forte de duplicidade.";
    }
    return `No NFC atual, duplicidades em foco: ${duplicateSignal.summary}`;
  }

  if (screenKey === "events" && wantsRegulation) {
    let message = `Regulamento ativo: ${params.panel.activeRuleSetLabel}.`;
    if (params.panel.pendingRuleSetLabel) {
      message += ` Proximo ciclo: ${params.panel.pendingRuleSetLabel}.`;
    }
    if (params.panel.unreadRegulationCount > 0) {
      message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) pendente(s).`;
    }
    return message;
  }

  if (wantsActions) {
    if (!quickActions.length) {
      return `Neste contexto (${contextName}), nao ha acoes recomendadas agora.`;
    }
    return `Proximos passos para ${contextName}: ${quickActions.join(", ")}.`;
  }

  if (!hasAlerts) {
    let message = `Tudo em ordem em ${contextName}.`;
    if (params.panel.unreadRegulationCount > 0) {
      message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) de regulamento pendente(s).`;
    }
    if (quickActions.length) {
      message += ` Se quiser, sigo com: ${quickActions.join(", ")}.`;
    }
    return message;
  }

  if (wantsSummary || hasAnyKeyword(normalizedPrompt, ["alerta", "pendencia", "pendencias"])) {
    return `Resumo de ${contextName}: ${topAlerts}.`;
  }

  let message = `Ponto principal em ${contextName}: ${topAlerts}.`;
  if (quickActions.length) {
    message += ` Posso executar: ${quickActions.join(", ")}.`;
  }
  return message;
};

export const resolveComposerSubmission = (
  params: ResolveComposerSubmissionParams
): ComposerSubmissionResolution => {
  const contextualReply = buildContextualComposerReply(params);
  if (contextualReply) {
    return {
      mode: "context_reply",
      message: contextualReply,
    };
  }

  return { mode: "assistant" };
};

export const buildDefaultContextReply = (
  params: BuildDefaultContextReplyParams
) => {
  const screenKey = resolveScreenKey(params.screen);
  const contextName = resolveContextName(screenKey);
  const quickActions = params.actions.slice(0, 3).map((item) => item.title);
  const attentionSignals = params.panel.attentionSignals.slice(0, 2);

  if (attentionSignals.length) {
    let message = `Atencao em ${contextName}: ${attentionSignals.map((item) => item.title).join(" | ")}.`;
    if (quickActions.length) {
      message += ` Posso seguir com: ${quickActions.join(", ")}.`;
    }
    return message;
  }

  let message = `Tudo em ordem em ${contextName}.`;
  if (params.panel.unreadRegulationCount > 0) {
    message += ` Ha ${params.panel.unreadRegulationCount} atualizacao(oes) de regulamento pendente(s).`;
  }
  if (quickActions.length) {
    message += ` Se quiser, posso te ajudar com: ${quickActions.join(", ")}.`;
  }
  return message;
};

export const buildNfcQuickActionReply = (
  params: BuildNfcQuickActionReplyParams
) => {
  const screen = String(params.screen ?? "").toLowerCase();
  if (!screen.startsWith("nfc")) return null;

  const nfcSignals = params.signals.filter(
    (item) => item.type === "unusual_presence_pattern"
  );
  const repeatedAbsenceSignals = params.signals.filter(
    (item) => item.type === "repeated_absence"
  );

  if (params.actionId === "nfc_summary") {
    if (!nfcSignals.length && !repeatedAbsenceSignals.length) {
      return "No contexto NFC atual, não há alerta urgente.";
    }
    return `No contexto NFC atual: ${nfcSignals.length} alerta(s) de presença incomum e ${repeatedAbsenceSignals.length} alerta(s) de ausência recorrente.`;
  }

  if (params.actionId === "nfc_actions") {
    if (nfcSignals.length > 0) {
      return "Próximos passos: revisar tags com leitura duplicada, validar vínculo da turma ativa e sincronizar pendências.";
    }
    return "Próximos passos: manter leitura ativa, revisar vínculos de tag e confirmar sincronização ao final da sessão.";
  }

  if (params.actionId === "nfc_duplicates") {
    if (nfcSignals.length > 0) {
      return `Duplicidades em foco: ${nfcSignals[0].summary}`;
    }
    return "Sem padrão forte de duplicidade no contexto NFC atual.";
  }

  return null;
};
