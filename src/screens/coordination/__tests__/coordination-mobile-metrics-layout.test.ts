import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSource = readFileSync(
  resolve(__dirname, "../CoordinationPeopleWorkspace.tsx"),
  "utf8"
);

describe("coordination mobile metrics layout", () => {
  it("keeps all five indicators side by side in one compact row", () => {
    expect(workspaceSource).toContain("flex: 1");
    expect(workspaceSource).toContain("minHeight: compact ? 72 : 78");
    expect(workspaceSource).not.toContain('width: compact ? (index === 4 ? "100%" : "50%")');
  });

  it("stacks icon, value and description inside every indicator", () => {
    expect(workspaceSource).toContain("size={compact ? 18 : 20}");
    expect(workspaceSource).toContain("fontSize: compact ? 9 : 11");
    expect(workspaceSource).toContain('textAlign: "center"');
  });
});
