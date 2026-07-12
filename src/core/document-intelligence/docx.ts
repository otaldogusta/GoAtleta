import { unzipSync } from "fflate";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

const decodeXmlText = (value: string) =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

export function extractDocxText(bytes: Uint8Array) {
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error("file_too_large");
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("docx_signature_invalid");
  }

  const archive = unzipSync(bytes, {
    filter: (entry) =>
      entry.name === "[Content_Types].xml" ||
      entry.name === "word/document.xml" ||
      entry.name === "word/vbaProject.bin",
  });
  if (archive["word/vbaProject.bin"]) throw new Error("docx_macros_not_allowed");
  const contentTypes = archive["[Content_Types].xml"];
  const document = archive["word/document.xml"];
  if (!contentTypes || !document) throw new Error("docx_structure_invalid");
  if (!new TextDecoder().decode(contentTypes).includes(DOCX_MIME)) {
    throw new Error("docx_mime_mismatch");
  }

  const xml = new TextDecoder().decode(document);
  const body = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(xml)?.[1] ?? "";
  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const paragraphAt = body.indexOf("<w:p", cursor);
    const tableAt = body.indexOf("<w:tbl", cursor);
    const starts = [paragraphAt, tableAt].filter((position) => position >= 0);
    if (!starts.length) break;
    const start = Math.min(...starts);
    const tag = start === tableAt ? "tbl" : "p";
    const end = body.indexOf(`</w:${tag}>`, start);
    if (end < 0) throw new Error("docx_structure_invalid");
    const blockEnd = end + tag.length + 5;
    blocks.push(body.slice(start, blockEnd));
    cursor = blockEnd;
  }

  const normalizedBlocks: string[] = [];
  const seenTables = new Set<string>();
  let duplicateBlocksIgnored = 0;
  for (const block of blocks) {
    const rows = block.startsWith("<w:tbl")
      ? block.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) ?? []
      : [block];
    const text = rows
      .map((row) => {
        const cells = row.match(/<w:tc\b[\s\S]*?<\/w:tc>/g);
        return (cells ?? [row])
          .map((unit) =>
            [...unit.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
              .map((match) => decodeXmlText(match[1]))
              .join(" ")
              .trim()
          )
          .filter(Boolean)
          .join(" | ");
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (!text) continue;
    if (block.startsWith("<w:tbl")) {
      const key = text.toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");
      if (seenTables.has(key)) {
        duplicateBlocksIgnored += 1;
        continue;
      }
      seenTables.add(key);
    }
    normalizedBlocks.push(text);
  }

  return { text: normalizedBlocks.join("\n"), duplicateBlocksIgnored };
}
