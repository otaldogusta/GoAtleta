import { normalizeAgeBand } from "../core/age-band";
import { sortClassesBySchedule } from "../core/class-schedule-sort";

type ClassRow = {
  id: string;
  name: string;
  ageBand: string;
  modality?: string;
  gender: string;
  daysPerWeek: number;
  goal: string;
  equipment: string;
  level: number;
  acwrLow?: number;
  acwrHigh?: number;
};

type SessionLogRow = {
  classId: string;
  rpe: number;
  technique: string;
  attendance: number;
  activity?: string;
  conclusion?: string;
  participantsCount?: number;
  photos?: string;
  painScore?: number;
  createdAt: string;
};

const classes: ClassRow[] = [];
const sessionLogs: SessionLogRow[] = [];
const trainingPlans: {
  id: string;
  classId: string;
  title: string;
  warmup: string;
  main: string;
  cooldown: string;
  warmupTime: string;
  mainTime: string;
  cooldownTime: string;
  createdAt: string;
}[] = [];

const normalize = (sql: string) =>
  sql.trim().replace(/\s+/g, " ").toLowerCase();

export const db = {
  execSync(sql: string) {
    const normalized = normalize(sql);
    if (
      normalized.startsWith("create table") ||
      normalized.startsWith("begin transaction") ||
      normalized.startsWith("commit") ||
      normalized.startsWith("rollback")
    ) {
      return;
    }
    throw new Error("Unsupported SQL (web): " + sql);
  },
  getFirstSync<T>(sql: string, params: unknown[] = []) {
    const normalized = normalize(sql);
    if (normalized.startsWith("select count(*) as count from classes")) {
      return { count: classes.length } as T;
    }
    if (normalized.startsWith("select * from classes where id =")) {
      const id = String(params[0] ?? "");
      const found = classes.find((item) => item.id === id);
      return (found ?? null) as T;
    }
    throw new Error("Unsupported SQL (web): " + sql);
  },
  getAllSync<T>(sql: string) {
    const normalized = normalize(sql);
    if (normalized.startsWith("select * from classes order by name asc")) {
      return sortClassesBySchedule(classes) as T[];
    }
    if (normalized.startsWith("select * from training_plans order by createdat desc")) {
      return [...trainingPlans].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ) as T[];
    }
    throw new Error("Unsupported SQL (web): " + sql);
  },
  runSync(sql: string, params: unknown[] = []) {
    const normalized = normalize(sql);
    if (normalized.startsWith("insert into classes")) {
      const row: ClassRow = {
        id: String(params[0] ?? ""),
        name: String(params[1] ?? ""),
        ageBand: normalizeAgeBand(String(params[2] ?? "")),
        daysPerWeek: Number(params[3] ?? 0),
        goal: String(params[4] ?? ""),
        equipment: String(params[5] ?? ""),
        level: Number(params[6] ?? 0),
        gender: String(params[7] ?? "misto"),
        modality: String(params[8] ?? "fitness"),
        acwrLow: Number(params[9] ?? 0.8),
        acwrHigh: Number(params[10] ?? 1.3),
      };
      const exists = classes.some((item) => item.id === row.id);
      if (!exists) classes.push(row);
      return;
    }
    if (normalized.startsWith("insert into session_logs")) {
      const createdAt = String(params[params.length - 1] ?? "");
      const row: SessionLogRow = {
        classId: String(params[0] ?? ""),
        rpe: Number(params[1] ?? 0),
        technique: String(params[2] ?? ""),
        attendance: Number(params[3] ?? 0),
        activity: params.length > 5 ? String(params[4] ?? "") : "",
        conclusion: params.length > 5 ? String(params[5] ?? "") : "",
        participantsCount: params.length > 6 ? Number(params[6] ?? 0) : 0,
        photos: params.length > 7 ? String(params[7] ?? "") : "",
        painScore: params.length > 8 ? Number(params[8] ?? 0) : undefined,
        createdAt,
      };
      sessionLogs.push(row);
      return;
    }
    if (normalized.startsWith("insert into training_plans")) {
      const row = {
        id: String(params[0] ?? ""),
        classId: String(params[1] ?? ""),
        title: String(params[2] ?? ""),
        warmup: String(params[3] ?? ""),
        main: String(params[4] ?? ""),
        cooldown: String(params[5] ?? ""),
        warmupTime: String(params[6] ?? ""),
        mainTime: String(params[7] ?? ""),
        cooldownTime: String(params[8] ?? ""),
        createdAt: String(params[9] ?? ""),
      };
      const exists = trainingPlans.some((item) => item.id === row.id);
      if (!exists) trainingPlans.push(row);
      return;
    }
    if (normalized.startsWith("update training_plans set")) {
      const id = String(params[8] ?? "");
      const idx = trainingPlans.findIndex((item) => item.id === id);
      if (idx === -1) return;
      trainingPlans[idx] = {
        ...trainingPlans[idx],
        classId: String(params[0] ?? ""),
        title: String(params[1] ?? ""),
        warmup: String(params[2] ?? ""),
        main: String(params[3] ?? ""),
        cooldown: String(params[4] ?? ""),
        warmupTime: String(params[5] ?? ""),
        mainTime: String(params[6] ?? ""),
        cooldownTime: String(params[7] ?? ""),
      };
      return;
    }
    if (normalized.startsWith("delete from training_plans")) {
      const id = String(params[0] ?? "");
      const idx = trainingPlans.findIndex((item) => item.id === id);
      if (idx !== -1) trainingPlans.splice(idx, 1);
      return;
    }
    throw new Error("Unsupported SQL (web): " + sql);
  },
};

export function initDb() {
  // No-op on web; data is kept in memory.
}
