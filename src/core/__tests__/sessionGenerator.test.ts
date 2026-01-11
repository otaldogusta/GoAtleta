import { generateSession } from "../sessionGenerator";

const mk = (ageBand: any, goal = "Fundamentos") => ({
  id: "t",
  name: "Turma",
  unit: "Rede Esperanca",
  ageBand,
  startTime: "14:00",
  daysOfWeek: [2, 4],
  daysPerWeek: 3,
  goal,
  equipment: "misto",
  level: 1,
});

test("gera sessao para 8-9 com conteudo de voleibol", () => {
  const s = generateSession(mk("8-9"));
  expect(s.warmup.length).toBeGreaterThan(0);
  expect(s.main.join(" ")).toContain("Tecnica - Toque");
  expect(s.cooldown.join(" ")).toContain("PSE");
});

test("gera sessao para 10-12 com conteudo de voleibol", () => {
  const s = generateSession(mk("10-12"));
  expect(s.main.join(" ")).toContain("Tecnica - Saque por cima");
});

test("gera sessao para 13-15 com conteudo de voleibol", () => {
  const s = generateSession(mk("13-15"));
  expect(s.main.join(" ")).toContain("Tecnica - Saque por cima");
});

test("sessao sempre tem cooldown com 3 itens", () => {
  const s = generateSession(mk("8-9"));
  expect(s.cooldown).toHaveLength(3);
});

test("session.block e string", () => {
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

test("usa fallback fitness quando objetivo nao e voleibol", () => {
  const s = generateSession(mk("8-9", "Forca Geral"));
  expect(s.main.join(" ")).toContain("Circuito");
});

