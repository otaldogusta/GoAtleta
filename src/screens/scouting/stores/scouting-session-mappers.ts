import type { ScoutingSession } from "../../../core/scouting-session";

export type ScoutingSessionRow = {
  id: string;
  class_id: string;
  date: string;
  type: ScoutingSession["type"];
  title: string;
  opponent: string | null;
  location: string | null;
  video_url: string | null;
  source_type: ScoutingSession["sourceType"] | null;
  video_clip_type: string | null;
  video_notes: string | null;
  status: ScoutingSession["status"];
  source: ScoutingSession["source"] | null;
  related_event_id: string | null;
  created_at: string;
  updated_at: string | null;
};

export function toScoutingSessionRow(session: ScoutingSession): ScoutingSessionRow {
  return {
    id: session.id,
    class_id: session.classId,
    date: session.date,
    type: session.type,
    title: session.title,
    opponent: session.opponent ?? null,
    location: session.location ?? null,
    video_url: session.videoUrl ?? null,
    source_type: session.sourceType ?? null,
    video_clip_type: session.videoClipType ?? null,
    video_notes: session.videoNotes ?? null,
    status: session.status,
    source: session.source ?? null,
    related_event_id: session.relatedEventId ?? null,
    created_at: session.createdAt,
    updated_at: session.updatedAt ?? null,
  };
}

export function fromScoutingSessionRow(row: ScoutingSessionRow): ScoutingSession {
  return {
    id: row.id,
    classId: row.class_id,
    date: row.date,
    type: row.type,
    title: row.title,
    opponent: row.opponent ?? undefined,
    location: row.location ?? undefined,
    videoUrl: row.video_url ?? undefined,
    sourceType: row.source_type ?? undefined,
    videoClipType: row.video_clip_type ?? undefined,
    videoNotes: row.video_notes ?? undefined,
    status: row.status,
    source: row.source ?? undefined,
    relatedEventId: row.related_event_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}
