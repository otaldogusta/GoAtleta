import { strToU8, zipSync } from "fflate";
import { DOCX_MIME, extractDocxText, MAX_DOCUMENT_BYTES } from "..";

const contentTypes = `<Types><Override ContentType="${DOCX_MIME}"/></Types>`;
const paragraph = (text: string) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`;
const table = (left: string, right: string) =>
  `<w:tbl><w:tr><w:tc>${paragraph(left)}</w:tc><w:tc>${paragraph(right)}</w:tc></w:tr></w:tbl>`;
const docx = (body: string, extra: Record<string, Uint8Array> = {}) =>
  zipSync({
    "[Content_Types].xml": strToU8(contentTypes),
    "word/document.xml": strToU8(`<w:document><w:body>${body}</w:body></w:document>`),
    ...extra,
  });

describe("DOCX pilot extraction", () => {
  it("preserves paragraph/table order and ignores repeated tables", () => {
    const repeated = table("Data", "02/07/2026");
    const result = extractDocxText(
      docx(`${paragraph("Planejamento de julho")}${repeated}${paragraph("Objetivo")}${repeated}`)
    );
    expect(result.text).toBe("Planejamento de julho\nData | 02/07/2026\nObjetivo");
    expect(result.duplicateBlocksIgnored).toBe(1);
  });

  it("rejects extension-only files, macros and oversized content", () => {
    expect(() => extractDocxText(strToU8("not a zip"))).toThrow("docx_signature_invalid");
    expect(() => extractDocxText(docx(paragraph("Plano"), { "word/vbaProject.bin": strToU8("macro") })))
      .toThrow("docx_macros_not_allowed");
    expect(() => extractDocxText(new Uint8Array(MAX_DOCUMENT_BYTES + 1))).toThrow("file_too_large");
  });
});
