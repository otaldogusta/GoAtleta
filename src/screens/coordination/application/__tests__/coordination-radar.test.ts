import type { ClassGroup, SessionLog } from "../../../../core/models";
import { buildCoordinationRadar } from "../coordination-radar";

const classGroup = (id: string) => ({ id, name: `Class ${id}`, unit: "Unit" } as ClassGroup);
const goodLog = (classId: string): SessionLog => ({
  classId, attendance: 1, technique: "boa", PSE: 6, activity: "Treino",
  conclusion: "", photos: "", createdAt: "2026-09-05T12:00:00Z",
});

it("keeps each class's evidence separate, including IDs that collide with object properties", () => {
  const classes = [classGroup("healthy"), classGroup("weak"), classGroup("__proto__")];
  const logs = [goodLog("healthy"), { ...goodLog("weak"), attendance: 0.2, technique: "ruim" as const },
    goodLog("__proto__"), goodLog("unrelated")];
  const input = JSON.stringify({ classes, logs });
  const result = buildCoordinationRadar(classes, logs);
  expect(result[0].classId).toBe("weak");
  expect(result.find((row) => row.classId === "healthy")?.alerts).toEqual([]);
  expect(result.find((row) => row.classId === "__proto__")?.logsCount).toBe(1);
  expect(result.every((row) => row.logsCount === 1)).toBe(true);
  expect(result.map((row) => row.classId)).not.toContain("unrelated");
  expect(JSON.stringify({ classes, logs })).toBe(input);
});

it("includes classes without reports among the six lowest scores", () => {
  const classes = Array.from({ length: 7 }, (_, index) => classGroup(String(index)));
  const logs = classes.slice(0, 6).map((row) => goodLog(row.id));
  const result = buildCoordinationRadar(classes, logs);
  expect(result).toHaveLength(6);
  expect(result[0]).toMatchObject({ classId: "6", logsCount: 0, radarScore: 0 });
  expect(result[0].alerts[0]).toContain("Sem sessões recentes");
});
