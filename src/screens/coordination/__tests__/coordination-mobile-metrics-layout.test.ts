import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSource = readFileSync(
  resolve(__dirname, "../CoordinationPeopleWorkspace.tsx"),
  "utf8"
);

describe("coordination mobile metrics layout", () => {
  it("keeps the four operational counts aligned in a compact two-column grid", () => {
    expect(workspaceSource).toContain('width: compact ? (index === 4 ? "100%" : "50%") : "20%"');
    expect(workspaceSource).toContain('minHeight: compact ? (index === 4 ? 42 : 60) : undefined');
    expect(workspaceSource).toContain('rowGap: compact ? 6 : 0');
  });

  it("renders the health score as one short horizontal summary row", () => {
    expect(workspaceSource).toContain(
      'flexDirection: compact ? (index === 4 ? "row" : "column") : "row"'
    );
    expect(workspaceSource).toContain('flexDirection: index === 4 ? "row" : "column"');
  });
});
