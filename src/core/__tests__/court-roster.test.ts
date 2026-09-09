import { courtRoster, courtSide } from "../court-roster";
import { newCourtBoard } from "../visual-court-editor";

it("uses the net axis, independent of horizontal screen orientation", () => {
  expect(courtSide({ x: 0.2, y: 0.8 })).toBe("A");
  expect(courtSide({ x: 0.2, y: 0.2 })).toBe("B");
  expect(courtSide({ x: 0.9, y: 0.5 })).toBe("Rede");
});

it("keeps team membership when a player moves across the net and separates the bench", () => {
  const board = newCourtBoard();
  const actor = board.actors[0];
  board.editor!.actorMeta[actor.id] = { team: "A" };
  board.timeline.steps[0].actorPositions[actor.id] = { x: 0.3, y: 0.2 };
  board.timeline.steps[0].visibleActorIds = [actor.id];
  const roster = courtRoster(board, 0);
  expect(roster[0]).toMatchObject({ team: "A", side: "B", inCourt: true });
  expect(roster[1].inCourt).toBe(false);
});
