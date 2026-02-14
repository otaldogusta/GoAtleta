import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("coachperiod.db");

export function initDb() {
  db.execSync(
    `
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      ageBand TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'misto',
      daysPerWeek INTEGER NOT NULL,
      goal TEXT NOT NULL,
      equipment TEXT NOT NULL,
      level INTEGER NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      modality TEXT NOT NULL DEFAULT 'fitness',
      unitId TEXT NOT NULL DEFAULT '',
      mvLevel TEXT NOT NULL DEFAULT '',
      cycleStartDate TEXT NOT NULL DEFAULT '',
      cycleLengthWeeks INTEGER NOT NULL DEFAULT 0,
      acwrLow REAL NOT NULL DEFAULT 0.8,
      acwrHigh REAL NOT NULL DEFAULT 1.3,
      startTime TEXT NOT NULL DEFAULT '',
      endTime TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classId TEXT NOT NULL,
      rpe INTEGER NOT NULL,
      technique TEXT NOT NULL,
      attendance INTEGER NOT NULL,
      activity TEXT NOT NULL DEFAULT '',
      conclusion TEXT NOT NULL DEFAULT '',
      participantsCount INTEGER NOT NULL DEFAULT 0,
      photos TEXT NOT NULL DEFAULT '',
      painScore INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scouting_logs (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      serve0 INTEGER NOT NULL DEFAULT 0,
      serve1 INTEGER NOT NULL DEFAULT 0,
      serve2 INTEGER NOT NULL DEFAULT 0,
      receive0 INTEGER NOT NULL DEFAULT 0,
      receive1 INTEGER NOT NULL DEFAULT 0,
      receive2 INTEGER NOT NULL DEFAULT 0,
      set0 INTEGER NOT NULL DEFAULT 0,
      set1 INTEGER NOT NULL DEFAULT 0,
      set2 INTEGER NOT NULL DEFAULT 0,
      attackSend0 INTEGER NOT NULL DEFAULT 0,
      attackSend1 INTEGER NOT NULL DEFAULT 0,
      attackSend2 INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS student_scouting_logs (
      id TEXT PRIMARY KEY NOT NULL,
      studentId TEXT NOT NULL,
      classId TEXT NOT NULL,
      date TEXT NOT NULL,
      serve0 INTEGER NOT NULL DEFAULT 0,
      serve1 INTEGER NOT NULL DEFAULT 0,
      serve2 INTEGER NOT NULL DEFAULT 0,
      receive0 INTEGER NOT NULL DEFAULT 0,
      receive1 INTEGER NOT NULL DEFAULT 0,
      receive2 INTEGER NOT NULL DEFAULT 0,
      set0 INTEGER NOT NULL DEFAULT 0,
      set1 INTEGER NOT NULL DEFAULT 0,
      set2 INTEGER NOT NULL DEFAULT 0,
      attackSend0 INTEGER NOT NULL DEFAULT 0,
      attackSend1 INTEGER NOT NULL DEFAULT 0,
      attackSend2 INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      title TEXT NOT NULL,
      warmup TEXT NOT NULL,
      main TEXT NOT NULL,
      cooldown TEXT NOT NULL,
      warmupTime TEXT NOT NULL,
      mainTime TEXT NOT NULL,
      cooldownTime TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_plans (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      startDate TEXT NOT NULL,
      weekNumber INTEGER NOT NULL,
      phase TEXT NOT NULL,
      theme TEXT NOT NULL,
      technicalFocus TEXT NOT NULL,
      physicalFocus TEXT NOT NULL,
      constraints TEXT NOT NULL,
      mvFormat TEXT NOT NULL,
      warmupProfile TEXT NOT NULL,
      jumpTarget TEXT NOT NULL,
      rpeTarget TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `
  );

  try {
    db.execSync(
      "CREATE UNIQUE INDEX IF NOT EXISTS class_plans_unique_week ON class_plans (classId, weekNumber)"
    );
  } catch {}

  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN classId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN warmupTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN mainTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN cooldownTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN unit TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN organizationId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN modality TEXT NOT NULL DEFAULT 'fitness'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN gender TEXT NOT NULL DEFAULT 'misto'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN unitId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN mvLevel TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN cycleStartDate TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN cycleLengthWeeks INTEGER NOT NULL DEFAULT 0"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN acwrLow REAL NOT NULL DEFAULT 0.8"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN acwrHigh REAL NOT NULL DEFAULT 1.3"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN startTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN endTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN technicalFocus TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN physicalFocus TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN constraints TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN mvFormat TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN source TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN updatedAt TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN jumpTarget TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN rpeTarget TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN painScore INTEGER"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN activity TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN conclusion TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN participantsCount INTEGER NOT NULL DEFAULT 0"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN photos TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE units ADD COLUMN organizationId TEXT NOT NULL DEFAULT ''"
    );
    // Fix existing units: assign them to the first available organization
    // This prevents orphaned units from disappearing
    const orgs = db.getAllSync<{ id: string }>("SELECT id FROM organizations LIMIT 1");
    if (orgs.length > 0) {
      db.execSync(
        "UPDATE units SET organizationId = ? WHERE organizationId = ''",
        [orgs[0].id]
      );
    }
  } catch {}
}

// Helper: Get all units (locations) for an organization
export function getUnitsByOrg(organizationId: string) {
  return db.getAllAsync<{
    id: string;
    name: string;
    address: string | null;
    notes: string | null;
    organizationId: string;
    createdAt: string;
  }>("SELECT * FROM units WHERE organizationId = ? ORDER BY name ASC", [
    organizationId,
  ]);
}
