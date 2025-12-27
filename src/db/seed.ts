import { db, initDb } from "./sqlite";
import type { ClassGroup, SessionLog } from "../core/models";

export async function seedIfEmpty() {
  initDb();

  const res = db.getFirstSync<{ count: number }>(
    "SELECT COUNT(*) as count FROM classes"
  );
  if (res?.count && res.count > 0) return;

  const classes: ClassGroup[] = [
    {
      id: "c1",
      name: "Turma 8–9",
      ageBand: "8-9",
      daysPerWeek: 3,
      goal: "Fundamentos",
      equipment: "misto",
      level: 1,
    },
    {
      id: "c2",
      name: "Turma 10–12",
      ageBand: "10-12",
      daysPerWeek: 3,
      goal: "Força Geral",
      equipment: "misto",
      level: 2,
    },
    {
      id: "c3",
      name: "Turma 13–15",
      ageBand: "13-15",
      daysPerWeek: 3,
      goal: "Força+Potência",
      equipment: "misto",
      level: 2,
    },
  ];

  db.execSync("BEGIN TRANSACTION");
  try {
    for (const c of classes) {
      db.runSync(
        `INSERT INTO classes (id, name, ageBand, daysPerWeek, goal, equipment, level)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
        ,
        [c.id, c.name, c.ageBand, c.daysPerWeek, c.goal, c.equipment, c.level]
      );
    }
    db.execSync("COMMIT");
  } catch (e) {
    db.execSync("ROLLBACK");
    throw e;
  }
}

export async function getClasses(): Promise<ClassGroup[]> {
  return db.getAllSync<ClassGroup>("SELECT * FROM classes ORDER BY name ASC");
}

export async function getClassById(id: string): Promise<ClassGroup | null> {
  const res = db.getFirstSync<ClassGroup>(
    "SELECT * FROM classes WHERE id = ?",
    [id]
  );
  return res ?? null;
}

export async function saveSessionLog(log: SessionLog) {
  db.runSync(
    `INSERT INTO session_logs (classId, rpe, technique, attendance, createdAt)
     VALUES (?, ?, ?, ?, ?)`
    ,
    [log.classId, log.rpe, log.technique, log.attendance, log.createdAt]
  );
}
