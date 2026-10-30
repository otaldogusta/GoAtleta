import { assertSessionIdentity, getSessionIdentity, getValidAccessToken, SessionIdentityChangedError } from "../auth/session";
import { getActiveOrganizationId, getReadCacheGeneration } from "../db/client";
import { MAX_EVENT_ATTACHMENT_BYTES, MAX_EVENT_ATTACHMENTS, validateEventAttachmentFile } from "../core/event-attachments";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";
import { supabaseRestRequest } from "./rest";
import { readEventAttachmentFile, type EventAttachmentFileSource } from "./event-attachment-file";

export { assertEventAttachmentCount, EVENT_ATTACHMENT_MIME_TYPES, MAX_EVENT_ATTACHMENT_BYTES, MAX_EVENT_ATTACHMENTS, validateEventAttachmentFile } from "../core/event-attachments";

export type EventAttachmentFile = EventAttachmentFileSource & { id: string };
export type EventAttachment = { id: string; organizationId: string; eventId: string; name: string; mimeType: string; sizeBytes: number; objectPath: string; createdBy: string; createdAt: string; uploadedAt: string | null };
type AttachmentReference = Pick<EventAttachment, "id" | "organizationId" | "eventId">;
type Scope = { organizationId: string; eventId: string };
type AttachmentRow = { id: string; organization_id: string; event_id: string; file_name: string; mime_type: string; size_bytes: number; object_path: string; created_by: string; created_at: string; uploaded_at: string | null; deleted_at: string | null };
const BUCKET = "event-attachments";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STORAGE_BASE = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1`;
const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export class EventAttachmentsUnavailableError extends Error {
  constructor() { super("Os anexos ainda não estão disponíveis nesta instituição."); this.name = "EventAttachmentsUnavailableError"; }
}

function safeError(error: unknown, action: "list" | "upload" | "remove" | "open" = "upload"): Error {
  if (error instanceof SessionIdentityChangedError || error instanceof EventAttachmentsUnavailableError) return error;
  const message = error instanceof Error ? error.message : "";
  if (/(PGRST20[245]|42P01|42883)/i.test(message) && /(event_attachment|event-attachments)/i.test(message)) return new EventAttachmentsUnavailableError();
  if (/(42501|403|permission denied|row.level security)/i.test(message)) return new Error("Você não tem permissão para acessar estes anexos.");
  if (/(401|Missing auth token)/i.test(message)) return new Error("Sua sessão expirou. Entre novamente.");
  if (/Storage (400|404):/i.test(message) && /bucket not found/i.test(message)) return new EventAttachmentsUnavailableError();
  if (/10 anex|attachment.limit|too many attachments/i.test(message)) return new Error("Cada evento pode ter até 10 anexos.");
  if (["Cada anexo deve ter até 20 MB.", "O arquivo está vazio ou é inválido.", "O tipo do arquivo mudou.", "O tamanho do arquivo mudou."].includes(message)) return new Error(message);
  const verb = { list: "carregar os anexos", upload: "enviar o anexo", remove: "remover o anexo", open: "abrir o anexo" }[action];
  return new Error(`Não foi possível ${verb}. Tente novamente.`);
}

async function captureContext(organizationId: string) {
  const identity = getSessionIdentity(), generation = getReadCacheGeneration();
  const assertIdentity = () => {
    assertSessionIdentity(identity);
    if (!identity.userId || generation !== getReadCacheGeneration()) throw new SessionIdentityChangedError();
  };
  const assertCurrent = async () => {
    assertIdentity();
    const active = await getActiveOrganizationId();
    assertIdentity();
    if (!organizationId.trim() || active !== organizationId) throw new SessionIdentityChangedError();
  };
  await assertCurrent();
  const token = await getValidAccessToken();
  await assertCurrent();
  if (!token) throw new Error("Missing auth token");
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` };
  const request = async <T>(path: string, body?: unknown): Promise<T> => {
    await assertCurrent();
    const value = await supabaseRestRequest<T>(path, { method: body === undefined ? "GET" : "POST", body, assertContextCurrent: assertIdentity });
    await assertCurrent();
    return value;
  };
  return { userId: identity.userId, headers, assertCurrent, request };
}
type Context = Awaited<ReturnType<typeof captureContext>>;

