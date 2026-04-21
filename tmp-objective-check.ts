import { resolveLearningObjectives } from "./src/core/pedagogy/objective-language.ts";

const cases = [
  { name: "introducao", input: { title: "Introdução aos fundamentos", theme: "Fundamentos de toque (passe e levantamento)", pedagogicalRule: "introducao", weeklyFocus: "Fundamentos de toque (passe e levantamento)" } },
  { name: "revisao", input: { title: "Revisão de fundamentos", theme: "Fundamentos de toque (passe e levantamento)", pedagogicalRule: "revisao", weeklyFocus: "Fundamentos de toque (passe e levantamento)" } },
  { name: "aplicacao", input: { title: "Aplicação em jogo reduzido", theme: "Fundamentos de toque (passe e levantamento)", pedagogicalRule: "aplicacao", weeklyFocus: "Fundamentos de toque (passe e levantamento)" } },
  { name: "mini-jogo", input: { title: "Mini jogo orientado", theme: "Fundamentos de toque (passe e levantamento)", pedagogicalRule: "mini jogo", weeklyFocus: "Fundamentos de toque (passe e levantamento)" } },
  { name: "consolidacao", input: { title: "Consolidação dos fundamentos", theme: "Fundamentos de toque (passe e levantamento)", pedagogicalRule: "consolidacao", weeklyFocus: "Fundamentos de toque (passe e levantamento)" } }
];

const firstVerb = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/^[^\p{L}]+/u, "").split(/\s+/)[0] || "";

for (const c of cases) {
  const r = resolveLearningObjectives(c.input as any);
  const gv = firstVerb(r.generalObjective);
  const sv = firstVerb(r.specificObjective);
  console.log(`\nCASE ${c.name}`);
  console.log(`general=${r.generalObjective}`);
  console.log(`specific=${r.specificObjective}`);
  console.log(`sameVerbStart=${gv !== "" && gv === sv} (${gv}|${sv})`);
}
