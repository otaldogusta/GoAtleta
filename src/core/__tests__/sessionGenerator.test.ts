import { generateSession } from "../sessionGenerator";

const mk = (ageBand: any) => ({
  id: "t",
  name: "Turma",
  ageBand,
  daysPerWeek: 3,
  goal: "Fundamentos",
  equipment: "misto",
  level: 1,
});

test("gera sessão para 8-9", () => {
  const s = generateSession(mk("8-9"));
  expect(s.warmup.length).toBeGreaterThan(0);
  expect(s.main.join(" ")).toContain("Circuito");
  expect(s.cooldown.join(" ")).toContain("RPE");
});

test("gera sessão para 10-12", () => {
  const s = generateSession(mk("10-12"));
  expect(s.main.join(" ")).toContain("Força técnica");
});

test("gera sessão para 13-15", () => {
  const s = generateSession(mk("13-15"));
  expect(s.main.join(" ")).toContain("Força");
});

test("sessão sempre tem cooldown com 3 itens", () => {
  const s = generateSession(mk("8-9"));
  expect(s.cooldown).toHaveLength(3);
});

test("session.block é string", () => {
  const s = generateSession(mk("8-9"));
  expect(typeof s.block).toBe("string");
});

test("main tem pelo menos 2 itens", () => {
  const s = generateSession(mk("8-9"));
  expect(s.main.length).toBeGreaterThanOrEqual(2);
});

test("warmup tem 3 itens", () => {
  const s = generateSession(mk("8-9"));
  expect(s.warmup).toHaveLength(3);
});
