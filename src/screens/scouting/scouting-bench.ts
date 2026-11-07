import type { ScoutingActionFundamental, Student } from "../../core/models";
import { getCaptureResultOptions } from "../../core/scouting-rallies";

export const benchCourtZones = [4, 3, 2, 5, 6, 1] as const;
export type ScoutingLineup = (string | null)[];
export const emptyScoutingLineup = (): ScoutingLineup => benchCourtZones.map(() => null);
export function validScoutingLineup(value: unknown): value is ScoutingLineup {
  return Array.isArray(value) && value.length === 6 && value.every(id => id === null || (typeof id === "string" && id.length > 0)) && new Set(value.filter(Boolean)).size === value.filter(Boolean).length;
}
export function visibleScoutingLineup(lineup: ScoutingLineup, students: readonly Student[]): ScoutingLineup {
  const ids = new Set(students.map(student => student.id));
  return lineup.map(id => id && ids.has(id) ? id : null);
}
const fundamentals: Record<string, ScoutingActionFundamental> = { S: "saque", R: "recepcao", L: "levantamento", A: "ataque", B: "bloqueio", D: "defesa", C: "cobertura", T: "transicao", M: "comunicacao" };
const resultName=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
export type ScoutingCodeContact = { studentId: string; fundamental: ScoutingActionFundamental; resultKey: string };
export type ScoutingCodeResult = { contact: ScoutingCodeContact; error?: never } | { error: string; contact?: never };
/** Local keyboard syntax uses the current capture rubric; it never interprets a point command. */
export function parseScoutingCode(raw: string, students: readonly Student[], jerseys: ReadonlyMap<string, string>, captureVersion: number): ScoutingCodeResult {
  const match = /^(\d{1,2})\s*([SRLABDCTM])\s*(.+)$/i.exec(raw.trim());
  if (!match) return { error: "Use camisa, fundamento e resultado. Ex.: 7S2 ou 7S+." };
  const jersey = String(Number(match[1]));
  const candidates = students.filter(student => { const value = jerseys.get(student.id); return value !== undefined && /^\d{1,2}$/.test(value) && String(Number(value)) === jersey; });
  if (candidates.length !== 1) return { error: candidates.length ? `Camisa ${jersey} repetida. Confira o elenco.` : `Camisa ${jersey} não cadastrada. Confira o elenco.` };
  const fundamental = fundamentals[match[2].toUpperCase()];
  const options = getCaptureResultOptions(fundamental, captureVersion);
  const evaluation = match[3].trim().toLowerCase();
  // Symbols are explicit aliases for levels, not an import of another product's five-value rubric.
  const level = /^[0-3]$/.test(evaluation) ? Number(evaluation) : ({ "=": 0, "-": 1, "+": 2, "#": 3 } as Record<string, number>)[evaluation];
  const matching = level === undefined ? options.filter(option => resultName(option.key) === resultName(evaluation) || resultName(option.label) === resultName(evaluation)) : options.filter(option => option.level === level);
  if (matching.length !== 1) return { error: matching.length ? "Há mais de um resultado nessa nota. Use o nome do resultado ou os botões." : "Resultado não disponível para este fundamento. Confira os critérios." };
  return { contact: { studentId: candidates[0].id, fundamental, resultKey: matching[0].key } };
}
