import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const classesScreenSource = readFileSync(
  resolve(__dirname, "../../../../../app/classes/index.tsx"),
  "utf8",
);
const classDetailsSource = readFileSync(
  resolve(__dirname, "../../../../../app/class/[id].tsx"),
  "utf8",
);

describe("class duplication feedback and navigation", () => {
  it("shows immediate progress and prevents concurrent duplications", () => {
    expect(classesScreenSource).toContain("duplicationInFlightRef.current");
    expect(classesScreenSource).toContain("setDuplicatingClassName(item.name)");
    expect(classesScreenSource).toContain("Duplicando turma…");
    expect(classesScreenSource).toContain("Copiando configurações e equipe de");
  });

  it("opens the duplicated class directly in its settings", () => {
    expect(classesScreenSource).toContain('params: { id: duplicatedClassId, settings: "1" }');
    expect(classDetailsSource).toContain('settings !== "1"');
    expect(classDetailsSource).toContain("setShowEditModal(true)");
  });
});
