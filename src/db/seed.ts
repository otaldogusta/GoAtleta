import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../api/config";
import { getValidAccessToken } from "../auth/session";
import type {
  ClassGroup,
  SessionLog,
  TrainingPlan,
  TrainingTemplate,
  HiddenTemplate,
  Student,
  AttendanceRecord,
  Exercise,
  ClassPlan,
} from "../core/models";

const REST_BASE = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

const headers = async () => {
  const token = await getValidAccessToken();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
};

const supabaseGet = async <T>(path: string) => {
  const res = await fetch(REST_BASE + path, { headers: await headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase GET error: ${res.status} ${text}`);
  }
  return (await res.json()) as T;
};

const supabasePost = async <T>(path: string, body: unknown) => {
  const res = await fetch(REST_BASE + path, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase POST error: ${res.status} ${text}`);
  }
  const text = await res.text();
  if (!text) return [] as T;
  return JSON.parse(text) as T;
};

const supabasePatch = async <T>(path: string, body: unknown) => {
  const res = await fetch(REST_BASE + path, {
    method: "PATCH",
    headers: await headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase PATCH error: ${res.status} ${text}`);
  }
  const text = await res.text();
  if (!text) return [] as T;
  return JSON.parse(text) as T;
};

const supabaseDelete = async (path: string) => {
  const res = await fetch(REST_BASE + path, {
    method: "DELETE",
    headers: await headers(),
  });
  if (!res.ok) throw new Error(`Supabase DELETE error: ${res.status}`);
};

const isMissingRelation = (error: unknown, relation: string) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes(`relation "public.${relation}"`) ||
    message.includes(`relation \"public.${relation}\"`) ||
    message.includes("does not exist")
  );
};

const safeGetUnits = async (): Promise<UnitRow[]> => {
  try {
    return await supabaseGet<UnitRow[]>("/units?select=*&order=name.asc");
  } catch (error) {
    if (isMissingRelation(error, "units")) return [];
    throw error;
  }
};

const ensureUnit = async (
  unitName: string | undefined,
  cachedUnits?: UnitRow[]
): Promise<UnitRow | null> => {
  const name = unitName?.trim();
  if (!name) return null;
  const units = cachedUnits ?? (await safeGetUnits());
  const existing = units.find(
    (unit) => unit.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const createdId = "u_" + Date.now();
  try {
    const created = await supabasePost<UnitRow[]>("/units", [
      { id: createdId, name, createdat: now },
    ]);
    const row = created[0] ?? { id: createdId, name, createdat: now };
    units.push(row);
    return row;
  } catch (error) {
    if (isMissingRelation(error, "units")) return null;
    throw error;
  }
};

type ClassRow = {
  id: string;
  name: string;
  unit?: string;
  unit_id?: string | null;
  ageband: string;
  starttime?: string;
  endtime?: string | null;
  end_time?: string | null;
  duration?: number;
  days?: number[];
  daysperweek: number;
  goal: string;
  equipment: string;
  level: number;
  mv_level?: string | null;
  cycle_start_date?: string | null;
  cycle_length_weeks?: number | null;
  createdat?: string | null;
};

type UnitRow = {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  createdat: string;
};

type TrainingPlanRow = {
  id: string;
  classid: string;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  applydays?: number[];
  applydate?: string;
  createdat: string;
};

type TrainingTemplateRow = {
  id: string;
  title: string;
  ageband: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  createdat: string;
};

type HiddenTemplateRow = {
  id: string;
  templateid: string;
  createdat: string;
};

type StudentRow = {
  id: string;
  name: string;
  classid: string;
  age: number;
  phone: string;
  birthdate?: string | null;
  createdat: string;
};

type AttendanceRow = {
  id: string;
  classid: string;
  studentid: string;
  date: string;
  status: string;
  note: string;
  createdat: string;
};

type ClassPlanRow = {
  id: string;
  classid: string;
  startdate: string;
  weeknumber: number;
  phase: string;
  theme: string;
  technical_focus: string;
  physical_focus: string;
  constraints: string;
  mv_format: string;
  warmupprofile: string;
  ruleset?: string | null;
  jump_target?: string | null;
  rpe_target?: string | null;
  source: string;
  created_at?: string | null;
  updated_at?: string | null;
  createdat?: string | null;
  updatedat?: string | null;
};

type SessionLogRow = {
  id: string;
  classid: string;
  rpe: number;
  technique: string;
  attendance: number;
  pain_score?: number | null;
  createdat: string;
};

type ExerciseRow = {
  id: string;
  title: string;
  tags: string[];
  videourl: string;
  source: string;
  description: string;
  publishedat: string;
  notes: string;
  createdat: string;
};

export async function seedIfEmpty() {
  const existing = await supabaseGet<ClassRow[]>(
    "/classes?select=id&limit=1"
  );
  if (existing.length > 0) return;

  const unitsCache = await safeGetUnits();

  const nowIso = new Date().toISOString();
  const classes: ClassRow[] = [
    {
      id: "c1",
      name: "Turma 8-9",
      unit: "Rede Esperanca",
      ageband: "8-9",
      starttime: "14:00",
      end_time: computeEndTime("14:00", 60),
      duration: 60,
      days: [2, 4],
      daysperweek: 3,
      goal: "Fundamentos",
      equipment: "misto",
      level: 1,
      mv_level: "MV1",
      cycle_start_date: formatIsoDate(new Date()),
      cycle_length_weeks: 12,
      created_at: nowIso,
    },
    {
      id: "c2",
      name: "Turma 10-12",
      unit: "Rede Esperanca",
      ageband: "10-12",
      starttime: "15:00",
      end_time: computeEndTime("15:00", 60),
      duration: 60,
      days: [2, 4],
      daysperweek: 3,
      goal: "Forca Geral",
      equipment: "misto",
      level: 2,
      mv_level: "MV2",
      cycle_start_date: formatIsoDate(new Date()),
      cycle_length_weeks: 12,
      created_at: nowIso,
    },
    {
      id: "c3",
      name: "Turma 13-15",
      unit: "Rede Esportes Pinhais",
      ageband: "13-15",
      starttime: "14:00",
      end_time: computeEndTime("14:00", 60),
      duration: 60,
      days: [1, 3, 5],
      daysperweek: 3,
      goal: "Forca+Potencia",
      equipment: "misto",
      level: 2,
      mv_level: "MV3",
      cycle_start_date: formatIsoDate(new Date()),
      cycle_length_weeks: 12,
      created_at: nowIso,
    },
  ];

  for (const row of classes) {
    const unit = await ensureUnit(row.unit, unitsCache);
    if (unit) row.unit_id = unit.id;
  }

  await supabasePost("/classes", classes);
}

const calculateAge = (birthDate: string) => {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < date.getDate())
  ) {
    age -= 1;
  }
  return Math.max(age, 0);
};

