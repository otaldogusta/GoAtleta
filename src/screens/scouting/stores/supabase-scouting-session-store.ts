import { supabaseGet, supabasePost } from "../../../db/client";
import type { ScoutingSession } from "../../../core/scouting-session";
import type { ScoutingSessionStore } from "../scouting-session-store";
import {
  fromScoutingSessionRow,
  toScoutingSessionRow,
  type ScoutingSessionRow,
} from "./scouting-session-mappers";

const sortSessions = (items: ScoutingSession[]) =>
  [...items].sort((a, b) => {
    if (a.date === b.date) return b.createdAt.localeCompare(a.createdAt);
    return b.date.localeCompare(a.date);
  });

export class SupabaseScoutingSessionStore implements ScoutingSessionStore {
  readonly kind = "supabase" as const;

  private sessions: ScoutingSession[] = [];

  async hydrate(): Promise<void> {
    const rows = await supabaseGet<ScoutingSessionRow[]>(
      "/scouting_sessions?select=*&order=date.desc&order=created_at.desc",
    );
    this.sessions = sortSessions(rows.map(fromScoutingSessionRow));
  }

  async save(input: ScoutingSession): Promise<ScoutingSession> {
    const rows = await supabasePost<ScoutingSessionRow[]>(
      "/scouting_sessions",
      [toScoutingSessionRow(input)],
      {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    );
    const persisted = fromScoutingSessionRow(rows[0] ?? toScoutingSessionRow(input));
    this.upsertLocal(persisted);
    return persisted;
  }

  async listByClass(classId: string): Promise<ScoutingSession[]> {
    const rows = await supabaseGet<ScoutingSessionRow[]>(
      `/scouting_sessions?select=*&class_id=eq.${encodeURIComponent(classId)}&order=date.desc&order=created_at.desc`,
    );
    const sessions = sortSessions(rows.map(fromScoutingSessionRow));
    for (const session of sessions) this.upsertLocal(session);
    return sessions;
  }

  async get(id: string): Promise<ScoutingSession | null> {
    const rows = await supabaseGet<ScoutingSessionRow[]>(
      `/scouting_sessions?select=*&id=eq.${encodeURIComponent(id)}&limit=1`,
    );
    const session = rows[0] ? fromScoutingSessionRow(rows[0]) : null;
    if (session) this.upsertLocal(session);
    return session;
  }

  private upsertLocal(input: ScoutingSession): void {
    this.sessions = sortSessions([...this.sessions.filter((item) => item.id !== input.id), input]);
  }
}
