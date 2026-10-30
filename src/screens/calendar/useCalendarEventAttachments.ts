import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import {
  EVENT_ATTACHMENT_MIME_TYPES, MAX_EVENT_ATTACHMENTS, getEventAttachmentUrl,
  listEventAttachments, removeEventAttachment, uploadEventAttachment, validateEventAttachmentFile,
  type EventAttachment, type EventAttachmentFile,
} from "../../api/event-attachments";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../auth/session";
import { createProfileRequestId as createAttachmentId } from "../../core/profile-request-id";
import { openEventAttachment } from "./application/open-event-attachment";

type Options = { eventId?: string; organizationId?: string; scope: string; canManage: boolean; busy: boolean; enabled: boolean };
type Progress = { completed: number; total: number };
type AttachmentTarget = Pick<EventAttachment, "id" | "organizationId" | "eventId">;
type Snapshot = {
  owner: string; attachments: EventAttachment[]; files: EventAttachmentFile[]; removedIds: string[];
  loaded: boolean; loading: boolean; error: string | null; picking: boolean; progress: Progress | null;
};
type Work = {
  picking: boolean; committing: boolean; eventId?: string;
  completedUploads: Map<string, EventAttachment>; attemptedUploads: Map<string, AttachmentTarget>; completedRemovals: Set<string>;
};
const newWork = (): Work => ({ picking: false, committing: false, completedUploads: new Map(), attemptedUploads: new Map(), completedRemovals: new Set() });
const emptySnapshot = (owner: string, needsLoad: boolean): Snapshot => ({ owner, attachments: [], files: [], removedIds: [], loaded: !needsLoad, loading: needsLoad, error: null, picking: false, progress: null });

