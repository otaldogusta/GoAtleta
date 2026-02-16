import type {
    ClassProfile,
    KnowledgeDocument,
    OrganizationAiProfile,
    SessionExecutionLog,
    SessionSkillSnapshot,
    UnitAiProfile,
} from "../core/models";
import { db } from "./sqlite";

const parseJsonArray = <T>(value: string, fallback: T[]): T[] => {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
};

export async function saveKnowledgeDocuments(documents: KnowledgeDocument[]) {
  for (const document of documents) {
    await db.runAsync(
      `INSERT OR REPLACE INTO kb_documents (
        id, organizationId, title, source, chunk, embedding, tags, sport, level, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        document.id,
        document.organizationId,
        document.title,
        document.source,
        document.chunk,
        JSON.stringify(document.embedding ?? []),
        JSON.stringify(document.tags ?? []),
        document.sport,
        document.level,
        document.createdAt,
      ]
    );
  }
}

export async function listKnowledgeDocumentsBySport(
  organizationId: string,
  sport: string,
  limit = 40
) {
  const rows = await db.getAllAsync<{
    id: string;
    organizationId: string;
    title: string;
    source: string;
    chunk: string;
    embedding: string;
    tags: string;
    sport: string;
    level: string;
    createdAt: string;
  }>(
    `SELECT * FROM kb_documents
     WHERE organizationId = ? AND sport = ?
     ORDER BY createdAt DESC
     LIMIT ?`,
    [organizationId, sport, Math.max(1, limit)]
  );

  return rows.map((row) => ({
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    source: row.source,
    chunk: row.chunk,
    embedding: parseJsonArray<number>(row.embedding, []),
    tags: parseJsonArray<string>(row.tags, []),
    sport: row.sport,
    level: row.level,
    createdAt: row.createdAt,
  })) as KnowledgeDocument[];
}

export async function saveOrganizationAiProfile(profile: OrganizationAiProfile) {
  await db.runAsync(
    `INSERT OR REPLACE INTO org_ai_profiles (
      id, organizationId, philosophy, constraints, goals, equipmentNotes, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.organizationId,
      profile.philosophy,
      JSON.stringify(profile.constraints ?? []),
      JSON.stringify(profile.goals ?? []),
      profile.equipmentNotes,
      profile.createdAt,
      profile.updatedAt,
    ]
  );
}

export async function getOrganizationAiProfile(organizationId: string) {
  const row = await db.getFirstAsync<{
    id: string;
    organizationId: string;
    philosophy: string;
    constraints: string;
    goals: string;
    equipmentNotes: string;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT * FROM org_ai_profiles
     WHERE organizationId = ?
     ORDER BY updatedAt DESC
     LIMIT 1`,
    [organizationId]
  );

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    philosophy: row.philosophy,
    constraints: parseJsonArray<string>(row.constraints, []),
    goals: parseJsonArray<string>(row.goals, []),
    equipmentNotes: row.equipmentNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as OrganizationAiProfile;
}

export async function saveUnitAiProfile(profile: UnitAiProfile) {
  await db.runAsync(
    `INSERT OR REPLACE INTO unit_ai_profiles (
      id, organizationId, unitId, realityNotes, constraints, focus, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.organizationId,
      profile.unitId,
      profile.realityNotes,
      JSON.stringify(profile.constraints ?? []),
      JSON.stringify(profile.focus ?? []),
      profile.createdAt,
      profile.updatedAt,
    ]
  );
}

export async function getUnitAiProfile(organizationId: string, unitId: string) {
  const row = await db.getFirstAsync<{
    id: string;
    organizationId: string;
    unitId: string;
    realityNotes: string;
    constraints: string;
    focus: string;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT * FROM unit_ai_profiles
     WHERE organizationId = ? AND unitId = ?
     ORDER BY updatedAt DESC
     LIMIT 1`,
    [organizationId, unitId]
  );

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    unitId: row.unitId,
    realityNotes: row.realityNotes,
    constraints: parseJsonArray<string>(row.constraints, []),
    focus: parseJsonArray<string>(row.focus, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as UnitAiProfile;
}

export async function saveSessionSkillSnapshot(snapshot: SessionSkillSnapshot) {
  await db.runAsync(
    `INSERT OR REPLACE INTO session_skill_snapshots (
      id, organizationId, classId, unitId, sessionDate, objective, focusSkills,
      consistencyScore, successRate, decisionQuality, appliedDrillIds, notes, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshot.id,
      snapshot.organizationId,
      snapshot.classId,
      snapshot.unitId,
      snapshot.sessionDate,
      snapshot.objective,
      JSON.stringify(snapshot.focusSkills ?? []),
      snapshot.consistencyScore,
      snapshot.successRate,
      snapshot.decisionQuality,
      JSON.stringify(snapshot.appliedDrillIds ?? []),
      JSON.stringify(snapshot.notes ?? []),
      snapshot.createdAt,
    ]
  );
}

export async function getLatestSessionSkillSnapshot(classId: string) {
  const row = await db.getFirstAsync<{
    id: string;
    organizationId: string;
    classId: string;
    unitId: string;
    sessionDate: string;
    objective: string;
    focusSkills: string;
    consistencyScore: number;
    successRate: number;
    decisionQuality: number;
    appliedDrillIds: string;
    notes: string;
    createdAt: string;
  }>(
    `SELECT * FROM session_skill_snapshots
     WHERE classId = ?
     ORDER BY sessionDate DESC, createdAt DESC
     LIMIT 1`,
    [classId]
  );

  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    classId: row.classId,
    unitId: row.unitId,
    sessionDate: row.sessionDate,
    objective: row.objective,
    focusSkills: parseJsonArray<SessionSkillSnapshot["focusSkills"][number]>(
      row.focusSkills,
      []
    ),
    consistencyScore: Number(row.consistencyScore ?? 0),
    successRate: Number(row.successRate ?? 0),
    decisionQuality: Number(row.decisionQuality ?? 0),
    appliedDrillIds: parseJsonArray<string>(row.appliedDrillIds, []),
    notes: parseJsonArray<string>(row.notes, []),
    createdAt: row.createdAt,
  } as SessionSkillSnapshot;
}

