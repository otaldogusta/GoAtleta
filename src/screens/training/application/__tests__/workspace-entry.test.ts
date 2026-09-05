import type { ClassGroup } from "../../../../core/models";
import { createPlanningWorkspaceDraft } from "../planning-library-bridge";
import { createAssistantWorkspacePlan, parseAssistantWorkspaceDraft, resolveWorkspaceDraftRestoration, resolveWorkspaceEntryRequest } from "../workspace-entry";
import type { TrainingPlanWorkspaceDraft } from "../training-plan-workspace-draft";

const classGroup = { id: "class-1", name: "Turma" } as ClassGroup;

describe("training workspace entry", () => {
  it("waits for the class catalog before deciding whether a stored draft can be restored", () => {
    const draft: TrainingPlanWorkspaceDraft = {
      version: 1, savedAt: "2026-09-05T12:00:00Z", lessonDate: "2026-09-07",
      plan: createPlanningWorkspaceDraft(classGroup),
    };
    expect(resolveWorkspaceDraftRestoration(draft, [], false)).toBe("waiting");
    expect(resolveWorkspaceDraftRestoration(draft, [classGroup], true)).toBe("available");
    expect(resolveWorkspaceDraftRestoration(draft, [], true)).toBe("unavailable");
    expect(draft.plan.classId).toBe("class-1");
  });

  it("maps the Assistant deep link into the plan consumed by the visible editor", () => {
    const raw = encodeURIComponent(JSON.stringify({
      title: "Passe e defesa", tags: ["passe"], warmup: ["Mobilidade"], main: ["Jogo de passe"],
      cooldown: ["Alongamento"], warmupTime: "10:00", mainTime: "30:00", cooldownTime: "05:00",
    }));
    const parsed = parseAssistantWorkspaceDraft(raw)!;
    const plan = createAssistantWorkspacePlan(parsed, classGroup, "2026-09-07");
    expect(plan).toMatchObject({ title: "Passe e defesa", classId: "class-1", applyDate: "2026-09-07", main: ["Jogo de passe"] });
    expect(plan.pedagogy?.blocks?.main.activities).toEqual([{ name: "Jogo de passe", description: "" }]);
    expect(plan.mainTime).toBe("30:00");
  });

  it("does not assign a draft to an unavailable class and tolerates invalid incoming JSON", () => {
    expect(parseAssistantWorkspaceDraft("%invalid")).toBeNull();
    expect(parseAssistantWorkspaceDraft("null")).toBeNull();
    const draft = parseAssistantWorkspaceDraft(encodeURIComponent(JSON.stringify({ main: ["Jogo"] })))!;
    expect(createAssistantWorkspacePlan(draft, null, "2026-09-07").classId).toBe("");
  });

  it("keeps blank-plan deep links and persisted creation requests on the workspace path", () => {
    const request = { openForm: false, assistantRaw: "", targetClassId: "", targetDate: "", pendingCreate: { classId: "class-1", date: "2026-09-07" } };
    expect(resolveWorkspaceEntryRequest(request)).toMatchObject({ classId: "class-1", date: "2026-09-07", template: null });
    expect(resolveWorkspaceEntryRequest({ ...request, openForm: true, targetClassId: "class-2", targetDate: "2026-09-08" })).toMatchObject({ classId: "class-2", date: "2026-09-08", template: null });
    expect(resolveWorkspaceEntryRequest({ ...request, openForm: true, assistantRaw: "invalid" })).toBeNull();
  });
});
