import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system/legacy";
import { validateEventAttachmentFile } from "../core/event-attachments";

export type EventAttachmentFileSource = { uri: string; name: string; mimeType?: string | null; size?: number | null; file?: Blob };
export type EventAttachmentBody = { body: BodyInit; size: number; type: string };

/** Native picker cache/content URIs are local files, not HTTP resources. */
export async function readEventAttachmentFile(file: EventAttachmentFileSource, assertCurrent: () => Promise<void>): Promise<EventAttachmentBody> {
  if (file.file) return { body: file.file, size: file.file.size, type: file.file.type };
  if (!/^(file:|content:)/i.test(file.uri)) throw new Error("Arquivo local inválido.");
  const info = await FileSystem.getInfoAsync(file.uri);
  await assertCurrent();
  if (!info.exists || info.isDirectory) throw new Error("Arquivo local indisponível.");
  validateEventAttachmentFile({ ...file, size: info.size });
  const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 });
  await assertCurrent();
  const bytes = new Uint8Array(Buffer.from(base64, "base64"));
  return { body: bytes.buffer, size: bytes.byteLength, type: "" };
}
