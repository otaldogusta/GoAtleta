import type { ClassGroup } from "../../../../core/models";
import { getClassIdentityLabel, isHomonymousClass } from "../class-identity";

const classGroup = (overrides: Partial<ClassGroup>): ClassGroup =>
  ({
    id: "class-1",
    name: "ElCartel",
    organizationId: "org-1",
    unit: "UniBrasil",
    unitId: "unit-1",
    colorKey: "green",
    modality: "voleibol",
    ageBand: "16+",
    gender: "feminino",
    startTime: "17:30",
    endTime: "19:00",
    durationMinutes: 90,
    daysOfWeek: [4, 5],
    daysPerWeek: 2,
    goal: "rendimento",
    equipment: "quadra",
    level: 3,
    mvLevel: "MV3",
    cycleStartDate: "2026-01-01",
    cycleLengthWeeks: 52,
    acwrLow: 0.8,
    acwrHigh: 1.3,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }) as ClassGroup;

describe("class identity label", () => {
  test("adds gender only when the same unit contains a homonymous class", () => {
    const female = classGroup({ id: "female", gender: "feminino" });
    const male = classGroup({ id: "male", gender: "masculino" });

    expect(isHomonymousClass(female, [female, male])).toBe(true);
    expect(getClassIdentityLabel(female, [female, male])).toBe("ElCartel · Feminino");
    expect(getClassIdentityLabel(male, [female, male])).toBe("ElCartel · Masculino");
  });

  test("keeps unique class names clean", () => {
    const unique = classGroup({ id: "unique", name: "Primeiros Saques" });

    expect(isHomonymousClass(unique, [unique])).toBe(false);
    expect(getClassIdentityLabel(unique, [unique])).toBe("Primeiros Saques");
  });

  test("does not treat equal names from different units as ambiguous", () => {
    const first = classGroup({ id: "first", unit: "UniBrasil" });
    const second = classGroup({ id: "second", unit: "Rede Esperança" });

    expect(getClassIdentityLabel(first, [first, second])).toBe("ElCartel");
  });
});