const parseAgeBand = (value: string) => {
  const match = value.match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end };
};

const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const computeEndTime = (startTime?: string, duration?: number | null) => {
  if (!startTime) return null;
  const match = startTime.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const total = hours * 60 + minutes + (duration ?? 0);
  const endHour = Math.floor(total / 60) % 24;
  const endMinute = total % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
};

export async function seedStudentsIfEmpty() {
  const existing = await supabaseGet<StudentRow[]>(
    "/students?select=id&limit=1"
  );
  if (existing.length > 0) return;

  const classes = await getClasses();
  if (!classes.length) return;

  const firstNames = [
    "Gustavo",
    "Mariana",
    "Lucas",
    "Ana",
    "Pedro",
    "Beatriz",
    "Joao",
    "Julia",
    "Rafael",
    "Camila",
  ];
  const lastNames = [
    "Silva",
    "Souza",
    "Oliveira",
    "Pereira",
    "Costa",
    "Santos",
    "Almeida",
    "Ferreira",
    "Gomes",
    "Ribeiro",
  ];

  const rows: StudentRow[] = [];
  const nowIso = new Date().toISOString();
  const currentYear = new Date().getFullYear();

  for (let i = 0; i < 20; i += 1) {
    const cls = classes[i % classes.length];
    const band = parseAgeBand(cls.ageBand);
    const age =
      band ? Math.round((band.start + band.end) / 2) : 12 + (i % 5);
    const year = currentYear - age;
    const month = String((i % 12) + 1).padStart(2, "0");
    const day = String((i % 28) + 1).padStart(2, "0");
    const birthDate = `${year}-${month}-${day}`;
    const phone = `(41) 9${String(8000 + i).padStart(4, "0")}-${String(
      1000 + i
    ).padStart(4, "0")}`;
    const name =
      firstNames[i % firstNames.length] +
      " " +
      lastNames[i % lastNames.length];

    rows.push({
      id: "s_" + (Date.now() + i),
      name,
      classid: cls.id,
      age: calculateAge(birthDate),
      phone,
      birthdate: birthDate,
      createdat: nowIso,
    });
  }

  await supabasePost("/students", rows);
}

