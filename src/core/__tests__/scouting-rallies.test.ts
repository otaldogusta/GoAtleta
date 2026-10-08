import { afterScoutingPoint, contactOutcome, getCaptureResultOptions, nextCaptureFundamental, scoutingSkillMetric, validateRallyContacts } from "../scouting-rallies";
import type { ScoutingAction, ScoutingContact, ScoutingMatchState } from "../models";

const contact = (fundamental: ScoutingContact["fundamental"], resultKey: string): ScoutingContact => ({ fundamental, resultKey, phase: "side_out" });
const state: ScoutingMatchState = { setNumber: 1, scoreUs: 12, scoreThem: 10, serve: "them", rotation: 1, recoveredDraft: [] };
test("closes exactly one point and rotates only when recovering serve", () => {
  const won = afterScoutingPoint(state, "us");
  expect(won).toMatchObject({ scoreUs: 13, scoreThem: 10, rotation: 6, serve: "us" });
  expect(afterScoutingPoint(won, "us").rotation).toBe(6);
  expect(afterScoutingPoint(state, "them")).toMatchObject({ scoreUs: 12, scoreThem: 11, rotation: 1 });
  expect(afterScoutingPoint({ ...state, rotation: null }, "us").rotation).toBeNull();
});
test("partial capture is allowed, contradictions and invalid results are rejected", () => {
  expect(validateRallyContacts([], "us")).toBeNull();
  expect(validateRallyContacts([contact("ataque", "ponto")], "them")).not.toBeNull();
  expect(validateRallyContacts([contact("ataque", "ponto"), contact("defesa", "defesa_boa")])).not.toBeNull();
  expect(validateRallyContacts([contact("ataque", "unknown")])).not.toBeNull();
  expect(validateRallyContacts([{ ...contact("recepcao", "b_medio"), zone: 7 }])).not.toBeNull();
  expect(validateRallyContacts([contact("recepcao", "b_medio"), contact("levantamento", "organizou"), contact("ataque", "ponto")], "us")).toBeNull();
});
test("does not reinterpret historical block evaluations", () => {
  expect(contactOutcome(contact("ataque", "bloqueado"))).toBeNull();
  expect(contactOutcome(contact("ataque", "bloqueio_ponto"))).toBe("them");
  expect(contactOutcome(contact("bloqueio", "tocou"))).toBeNull();
  expect(getCaptureResultOptions("ataque")[1]).toMatchObject({ key: "bloqueio_ponto", level: 0 });
  const actions = ["ponto", "erro", "bloqueio_ponto", "bloqueado"].map((resultKey) => ({ fundamental: "ataque", resultKey, resultLevel: 0 }) as ScoutingAction);
  expect(scoutingSkillMetric(actions, "ataque")).toMatchObject({ total: 4, denominator: 3, excluded: 1, value: -33 });
});
test("suggestions change only the next fundamental, never create a contact", () => {
  expect(nextCaptureFundamental(undefined, "us")).toBe("saque");
  expect(nextCaptureFundamental(contact("recepcao", "b_medio"))).toBe("levantamento");
  expect(nextCaptureFundamental(contact("levantamento", "organizou"))).toBe("ataque");
});
