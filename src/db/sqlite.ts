import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("coachperiod.db");

export function initDb() {
  db.execSync(
    `
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      ageBand TEXT NOT NULL,
      daysPerWeek INTEGER NOT NULL,
      goal TEXT NOT NULL,
      equipment TEXT NOT NULL,
      level INTEGER NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      unitId TEXT NOT NULL DEFAULT '',
      mvLevel TEXT NOT NULL DEFAULT '',
      cycleStartDate TEXT NOT NULL DEFAULT '',
      cycleLengthWeeks INTEGER NOT NULL DEFAULT 0,
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
      painScore INTEGER,
      createdAt TEXT NOT NULL
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
}
