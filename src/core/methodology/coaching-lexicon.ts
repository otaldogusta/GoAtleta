export const coachingLexiconNormalize = {
  plataforma: "manchete",
  contato_plataforma: "manchete",
  "contato plataforma": "manchete",
  distribuicao: "levantamento",
  distribuição: "levantamento",
  distribuicao_da_bola: "levantamento",
  "distribuição da bola": "levantamento",
  efetividade_adversaria: "dificultar a jogada do outro lado",
  "efetividade adversária": "dificultar a jogada do outro lado",
  organizacao_ofensiva: "organizar o ataque",
  "organização ofensiva": "organizar o ataque",
  continuidade_ofensiva: "dar sequência na jogada",
  "continuidade ofensiva": "dar sequência na jogada",
  reorganizacao: "se reorganizar",
  "reorganização": "se reorganizar",
  gesto_tecnico: "movimento",
  "gesto técnico": "movimento",
  execucao_tecnica: "execução",
  "execução técnica": "execução",
} as const;

export const passeLexicon = {
  base: "manchete",
  stable: "braços firmes na manchete",
  long: "manchete longa",
  short: "recepção curta",
  control: "controlar a primeira bola",
  direction: "direcionar o passe para a levantadora",
  commonErrors: ["braços soltos", "bola subindo demais", "passe afastado da rede"],
} as const;

export const levantamentoLexicon = {
  base: "levantamento",
  distribution: "distribuir a bola",
  tempo: "tempo do levantamento",
  position: "posição da levantadora",
  organize: "organizar o ataque",
  phrases: [
    "soltar a bola para o ataque",
    "levantar com precisão",
    "colocar a bola na mão do atacante",
  ],
} as const;

export const ataqueLexicon = {
  base: "ataque",
  diagonal: "ataque na diagonal",
  paralela: "ataque na paralela",
  direction: "direcionar o ataque",
  decision: "escolher a melhor opção de ataque",
  phrases: ["finalizar a jogada", "variar o ataque", "explorar o bloqueio"],
} as const;

export const saqueLexicon = {
  base: "saque",
  target: "saque direcionado",
  deep: "saque no fundo da quadra",
  breakReception: "saque para quebrar a recepção",
  short: "saque curto",
  phrases: [
    "tirar o passe da rede",
    "dificultar a recepção",
    "colocar pressão no outro lado",
  ],
} as const;

export const defesaLexicon = {
  base: "defesa",
  spikeDefense: "defesa de ataque",
  tipDefense: "defesa de largada",
  read: "ler a jogada",
  react: "reagir rápido",
  continuity: "manter a bola viva",
  phrases: ["não deixar a bola cair", "segurar a defesa", "recuperar a jogada"],
} as const;

export const bloqueioLexicon = {
  base: "bloqueio",
  simple: "bloqueio simples",
  double: "bloqueio duplo",
  timing: "tempo de salto",
  close: "fechar o espaço do ataque",
  phrases: ["subir junto no bloqueio", "fechar a diagonal", "tocar na bola no bloqueio"],
} as const;

export const transicaoLexicon = {
  base: "transição",
  defenseAttack: "saída para o contra-ataque",
  coverage: "cobertura do ataque",
  reorganize: "se reorganizar rápido",
  continuity: "dar sequência na jogada",
  phrases: ["virar a bola após a defesa", "organizar o contra-ataque", "continuar a jogada"],
} as const;

export const tradicionalPhrases = [
  "com correção objetiva",
  "com foco na execução correta",
  "repetindo o movimento até ajustar",
] as const;

export const cognitivistaPhrases = [
  "testando diferentes formas",
  "comparando resultados",
  "escolhendo a melhor solução",
] as const;

export const socioculturalPhrases = [
  "conversando entre si",
  "ajustando em grupo",
  "organizando a jogada juntos",
] as const;

export type CoachingLexicon = {
  normalize: typeof coachingLexiconNormalize;
  passe: typeof passeLexicon;
  levantamento: typeof levantamentoLexicon;
  ataque: typeof ataqueLexicon;
  saque: typeof saqueLexicon;
  defesa: typeof defesaLexicon;
  bloqueio: typeof bloqueioLexicon;
  transicao: typeof transicaoLexicon;
};

export const coachingLexicon: CoachingLexicon = {
  normalize: coachingLexiconNormalize,
  passe: passeLexicon,
  levantamento: levantamentoLexicon,
  ataque: ataqueLexicon,
  saque: saqueLexicon,
  defesa: defesaLexicon,
  bloqueio: bloqueioLexicon,
  transicao: transicaoLexicon,
};

export const bannedUiTerms = {
  ...coachingLexiconNormalize,
  "plataforma estável": passeLexicon.stable,
  "ajuste de plataforma": "ajuste da manchete",
  "base da plataforma": "base estável na manchete",
  "organização adversária": "recepção do outro lado",
  "reorganização entre defesa e ataque": transicaoLexicon.defenseAttack,
  "fechamento do corredor": bloqueioLexicon.phrases[1],
  "fechar o corredor": bloqueioLexicon.phrases[1],
  "solução ofensiva": levantamentoLexicon.phrases[0],
} as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildReplacementPattern = (value: string) => {
  const escaped = escapeRegExp(value.trim()).replace(/_/g, "[_\\s]+");
  if (/[_\s]/.test(value)) {
    return new RegExp(escaped, "gi");
  }
  return new RegExp(`\\b${escaped}\\b`, "gi");
};

const orderedBannedTerms = Object.entries(bannedUiTerms)
  .sort((left, right) => right[0].length - left[0].length)
  .map(([from, to]) => ({ pattern: buildReplacementPattern(from), to }));

export const toVisibleCoachingText = (value: string) => {
  let result = String(value ?? "").trim();
  orderedBannedTerms.forEach(({ pattern, to }) => {
    result = result.replace(pattern, to);
  });
  return result
    .replace(/\bmanchete estavel\b/gi, "base estável na manchete")
    .replace(/\bmanter a continuidade\b/gi, transicaoLexicon.continuity)
    .replace(/\s{2,}/g, " ")
    .trim();
};
