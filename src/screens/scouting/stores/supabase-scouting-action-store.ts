import { supabaseDelete, supabaseGet, supabasePost } from "../../../db/client";
import type { ScoutingAction } from "../../../core/scouting-action";
import type { ScoutingActionStore } from "../scouting-action-store";
import {
  fromScoutingActionRow,
  toScoutingActionRow,
  type ScoutingActionRow,
} from "./scouting-action-mappers";

const sortActions = (items: ScoutingAction[]) =>
  [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export class SupabaseScoutingActionStore implements ScoutingActionStore {
  readonly kind = "supabase" as const;

  private actions: ScoutingAction[] = [];

  async hydrate(): Promise<void> {
    const rows = await supabaseGet<ScoutingActionRow[]>(
      "/scouting_actions?select=*&order=created_at.desc",
    );
    this.actions = sortActions(rows.map(fromScoutingActionRow));
  }

  async save(input: ScoutingAction): Promise<ScoutingAction> {
    const rows = await supabasePost<ScoutingActionRow[]>(
      "/scouting_actions",
      [toScoutingActionRow(input)],
      {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    );
    const persisted = fromScoutingActionRow(rows[0] ?? toScoutingActionRow(input));
    this.upsertLocal(persisted);
    return persisted;
  }

  async list(): Promise<ScoutingAction[]> {
    const rows = await supabaseGet<ScoutingActionRow[]>(
      "/scouting_actions?select=*&order=created_at.desc",
    );
    this.actions = sortActions(rows.map(fromScoutingActionRow));
    return this.actions;
  }

  async listBySession(scoutingSessionId: string): Promise<ScoutingAction[]> {
    return this.listByFilter("scouting_session_id", scoutingSessionId);
  }

  async listByClass(classId: string): Promise<ScoutingAction[]> {
    return this.listByFilter("class_id", classId);
  }

  async listByAthlete(athleteId: string): Promise<ScoutingAction[]> {
    return this.listByFilter("athlete_id", athleteId);
  }

  async delete(id: string): Promise<boolean> {
    await supabaseDelete(`/scouting_actions?id=eq.${encodeURIComponent(id)}`);
    this.actions = this.actions.filter((item) => item.id !== id);
    return true;
  }

  private async listByFilter(column: string, value: string): Promise<ScoutingAction[]> {
    const rows = await supabaseGet<ScoutingActionRow[]>(
      `/scouting_actions?select=*&${column}=eq.${encodeURIComponent(value)}&order=created_at.desc`,
    );
    const actions = sortActions(rows.map(fromScoutingActionRow));
    for (const action of actions) this.upsertLocal(action);
    return actions;
  }

  private upsertLocal(input: ScoutingAction): void {
    this.actions = sortActions([...this.actions.filter((item) => item.id !== input.id), input]);
  }
}
