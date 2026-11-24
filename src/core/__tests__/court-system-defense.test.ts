import { ensureCourtDefenseStep, getCourtDefenseSideStepIndex, getCourtDefenseStepIndex } from "../court-defense-preset";
import { getCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { buildSimulatedReceptionRotationPreset, configureCourtRotationSequenceMode } from "../court-simulation-sequence";
import { parseEditorImport } from "../visual-court-editor";

const shirtZones = [4, 3, 2, 5, 6, 1];

describe("defesa dentro do sistema selecionado", () => {
  it("na saída do 6×0, mantém a paralela e a paragonal enquanto o defensor da 1 sobe para a largada", () => {
    const board = buildSimulatedReceptionRotationPreset("6-0");
    const receive = getCourtSimulation(board, 0)!;
    const team = receive.teamActorIds!;
    const base = ensureCourtDefenseStep(board, "5", undefined, receive);
    const covered = ensureCourtDefenseStep(board, "5", "zone1", receive);
    const reference = sampleCourtSimulation(base.payload, base.stepIndex, 1)!;
    const end = sampleCourtSimulation(covered.payload, covered.stepIndex, 1)!;
    for (const [jersey, slot] of [[5, 4], [4, 5]]) {
      expect(end.actors.find(actor => actor.id === team[jersey - 1])?.position).toEqual(reference.actors[slot].position);
    }
    expect(end.actors[0].id).toBe(team[5]);
    expect(end.actors[0].position[0]).toBeCloseTo(.45);
    expect(end.actors[0].position[2]).toBeCloseTo(2.88);
    for (let sample = 0; sample <= 100; sample++) {
      const progress = sample / 100;
      const frame = sampleCourtSimulation(covered.payload, covered.stepIndex, progress)!;
      expect(frame.actors[4].position[0]).toBeLessThan(frame.actors[5].position[0]);
      const [x, , z] = frame.actors[0].position;
      const [backX, , backZ] = frame.actors[5].position;
      expect(Math.hypot(x - backX, z - backZ)).toBeGreaterThan(1);
    }
  });

  it.each(["4", "1", "5"] as const)("começa a defesa %s do 5×1 em P1 com líbero na 5 e Ponteiro¹ na 6", preset => {
    const board = buildSimulatedReceptionRotationPreset("5-1");
    const receive = getCourtSimulation(board, 0)!;
    const team = receive.teamActorIds!;
    const { payload, stepIndex } = ensureCourtDefenseStep(board, preset, "front", receive);
    const start = sampleCourtSimulation(payload, stepIndex, 0)!;
    expect(start.actors[preset === "5" ? 4 : 0].id).toBe(team[4]);
    expect(start.actors[5].id).toBe(team[3]);
  });

  it.each(["4", "1", "5"] as const)("leva as seis camisas do 6×0 às suas zonas na defesa %s", preset => {
    let board = buildSimulatedReceptionRotationPreset("6-0");
    const originalActors = [...board.actors];
    for (let rotation = 0; rotation < 6; rotation++) {
      const receive = getCourtSimulation(board, rotation)!;
      const team = receive.teamActorIds!;
      const zone = (id: string) => (shirtZones[team.indexOf(id)] - 1 - rotation + 6) % 6 + 1;
      const next = ensureCourtDefenseStep(board, preset, "front", receive);
      board = next.payload;
      const defense = getCourtSimulation(board, next.stepIndex)!;
      expect(defense).toMatchObject({ system: "6-0", rotation, teamActorIds: team });
      const defenders = defense.actorIds.slice(0, 6);
      expect(defenders.map(zone)).toEqual(preset === "5" ? [1, 4, 3, 2, 6, 5] : [6, 2, 3, 4, 1, 5]);
      expect(defense.actorIds[6]).toBe(receive.actorIds[6]);
      const starts = defense.defenseSettings!.startPositions;
      const leftBack = defenders.find(id => zone(id) === 6)!;
      const middleBack = defenders.find(id => zone(id) === 5)!;
      expect(starts[leftBack].x).toBeLessThan(.5);
      expect(starts[middleBack].x).toBe(.5);
      expect(starts[receive.actorIds[0]].x).toBeGreaterThan(.5);
      expect(starts[receive.actorIds[0]].y).toBeLessThan(.6);
      const contact = sampleCourtSimulation(board, next.stepIndex, .94)!;
      const blockingZones = contact.actors.filter(actor => actor.role === "blocker").map(actor => zone(actor.id)).sort();
      expect(blockingZones).toEqual(preset === "1" ? [3] : preset === "4" ? [2, 3] : [3, 4]);
      expect(getCourtDefenseStepIndex(board, preset, "front", receive)).toBe(next.stepIndex);
      expect(ensureCourtDefenseStep(board, preset, "front", receive).payload).toBe(board);
    }
    expect(board.actors).toEqual(originalActors);
  });

  it("separa rodízios, sistemas e coberturas e recupera a edição do mesmo rodízio depois da importação", () => {
    const source = buildSimulatedReceptionRotationPreset("6-0");
    const attack = configureCourtRotationSequenceMode(source, 1, "attack");
    const active = getCourtSimulation(attack, 1)!;
    const { payload, stepIndex } = ensureCourtDefenseStep(attack, "1", "front", active);
    const editable = payload.timeline.steps[stepIndex];
    editable.actorPositions[active.teamActorIds![0]] = { x: .24, y: .61 };
    const other = getCourtSimulation(attack, 2)!;
    expect(getCourtDefenseSideStepIndex(payload, "1", "front", other)).toBe(-1);
    expect(getCourtDefenseSideStepIndex(payload, "1", "front", { ...active, system: "5-1" })).toBe(-1);
    expect(getCourtDefenseSideStepIndex(payload, "1", "front", { ...active, teamActorIds: [...active.teamActorIds!].reverse() })).toBe(-1);
    const next = ensureCourtDefenseStep(payload, "1", "front", other);
    const zone1 = ensureCourtDefenseStep(next.payload, "1", "zone1", next.payload.timeline.steps[stepIndex].simulation);
    expect(new Set([stepIndex, next.stepIndex, zone1.stepIndex]).size).toBe(3);
    const imported = parseEditorImport(JSON.stringify({ format: "goatleta-court", version: 1, payload: zone1.payload }));
    const restored = ensureCourtDefenseStep(imported, "1", "front", getCourtSimulation(imported, 1));
    expect(restored.payload).toBe(imported);
    expect(restored.stepIndex).toBe(stepIndex);
    expect(imported.timeline.steps[stepIndex].actorPositions[active.teamActorIds![0]]).toEqual({ x: .24, y: .61 });
  });

  it.each(["5-1", "4-2", "6-2"] as const)("mantém o central de rede e o líbero de fundo no %s", system => {
    const board = buildSimulatedReceptionRotationPreset(system);
    for (let rotation = 0; rotation < 6; rotation++) {
      const active = getCourtSimulation(board, rotation)!;
      const next = ensureCourtDefenseStep(board, "1", "front", active);
      const defense = getCourtSimulation(next.payload, next.stepIndex)!;
      expect(defense).toMatchObject({ system, rotation, teamActorIds: active.teamActorIds });
      expect(defense.actorIds[2]).toBe(active.teamActorIds![2]);
      expect(defense.defenseSettings!.startPositions[active.teamActorIds![4]].y).toBeGreaterThan(.7);
      expect(next.payload.actors).toEqual(board.actors);
    }
  });
});
