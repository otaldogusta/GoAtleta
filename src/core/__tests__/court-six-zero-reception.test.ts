import { configureCourtSimulation, getCourtSimulation, receptionPlayerIdentity, sampleCourtSimulation } from "../court-simulation";
import { ensureCourtDefenseStep } from "../court-defense-preset";
import { normalizeCourtSimulation } from "../court-simulation-model";
import { buildSimulatedReceptionRotationPreset } from "../court-simulation-sequence";
import { parseEditorImport } from "../visual-court-editor";
import { buildCourtPerspectiveFrame } from "../visual-court-perspective";
import { displayActors } from "../../components/visual-court/CourtEditorScene";

it("rotates the six numbered athletes through every zone and gives the second touch to zone 2", () => {
  const template = buildSimulatedReceptionRotationPreset("6-0");
  const board = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: template }));
  const team = getCourtSimulation(board, 0)!.teamActorIds!;
  expect(board.actors.filter(actor => team.includes(actor.id)).map(actor => [actor.number, actor.role])).toEqual(
    [1, 2, 3, 4, 5, 6].map(number => [number, "athlete"]));
  const setters = [];
  for (let rotation = 0; rotation < 6; rotation++) {
    const initial = sampleCourtSimulation(board, rotation, 0)!;
    const final = sampleCourtSimulation(board, rotation, 1)!;
    expect(initial.config).toMatchObject({ system: "6-0", rotation, teamActorIds: team });
    expect(initial.visibleIds).toHaveLength(7); // Six receivers and the opponent serving.
    expect(new Set(initial.config.actorIds.slice(0, 6))).toEqual(new Set(team));
    const identities = team.map(id => receptionPlayerIdentity(initial.config, id)!);
    expect(identities.map(player => player.label)).toEqual(["1", "2", "3", "4", "5", "6"]);
    const zones = [4, 3, 2, 5, 6, 1].map(zone => (zone - 1 - rotation + 6) % 6 + 1);
    expect(identities.map(player => player.position)).toEqual(zones);
    const setter = final.actors[0];
    setters.push(setter.id);
    expect(setter).toMatchObject({ id: team[zones.indexOf(2)], pose: "contact", position: [1.62, 0, .76] });
    final.ball.forEach((coordinate, axis) => expect(coordinate).toBeCloseTo(final.setHand![axis], 8));
    const rendered = buildCourtPerspectiveFrame(board, rotation, 1);
    team.forEach((id, index) => expect(rendered.actors.find(actor => actor.id === id)).toMatchObject({
      label: String(index + 1), rotationPosition: zones[index], color: "#19c87b",
    }));
  }
  expect(new Set(setters)).toEqual(new Set(team));
  const withoutNumbers = { ...board, editor: { ...board.editor!, showActorNumbers: false } };
  const hidden = buildCourtPerspectiveFrame(withoutNumbers, 0, 0).actors;
  for (const id of team) expect(hidden.find(actor => actor.id === id)?.label).toBe("");
  expect(hidden.find(actor => !team.includes(actor.id))?.label).toBe("Sacador");
});

it("requires six own participants only for the 6×0 and shows the opponent's actual job in both views", () => {
  const board = buildSimulatedReceptionRotationPreset("6-0"), receive = getCourtSimulation(board, 0)!;
  const attackBoard = configureCourtSimulation(board, 0, { mode: "attack", preset: "fundo-1" });
  const attack = getCourtSimulation(attackBoard, 0)!;
  const defense = ensureCourtDefenseStep(attackBoard, "1", undefined, attack);
  const defending = getCourtSimulation(defense.payload, defense.stepIndex)!;
  for (const config of [receive, attack, defending]) {
    const opponent = config.actorIds.find(id => !config.teamActorIds!.includes(id))!;
    expect(normalizeCourtSimulation(config)).toEqual(config);
    expect(normalizeCourtSimulation({ ...config, teamActorIds: undefined })).toBeNull();
    expect(normalizeCourtSimulation({ ...config, teamActorIds: [opponent, ...config.teamActorIds!.slice(1)] })).toBeNull();
  }
  expect(normalizeCourtSimulation({ ...receive, system: "5-1", teamActorIds: undefined })).not.toBeNull();
  const opponent = receive.actorIds[6];
  expect(defending.actorIds[6]).toBe(opponent);
  const actor = board.actors.find(player => player.id === opponent)!;
  for (const [payload, index, label] of [[board, 0, "Sacador"], [attackBoard, 0, "Bloqueador"], [defense.payload, defense.stepIndex, "Atacante"]] as const) {
    expect(buildCourtPerspectiveFrame(payload, index, 1).actors.find(player => player.id === opponent))
      .toMatchObject({ label, color: actor.color });
    expect(displayActors(payload, index, 1).find(player => player.id === opponent))
      .toMatchObject({ label, color: actor.color });
  }
});

it("starts in the W and holds it until the serve, then releases the three attackers", () => {
  const board = buildSimulatedReceptionRotationPreset("6-0");
  const start = sampleCourtSimulation(board, 0, 0)!;
  const serving = sampleCourtSimulation(board, 0, start.serveContact!)!;
  const passing = sampleCourtSimulation(board, 0, start.receiveContact!)!;
  const final = sampleCourtSimulation(board, 0, 1)!;
  const duringToss = sampleCourtSimulation(board, 0, start.serveContact! / 2)!;
  start.actors.slice(0, 6).forEach((actor, slot) => actor.position.forEach((value, axis) =>
    expect(duringToss.actors[slot].position[axis]).toBeCloseTo(value, 8)));
  expect(start.actors[0].position[0]).toBeCloseTo(1.62, 8);
  expect(start.actors[0].position[2]).toBeCloseTo(.76, 8);
  expect(serving.actors[0].position).toEqual([1.62, 0, .76]);
  for (const slot of [1, 2, 3]) expect(serving.actors[slot].position[2]).toBeCloseTo(3, 0);
  for (const slot of [4, 5]) expect(serving.actors[slot].position[2]).toBeGreaterThan(6);
  expect(passing.receiver).toBe(5);
  expect(passing.actors[5].pose).toBe("follow");
  expect(final.actors[3].position[0]).toBeLessThan(-4.5);
  expect(Math.abs(final.actors[2].position[0])).toBeLessThan(1);
  expect(final.actors[1].position[0]).toBeGreaterThan(3);
  expect(final.actors[1].position[2]).toBeGreaterThan(5);
  expect(final.actors.filter(actor => actor.attackReadiness === 1).map(actor => actor.slot)).toEqual([1, 2, 3]);
  const shortRight = configureCourtSimulation(board, 0, { landingOverride: { x: 3.6, z: 4 } });
  expect(sampleCourtSimulation(shortRight, 0, .5)!.receiver).toBe(1);
});
