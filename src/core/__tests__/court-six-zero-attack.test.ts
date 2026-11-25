import { configureCourtSimulation, getCourtSimulation, sampleCourtSimulation } from "../court-simulation";
import { SIX_ZERO_ATTACK_PRESETS } from "../court-simulation/attack-settings.js";
import { simulationFloorPoint } from "../court-simulation-display";
import { parseCourtVisualPayload, serializeCourtVisualPayload } from "../visual-court";
import { newCourtBoard } from "../visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../visual-court-perspective";

function numberedBoard() {
  const board = newCourtBoard();
  board.actors.reverse();
  const team = board.actors.filter(actor => board.editor!.actorMeta[actor.id].team === "A")
    .sort((a, b) => a.number! - b.number!).map(actor => actor.id);
  return { board, team };
}

it.each([0, 1, 2, 3, 4, 5])("carries the six shirts from reception into all three attack lanes in rotation %i", rotation => {
  const { board, team } = numberedBoard();
  const reception = configureCourtSimulation(board, 0, { mode: "receive", system: "6-0", rotation });
  const prepared = sampleCourtSimulation(reception, 0, 1)!;
  const zone = (id: string) => ([4, 3, 2, 5, 6, 1][team.indexOf(id)] + 5 - rotation) % 6 + 1;
  let attack = reception;
  for (const preset of SIX_ZERO_ATTACK_PRESETS) {
    attack = configureCourtSimulation(attack, 0, { mode: "attack", preset, blockers: 2 });
    const opening = sampleCourtSimulation(attack, 0, 0)!;
    const impact = sampleCourtSimulation(attack, 0, opening.attackContact!)!;
    expect(opening.config.teamActorIds).toEqual(team);
    expect(opening.visibleIds).toHaveLength(8);
    expect(attack.timeline.steps[0].visibleActorIds).toHaveLength(8);
    for (const id of team) {
      const actor = opening.actors.find(item => item.id === id)!;
      expect(actor.visible).toBe(true);
      prepared.actors.find(item => item.id === id)!.position.forEach((v, axis) =>
        expect(actor.position[axis]).toBeCloseTo(v, 5));
    }
    expect(zone(impact.actors[0].id)).toBe(2);
    expect(zone(impact.actors[3].id)).toBe(preset === "1" ? 3 : preset === "fundo-1" ? 1 : 4);
    expect(impact.setHand![0]).toBeGreaterThan(0);
    expect(impact.setHand![0]).toBeLessThan(3);
    expect(impact.actors[3].jump).toBeGreaterThan(.6);
    for (const slot of [4, 6, 7, 8]) {
      expect(impact.actors[slot].position).not.toEqual(opening.actors[slot].position);
      expect(impact.actors[slot].position[2]).toBeGreaterThan(impact.actors[3].position[2]);
    }
    if (preset === "fundo-1") {
      const [start, plant] = opening.backRowApproach!;
      expect(start[0]).toBeGreaterThan(3);
      expect(start[2]).toBeGreaterThan(plant[2]);
      expect(plant[2]).toBeGreaterThan(3);
      expect(impact.actors[3].position[2]).toBeLessThan(3);
    }
  }
});

it("keeps a legal preset in the editor and all six numbered players in a reopened perspective", () => {
  const { board, team } = numberedBoard();
  let selected = configureCourtSimulation(board, 0, { mode: "attack", system: "6-0", preset: "pipe", rotation: 3 });
  expect(getCourtSimulation(selected, 0)!.preset).toBe("4");
  selected = configureCourtSimulation(selected, 0, { preset: "1" });
  const reopened = parseCourtVisualPayload(serializeCourtVisualPayload(selected))!;
  const sample = sampleCourtSimulation(reopened, 0, .65)!;
  const perspective = buildCourtPerspectiveFrame(reopened, 0, .65);
  team.forEach((id, jersey) => {
    const player = perspective.actors.find(item => item.id === id)!;
    expect(player.label).toBe(`Jogador ${jersey + 1}${id === sample.actors[0].id ? " • (Lv)" : ""}`);
    expect(player.color).toBe(["#38bdf8", "#a78bfa", "#19c87b", "#19c87b", "#a78bfa", "#38bdf8"][jersey]);
    expect(worldToCourtPoint(player.position)).toEqual(simulationFloorPoint(sample.actors.find(item => item.id === id)!.position));
  });
  const otherSystem = configureCourtSimulation(reopened, 0, { system: "4-2" });
  expect(getCourtSimulation(otherSystem, 0)!.actorIds).toHaveLength(7);
  const restored = configureCourtSimulation(otherSystem, 0, { system: "6-0", preset: "fundo-1" });
  expect(getCourtSimulation(restored, 0)!.teamActorIds).toEqual(team);
});
