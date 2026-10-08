import type {
  ScoutingAction, ScoutingActionFundamental, ScoutingContact, ScoutingMatchState,
  ScoutingRally, ScoutingSide,
} from "./models";
import { getScoutingResultOptions, type ScoutingResultOption } from "./scouting";

// Version 2 is explicit on new actions. Historical result keys/levels stay intact.
export const scoutingCaptureRubricVersion = 2;
export const captureFundamentals: ScoutingActionFundamental[] = [
  "recepcao", "levantamento", "ataque", "saque", "defesa", "bloqueio",
];
const friendlyLabels: Record<string, string> = {
  c_baixo: "Limitada", b_medio: "Boa", a_alto: "Completa",
  manteve: "Manteve", organizou: "Organizou", decisivo: "Preciso",
  continuidade: "Em jogo",
};
export const getCaptureResultOptions = (fundamental: ScoutingActionFundamental): ScoutingResultOption[] =>
  getScoutingResultOptions(fundamental).map((option) => {
    if (fundamental === "ataque" && option.key === "bloqueado") {
      return { key: "bloqueio_ponto", label: "Bloq. ponto", level: 0 };
    }
    return { ...option, label: friendlyLabels[option.key] ?? option.label };
  });

export const captureResult = (contact: ScoutingContact) =>
  getCaptureResultOptions(contact.fundamental).find((option) => option.key === contact.resultKey);

export function contactOutcome(contact?: ScoutingContact): ScoutingSide | null {
  if (!contact) return null;
  const { fundamental: f, resultKey: key } = contact;
  if ((f === "saque" && key === "ace") || (["ataque", "bloqueio"].includes(f) && key === "ponto")) return "us";
  if ((["saque", "recepcao", "levantamento", "ataque", "bloqueio"].includes(f) && key === "erro") ||
      (f === "ataque" && key === "bloqueio_ponto") || (f === "defesa" && key === "nao_defendeu")) return "them";
  return null;
}

export function validateRallyContacts(contacts: ScoutingContact[], winner?: ScoutingSide): string | null {
  if (contacts.length > 100) return "Uma jogada pode ter até 100 contatos registrados.";
  for (let i = 0; i < contacts.length; i += 1) {
    const contact = contacts[i];
    if (!captureResult(contact)) return "Escolha um resultado válido para o fundamento.";
    if (contact.zone != null && (!Number.isInteger(contact.zone) || contact.zone < 1 || contact.zone > 6)) return "Escolha uma zona de 1 a 6.";
    const outcome = contactOutcome(contact);
    if (outcome && i !== contacts.length - 1) return "Há um contato que encerra a jogada antes do último. Corrija a sequência.";
    if (winner && outcome && outcome !== winner) return "O ponto não corresponde ao último contato. Corrija o resultado.";
  }
  return null;
}

export function nextCaptureFundamental(contact?: ScoutingContact, serve: ScoutingSide = "them"): ScoutingActionFundamental {
  if (!contact) return serve === "us" ? "saque" : "recepcao";
  if (["recepcao", "defesa", "cobertura"].includes(contact.fundamental)) return "levantamento";
  if (contact.fundamental === "levantamento") return "ataque";
  return "defesa";
}

export function afterScoutingPoint(state: ScoutingMatchState, winner: ScoutingSide): ScoutingMatchState {
  return { ...state, scoreUs: state.scoreUs + Number(winner === "us"),
    scoreThem: state.scoreThem + Number(winner === "them"), serve: winner,
    rotation: winner === "us" && state.serve === "them" && state.rotation != null ? (state.rotation + 4) % 6 + 1 : state.rotation,
    recoveredDraft: [] };
}

export function summarizeRallies(rallies: ScoutingRally[]) {
  const receiving = rallies.filter((r) => r.serve === "them");
  const serving = rallies.filter((r) => r.serve === "us");
  return { total: rallies.length, receiving: { won: receiving.filter((r) => r.won).length, total: receiving.length },
    serving: { won: serving.filter((r) => r.won).length, total: serving.length } };
}

// Historical 'bloqueado' did not distinguish coverage from a terminal block.
// Do not silently classify it as an error or as continuity in attack efficiency.
export function scoutingSkillMetric(actions: ScoutingAction[], fundamental: ScoutingActionFundamental) {
  return scoutingWeightedMetric(actions.map(a => ({ fundamental: a.fundamental, result_key: a.resultKey, result_level: a.resultLevel, count: 1 })), fundamental);
}

export function scoutingWeightedMetric(counts: { fundamental: ScoutingActionFundamental; result_key: string; result_level: number; count: number }[], fundamental: ScoutingActionFundamental) {
  const selected = counts.filter((a) => a.fundamental === fundamental);
  const sum = (rows: typeof counts) => rows.reduce((total, row) => total + row.count, 0);
  const known = selected.filter((a) => !(fundamental === "ataque" && a.result_key === "bloqueado"));
  const n = sum(known);
  const points = sum(known.filter((a) => a.result_key === "ponto"));
  const errors = sum(known.filter((a) => a.result_key === "erro" || a.result_key === "bloqueio_ponto"));
  const positive = sum(known.filter((a) => a.result_level >= 2));
  return { total: sum(selected), denominator: n, excluded: sum(selected) - n,
    value: n ? Math.round(100 * (fundamental === "ataque" ? points - errors : positive) / n) : null,
    numerator: fundamental === "ataque" ? points - errors : positive, points, errors };
}

export const captureCriterion = (f: ScoutingActionFundamental, key: string): string => {
  const terminal = contactOutcome({ fundamental: f, resultKey: key, phase: "side_out" });
  if (terminal) return key === "bloqueio_ponto" ? "Bloqueio adversário encerrou o ponto. Se houve cobertura e continuidade, use Em jogo." :
    terminal === "us" ? "Este contato encerrou a jogada com ponto nosso." : "Este contato encerrou a jogada com ponto adversário.";
  if (f === "recepcao") return ({ c_baixo: "Manteve a bola viva, com construção limitada.", b_medio: "Permitiu construir o ataque com algumas opções.", a_alto: "Permitiu todas as opções previstas para a tarefa." } as Record<string, string>)[key] ?? "Avalie a construção da jogada.";
  if (f === "levantamento") return key === "decisivo" ? "Chegou ao alvo e tempo pretendidos; não significa ponto ou assistência automática." : "Avalie se o levantamento permitiu organizar o ataque.";
  if (f === "bloqueio") return "O bloqueio tocou ou amortizou a bola, que continuou em jogo.";
  return "Avalie o efeito deste contato na continuidade, usando o mesmo critério durante a sessão.";
};