/** Files/removals remain staged until the event's existing Save flow commits them. */
export function useCalendarEventAttachments({ eventId, organizationId, scope, canManage, busy, enabled }: Options) {
  const identity = getSessionIdentity();
  const owner = JSON.stringify([scope, organizationId, eventId, identity.userId, identity.generation, enabled, canManage]);
  const needsLoad = Boolean(enabled && eventId && organizationId && identity.userId);
  const [state, setState] = useState(() => emptySnapshot(owner, needsLoad));
  const [readRevision, setReadRevision] = useState(0);
  const live = useRef({ owner, state, enabled, canManage, busy });
  const mounted = useRef(false);
  const epoch = useRef(0);
  const work = useRef<Work>(newWork());
  useLayoutEffect(() => { live.current = { owner, state, enabled, canManage, busy }; }, [owner, state, enabled, canManage, busy]);
  useLayoutEffect(() => {
    mounted.current = true;
    epoch.current += 1;
    work.current = newWork();
    return () => { mounted.current = false; epoch.current += 1; };
  }, [owner]);

  const capture = useCallback(() => {
    const generation = epoch.current, session = getSessionIdentity(), capturedWork = work.current;
    const current = () => mounted.current && epoch.current === generation && live.current.owner === owner && live.current.enabled
      && Boolean(session.userId) && isSessionIdentityCurrent(session);
    return { current, work: capturedWork };
  }, [owner]);
  const write = useCallback((patch: Partial<Snapshot>) => {
    setState(previous => ({ ...(previous.owner === owner ? previous : emptySnapshot(owner, needsLoad)), ...patch }));
  }, [owner, needsLoad]);

  useEffect(() => {
    const job = capture();
    if (!enabled || !eventId || !organizationId || !job.current()) return;
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active || !job.current()) return;
      write({ loading: true, error: null });
      try {
        const attachments = await listEventAttachments({ organizationId, eventId, includePending: canManage });
        if (!active || !job.current()) return;
        if (attachments.some(item => item.organizationId !== organizationId || item.eventId !== eventId)) throw new Error("Invalid attachment context");
        write({ attachments, loaded: true, loading: false, error: null });
      } catch {
        if (active && job.current()) write({ loading: false, loaded: false, error: "Não foi possível carregar os anexos. Tente novamente." });
      }
    });
    return () => { active = false; };
  }, [capture, write, enabled, eventId, organizationId, canManage, readRevision]);

  const pick = useCallback(async () => {
    const job = capture();
    if (!job.current() || !live.current.canManage || live.current.busy || job.work.picking || job.work.committing) return;
    const snapshot = live.current.state.owner === owner ? live.current.state : emptySnapshot(owner, needsLoad);
    if (eventId && !snapshot.loaded) { write({ error: "Carregue os anexos antes de adicionar arquivos." }); return; }
    job.work.picking = true;
    write({ picking: true, error: null });
    try {
      const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, base64: false, type: [...EVENT_ATTACHMENT_MIME_TYPES] });
      if (!job.current() || live.current.busy || result.canceled) return;
      const files: EventAttachmentFile[] = [];
      for (const asset of result.assets) {
        const file: EventAttachmentFile = { id: createAttachmentId(), uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size, file: asset.file };
        try {
          const validated = validateEventAttachmentFile(file);
          files.push({ ...file, name: validated.name, mimeType: validated.mimeType, size: validated.sizeBytes });
        } catch (error) {
          write({ error: error instanceof Error ? error.message : "Escolha uma imagem, PDF ou documento compatível." });
          return;
        }
      }
      const current = live.current.state.owner === owner ? live.current.state : snapshot;
      const ids = new Set([...current.attachments.filter(item => !current.removedIds.includes(item.id)).map(item => item.id), ...current.files.map(item => item.id), ...files.map(item => item.id)]);
      if (ids.size > MAX_EVENT_ATTACHMENTS) { write({ error: `Cada evento pode ter até ${MAX_EVENT_ATTACHMENTS} anexos.` }); return; }
      write({ files: [...current.files, ...files], error: null, progress: null });
    } catch {
      if (job.current()) write({ error: "Não foi possível selecionar os arquivos. Tente novamente." });
    } finally {
      job.work.picking = false;
      if (job.current()) write({ picking: false });
    }
  }, [capture, write, owner, needsLoad, eventId]);

  const removePending = useCallback((id: string) => {
    const job = capture();
    if (!job.current() || !live.current.canManage || live.current.busy || job.work.picking || job.work.committing) return;
    const snapshot = live.current.state;
    if (snapshot.owner !== owner || !snapshot.files.some(file => file.id === id)) return;
    const attempted = job.work.completedUploads.get(id) ?? job.work.attemptedUploads.get(id);
    write({ files: snapshot.files.filter(file => file.id !== id), removedIds: attempted ? [...new Set([...snapshot.removedIds, attempted.id])] : snapshot.removedIds, error: null, progress: null });
  }, [capture, write, owner]);

  const removeExisting = useCallback((id: string) => {
    const job = capture();
    if (!job.current() || !live.current.canManage || live.current.busy || job.work.picking || job.work.committing) return;
    const snapshot = live.current.state;
    if (snapshot.owner !== owner || !snapshot.attachments.some(file => file.id === id)) return;
    write({ removedIds: [...new Set([...snapshot.removedIds, id])], error: null, progress: null });
  }, [capture, write, owner]);

  const retryLoad = useCallback(() => {
    const job = capture();
    if (job.current() && !live.current.busy && !job.work.committing) setReadRevision(value => value + 1);
  }, [capture]);

  const open = useCallback(async (item: EventAttachment | EventAttachmentFile) => {
    const job = capture();
    if (!job.current() || live.current.busy || !organizationId) return;
    const snapshot = live.current.state;
    if (snapshot.owner !== owner || snapshot.removedIds.includes(item.id)) return;
    const existing = snapshot.attachments.find(file => file.id === item.id) ?? job.work.completedUploads.get(item.id);
    const local = snapshot.files.find(file => file.id === item.id);
    try {
      let url: string;
      if (existing) {
        if (existing.organizationId !== organizationId || (eventId && existing.eventId !== eventId)) return;
        if (existing.uploadedAt === null) { write({ error: "Este anexo ainda não terminou de enviar." }); return; }
        url = await getEventAttachmentUrl({ organizationId, eventId: existing.eventId, attachment: existing });
      } else if (local) url = local.uri;
      else return;
      if (!job.current() || live.current.busy) return;
      await openEventAttachment({ url, name: existing?.name ?? local!.name, localFile: existing ? undefined : local, isCurrent: () => job.current() && !live.current.busy });
    } catch {
      if (job.current()) write({ error: "Não foi possível abrir o anexo. Tente novamente." });
    }
  }, [capture, write, owner, organizationId, eventId]);

  const commit = useCallback(async (targetEventId: string, parentCurrent: () => boolean) => {
    const job = capture();
    if (!job.current() || !parentCurrent()) return;
    if (!live.current.canManage || !organizationId) throw new Error("Você não pode alterar os anexos.");
    if (job.work.picking || job.work.committing) throw new Error("Aguarde a seleção ou o envio dos anexos.");
    if ((eventId && targetEventId !== eventId) || (job.work.eventId && job.work.eventId !== targetEventId)) throw new Error("O evento mudou. Abra novamente os anexos.");
    const snapshot = live.current.state;
    if (snapshot.owner !== owner) return;
    const files = [...snapshot.files], removedIds = [...snapshot.removedIds];
    if (!files.length && !removedIds.length) return;
    const current = () => job.current() && parentCurrent() && live.current.canManage;
    job.work.committing = true;
    job.work.eventId = targetEventId;
    let completed = removedIds.filter(id => job.work.completedRemovals.has(id)).length + files.filter(file => job.work.completedUploads.has(file.id)).length;
    const total = removedIds.length + files.length;
    write({ error: null, progress: { completed, total } });
    try {
      for (const id of removedIds) {
        if (!current()) return;
        if (job.work.completedRemovals.has(id)) continue;
        const attachment = snapshot.attachments.find(file => file.id === id) ?? job.work.completedUploads.get(id) ?? job.work.attemptedUploads.get(id);
        if (!attachment || attachment.organizationId !== organizationId || attachment.eventId !== targetEventId) throw new Error("Invalid attachment context");
        await removeEventAttachment({ organizationId, eventId: targetEventId, attachment });
        if (!current()) return;
        job.work.completedRemovals.add(id);
        completed += 1;
        write({ progress: { completed, total } });
      }
      for (const file of files) {
        if (!current()) return;
        if (job.work.completedUploads.has(file.id)) continue;
        job.work.attemptedUploads.set(file.id, { id: file.id, organizationId, eventId: targetEventId });
        const attachment = await uploadEventAttachment({ organizationId, eventId: targetEventId, file });
        if (!current()) return;
        if (attachment.organizationId !== organizationId || attachment.eventId !== targetEventId || attachment.id !== file.id) throw new Error("Invalid attachment context");
        job.work.completedUploads.set(file.id, attachment);
        completed += 1;
        write({ progress: { completed, total } });
      }
    } catch (error) {
      if (!current()) return;
      write({ error: "Não foi possível salvar os anexos. Tente novamente." });
      throw error;
    } finally {
      job.work.committing = false;
    }
    // Keep file/removal IDs stable until the parent finishes Save and closes.
  }, [capture, write, owner, organizationId, eventId]);

  const visible = state.owner === owner ? state : emptySnapshot(owner, needsLoad);
  const files = enabled ? visible.files : [], attachments = enabled ? visible.attachments : [], removedIds = enabled ? visible.removedIds : [];
  const signature = JSON.stringify({ files: files.map(file => file.id), removedIds: [...removedIds].sort() });
  return { attachments, files, removedIds, loading: enabled && visible.loading, error: enabled ? visible.error : null,
    picking: enabled && visible.picking, progress: enabled ? visible.progress : null,
    signature, hasChanges: Boolean(files.length || removedIds.length), pick, removePending, removeExisting, retryLoad, open, commit };
}
