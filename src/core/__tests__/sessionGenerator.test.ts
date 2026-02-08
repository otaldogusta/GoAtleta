import { generateSession } from "../sessionGenerator";

const mk = (ageBand: any, goal = "Fundamentos") => ({
  id: "t",
  name: "Turma",
  unit: "Rede Esperança",
  ageBand,
  startTime: "14:00",
  daysOfWeek: [2, 4],
  daysPerWeek: 3,
  goal,
  equipment: "misto",
  level: 1,
});

test("gera sessão para 8-9 com conteudo de voleibol", () => {
  const s = generateSession(mk("08-09"));
  expect(s.warmup.length).toBeGreaterThan(0);
  expect(s.main.join(" ")).toContain("Técnica - Toque");
  expect(s.cooldown.join(" ")).toContain("PSE");
});

test("gera sessão para 10-12 com conteudo de voleibol", () => {
  const s = generateSession(mk("10-12"));
  expect(s.main.join(" ")).toContain("Técnica - Saque por cima");
});

test("gera sessão para 13-15 com conteudo de voleibol", () => {
  const s = generateSession(mk("13-15"));
  expect(s.main.join(" ")).toContain("Técnica - Saque por cima");
});

test("sessão sempre tem cooldown com 3 itens", () => {
  const s = generateSession(mk("08-09"));
  expect(s.cooldown).toHaveLength(3);
});

test("session.block e string", () => {
  const s = generateSession(mk("08-09"));
  expect(typeof s.block).toBe("string");
});

test("main tem pelo menos 2 itens", () => {
  const s = generateSession(mk("08-09"));
  expect(s.main.length).toBeGreaterThanOrEqual(2);
});

test("warmup tem 3 itens", () => {
  const s = generateSession(mk("08-09"));
  expect(s.warmup).toHaveLength(3);
});

test("usa fallback fitness quando objetivo não e voleibol", () => {
  const s = generateSession(mk("08-09", "Forca Geral"));
  expect(s.main.join(" ")).toContain("Circuito");
});


