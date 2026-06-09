import type { VolleyballSkill } from "../models";

export type ActivityRealityFlag =
  | "longQueue"
  | "teacherBottleneck"
  | "hitToContinueRule"
  | "missingRotation"
  | "missingStarter"
  | "genericName"
  | "skillDrift"
  | "overTechnicalWarmup"
  | "artificialText"
  | "internalFieldLeak";

export type ActivityRealityScore = {
  score: number;
  flags: ActivityRealityFlag[];
  breakdown: {
    participation: number;
    waiting: number;
    clarity: number;
    progression: number;
    skillRelation: number;
    ageFit: number;
  };
};

type RealityActivity = {
  stage?: string;
  name?: string;
  participants?: string;
  organization?: string;
  starter?: string;
  action?: string;
  rotation?: string;
  simpleRule?: string;
  scoring?: string;
  execution?: string;
  coachFocus?: string;
  successCriteria?: string;
  adaptation?: string;
  primarySkill?: string;
  presentation?: { standardText?: string };
};

const normalize = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const hasAny = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

const skillSignals: Record<VolleyballSkill, RegExp[]> = {
  passe: [/passe/, /manchete/, /recepcao/, /primeiro contato/, /jogavel/, /chama/],
  levantamento: [/levant/, /segundo contato/, /toque/, /bola alta/, /zona combinada/],
  ataque: [/ataque/, /finaliz/, /zona livre/, /bola final/],
  bloqueio: [/bloqueio/, /janela/, /rede/, /cobertura/],
  defesa: [/defesa/, /defende/, /salva/, /protege/, /devolve jogavel/],
  saque: [/saque/, /saca/, /sacador/, /zona de saque/],
  transicao: [/transicao/, /contra-ataca/, /vira-jogo/, /reorganiza/, /defesa ao ataque/],
};

export const evaluateActivityReality = (
  activity: RealityActivity,
  params: { primarySkill: VolleyballSkill }
): ActivityRealityScore => {
  const text = normalize([
    activity.name,
    activity.participants,
    activity.organization,
    activity.starter,
    activity.action,
    activity.rotation,
    activity.simpleRule,
    activity.scoring,
    activity.execution,
    activity.presentation?.standardText,
  ].join(" "));
  const flags: ActivityRealityFlag[] = [];

  const longQueue = /\bfila\b/.test(text) && !/\bfila curta|filas curtas|rodizio rapido|rodizio rapido\b/.test(text);
  const teacherBottleneck = /\bprofessor\b[^.]{0,60}\b(lanca|alimenta|entrega|passa)\b[^.]{0,80}\b(um por vez|cada aluno|fila)\b/.test(text);
  const hitToContinueRule =
    /\bso continua\b[^.]{0,80}\b(acertar|acerto|alvo|zona)\b/.test(text) ||
    /\b(acertar|acerto)\b[^.]{0,80}\bpara continuar\b/.test(text);
  const missingRotation = !normalize(activity.rotation) || !/\btroca|trocam|rodizio|depois de|a cada|rodam|passa\b/.test(text);
  const missingStarter = !normalize(activity.starter) || !/\binicia|comeca|bola entra|lanca|saca|ao sinal|abre\b/.test(text);
  const genericName = /\b(passe orientado|atividade estruturada|aquecimento com|tarefa tecnica|ajuste de contato)\b/.test(text);
  const artificialText = /\b(vwv_|exploracao guiada|referencia tecnica|volleyballxl|descric(?:a|ao) gerada)\b/.test(text);
  const internalFieldLeak = /\b(foco do professor|criterio de sucesso|adaptacao|primaryskill|sourcepatternid)\b/.test(text);
  const overTechnicalWarmup =
    activity.stage === "warmup" &&
    /\b(base baixa|bracos juntos|plataforma firme|correto|perfeito|gesto perfeito)\b/.test(text);
  const skillDrift =
    params.primarySkill === "passe" &&
    /\b(levantamento|levantador|distribuicao|organizar ataque|segundo contato|toque com cone|cone pega-toque|mini jogo com segundo contato definido)\b/.test(text);

  if (longQueue) flags.push("longQueue");
  if (teacherBottleneck) flags.push("teacherBottleneck");
  if (hitToContinueRule) flags.push("hitToContinueRule");
  if (missingRotation) flags.push("missingRotation");
  if (missingStarter) flags.push("missingStarter");
  if (genericName) flags.push("genericName");
  if (skillDrift) flags.push("skillDrift");
  if (overTechnicalWarmup) flags.push("overTechnicalWarmup");
  if (artificialText) flags.push("artificialText");
  if (internalFieldLeak) flags.push("internalFieldLeak");

  const hasParticipation = hasAny(text, [/aluno/, /dupla/, /trio/, /grupo/, /equipe/, /turma/]);
  const hasOrganization = hasAny(text, [/quadra/, /zona/, /cone/, /alvo/, /rede/, /linha/, /bola/]);
  const hasAction = hasAny(text, [/recebe/, /envia/, /devolve/, /saca/, /levanta/, /defende/, /fecha/, /troca/, /joga/, /chama/, /inicia/]);
  const hasRule = Boolean(normalize(activity.simpleRule || activity.scoring || activity.execution));
  const skillFit = hasAny(text, skillSignals[params.primarySkill]);
  const ageFit = !overTechnicalWarmup && !genericName;

  const breakdown = {
    participation: hasParticipation && !longQueue ? 20 : hasParticipation ? 12 : 0,
    waiting: !longQueue && !teacherBottleneck ? 20 : 6,
    clarity: [hasOrganization, Boolean(normalize(activity.starter)), hasAction, Boolean(normalize(activity.rotation))]
      .filter(Boolean).length >= 3
      ? 10
      : 4,
    progression: hasRule || normalize(activity.adaptation) ? 15 : 6,
    skillRelation: skillFit && !skillDrift ? 20 : skillFit ? 10 : 0,
    ageFit: ageFit ? 15 : 4,
  };
  const score = Object.values(breakdown).reduce((sum, item) => sum + item, 0);

  return {
    score,
    flags,
    breakdown,
  };
};
