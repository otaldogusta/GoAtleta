import { normalizeAgeBand } from "../core/age-band";
import { sortClassesBySchedule } from "../core/class-schedule-sort";

type ClassRow = {
  id: string;
  name: string;
  organizationId: string;
  ageBand: string;
  modality: string;
  gender: string;
  daysPerWeek: number;
  goal: string;
  equipment: string;
  level: number;
  acwrLow: number;
  acwrHigh: number;
};

type SessionLogRow = {
  classId: string;
  rpe: number;
  technique: string;
  attendance: number;
  activity: string;
  conclusion: string;
  participantsCount: number;
  photos: string;
  painScore: number;
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
const dailyLessonPlans: any[] = [];
const classPlans: any[] = [];
const monthlyPlanningBlueprints: any[] = [];
const planningCycles: any[] = [];

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
  async getFirstAsync<T>(sql: string, params: unknown[] = []) {
    // Async version of getFirstSync - query planning tables from memory
    const normalized = normalize(sql);

    // Query for daily_lesson_plan by weeklyPlanId and date
    if (normalized.startsWith("select * from daily_lesson_plans where weekly")) {
      const weeklyPlanId = String(params[0] ?? "");
      const date = String(params[1] ?? "");
      const found = dailyLessonPlans.find(
        (plan) => plan.weeklyPlanId === weeklyPlanId && plan.date === date
      );
      return (found ?? null) as T;
    }

    // Query for class_plan by id
    if (normalized.startsWith("select * from class_plans where id =")) {
      const id = String(params[0] ?? "");
      const found = classPlans.find((plan) => plan.id === id);
      return (found ?? null) as T;
    }

    // Query for monthly_planning_blueprint by classId and monthKey
    if (normalized.startsWith("select * from monthly_planning_blueprints")) {
      const classId = String(params[0] ?? "");
      const monthKey = String(params[1] ?? "");
      const found = monthlyPlanningBlueprints.find(
        (bp) => bp.classId === classId && bp.monthKey === monthKey
      );
      return (found ?? null) as T;
    }

    // Query for active planning_cycle by classId
    if (normalized.startsWith("select * from planning_cycles where classid = ? and status = 'active'")) {
      const classId = String(params[0] ?? "");
      const found = planningCycles
        .filter((c) => c.classId === classId && c.status === "active")
        .sort((a, b) => b.year - a.year)[0];
      return (found ?? null) as T;
    }

    // Query for planning_cycle by classId + year + status
    if (normalized.startsWith("select * from planning_cycles where classid = ? and year = ?")) {
      const classId = String(params[0] ?? "");
      const year = Number(params[1] ?? 0);
      const found = planningCycles.find(
        (c) => c.classId === classId && c.year === year && c.status === "active"
      );
      return (found ?? null) as T;
    }

    if (normalized.startsWith("select count(*) as count from")) {
      return { count: 0 } as T;
    }
    return null as T;
  },
  getAllSync<T>(sql: string) {
    const normalized = normalize(sql);
    if (normalized.startsWith("select * from classes order by name asc")) {
      return sortClassesBySchedule(classes as any) as T[];
    }
    if (normalized.startsWith("select * from training_plans order by createdat desc")) {
      return [...trainingPlans].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ) as T[];
    }
    throw new Error("Unsupported SQL (web): " + sql);
  },
  async getAllAsync<T>(sql: string, params: unknown[] = []) {
    // Async version of getAllSync - query planning tables from memory
    const normalized = normalize(sql);

    if (normalized.startsWith("select * from daily_lesson_plans where classid =")) {
      const classId = String(params[0] ?? "");
      const limit = Number(params[1] ?? 12);
      return dailyLessonPlans
        .filter((plan) => plan.classId === classId)
        .sort((a, b) => (a.date < b.date ? 1 : -1))
        .slice(0, Math.max(1, Math.floor(limit))) as T[];
    }

    // Query for daily_lesson_plans by weeklyPlanIds (array filter)
    if (normalized.startsWith("select * from daily_lesson_plans where weekly")) {
      // Handle both single weeklyPlanId queries and array-based queries
      if (sql.includes("IN (")) {
        // For IN (?, ?, ...), sqlite binding passes one param per placeholder.
        // Also accept a single nested array for compatibility.
        const weeklyPlanIds = Array.isArray(params[0]) && params.length === 1
          ? (params[0] as unknown[])
          : params;
        const normalizedIds = weeklyPlanIds.map((value) => String(value));
        const matchingPlans = dailyLessonPlans.filter((plan) =>
          normalizedIds.includes(String(plan.weeklyPlanId))
        );
        return matchingPlans as T[];
      }
      const weeklyPlanId = String(params[0] ?? "");
      const matchingPlans = dailyLessonPlans.filter((plan) =>
        plan.weeklyPlanId === weeklyPlanId
      );
      return matchingPlans as T[];
    }

    // Query for class_plans by ids
    if (normalized.startsWith("select * from class_plans")) {
      return (classPlans as T[]) || [];
    }

    // Query for all planning_cycles by classId
    if (normalized.startsWith("select * from planning_cycles where classid =")) {
      const classId = String(params[0] ?? "");
      return planningCycles
        .filter((c) => c.classId === classId)
        .sort((a, b) => b.year - a.year) as T[];
    }

    return [] as T[];
  },
  runSync(sql: string, params: unknown[] = []) {
    const normalized = normalize(sql);
    if (normalized.startsWith("insert into classes")) {
      const row: ClassRow = {
        id: String(params[0] ?? ""),
        name: String(params[1] ?? ""),
        organizationId: String(params[11] ?? ""),
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
        painScore: params.length > 8 ? Number(params[8] ?? 0) : 0,
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
  async runAsync(sql: string, params: unknown[] = []) {
    // Handle planning operations on web (memory db)
    const normalized = normalize(sql);

    // Handle INSERT OR REPLACE into daily_lesson_plans
    if (normalized.startsWith("insert or replace into daily_lesson_plans")) {
      const plan = {
        id: String(params[0] ?? ""),
        classId: String(params[1] ?? ""),
        weeklyPlanId: String(params[2] ?? ""),
        date: String(params[3] ?? ""),
        dayOfWeek: Number(params[4] ?? 0),
        title: String(params[5] ?? ""),
        blocksJson: String(params[6] ?? "[]"),
        warmup: String(params[7] ?? ""),
        mainPart: String(params[8] ?? ""),
        cooldown: String(params[9] ?? ""),
        observations: String(params[10] ?? ""),
        generationVersion: Number(params[11] ?? 1),
        derivedFromWeeklyVersion: Number(params[12] ?? 1),
        generationModelVersion: String(params[13] ?? ""),
        generationContextSnapshotJson: String(params[14] ?? "{}"),
        syncStatus: String(params[15] ?? "in_sync"),
        outOfSyncReasonsJson: String(params[16] ?? "[]"),
        manualOverridesJson: String(params[17] ?? "{}"),
        manualOverrideMaskJson: String(params[18] ?? "[]"),
        lastAutoGeneratedAt: String(params[19] ?? ""),
        lastManualEditedAt: String(params[20] ?? ""),
        createdAt: String(params[21] ?? ""),
        updatedAt: String(params[22] ?? ""),
      };
      const idx = dailyLessonPlans.findIndex((p) => p.id === plan.id);
      if (idx !== -1) {
        dailyLessonPlans[idx] = plan;
      } else {
        dailyLessonPlans.push(plan);
      }
      return;
    }

    // Handle UPDATE daily_lesson_plans
    if (normalized.startsWith("update daily_lesson_plans")) {
      const weeklyPlanId = String(params[2] ?? "");
      const reason = String(params[0] ?? "");
      const updatedAt = String(params[1] ?? "");
      dailyLessonPlans.forEach((plan) => {
        if (plan.weeklyPlanId === weeklyPlanId) {
          plan.syncStatus = "out_of_sync";
          plan.outOfSyncReasonsJson = JSON.stringify([reason]);
          plan.updatedAt = updatedAt;
        }
      });
      return;
    }

    // Handle INSERT OR REPLACE into class_plans (weeklies)
    if (normalized.startsWith("insert or replace into class_plans")) {
      const plan = {
        id: String(params[0] ?? ""),
        classId: String(params[1] ?? ""),
        monthKey: String(params[2] ?? ""),
        weekNumber: Number(params[3] ?? 0),
        startDate: String(params[4] ?? ""),
        endDate: String(params[5] ?? ""),
        phase: String(params[6] ?? ""),
        generalObjective: String(params[7] ?? ""),
        theme: String(params[8] ?? ""),
        technicalFocus: String(params[9] ?? ""),
        pedagogicalRule: String(params[10] ?? ""),
        generationVersion: Number(params[11] ?? 1),
        derivedFromMonthlyVersion: Number(params[12] ?? 0),
        generationModelVersion: String(params[13] ?? ""),
        syncStatus: String(params[14] ?? "in_sync"),
        manualOverrideMaskJson: String(params[15] ?? "[]"),
        lastManualEditedAt: String(params[16] ?? ""),
        createdAt: String(params[17] ?? ""),
        updatedAt: String(params[18] ?? ""),
      };
      const idx = classPlans.findIndex((p) => p.id === plan.id);
      if (idx !== -1) {
        classPlans[idx] = plan;
      } else {
        classPlans.push(plan);
      }
      return;
    }

    // Handle INSERT OR REPLACE into monthly_planning_blueprints
    if (normalized.startsWith("insert or replace into monthly_planning_blueprints")) {
      const blueprint = {
        id: String(params[0] ?? ""),
        classId: String(params[1] ?? ""),
        monthKey: String(params[2] ?? ""),
        macroIntent: String(params[3] ?? ""),
        pedagogicalProgressionJson: String(params[4] ?? "[]"),
        generationVersion: Number(params[5] ?? 1),
        generationModelVersion: String(params[6] ?? ""),
        title: String(params[7] ?? ""),
        createdAt: String(params[8] ?? ""),
        updatedAt: String(params[9] ?? ""),
      };
      const idx = monthlyPlanningBlueprints.findIndex((bp) => bp.id === blueprint.id);
      if (idx !== -1) {
        monthlyPlanningBlueprints[idx] = blueprint;
      } else {
        monthlyPlanningBlueprints.push(blueprint);
      }
      return;
    }

    // Handle INSERT OR REPLACE into planning_cycles
    if (normalized.startsWith("insert or replace into planning_cycles")) {
      const cycle = {
        id: String(params[0] ?? ""),
        classId: String(params[1] ?? ""),
        year: Number(params[2] ?? 0),
        title: String(params[3] ?? ""),
        startDate: String(params[4] ?? ""),
        endDate: String(params[5] ?? ""),
        status: String(params[6] ?? "active"),
        createdAt: String(params[7] ?? ""),
        updatedAt: String(params[8] ?? ""),
      };
      const idx = planningCycles.findIndex((c) => c.id === cycle.id);
      if (idx !== -1) {
        planningCycles[idx] = cycle;
      } else {
        planningCycles.push(cycle);
      }
      return;
    }

    // Handle UPDATE planning_cycles (archive by id)
    if (normalized.startsWith("update planning_cycles set status = 'archived'")) {
      const updatedAt = String(params[0] ?? "");
      // Determine if filtering by id or by classId+status
      if (normalized.includes("where id =")) {
        const id = String(params[1] ?? "");
        planningCycles.forEach((c) => {
          if (c.id === id) { c.status = "archived"; c.updatedAt = updatedAt; }
        });
      } else {
        // Archive all active cycles for a classId
        const classId = String(params[1] ?? "");
        planningCycles.forEach((c) => {
          if (c.classId === classId && c.status === "active") {
            c.status = "archived";
            c.updatedAt = updatedAt;
          }
        });
      }
      return;
    }

    throw new Error("Unsupported SQL (web runAsync): " + sql);
  },
};

export function initDb() {
  // No-op on web; data is kept in memory.
}
