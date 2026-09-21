import { appendAssistantProgress, ASSISTANT_PROGRESS_LABELS } from "../progress";

test("keeps verified assistant progress ordered and unique", () => {
  let steps = appendAssistantProgress([], "preparing_context");
  steps = appendAssistantProgress(steps, "scientific_search");
  steps = appendAssistantProgress(steps, "scientific_search");
  steps = appendAssistantProgress(steps, "unknown_status");

  expect(steps).toEqual(["preparing_context", "scientific_search"]);
  expect(ASSISTANT_PROGRESS_LABELS[steps[1]]).toBe("Consultando referências científicas");
});
