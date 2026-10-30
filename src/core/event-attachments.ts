export const MAX_EVENT_ATTACHMENTS = 10;
export const MAX_EVENT_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const formats: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", avif: "image/avif", heic: "image/heic", heif: "image/heif",
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet", odp: "application/vnd.oasis.opendocument.presentation",
  txt: "text/plain", csv: "text/csv",
};
export const EVENT_ATTACHMENT_MIME_TYPES: readonly string[] = Object.freeze([...new Set(Object.values(formats))]);

/** Picker metadata is advisory; upload validates the actual Blob's byte size again. */
export function validateEventAttachmentFile(file: { name: string; mimeType?: string | null; size?: number | null }): { name: string; mimeType: string; sizeBytes: number | null } {
  const name = file.name.trim();
  if (!name || name.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(name)) throw new Error("O nome do arquivo é inválido.");
  const extension = name.split(".").at(-1)?.toLowerCase() ?? "";
  const expected = Object.prototype.hasOwnProperty.call(formats, extension) ? formats[extension] : undefined;
  if (!expected || !name.includes(".")) throw new Error("Escolha uma imagem, PDF ou documento compatível.");
  const supplied = file.mimeType?.split(";")[0].trim().toLowerCase();
  const mimeType = !supplied || supplied === "application/octet-stream" ? expected : supplied === "image/jpg" ? "image/jpeg" : supplied;
  if (mimeType !== expected) throw new Error("O tipo do arquivo não corresponde ao nome.");
  const sizeBytes = file.size == null ? null : file.size;
  if (sizeBytes !== null && (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0)) throw new Error("O arquivo está vazio ou é inválido.");
  if (sizeBytes !== null && sizeBytes > MAX_EVENT_ATTACHMENT_BYTES) throw new Error("Cada anexo deve ter até 20 MB.");
  return { name, mimeType, sizeBytes };
}

export function assertEventAttachmentCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0 || count > MAX_EVENT_ATTACHMENTS) throw new Error("Cada evento pode ter até 10 anexos.");
}
