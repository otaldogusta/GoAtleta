export type ReplyBlock = { kind: "paragraph" | "heading" | "bullet" | "numbered"; text: string; marker?: string };

// Render a small, predictable Markdown subset as native text, never HTML.
export function parseReplyBlocks(content: string): ReplyBlock[] {
  const blocks: ReplyBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  for (const line of content.replace(/\r\n/g, "\n").split("\n")) {
    const text = line.trim();
    if (!text) { flush(); continue; }
    const heading = text.match(/^#{1,3}\s+(.+)$/);
    const bullet = text.match(/^[-*•]\s+(.+)$/);
    const numbered = text.match(/^(\d+[.)])\s+(.+)$/);
    if (heading || bullet || numbered) {
      flush();
      if (heading) blocks.push({ kind: "heading", text: heading[1] });
      else if (bullet) blocks.push({ kind: "bullet", text: bullet[1], marker: "•" });
      else if (numbered) blocks.push({ kind: "numbered", text: numbered[2], marker: numbered[1] });
    } else paragraph.push(line);
  }
  flush();
  return blocks;
}

export function parseReplyEmphasis(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).filter(Boolean).map(part => ({
    text: part.startsWith("**") && part.endsWith("**") && part.length > 4 ? part.slice(2, -2) : part,
    bold: part.startsWith("**") && part.endsWith("**") && part.length > 4,
  }));
}
