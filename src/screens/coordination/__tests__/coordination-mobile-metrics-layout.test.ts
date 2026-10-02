import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceSource = readFileSync(
  resolve(__dirname, "../CoordinationPeopleWorkspace.tsx"),
  "utf8"
);

describe("coordination mobile metrics layout", () => {
  it("keeps all five indicators side by side in one compact row", () => {
    expect(workspaceSource).toContain("flex: 1");
    expect(workspaceSource).toContain("minHeight: compact ? 72 : 48");
    expect(workspaceSource).not.toContain('width: compact ? (index === 4 ? "100%" : "50%")');
  });

  it("stacks mobile indicators and places desktop icons next to their values", () => {
    expect(workspaceSource).toContain('flexDirection: compact ? "column" : "row"');
    expect(workspaceSource).toContain("size={18}");
    expect(workspaceSource).toContain("fontSize: compact ? 9 : 12");
    expect(workspaceSource).toContain('textAlign: "center"');
  });
});