export async function getClasses(): Promise<ClassGroup[]> {
  const units = await safeGetUnits();
  const unitMap = new Map(units.map((unit) => [unit.id, unit.name]));
  const rows = await supabaseGet<ClassRow[]>("/classes?select=*&order=name.asc");
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    unit:
      row.unit ??
      (row.unit_id ? unitMap.get(row.unit_id) : undefined) ??
      "Sem unidade",
    unitId: row.unit_id ?? undefined,
    ageBand: row.ageband,
    startTime: row.starttime ?? "14:00",
    endTime:
      row.end_time ??
      row.endtime ??
      computeEndTime(row.starttime, row.duration ?? 60) ??
      undefined,
    durationMinutes: row.duration ?? 60,
    daysOfWeek:
      Array.isArray(row.days) && row.days.length
        ? row.days
        : row.daysperweek === 3
          ? [1, 3, 5]
          : [2, 4],
    daysPerWeek: row.daysperweek,
    goal: row.goal,
    equipment: row.equipment,
    level: row.level,
    mvLevel: row.mv_level ?? undefined,
    cycleStartDate: row.cycle_start_date ?? undefined,
    cycleLengthWeeks: row.cycle_length_weeks ?? undefined,
    createdAt: row.createdat ?? undefined,
  })).sort((a, b) => {
    const parseRange = (value?: string) => {
      const fallback = value ?? "";
      const match = fallback.match(/(\d+)\s*-\s*(\d+)/);
      if (match) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        return {
          start: Number.isFinite(start) ? start : Number.POSITIVE_INFINITY,
          end: Number.isFinite(end) ? end : Number.POSITIVE_INFINITY,
          label: fallback,
        };
      }
      const single = fallback.match(/(\d+)/);
      if (single) {
        const valueNum = Number(single[1]);
        return {
          start: Number.isFinite(valueNum) ? valueNum : Number.POSITIVE_INFINITY,
          end: Number.isFinite(valueNum) ? valueNum : Number.POSITIVE_INFINITY,
          label: fallback,
        };
      }
      return {
        start: Number.POSITIVE_INFINITY,
        end: Number.POSITIVE_INFINITY,
        label: fallback,
      };
    };
    const aRange = parseRange(a.ageBand || a.name);
    const bRange = parseRange(b.ageBand || b.name);
    if (aRange.start !== bRange.start) return aRange.start - bRange.start;
    if (aRange.end !== bRange.end) return aRange.end - bRange.end;
    return aRange.label.localeCompare(bRange.label);
  });
}