function mapRow(row: AttachmentRow, scope: Scope): EventAttachment {
  if (!row || !UUID.test(row.id) || row.organization_id !== scope.organizationId || row.event_id !== scope.eventId || row.object_path !== `${scope.organizationId}/${scope.eventId}/${row.id}`) throw new Error("Resposta de anexos inválida.");
  const metadata = validateEventAttachmentFile({ name: row.file_name, mimeType: row.mime_type, size: Number(row.size_bytes) });
  return { id: row.id, organizationId: row.organization_id, eventId: row.event_id, name: metadata.name, mimeType: metadata.mimeType, sizeBytes: metadata.sizeBytes!, objectPath: row.object_path, createdBy: row.created_by, createdAt: row.created_at, uploadedAt: row.uploaded_at };
}

export async function ensureEventAttachmentsAvailable({ organizationId }: { organizationId: string }): Promise<void> {
  try {
    const context = await captureContext(organizationId);
    const capabilities = await context.request<{ version: number; bucket: string; maxFiles: number; maxFileBytes: number }>("/rpc/get_event_attachment_capabilities");
    if (capabilities?.version !== 1 || capabilities.bucket !== BUCKET || capabilities.maxFiles !== MAX_EVENT_ATTACHMENTS || capabilities.maxFileBytes !== MAX_EVENT_ATTACHMENT_BYTES) throw new EventAttachmentsUnavailableError();
    await context.request(`/event_attachments?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`);
  } catch (error) { throw safeError(error, "list"); }
}

export async function listEventAttachments({ includePending = false, ...scope }: Scope & { includePending?: boolean }): Promise<EventAttachment[]> {
  try {
    const context = await captureContext(scope.organizationId);
    const rows = await context.request<AttachmentRow[]>(`/event_attachments?select=*&organization_id=eq.${encodeURIComponent(scope.organizationId)}&event_id=eq.${encodeURIComponent(scope.eventId)}${includePending ? "" : "&uploaded_at=not.is.null"}&deleted_at=is.null&order=created_at.asc,id.asc&limit=${MAX_EVENT_ATTACHMENTS + 1}`);
    if (!Array.isArray(rows) || rows.length > MAX_EVENT_ATTACHMENTS) throw new Error("Resposta de anexos inválida.");
    return rows.map(row => { if ((!includePending && !row.uploaded_at) || row.deleted_at) throw new Error("Resposta de anexos inválida."); return mapRow(row, scope); });
  } catch (error) { throw safeError(error, "list"); }
}

async function storage(context: Context, path: string, method: "POST" | "DELETE", body?: BodyInit, contentType?: string): Promise<Response> {
  await context.assertCurrent();
  const response = await fetch(`${STORAGE_BASE}${path}`, { method, headers: { ...context.headers, ...(contentType ? { "Content-Type": contentType } : {}) }, body });
  await context.assertCurrent();
  return response;
}
async function checkStorageResponse(response: Response, context: Context, accepted: number[] = [], acceptLegacyDuplicate = false): Promise<void> {
  if (response.ok || accepted.includes(response.status)) return;
  const text = await response.text();
  await context.assertCurrent();
  if (acceptLegacyDuplicate && response.status === 400) {
    let duplicate = false;
    try {
      const error = JSON.parse(text) as { error?: string; code?: string; message?: string };
      duplicate = [error.code, error.error, error.message].some(value => typeof value === "string" && /^(?:Asset Already Exists|The resource already exists|ResourceAlreadyExists|KeyAlreadyExists|Duplicate)$/i.test(value.trim()));
    } catch { duplicate = /^Asset Already Exists$/i.test(text.trim()); }
    if (duplicate) return;
  }
  throw new Error(`Storage ${response.status}: ${text.slice(0, 1000)}`);
}

