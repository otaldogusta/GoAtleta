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

  it("applies and clamps the workspace preview zoom", () => {
    const source = "<html><head><style></style></head><body><div class=\"page\"></div></body></html>";

    expect(buildPreviewHtml(source, true, 120)).toContain("zoom: var(--goatleta-page-scale, 1);");
    expect(buildPreviewHtml(source, true, 120)).toContain("width: 210mm;");
    expect(buildPreviewHtml(source, true, 120)).toContain("min-height: 297mm;");
    expect(buildPreviewHtml(source, true, 120)).toContain("aspect-ratio: 210 / 297;");
    expect(buildPreviewHtml(source, true, 120)).toContain("requestedZoom = 1.2;");
    expect(buildPreviewHtml(source, true, 30)).toContain("requestedZoom = 0.7;");
    expect(buildPreviewHtml(source, true, 180)).toContain("requestedZoom = 1.4;");
  });

  it("marks the active lesson block without treating a plain blur as an edit", () => {
    const html = buildPreviewHtml(
      "<html><head><style></style></head><body><div class=\"page\"></div></body></html>",
      true
    );

    expect(html).toContain("goatleta-active-block");
    expect(html).toContain("#22c55e");
    expect(html).not.toContain("document.addEventListener('blur'");
    expect(html).toContain("GOATLETA_PDF_READY");
  });

  it("paginates overflowing rows into stacked A4 sheets and reports navigation", () => {
    const html = buildPreviewHtml(
      "<html><head><style></style></head><body><div class=\"page\"><section class=\"lesson-card\"><table><tbody><tr class=\"title-row\"></tr><tr class=\"block-row\"></tr></tbody></table></section></div></body></html>",
      true
    );

    expect(html).toContain("paginateDocument()");
    expect(html).toContain("page.scrollHeight > page.clientHeight + 2");
    expect(html).toContain("currentPage.after(next.page)");
    expect(html).toContain("GOATLETA_PDF_PAGE_COUNT");
    expect(html).toContain("GOATLETA_PDF_PAGE_CHANGE");
    expect(html).toContain("Página ' + (index + 1) + ' de '");
  });
});
