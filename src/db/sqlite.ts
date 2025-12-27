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
      level INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classId TEXT NOT NULL,
      rpe INTEGER NOT NULL,
      technique TEXT NOT NULL,
      attendance INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    );
  `
  );
}