export async function uploadEventAttachment({ file, ...scope }: Scope & { file: EventAttachmentFile }): Promise<EventAttachment> {
  const metadata = validateEventAttachmentFile(file);
  if (!UUID.test(file.id)) throw new Error("O identificador do anexo é inválido.");
  try {
    const context = await captureContext(scope.organizationId);
    const payload = await readEventAttachmentFile(file, context.assertCurrent);
    const actual = validateEventAttachmentFile({ name: metadata.name, mimeType: metadata.mimeType, size: payload.size });
    if (metadata.sizeBytes !== null && metadata.sizeBytes !== actual.sizeBytes) throw new Error("O tamanho do arquivo mudou.");
    const payloadType = payload.type.split(";")[0].trim().toLowerCase();
    const normalizedType = payloadType === "image/jpg" ? "image/jpeg" : payloadType;
    if (normalizedType && normalizedType !== "application/octet-stream" && normalizedType !== metadata.mimeType) throw new Error("O tipo do arquivo mudou.");
    const params = { p_organization_id: scope.organizationId, p_event_id: scope.eventId, p_id: file.id };
    const prepared = await context.request<AttachmentRow>("/rpc/prepare_event_attachment", { ...params, p_file_name: actual.name, p_mime_type: actual.mimeType, p_size_bytes: actual.sizeBytes });
    const item = mapRow(prepared, scope);
    if (item.id !== file.id || item.createdBy !== context.userId || prepared.deleted_at) throw new Error("Resposta de anexos inválida.");
    if (prepared.uploaded_at) return item;
    const response = await storage(context, `/object/${BUCKET}/${encodePath(item.objectPath)}`, "POST", payload.body, actual.mimeType);
    // Storage documents both legacy 400 duplicates and 409; finalize validates the existing object's size/type.
    await checkStorageResponse(response, context, [409], true);
    const finalized = await context.request<AttachmentRow>("/rpc/finalize_event_attachment", params);
    if (finalized.id !== file.id || !finalized.uploaded_at || finalized.deleted_at) throw new Error("O anexo não foi concluído.");
    return mapRow(finalized, scope);
  } catch (error) { throw safeError(error, "upload"); }
}

export async function removeEventAttachment({ attachment, ...scope }: Scope & { attachment: AttachmentReference }): Promise<void> {
  try {
    const context = await captureContext(scope.organizationId);
    if (attachment.organizationId !== scope.organizationId || attachment.eventId !== scope.eventId || !UUID.test(attachment.id)) throw new Error("Anexo inválido.");
    const removed = await context.request<AttachmentRow | null>("/rpc/remove_event_attachment", { p_organization_id: scope.organizationId, p_event_id: scope.eventId, p_id: attachment.id });
    if (!removed) return;
    const item = mapRow(removed, scope);
    if (!removed.deleted_at || item.id !== attachment.id) throw new Error("Resposta de anexos inválida.");
    const response = await storage(context, `/object/${BUCKET}/${encodePath(item.objectPath)}`, "DELETE");
    await checkStorageResponse(response, context, [404]);
  } catch (error) { throw safeError(error, "remove"); }
}

export async function getEventAttachmentUrl({ attachment, ...scope }: Scope & { attachment: EventAttachment }): Promise<string> {
  try {
    const context = await captureContext(scope.organizationId);
    if (!attachment.uploadedAt || attachment.organizationId !== scope.organizationId || attachment.eventId !== scope.eventId || attachment.objectPath !== `${scope.organizationId}/${scope.eventId}/${attachment.id}` || !UUID.test(attachment.id)) throw new Error("Anexo inválido.");
    const response = await storage(context, `/object/sign/${BUCKET}/${encodePath(attachment.objectPath)}`, "POST", JSON.stringify({ expiresIn: 60 }), "application/json");
    await checkStorageResponse(response, context);
    const result = await response.json() as { signedURL?: string; signedUrl?: string };
    await context.assertCurrent();
    const value = result.signedURL ?? result.signedUrl;
    if (!value) throw new Error("Endereço do anexo indisponível.");
    const base = new URL(SUPABASE_URL);
    const url = new URL(value.startsWith("/object/") ? `${STORAGE_BASE}${value}` : value, `${STORAGE_BASE}/`);
    if (url.origin !== base.origin || url.pathname !== `/storage/v1/object/sign/${BUCKET}/${encodePath(attachment.objectPath)}`) throw new Error("Endereço do anexo inválido.");
    url.searchParams.set("download", attachment.name);
    return url.toString();
  } catch (error) { throw safeError(error, "open"); }
}
