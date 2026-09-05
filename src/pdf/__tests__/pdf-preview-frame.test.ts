import { buildPreviewHtml } from "../PdfPreviewFrame.web";

// The Expo resolver treats both platform files as one import for import/no-duplicates.
const { buildNativePreviewHtml } = jest.requireActual("../PdfPreviewFrame.tsx");

jest.mock("react-native-webview", () => ({ WebView: () => null }));

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
    expect(buildPreviewHtml(source, true, 120)).toContain("box-sizing: border-box;");
    expect(buildPreviewHtml(source, true, 120)).toContain("requestedZoom = 1.2;");
    expect(buildPreviewHtml(source, true, 30)).toContain("requestedZoom = 0.7;");
    expect(buildPreviewHtml(source, true, 180)).toContain("requestedZoom = 1.4;");
  });

  it("keeps a readable mobile page width with touch-friendly horizontal panning", () => {
    const source = "<html><head><style></style></head><body><div class=\"page\"></div></body></html>";
    const html = buildPreviewHtml(source, true, 100, 620);

    expect(html).toContain("overflow-x: auto;");
    expect(html).toContain("touch-action: pan-x pan-y;");
    expect(html).toContain("scrollbar-width: none;");
    expect(html).toContain("body::-webkit-scrollbar");
    expect(html).toContain("minimumScale = 620 > 0 ? 620 / a4WidthPx : 0");
    expect(html).toContain("Math.max(minimumScale, fitScale * requestedZoom)");
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

describe("buildNativePreviewHtml", () => {
  it("waits for the native document and retries readiness until the bridge exists", () => {
    const html = buildNativePreviewHtml(
      "<html><head></head><body><div class=\"page\"></div></body></html>",
      true
    );

    expect(html).toContain("document.addEventListener('DOMContentLoaded', scheduleReady, { once: true })");
    expect(html).toContain("window.setTimeout(publishReady, 300)");
    expect(html).toContain("if (readySent) return");
    expect(html).toContain("if (!hasNativeBridge())");
    expect(html).toContain("readyRetryTimer = window.setTimeout");
    expect(html).toContain("}, 100)");
    expect(html).toContain("width: 210mm");
    expect(html).toContain("min-height: 297mm");
    expect(html).toContain("aspect-ratio: 210 / 297");
    expect(html).toContain("box-sizing: border-box");
    expect(html).toContain("padding: 15mm 8mm 8mm");
    expect(html).toContain("goatleta-native-page-shell");
    expect(html).toContain("transform: scale(var(--goatleta-native-page-scale, 1))");
    expect(html).toContain("GOATLETA_PDF_PAGE_COUNT");
    expect(html).toContain("GOATLETA_PDF_READY");
    expect(html.indexOf("send({ type: 'GOATLETA_PDF_READY' })")).toBeLessThan(
      html.indexOf("readySent = true", html.indexOf("function publishReady()"))
    );
  });

  it("keeps direct editing enabled only for editable native previews", () => {
    const source = "<html><head></head><body><div class=\"page\"></div></body></html>";
    const editableHtml = buildNativePreviewHtml(source, true);

    expect(editableHtml).toContain("GOATLETA_PDF_EDIT");
    expect(editableHtml).toContain("document.addEventListener('input'");
    expect(editableHtml).toContain("publishEdit(event.target); scheduleScaleUpdate()");
    expect(editableHtml).toContain("new ResizeObserver(scheduleScaleUpdate)");
    expect(editableHtml).toContain("pageResizeObserver.observe(page)");
    expect(buildNativePreviewHtml(source, false)).not.toContain("document.addEventListener('input'");
  });

  it("fits the A4 sheet to the measured native frame at 100 percent", () => {
    const source = "<html><head></head><body><div class=\"page\"></div></body></html>";
    const html = buildNativePreviewHtml(source, true, 100, 360);

    expect(html).toContain("var hostViewportWidth = 360");
    expect(html).toContain(
      "var resolvedViewportWidth = viewport.canvas.clientWidth || document.documentElement.clientWidth || window.innerWidth || hostViewportWidth"
    );
    expect(html).toContain("var availableWidth = Math.max(1, resolvedViewportWidth - 20)");
    expect(html).toContain("var fitScale = Math.min(1, availableWidth / naturalWidth)");
    expect(html).toContain("var requestedZoom = 1");
    expect(html).toContain("var minimumScale = 0 > 0 ? 0 / naturalWidth : 0");
    expect(html).toContain("Math.max(minimumScale, fitScale * requestedZoom)");
    expect(html).toContain("var scaledPageWidth = Math.ceil(pageWidth * resolvedScale)");
    expect(html).toContain("shell.style.width = scaledPageWidth + 'px'");
    expect(html).toContain("shell.style.height = Math.ceil(pageHeight * resolvedScale) + 'px'");
    expect(html).toContain("page.style.transform = 'scale(' + resolvedScale + ')'");
    expect(html).not.toContain("Math.max(280, window.innerWidth - 16)");
  });

  it("keeps the editable A4 layout readable and pannable on native phones", () => {
    const source = "<html><head></head><body><div class=\"page\"></div></body></html>";
    const html = buildNativePreviewHtml(source, true, 100, 360, 620);

    expect(html).toContain("goatleta-native-scroll-canvas");
    expect(html).toContain("goatleta-native-document-track");
    expect(html).toContain("overflow-x: auto");
    expect(html).toContain("overflow-y: auto");
    expect(html).toContain("touch-action: pan-x pan-y pinch-zoom");
    expect(html).toContain("enableCanvasDrag(viewport.canvas)");
    expect(html).toContain("canvas.addEventListener('touchmove'");
    expect(html).toContain("event.preventDefault()");
    expect(html).toContain("canvas.scrollLeft = drag.left - deltaX");
    expect(html).toContain("isEditableTarget(event.target)");
    expect(html).toContain("[contenteditable=\"true\"], .pdf-editable-cell, input, textarea, select");
    expect(html).toContain("viewport.track.style.width = Math.max(");
    expect(html).toContain("var minimumScale = 620 > 0 ? 620 / naturalWidth : 0");
    expect(html).toContain("Math.max(minimumScale, fitScale * requestedZoom)");
    expect(html).toContain("width: 210mm");
    expect(buildNativePreviewHtml(source, true, 125, 360, 620)).toContain("var requestedZoom = 1.25");
    expect(html).not.toContain("grid-template-columns: minmax(112px, 34%)");
  });

});