export async function getClassById(id: string): Promise<ClassGroup | null> {
  const units = await safeGetUnits();
  const unitMap = new Map(units.map((unit) => [unit.id, unit.name]));
  const rows = await supabaseGet<ClassRow[]>(
    "/classes?select=*&id=eq." + encodeURIComponent(id)
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    unit:
      row.unit ??
      (row.unit_id ? unitMap.get(row.unit_id) : undefined) ??
      "Sem unidade",
    unitId: row.unit_id ?? undefined,
    ageBand: row.ageband,
    startTime: row.starttime ?? "14:00",
    endTime:
      row.end_time ??
      row.endtime ??
      computeEndTime(row.starttime, row.duration ?? 60) ??
      undefined,
    durationMinutes: row.duration ?? 60,
    daysOfWeek:
      Array.isArray(row.days) && row.days.length
        ? row.days
        : row.daysperweek === 3
          ? [1, 3, 5]
          : [2, 4],
    daysPerWeek: row.daysperweek,
    goal: row.goal,
    equipment: row.equipment,
    level: row.level,
    mvLevel: row.mv_level ?? undefined,
    cycleStartDate: row.cycle_start_date ?? undefined,
    cycleLengthWeeks: row.cycle_length_weeks ?? undefined,
    createdAt: row.createdat ?? undefined,
  };
}

export async function updateClass(
  id: string,
  data: {
    name: string;
    unit: string;
    daysOfWeek: number[];
    goal: ClassGroup["goal"];
    ageBand: ClassGroup["ageBand"];
    startTime: string;
    durationMinutes: number;
    unitId?: string;
    mvLevel?: string;
    cycleStartDate?: string;
    cycleLengthWeeks?: number;
  }
) {
  const payload: Record<string, unknown> = {
    name: data.name,
    unit: data.unit,
    days: data.daysOfWeek,
    goal: data.goal,
    ageband: data.ageBand,
    starttime: data.startTime,
    end_time: computeEndTime(data.startTime, data.durationMinutes),
    duration: data.durationMinutes,
  };

  const resolvedUnit =
    data.unitId ??
    (await ensureUnit(data.unit))?.id ??
    undefined;
  if (resolvedUnit) payload.unit_id = resolvedUnit;
  if (data.mvLevel) payload.mv_level = data.mvLevel;
  if (data.cycleStartDate) payload.cycle_start_date = data.cycleStartDate;
  if (typeof data.cycleLengthWeeks === "number") {
    payload.cycle_length_weeks = data.cycleLengthWeeks;
  }

  await supabasePatch("/classes?id=eq." + encodeURIComponent(id), payload);
}

