import { MAX_EVENT_ATTACHMENT_BYTES } from "../core/event-attachments";
import { SUPABASE_URL } from "./config";

export type EventAttachmentFileSource = { uri: string; name: string; mimeType?: string | null; size?: number | null; file?: Blob };
export type EventAttachmentBody = { body: BodyInit; size: number; type: string };
type EventAttachmentDownloadSource = { url: string; name: string; localFile?: Pick<EventAttachmentFileSource, "uri" | "file"> };

/** Read only signed attachment bytes or a file selected locally, without browser navigation. */
export async function readEventAttachmentDownloadBlob({ url, name, localFile }: EventAttachmentDownloadSource, assertCurrent: () => void): Promise<Blob> {
  assertCurrent();
  if (localFile) {
    if (localFile.uri !== url || (!localFile.file && !/^(blob:|data:)/i.test(url))) throw new Error("O endereço do anexo é inválido.");
  } else {
    const target = new URL(url), base = new URL(SUPABASE_URL);
    const prefix = "/storage/v1/object/sign/event-attachments/";
    const parts = target.pathname.startsWith(prefix) ? target.pathname.slice(prefix.length).split("/") : [];
    if (target.origin !== base.origin || target.username || target.password || parts.length !== 3 || parts.some(part => !part || /[/\\]/.test(decodeURIComponent(part))) || !target.searchParams.get("token")) throw new Error("O endereço do anexo é inválido.");
  }
  if (!name.trim() || name.length > 255 || /[/\\\x00-\x1f\x7f]/.test(name)) throw new Error("O nome do anexo é inválido.");
  let blob = localFile?.file;
  if (!blob) {
    const response = await fetch(url, { credentials: "omit", redirect: "error" });
    assertCurrent();
    if (!response.ok) throw new Error("Não foi possível baixar o anexo. Tente novamente.");
    blob = await response.blob();
  }
  assertCurrent();
  if (!blob.size || blob.size > MAX_EVENT_ATTACHMENT_BYTES) throw new Error("O arquivo está vazio ou excede o limite de 20 MB.");
  return blob;
}

/** Keep native FileSystem and base64 conversion out of the web attachment path. */
export async function readEventAttachmentFile(file: EventAttachmentFileSource, assertCurrent: () => Promise<void>): Promise<EventAttachmentBody> {
  if (file.file) return { body: file.file, size: file.file.size, type: file.file.type };
  if (!/^(blob:|data:)/i.test(file.uri)) throw new Error("Arquivo local inválido.");
  const response = await fetch(file.uri);
  await assertCurrent();
  if (!response.ok) throw new Error("Não foi possível ler o arquivo.");
  const blob = await response.blob();
  await assertCurrent();
  return { body: blob, size: blob.size, type: blob.type };
}
