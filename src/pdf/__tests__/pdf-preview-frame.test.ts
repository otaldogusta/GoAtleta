import { buildPreviewHtml } from "../PdfPreviewFrame.web";

describe("buildPreviewHtml", () => {
  it("keeps an editable cell click from being treated as a background click", () => {
    const html = buildPreviewHtml(
      "<html><head><style></style></head><body><section class=\"lesson-card\"></section></body></html>",
      true
    );

    const cellGuardIndex = html.indexOf("if (cell) {");
    const backgroundGuardIndex = html.indexOf("if (!card) {");

    expect(cellGuardIndex).toBeGreaterThan(-1);
    expect(backgroundGuardIndex).toBeGreaterThan(cellGuardIndex);
    expect(html).toContain("if (document.activeElement !== cell)");
    expect(html).toContain("return;");
  });
});