export async function upsertClassProfile(profile: ClassProfile) {
  await db.runAsync(
    `INSERT OR REPLACE INTO class_profiles (
      classId, organizationId, unitId, modality, ageBand, level,
      sessionsPerWeek, cycleGoal, constraintsDefault, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.classId,
      profile.organizationId,
      profile.unitId,
      profile.modality,
      profile.ageBand,
      profile.level,
      profile.sessionsPerWeek,
      profile.cycleGoal,
      JSON.stringify(profile.constraintsDefault ?? []),
      profile.createdAt,
      profile.updatedAt,
    ]
  );
}

export async function getClassProfile(classId: string) {
  const row = await db.getFirstAsync<{
    classId: string;
    organizationId: string;
    unitId: string;
    modality: "volleyball_indoor";
    ageBand: string;
    level: "initiation" | "development" | "performance";
    sessionsPerWeek: number;
    cycleGoal: string;
    constraintsDefault: string;
    createdAt: string;
    updatedAt: string;
  }>(
    `SELECT * FROM class_profiles WHERE classId = ? LIMIT 1`,
    [classId]
  );

  if (!row) return null;
  return {
    classId: row.classId,
    organizationId: row.organizationId,
    unitId: row.unitId,
    modality: row.modality,
    ageBand: row.ageBand,
    level: row.level,
    sessionsPerWeek: Number(row.sessionsPerWeek ?? 2),
    cycleGoal: row.cycleGoal,
    constraintsDefault: parseJsonArray<string>(row.constraintsDefault, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as ClassProfile;
}

export async function saveSessionExecutionLog(log: SessionExecutionLog) {
  await db.runAsync(
    `INSERT OR REPLACE INTO session_execution_log (
      id, classId, date, plannedFocusTags, executedDrills, rpeGroup,
      quality, constraints, coachNotes, attendanceCount, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.classId,
      log.date,
      JSON.stringify(log.plannedFocusTags ?? []),
      JSON.stringify(log.executedDrills ?? []),
      log.rpeGroup,
      log.quality,
      JSON.stringify(log.constraints ?? []),
      log.coachNotes,
      log.attendanceCount,
      log.createdAt,
    ]
  );
}

export async function getLastSessionExecutionLog(classId: string) {
  const row = await db.getFirstAsync<{
    id: string;
    classId: string;
    date: string;
    plannedFocusTags: string;
    executedDrills: string;
    rpeGroup: number;
    quality: "low" | "medium" | "high";
    constraints: string;
    coachNotes: string;
    attendanceCount: number;
    createdAt: string;
  }>(
    `SELECT * FROM session_execution_log WHERE classId = ? ORDER BY date DESC, createdAt DESC LIMIT 1`,
    [classId]
  );

  if (!row) return null;
  return {
    id: row.id,
    classId: row.classId,
    date: row.date,
    plannedFocusTags: parseJsonArray<string>(row.plannedFocusTags, []),
    executedDrills: parseJsonArray<SessionExecutionLog["executedDrills"][number]>(
      row.executedDrills,
      []
    ),
    rpeGroup: Number(row.rpeGroup ?? 5),
    quality: row.quality,
    constraints: parseJsonArray<string>(row.constraints, []),
    coachNotes: row.coachNotes,
    attendanceCount: Number(row.attendanceCount ?? 0),
    createdAt: row.createdAt,
  } as SessionExecutionLog;
}
