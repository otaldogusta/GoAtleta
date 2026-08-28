import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const classRoute = readFileSync(
  resolve(__dirname, "../../../../../app/class/[id].tsx"),
  "utf8"
);

describe("class roster export actions", () => {
  it("keeps both download labels visible in a non-flexing mobile footer", () => {
    expect(classRoute).toContain("const stackRosterExportActions = windowWidth < 620;");
    expect(classRoute).toContain(
      'flexDirection: stackRosterExportActions ? "column" : "row"'
    );
    expect(classRoute).toContain('accessibilityLabel="Baixar PDF"');
    expect(classRoute).toContain('accessibilityLabel="Baixar XLSX"');
    expect(classRoute.match(/flex: stackRosterExportActions \? undefined : 1/g)).toHaveLength(2);
    expect(classRoute.match(/minHeight: 48/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(classRoute).toContain("Baixar PDF");
    expect(classRoute).toContain("Baixar XLSX");
  });
});
