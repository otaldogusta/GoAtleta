import { readFileSync } from "fs";
import { resolve } from "path";

it("mounts the shared picker lists in the classes editor", () => {
  const source = readFileSync(resolve(process.cwd(), "app/classes/index.tsx"), "utf8");
  expect(source).toMatch(/default: module\.ModernClassEditModalBody/);
  expect(source).toMatch(/<ClassEditModalBody\s+renderPickers\s/);
});
