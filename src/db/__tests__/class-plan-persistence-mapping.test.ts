import { mapClassPlanRow } from "../periodization";
import type { ClassPlanRow } from "../row-types";

describe("class plan persistence mapping", () => {
  it("preserva snapshots semanais e metadados de sincronizacao no round-trip remoto", () => {
    const row: ClassPlanRow = {
      id: "plan_1",
      classid: "class_1",
      cycle_id: "cycle_1",
      organization_id: "org_1",
      startdate: "2026-06-01",
      weeknumber: 1,
      phase: "Jogos reduzidos",
      theme: "Continuidade",
      technical_focus: "Toque e manchete",
      physical_focus: "Agilidade",
      constraints: "3x3",
      mv_format: "3x3",
      warmupprofile: "cooperativo",
      jump_target: "baixo",
      rpe_target: "PSE 5",
      source: "AUTO",
      generation_context_snapshot_json: JSON.stringify({
        schemaVersion: 1,
        pedagogicalDecisionSupport: {
          teacherFacingSummary: "Manter continuidade no 3x3.",
          capIntent: {
            conceitual: ["Compreender espaco"],
            procedimental: ["Aplicar toque"],
            atitudinal: ["Cooperar"],
          },
        },
      }),
      weekly_integrated_context_json: JSON.stringify({ model: "quadra_apenas" }),
      generation_version: 3,
      derived_from_blueprint_version: 2,
      generation_model_version: "planning-v2",
      sync_status: "out_of_sync",
      out_of_sync_reasons_json: "[\"weekly_plan_changed\"]",
      manual_overrides_json: "{}",
      manual_override_mask_json: "[]",
      last_auto_generated_at: "2026-06-01T00:00:00.000Z",
      last_manual_edited_at: "2026-06-01T00:00:00.000Z",
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-02T00:00:00.000Z",
    };

    const plan = mapClassPlanRow(row);

    expect(plan.generationContextSnapshotJson).toContain("pedagogicalDecisionSupport");
    expect(plan.weeklyIntegratedContextJson).toContain("quadra_apenas");
    expect(plan.generationVersion).toBe(3);
    expect(plan.derivedFromBlueprintVersion).toBe(2);
    expect(plan.syncStatus).toBe("out_of_sync");
    expect(plan.outOfSyncReasonsJson).toBe("[\"weekly_plan_changed\"]");
  });
});

