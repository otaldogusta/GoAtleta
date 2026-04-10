import {
  buildAthleteIntakeSummary,
  extractDetectedModalities,
  mapGoogleFormsRowToAthleteIntake,
  normalizeAthleteModality,
} from "../athlete-intake";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (value: unknown) => {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
  toHaveLength: (expected: number) => void;
  toContain: (expected: unknown) => void;
  toMatchObject: (expected: Record<string, unknown>) => void;
};

describe("athlete-intake", () => {
  it("canonicalizes volleyball spellings to a single modality key", () => {
    expect(normalizeAthleteModality("Vôlei")).toBe("voleibol");
    expect(normalizeAthleteModality("Voleibol")).toBe("voleibol");
    expect(normalizeAthleteModality("Volleyball")).toBe("voleibol");
  });

  it("deduplicates volleyball variants in detected modalities", () => {
    const detected = extractDetectedModalities([
      { "Qual(ais) modalidade": "Vôlei" },
      { "Qual(ais) modalidade": "Voleibol" },
      { "Qual(ais) modalidade": "Basquete" },
    ]);

    expect(detected).toHaveLength(2);
    expect(detected[0]).toMatchObject({
      normalized: "voleibol",
      label: "Voleibol",
      count: 2,
      isVolleyball: true,
    });
    expect(detected[1]).toMatchObject({
      normalized: "basquete",
      label: "Basquete",
      count: 1,
      isVolleyball: false,
    });
  });

  it("stores canonical modalities when mapping a form row", () => {
    const intake = mapGoogleFormsRowToAthleteIntake({
      "Nome": "Atleta Teste",
      "Qual(ais) modalidade": "Vôlei / Voleibol / Volleyball",
    });

    expect(intake.modalities).toEqual(["voleibol"]);
  });

  it("keeps volleyball-only summaries stable after canonicalization", () => {
    const summary = buildAthleteIntakeSummary([
      {
        id: "1",
        classId: null,
        studentId: null,
        fullName: "A",
        ra: null,
        sex: null,
        birthDate: null,
        email: null,
        modalities: ["Vôlei"],
        parqPositive: false,
        cardioRisk: false,
        orthoRisk: false,
        currentInjury: false,
        smoker: false,
        allergies: false,
        majorSurgery: false,
        familyHistoryRisk: false,
        dizzinessOrSyncope: false,
        needsMedicalClearance: false,
        needsIndividualAttention: false,
        jumpRestriction: "nenhuma",
        riskStatus: "apto",
        tags: [],
        notes: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
      },
      {
        id: "2",
        classId: null,
        studentId: null,
        fullName: "B",
        ra: null,
        sex: null,
        birthDate: null,
        email: null,
        modalities: ["Voleibol"],
        parqPositive: false,
        cardioRisk: false,
        orthoRisk: false,
        currentInjury: false,
        smoker: false,
        allergies: false,
        majorSurgery: false,
        familyHistoryRisk: false,
        dizzinessOrSyncope: false,
        needsMedicalClearance: false,
        needsIndividualAttention: false,
        jumpRestriction: "nenhuma",
        riskStatus: "apto",
        tags: [],
        notes: null,
        createdAt: "2026-03-27T00:00:00.000Z",
        updatedAt: "2026-03-27T00:00:00.000Z",
      },
    ]);

    expect(summary.total).toBe(2);
    expect(summary.volleyballAny).toBe(2);
    expect(summary.volleyballOnly).toBe(2);
    expect(summary.multiModality).toBe(0);
  });
});