export async function saveClass(data: {
  name: string;
  unit: string;
  ageBand: ClassGroup["ageBand"];
  daysOfWeek: number[];
  goal: ClassGroup["goal"];
  startTime: string;
  durationMinutes: number;
  unitId?: string;
  mvLevel?: string;
  cycleStartDate?: string;
  cycleLengthWeeks?: number;
}) {
  const resolvedUnit =
    data.unitId ??
    (await ensureUnit(data.unit))?.id ??
    undefined;
  await supabasePost("/classes", [
    {
      id: "c_" + Date.now(),
      name: data.name,
      unit: data.unit,
      unit_id: resolvedUnit,
      ageband: data.ageBand,
      starttime: data.startTime,
      end_time: computeEndTime(data.startTime, data.durationMinutes),
      duration: data.durationMinutes,
      days: data.daysOfWeek,
      daysperweek: data.daysOfWeek.length,
      goal: data.goal,
      equipment: "misto",
      level: 1,
      mv_level: data.mvLevel,
      cycle_start_date: data.cycleStartDate,
      cycle_length_weeks: data.cycleLengthWeeks,
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function duplicateClass(base: ClassGroup) {
  const resolvedUnit =
    base.unitId ??
    (await ensureUnit(base.unit))?.id ??
    undefined;
  await supabasePost("/classes", [
    {
      id: "c_" + Date.now(),
      name: base.name + " (copia)",
      unit: base.unit,
      unit_id: resolvedUnit,
      ageband: base.ageBand,
      starttime: base.startTime,
      end_time: computeEndTime(base.startTime, base.durationMinutes),
      duration: base.durationMinutes,
      days: base.daysOfWeek,
      daysperweek: base.daysOfWeek.length,
      goal: base.goal,
      equipment: base.equipment,
      level: base.level,
      mv_level: base.mvLevel,
      cycle_start_date: base.cycleStartDate,
      cycle_length_weeks: base.cycleLengthWeeks,
      created_at: new Date().toISOString(),
    },
  ]);
}

export async function deleteClass(id: string) {
  await supabaseDelete("/classes?id=eq." + encodeURIComponent(id));
}

export async function deleteClassCascade(id: string) {
  await supabaseDelete(
    "/training_plans?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete(
    "/class_plans?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete(
    "/attendance_logs?classid=eq." + encodeURIComponent(id)
  );
  await supabaseDelete("/students?classid=eq." + encodeURIComponent(id));
  await supabaseDelete(
    "/session_logs?classid=eq." + encodeURIComponent(id)
  );
  await deleteClass(id);
}

export async function saveSessionLog(log: SessionLog) {
  await supabasePost("/session_logs", [
    {
      id: "log_" + Date.now(),
      classid: log.classId,
      rpe: log.rpe,
      technique: log.technique,
      attendance: log.attendance,
      pain_score: log.painScore ?? null,
      createdat: log.createdAt,
    },
  ]);
}

export async function getSessionLogByDate(
  classId: string,
  date: string
): Promise<SessionLog | null> {
  const start = `${date}T00:00:00.000Z`;
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const rows = await supabaseGet<SessionLogRow[]>(
    "/session_logs?select=*&classid=eq." +
      encodeURIComponent(classId) +
      "&createdat=gte." +
      encodeURIComponent(start) +
      "&createdat=lt." +
      encodeURIComponent(end.toISOString()) +
      "&order=createdat.desc&limit=1"
  );
  const row = rows[0];
  if (!row) return null;
  return {
    classId: row.classid,
    rpe: row.rpe,
    technique: row.technique === "ruim" ? "ruim" : row.technique === "ok" ? "ok" : "boa",
    attendance: row.attendance,
    painScore: row.pain_score ?? undefined,
    createdAt: row.createdat,
  };
}

export async function getSessionLogsByRange(
  startIso: string,
  endIso: string
): Promise<SessionLog[]> {
  const rows = await supabaseGet<SessionLogRow[]>(
    "/session_logs?select=*&createdat=gte." +
      encodeURIComponent(startIso) +
      "&createdat=lt." +
      encodeURIComponent(endIso)
  );
  return rows.map((row) => ({
    classId: row.classid,
    rpe: row.rpe,
    technique: row.technique === "ruim" ? "ruim" : row.technique === "ok" ? "ok" : "boa",
    attendance: row.attendance,
    painScore: row.pain_score ?? undefined,
    createdAt: row.createdat,
  }));
}

export async function getTrainingPlans(): Promise<TrainingPlan[]> {
  const rows = await supabaseGet<TrainingPlanRow[]>(
    "/training_plans?select=*&order=createdat.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    title: row.title,
    tags: row.tags ?? [],
    warmup: row.warmup ?? [],
    main: row.main ?? [],
    cooldown: row.cooldown ?? [],
    warmupTime: row.warmuptime ?? "",
    mainTime: row.maintime ?? "",
    cooldownTime: row.cooldowntime ?? "",
    applyDays: row.applydays ?? [],
    applyDate: row.applydate ?? "",
    createdAt: row.createdat,
  }));
}

export async function saveTrainingPlan(plan: TrainingPlan) {
  await supabasePost("/training_plans", [
    {
      id: plan.id,
      classid: plan.classId,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    },
  ]);
}

export async function updateTrainingPlan(plan: TrainingPlan) {
  await supabasePatch(
    "/training_plans?id=eq." + encodeURIComponent(plan.id),
    {
      classid: plan.classId,
      title: plan.title,
      tags: plan.tags ?? [],
      warmup: plan.warmup,
      main: plan.main,
      cooldown: plan.cooldown,
      warmuptime: plan.warmupTime,
      maintime: plan.mainTime,
      cooldowntime: plan.cooldownTime,
      applydays: plan.applyDays ?? [],
      applydate: plan.applyDate ? plan.applyDate : null,
      createdat: plan.createdAt,
    }
  );
}

export async function deleteTrainingPlan(id: string) {
  await supabaseDelete(
    "/training_plans?id=eq." + encodeURIComponent(id)
  );
}

export async function getClassPlansByClass(
  classId: string
): Promise<ClassPlan[]> {
  try {
    const rows = await supabaseGet<ClassPlanRow[]>(
      "/class_plans?select=*&classid=eq." +
        encodeURIComponent(classId) +
        "&order=weeknumber.asc"
    );
    return rows.map((row) => ({
      id: row.id,
      classId: row.classid,
      startDate: row.startdate,
      weekNumber: row.weeknumber,
      phase: row.phase,
      theme: row.theme,
      technicalFocus: row.technical_focus ?? "",
      physicalFocus: row.physical_focus ?? "",
      constraints: row.constraints ?? row.ruleset ?? "",
      mvFormat: row.mv_format ?? "",
      warmupProfile: row.warmupprofile ?? "",
      jumpTarget: row.jump_target ?? "",
      rpeTarget: row.rpe_target ?? "",
      source: row.source === "MANUAL" ? "MANUAL" : "AUTO",
      createdAt: row.created_at ?? row.createdat ?? new Date().toISOString(),
      updatedAt: row.updated_at ?? row.updatedat ?? undefined,
    }));
  } catch (error) {
    if (isMissingRelation(error, "class_plans")) return [];
    throw error;
  }
}

export async function createClassPlan(plan: ClassPlan) {
  try {
    await saveClassPlans([plan]);
  } catch (error) {
    if (error instanceof Error && error.message.includes("23505")) {
      const existing = await getClassPlansByClass(plan.classId);
      const match = existing.find((item) => item.weekNumber === plan.weekNumber);
      if (match) {
        await updateClassPlan({ ...plan, id: match.id, createdAt: match.createdAt });
        return;
      }
    }
    throw error;
  }
}

export async function updateClassPlan(plan: ClassPlan) {
  await supabasePatch(
    "/class_plans?id=eq." + encodeURIComponent(plan.id),
    {
      classid: plan.classId,
      startdate: plan.startDate,
      weeknumber: plan.weekNumber,
      phase: plan.phase,
      theme: plan.theme,
      technical_focus: plan.technicalFocus,
      physical_focus: plan.physicalFocus,
      constraints: plan.constraints,
      ruleset: plan.constraints,
      mv_format: plan.mvFormat,
      warmupprofile: plan.warmupProfile,
      source: plan.source,
      jump_target: plan.jumpTarget,
      rpe_target: plan.rpeTarget,
      created_at: plan.createdAt,
      updated_at: plan.updatedAt ?? plan.createdAt,
    }
  );
}

export async function saveClassPlans(plans: ClassPlan[]) {
  if (!plans.length) return;
  await supabasePost("/class_plans", plans.map((plan) => ({
    id: plan.id,
    classid: plan.classId,
    startdate: plan.startDate,
    weeknumber: plan.weekNumber,
    phase: plan.phase,
    theme: plan.theme,
    technical_focus: plan.technicalFocus,
    physical_focus: plan.physicalFocus,
    constraints: plan.constraints,
    ruleset: plan.constraints,
    mv_format: plan.mvFormat,
    warmupprofile: plan.warmupProfile,
    source: plan.source,
    jump_target: plan.jumpTarget,
    rpe_target: plan.rpeTarget,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt ?? plan.createdAt,
  })));
}

export async function deleteClassPlansByClass(classId: string) {
  await supabaseDelete(
    "/class_plans?classid=eq." + encodeURIComponent(classId)
  );
}

export async function getExercises(): Promise<Exercise[]> {
  const rows = await supabaseGet<ExerciseRow[]>(
    "/exercises?select=*&order=createdat.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    tags: row.tags ?? [],
    videoUrl: row.videourl ?? "",
    source: row.source ?? "",
    description: row.description ?? "",
    publishedAt: row.publishedat ?? "",
    notes: row.notes ?? "",
    createdAt: row.createdat,
  }));
}

