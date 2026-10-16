import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { configureCourtSimulation, sampleCourtSimulation } from "../../../core/court-simulation";
import { simulationFloorPoint } from "../../../core/court-simulation-display";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { buildCourtPerspectiveFrame, worldToCourtPoint } from "../../../core/visual-court-perspective";
import type { CourtVisualPayload } from "../../../core/visual-court";
import { CourtEditorScene, displayActors, scenePoint } from "../CourtEditorScene";

// Keep the actual simulation, projection and Scene logic. Only SVG host nodes
// are replaced, as in CourtEditorScene.test.ts, so their coordinates are inspectable.
jest.mock("react-native-svg", () => ({
  __esModule: true, default: "Svg", Circle: "Circle", G: "G", Line: "Line",
  Path: "Path", Polygon: "Polygon", Rect: "Rect", Text: "SvgText",
}));

function attackBoard() {
  const source = newCourtBoard("Mesma jogada em duas vistas");
  source.actors = source.actors.map(actor => ({ ...actor, representation: "circle" }));
  return configureCourtSimulation(source, 0, { mode: "attack", preset: "4", blockers: 3, layers: { attack: true, pass: true, block: true } });
}

describe("rendered 2D simulation stays synchronized with the same 3D action", () => {
  let tree: TestRenderer.ReactTestRenderer;
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  function expectRenderedProjection(payload: CourtVisualPayload, progress: number, landscape: boolean) {
    const sample = sampleCourtSimulation(payload, 0, progress)!;
    const actors = displayActors(payload, 0, progress), perspective = buildCourtPerspectiveFrame(payload, 0, progress);
    const circles = tree.root.findAllByType("Circle").filter(node => node.props.r === 52);
    expect(actors.map(actor => actor.id)).toEqual(perspective.actors.map(actor => actor.id));
    expect(circles).toHaveLength(actors.length);
    expect(tree.root.findAllByType("SvgText").map(node => node.props.children)).toEqual(actors.map(actor => actor.label || actor.number));
    actors.forEach((actor, index) => {
      const sampledActor = sample.actors.find(item => item.id === actor.id);
      if (sampledActor) {
        expect(sampledActor.visible).toBe(true);
        expect(actor.point).toEqual(simulationFloorPoint(sampledActor.position));
      }
      const sameActor = perspective.actors.find(item => item.id === actor.id)!;
      const flat = worldToCourtPoint(sameActor.position);
      expect(actor.point.x).toBeCloseTo(flat.x, 12);
      expect(actor.point.y).toBeCloseTo(flat.y, 12);
      const at = scenePoint(actor.point, landscape);
      expect(circles[index].props.cx).toBeCloseTo(at.x, 10);
      expect(circles[index].props.cy).toBeCloseTo(at.y, 10);
    });
    for (const actor of sample.actors) expect(actors.some(item => item.id === actor.id)).toBe(actor.visible);
  }

  it.each([true, false])("updates the same Scene instance through presets 4, 5 and pipe, landscape=%s", landscape => {
    let payload = attackBoard();
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape, progress: 0 })); });
    // Never remount the Scene or change a key: changing the preset must update
    // actual rendered circles, not only a pure helper or a newly opened surface.
    for (const preset of ["4", "5", "pipe"]) {
      payload = configureCourtSimulation(payload, 0, { preset });
      const snapshot = JSON.stringify(payload), timing = sampleCourtSimulation(payload, 0, 0)!;
      expect(timing.config.preset).toBe(preset);
      for (const progress of [0, .5, timing.attackContact!, 1]) {
        act(() => tree.update(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape, progress })));
        expectRenderedProjection(payload, progress, landscape);
      }
      expect(JSON.stringify(payload)).toBe(snapshot);
    }
  });

  it("updates active player visibility on the mounted Scene when blocker count and layers change", () => {
    let payload = attackBoard();
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: true, progress: 0 })); });
    for (const patch of [
      { blockers: 1 as const, layers: { pass: false, block: true, attack: true } },
      { blockers: 3 as const, layers: { pass: true, block: true, attack: true } },
      { blockers: 2 as const, layers: { pass: true, block: false, attack: true } },
    ]) {
      payload = configureCourtSimulation(payload, 0, patch);
      const progress = sampleCourtSimulation(payload, 0, 0)!.attackContact!;
      act(() => tree.update(React.createElement(CourtEditorScene, { payload, stepIndex: 0, landscape: true, progress })));
      expectRenderedProjection(payload, progress, true);
    }
  });
});
