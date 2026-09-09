/** Extract activity themes for the history list; never modifies the original report. */
export function trainingHistoryTitle(activity: string, conclusion = ""): string {
  const text = (activity.trim() || conclusion.trim()).replace(/\s+/g, " ");
  if (!text) return "Treino registrado";
  if (text.length <= 64) return text;
  const normalized = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const themes: [RegExp, string][] = [
    [/\broda de conversa\b/, "Roda de conversa"],
    [/\bmanchetes?\b/, "manchete"],
    [/\btoques?\b/, "toque"],
    [/\bsaques?\b/, "saque"],
    [/\brecepcao\b/, "recepção"],
    [/\blevantamento\b/, "levantamento"],
    [/\bataques?\b/, "ataque"],
    [/\bbloqueios?\b/, "bloqueio"],
    [/\bdefesa\b/, "defesa"],
    [/\bdeslocamentos?\b/, "deslocamento"],
    [/\bmini\s*volei\b|\bmini\s*jogo\b/, "minivôlei"],
    [/\balongamento\b/, "alongamento"],
  ];
  const labels = themes.filter(([pattern]) => pattern.test(normalized)).slice(0, 3).map(([, label]) => label);
  if (labels.length) {
    const title = labels.join(" · ");
    return title[0].toUpperCase() + title.slice(1);
  }
  const firstSentence = text.split(/[.!?\n]/)[0].trim();
  return firstSentence.length <= 64 ? firstSentence : "Atividades e observações do treino";
}