export async function saveExercise(exercise: Exercise) {
  await supabasePost("/exercises", [
    {
      id: exercise.id,
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    },
  ]);
}

export async function updateExercise(exercise: Exercise) {
  await supabasePatch(
    "/exercises?id=eq." + encodeURIComponent(exercise.id),
    {
      title: exercise.title,
      tags: exercise.tags ?? [],
      videourl: exercise.videoUrl ?? "",
      source: exercise.source ?? "",
      description: exercise.description ?? "",
      publishedat: exercise.publishedAt ?? "",
      notes: exercise.notes ?? "",
      createdat: exercise.createdAt,
    }
  );
}

export async function deleteExercise(id: string) {
  await supabaseDelete(
    "/exercises?id=eq." + encodeURIComponent(id)
  );
}

export async function getTrainingTemplates(): Promise<TrainingTemplate[]> {
  const rows = await supabaseGet<TrainingTemplateRow[]>(
    "/training_templates?select=*&order=createdat.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    ageBand: row.ageband,
    tags: row.tags ?? [],
    warmup: row.warmup ?? [],
    main: row.main ?? [],
    cooldown: row.cooldown ?? [],
    warmupTime: row.warmuptime ?? "",
    mainTime: row.maintime ?? "",
    cooldownTime: row.cooldowntime ?? "",
    createdAt: row.createdat,
  }));
}

