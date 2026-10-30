import { assertEventAttachmentCount, EVENT_ATTACHMENT_MIME_TYPES, MAX_EVENT_ATTACHMENT_BYTES, validateEventAttachmentFile } from "../event-attachments";

test.each([
  ["imagem.jpg", "image/jpeg"], ["imagem.PNG", "image/png"], ["arquivo.pdf", "application/pdf"],
  ["material.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["tabela.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["slides.odp", "application/vnd.oasis.opendocument.presentation"], ["anotacoes.txt", "text/plain"], ["tabela.csv", "text/csv"],
])("allows supported picker metadata and resolves an omitted MIME for %s", (name, mimeType) => {
  expect(validateEventAttachmentFile({ name, mimeType, size: 10 })).toEqual({ name, mimeType, sizeBytes: 10 });
  expect(validateEventAttachmentFile({ name })).toEqual({ name, mimeType, sizeBytes: null });
  expect(EVENT_ATTACHMENT_MIME_TYPES).toContain(mimeType);
});

test.each(["imagem.svg", "pagina.html", "script.exe", "macro.docm", "dados.zip", "dados.constructor", "dados.__proto__", "../arquivo.pdf", "pasta\\arquivo.pdf", "a\u0000.pdf"])("rejects unsupported or unsafe file name %s", name => {
  expect(() => validateEventAttachmentFile({ name, size: 10 })).toThrow();
});

test("rejects mismatched MIME, empty/invalid files, oversize and more than ten attachments", () => {
  expect(() => validateEventAttachmentFile({ name: "foto.jpg", mimeType: "image/svg+xml", size: 10 })).toThrow(/tipo/);
  expect(() => validateEventAttachmentFile({ name: "nota.txt", mimeType: "text/html", size: 10 })).toThrow(/tipo/);
  for (const size of [0, -1, NaN, Infinity, 1.5]) expect(() => validateEventAttachmentFile({ name: "nota.txt", size })).toThrow(/vazio|inválido/);
  expect(validateEventAttachmentFile({ name: "limite.pdf", size: MAX_EVENT_ATTACHMENT_BYTES }).sizeBytes).toBe(MAX_EVENT_ATTACHMENT_BYTES);
  expect(() => validateEventAttachmentFile({ name: "grande.pdf", size: MAX_EVENT_ATTACHMENT_BYTES + 1 })).toThrow(/20 MB/);
  expect(() => assertEventAttachmentCount(10)).not.toThrow();
  expect(() => assertEventAttachmentCount(11)).toThrow(/10 anexos/);
});
