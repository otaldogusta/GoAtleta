import { parseReplyBlocks, parseReplyEmphasis } from "../reply-format";

test("renders summary sections, bullets and steps without changing facts", () => {
  expect(parseReplyBlocks("**13 registros atrasados**\n\n## Prioridades\n- Revisar chamadas\n1. Abrir os registros")).toEqual([
    { kind: "paragraph", text: "**13 registros atrasados**" },
    { kind: "heading", text: "Prioridades" },
    { kind: "bullet", text: "Revisar chamadas", marker: "•" },
    { kind: "numbered", text: "Abrir os registros", marker: "1." },
  ]);
});
test("keeps plain replies, decimals, names and incomplete streamed emphasis intact", () => {
  expect(parseReplyBlocks("Saúde: 57%. Valor: 13.50.\nNome: Bem-te-vi")).toEqual([
    { kind: "paragraph", text: "Saúde: 57%. Valor: 13.50.\nNome: Bem-te-vi" },
  ]);
  expect(parseReplyEmphasis("Há **13 registros")).toEqual([{ text: "Há **13 registros", bold: false }]);
  expect(parseReplyEmphasis("Há **13 registros**.")).toEqual([
    { text: "Há ", bold: false }, { text: "13 registros", bold: true }, { text: ".", bold: false },
  ]);
});
test("HTML and URLs remain literal text rather than executable content", () => {
  expect(parseReplyBlocks('<script>alert(1)</script> https://example.com')).toEqual([
    { kind: "paragraph", text: '<script>alert(1)</script> https://example.com' },
  ]);
});