export async function saveTrainingTemplate(
  template: TrainingTemplate
) {
  await supabasePost("/training_templates", [
    {
      id: template.id,
      title: template.title,
      ageband: template.ageBand,
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    },
  ]);
}

export async function updateTrainingTemplate(
  template: TrainingTemplate
) {
  await supabasePatch(
    "/training_templates?id=eq." + encodeURIComponent(template.id),
    {
      title: template.title,
      ageband: template.ageBand,
      tags: template.tags ?? [],
      warmup: template.warmup,
      main: template.main,
      cooldown: template.cooldown,
      warmuptime: template.warmupTime,
      maintime: template.mainTime,
      cooldowntime: template.cooldownTime,
      createdat: template.createdAt,
    }
  );
}

export async function deleteTrainingTemplate(id: string) {
  await supabaseDelete(
    "/training_templates?id=eq." + encodeURIComponent(id)
  );
}

export async function getHiddenTemplates(): Promise<HiddenTemplate[]> {
  const rows = await supabaseGet<HiddenTemplateRow[]>(
    "/training_template_hides?select=*"
  );
  return rows.map((row) => ({
    id: row.id,
    templateId: row.templateid,
    createdAt: row.createdat,
  }));
}

export async function hideTrainingTemplate(templateId: string) {
  await supabasePost("/training_template_hides", [
    {
      id: "hide_" + Date.now(),
      templateid: templateId,
      createdat: new Date().toISOString(),
    },
  ]);
}

export async function getLatestTrainingPlanByClass(
  classId: string
): Promise<TrainingPlan | null> {
  const rows = await supabaseGet<TrainingPlanRow[]>(
    "/training_plans?select=*&classid=eq." +
      encodeURIComponent(classId) +
      "&order=createdat.desc&limit=1"
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    classId: row.classid,
    title: row.title,
    tags: row.tags ?? [],
    warmup: row.warmup ?? [],
    main: row.main ?? [],
    cooldown: row.cooldown ?? [],
    warmupTime: row.warmuptime ?? "",
    mainTime: row.maintime ?? "",
    cooldownTime: row.cooldowntime ?? "",
    applyDays: row.applydays ?? [],
    applyDate: row.applydate ?? "",
    createdAt: row.createdat,
  };
}

export async function getStudents(): Promise<Student[]> {
  const rows = await supabaseGet<StudentRow[]>(
    "/students?select=*&order=name.asc"
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    classId: row.classid,
    age: row.age,
    phone: row.phone,
    birthDate: row.birthdate ?? "",
    createdAt: row.createdat,
  }));
}

export async function getStudentsByClass(classId: string): Promise<Student[]> {
  const rows = await supabaseGet<StudentRow[]>(
    "/students?select=*&classid=eq." + encodeURIComponent(classId) + "&order=name.asc"
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    classId: row.classid,
    age: row.age,
    phone: row.phone,
    birthDate: row.birthdate ?? "",
    createdAt: row.createdat,
  }));
}

export async function getStudentById(id: string): Promise<Student | null> {
  const rows = await supabaseGet<StudentRow[]>(
    "/students?select=*&id=eq." + encodeURIComponent(id)
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    classId: row.classid,
    age: row.age,
    phone: row.phone,
    birthDate: row.birthdate ?? "",
    createdAt: row.createdat,
  };
}

export async function saveStudent(student: Student) {
  await supabasePost("/students", [
    {
      id: student.id,
      name: student.name,
      classid: student.classId,
      age: student.age,
      phone: student.phone,
      birthdate: student.birthDate ? student.birthDate : null,
      createdat: student.createdAt,
    },
  ]);
}

export async function updateStudent(student: Student) {
  await supabasePatch(
    "/students?id=eq." + encodeURIComponent(student.id),
    {
      name: student.name,
      classid: student.classId,
      age: student.age,
      phone: student.phone,
      birthdate: student.birthDate ? student.birthDate : null,
      createdat: student.createdAt,
    }
  );
}

export async function deleteStudent(id: string) {
  await supabaseDelete("/students?id=eq." + encodeURIComponent(id));
}

export async function saveAttendanceRecords(
  classId: string,
  date: string,
  records: AttendanceRecord[]
) {
  await supabaseDelete(
    "/attendance_logs?classid=eq." +
      encodeURIComponent(classId) +
      "&date=eq." +
      encodeURIComponent(date)
  );

  const rows: AttendanceRow[] = records.map((record) => ({
    id: record.id,
    classid: record.classId,
    studentid: record.studentId,
    date: record.date,
    status: record.status,
    note: record.note,
    createdat: record.createdAt,
  }));

  await supabasePost("/attendance_logs", rows);
}

export async function getAttendanceByClass(
  classId: string
): Promise<AttendanceRecord[]> {
  const rows = await supabaseGet<AttendanceRow[]>(
    "/attendance_logs?select=*&classid=eq." +
      encodeURIComponent(classId) +
      "&order=date.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    createdAt: row.createdat,
  }));
}

export async function getAttendanceByDate(
  classId: string,
  date: string
): Promise<AttendanceRecord[]> {
  const rows = await supabaseGet<AttendanceRow[]>(
    "/attendance_logs?select=*&classid=eq." +
      encodeURIComponent(classId) +
      "&date=eq." +
      encodeURIComponent(date)
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    createdAt: row.createdat,
  }));
}

export async function getAttendanceByStudent(
  studentId: string
): Promise<AttendanceRecord[]> {
  const rows = await supabaseGet<AttendanceRow[]>(
    "/attendance_logs?select=*&studentid=eq." +
      encodeURIComponent(studentId) +
      "&order=date.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    createdAt: row.createdat,
  }));
}

export async function getAttendanceAll(): Promise<AttendanceRecord[]> {
  const rows = await supabaseGet<AttendanceRow[]>(
    "/attendance_logs?select=*&order=date.desc"
  );
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    studentId: row.studentid,
    date: row.date,
    status: row.status === "faltou" ? "faltou" : "presente",
    note: row.note ?? "",
    createdAt: row.createdat,
  }));
}
