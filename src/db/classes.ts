// ---------------------------------------------------------------------------
// Classes (turmas) + seed helpers
// ---------------------------------------------------------------------------

import * as Sentry from "@sentry/react-native";
import { normalizeAgeBand, parseAgeBandRange } from "../core/age-band";
import { resolveClassModality } from "../core/class-modality";
import type { ClassGroup } from "../core/models";
import { canonicalizeUnitLabel } from "../core/unit-label";
import { sortClassesBySchedule } from "../core/class-schedule-sort";
import { normalizeUnitKey } from "../core/unit-key";
import { getSessionUserId } from "../auth/session";
import {
  getActiveOrganizationId,
  getScopedOrganizationId,
  isAuthError,
  isMissingRelation,
  isNetworkError,
  isPermissionError,
  CACHE_KEYS,
  readCache,
  writeCache,
  supabaseGet,
  supabasePost,
  supabasePatch,
  supabaseDelete,
} from "./client";
import type { ClassRow, UnitRow } from "./row-types";
import {
  deleteTrainingIntegrationRuleBySession,
  syncTrainingIntegrationRuleFromSession,
} from "./training-sessions";

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

const buildClassesCacheKey = (organizationId: string | null) =>
  organizationId ? `${CACHE_KEYS.classes}_${organizationId}` : CACHE_KEYS.classes;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const calculateAge = (birthDate: string) => {
  const date = new Date(birthDate);
  if (Number.isNaN(date.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return Math.max(age, 0);
};

const parseAgeBand = (value: string) => {
  const range = parseAgeBandRange(value);
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) return null;
  return { start: range.start, end: range.end };
};

export const formatIsoDate = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const computeEndTime = (startTime?: string, duration?: number | null) => {
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

export const safeGetUnits = async (): Promise<UnitRow[]> => {
  try {
    return await supabaseGet<UnitRow[]>("/units?select=*&order=name.asc");
  } catch (error) {
    if (isMissingRelation(error, "units")) return [];
    if (isAuthError(error)) return [];
    throw error;
  }
};

export const ensureUnit = async (
  unitName: string | undefined,
  cachedUnits?: UnitRow[]
): Promise<UnitRow | null> => {
  const name = canonicalizeUnitLabel(unitName ?? null);
  if (!name) return null;
  const units = cachedUnits ?? (await safeGetUnits());
  const targetKey = normalizeUnitKey(name);
  const existing = units.find((unit) => normalizeUnitKey(unit.name) === targetKey);
  if (existing) {
    if (existing.name !== name) {
      try {
        await supabasePatch("/units?id=eq." + encodeURIComponent(existing.id), { name });
        existing.name = name;
      } catch {
        // ignore rename failures
      }
    }
    return existing;
  }
  const now = new Date().toISOString();
  const createdId = "u_" + Date.now();
  try {
    const created = await supabasePost<UnitRow[]>("/units", [{ id: createdId, name, createdat: now }]);
    if (!created[0]) return null;
    const row = { id: createdId, name, createdat: now };
    units.push(row);
    return row;
  } catch (error) {
    if (isMissingRelation(error, "units")) return null;
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedIfEmpty() {
  if (!(await getSessionUserId())) return;
  try {
    const activeOrganizationId = await getActiveOrganizationId();
    const existing = await supabaseGet<ClassRow[]>(
      activeOrganizationId
        ? "/classes?select=id&organization_id=eq." + encodeURIComponent(activeOrganizationId) + "&limit=1"
        : "/classes?select=id&limit=1"
    );
    if (existing.length > 0) return;

    const unitsCache = await safeGetUnits();
    const nowIso = new Date().toISOString();
    const classes: ClassRow[] = [
      { id: "c_re_f_8_11", name: "Feminino (8-11)", unit: "Rede Esperana", modality: "voleibol", ageband: "08-11", gender: "feminino", starttime: "14:00", end_time: computeEndTime("14:00", 60), duration: 60, days: [2, 4], daysperweek: 2, goal: "Fundamentos + jogo reduzido", equipment: "quadra", level: 1, mv_level: "MV1", cycle_start_date: formatIsoDate(new Date()), cycle_length_weeks: 4, created_at: nowIso },
      { id: "c_re_m_8_11", name: "Masculino (8-11)", unit: "Rede Esperana", modality: "voleibol", ageband: "08-11", gender: "masculino", starttime: "15:30", end_time: computeEndTime("15:30", 60), duration: 60, days: [2, 4], daysperweek: 2, goal: "Fundamentos + jogo reduzido", equipment: "quadra", level: 1, mv_level: "MV1", cycle_start_date: formatIsoDate(new Date()), cycle_length_weeks: 4, created_at: nowIso },
      { id: "c_rp_6_8", name: "6-8 anos", unit: "Rede Esportes Pinhais", modality: "voleibol", ageband: "06-08", gender: "misto", starttime: "09:00", end_time: computeEndTime("09:00", 60), duration: 60, days: [6], daysperweek: 1, goal: "Coordenação + bola + jogo", equipment: "quadra", level: 1, mv_level: "MV1", cycle_start_date: formatIsoDate(new Date()), cycle_length_weeks: 4, created_at: nowIso },
      { id: "c_rp_9_11", name: "9-11 anos", unit: "Rede Esportes Pinhais", modality: "voleibol", ageband: "09-11", gender: "misto", starttime: "10:00", end_time: computeEndTime("10:00", 60), duration: 60, days: [6], daysperweek: 1, goal: "Fundamentos + continuidade", equipment: "quadra", level: 1, mv_level: "MV1", cycle_start_date: formatIsoDate(new Date()), cycle_length_weeks: 4, created_at: nowIso },
      { id: "c_rp_12_14", name: "12-14 anos", unit: "Rede Esportes Pinhais", modality: "voleibol", ageband: "12-14", gender: "misto", starttime: "11:00", end_time: computeEndTime("11:00", 60), duration: 60, days: [6], daysperweek: 1, goal: "Fundamentos + jogo + ataque progressivo", equipment: "quadra", level: 2, mv_level: "MV2", cycle_start_date: formatIsoDate(new Date()), cycle_length_weeks: 4, created_at: nowIso },
    ];

    if (activeOrganizationId) {
      for (const row of classes) row.organization_id = activeOrganizationId;
    }
    for (const row of classes) {
      const unit = await ensureUnit(row.unit, unitsCache);
      if (unit) row.unit_id = unit.id;
    }
    await supabasePost("/classes", classes);
  } catch (error) {
    if (isAuthError(error) || isPermissionError(error)) return;
    throw error;
  }
}

export async function seedStudentsIfEmpty() {
  if (!(await getSessionUserId())) return;
  try {
    const activeOrganizationId = await getActiveOrganizationId();
    const existing = await supabaseGet<{ id: string }[]>(
      activeOrganizationId
        ? "/students?select=id&organization_id=eq." + encodeURIComponent(activeOrganizationId) + "&limit=1"
        : "/students?select=id&limit=1"
    );
    if (existing.length > 0) return;

    const classes = await getClasses({ organizationId: activeOrganizationId });
    if (!classes.length) return;

    const firstNames = ["Gustavo","Mariana","Lucas","Ana","Pedro","Beatriz","Joao","Julia","Rafael","Camila"];
    const lastNames = ["Silva","Souza","Oliveira","Pereira","Costa","Santos","Almeida","Ferreira","Gomes","Ribeiro"];
    const rows = [];
    const nowIso = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    for (let i = 0; i < 20; i += 1) {
      const cls = classes[i % classes.length];
      const band = parseAgeBand(cls.ageBand);
      const age = band ? Math.round((band.start + band.end) / 2) : 12 + (i % 5);
      const year = currentYear - age;
      const month = String((i % 12) + 1).padStart(2, "0");
      const day = String((i % 28) + 1).padStart(2, "0");
      const birthDate = `${year}-${month}-${day}`;
      rows.push({
        id: "s_" + (Date.now() + i),
        name: firstNames[i % firstNames.length] + " " + lastNames[i % lastNames.length],
        classid: cls.id,
        age: calculateAge(birthDate),
        phone: `(41) 9${String(8000 + i).padStart(4, "0")}-${String(1000 + i).padStart(4, "0")}`,
        birthdate: birthDate,
        createdat: nowIso,
      });
    }
    await supabasePost("/students", rows);
  } catch (error) {
    if (isAuthError(error) || isPermissionError(error)) return;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getClasses(options: { organizationId?: string | null } = {}): Promise<ClassGroup[]> {
  const startedAt = Date.now();
  try {
    const units = await safeGetUnits();
    const unitMap = new Map(units.map((unit) => [unit.id, canonicalizeUnitLabel(unit.name)]));
    const activeOrganizationId = await getScopedOrganizationId(options.organizationId, "getClasses");
    if (!activeOrganizationId) return [];
    const cacheKey = buildClassesCacheKey(activeOrganizationId);
    const rows = await supabaseGet<ClassRow[]>(`/classes?select=*&organization_id=eq.${encodeURIComponent(activeOrganizationId)}&order=name.asc`);
    const mapped = sortClassesBySchedule(rows.map((row) => {
      const unitFromId = row.unit_id ? unitMap.get(row.unit_id) : undefined;
      const unitLabel = canonicalizeUnitLabel(unitFromId ?? row.unit ?? null) ?? canonicalizeUnitLabel(row.unit ?? "") ?? "Sem unidade";
      const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
      const resolvedStartTime = row.starttime ?? "14:00";
      const resolvedEndTime = row.end_time ?? row.endtime ?? computeEndTime(row.starttime, row.duration ?? 60) ?? computeEndTime(resolvedStartTime, row.duration ?? 60) ?? resolvedStartTime;
      const resolvedEquipment: ClassGroup["equipment"] = row.equipment === "quadra" || row.equipment === "funcional" || row.equipment === "academia" || row.equipment === "misto" ? row.equipment : "misto";
      const resolvedModality: ClassGroup["modality"] = resolveClassModality(row.modality) ?? "fitness";
      const resolvedGender: ClassGroup["gender"] = row.gender === "masculino" || row.gender === "feminino" ? row.gender : "misto";
      const resolvedLevel: ClassGroup["level"] = row.level === 2 || row.level === 3 ? row.level : 1;
      return {
        id: row.id, name: row.name, organizationId: resolvedOrganizationId, unit: unitLabel, unitId: row.unit_id ?? "",
        colorKey: row.color_key ?? "", modality: resolvedModality, ageBand: normalizeAgeBand(row.ageband),
        gender: resolvedGender, startTime: resolvedStartTime, endTime: resolvedEndTime, durationMinutes: row.duration ?? 60,
        daysOfWeek: Array.isArray(row.days) && row.days.length ? row.days : row.daysperweek === 3 ? [1, 3, 5] : [2, 4],
        daysPerWeek: row.daysperweek, goal: row.goal, equipment: resolvedEquipment, level: resolvedLevel,
        mvLevel: row.mv_level ?? "", cycleStartDate: row.cycle_start_date ?? "", cycleLengthWeeks: row.cycle_length_weeks ?? 0,
        acwrLow: row.acwr_low ?? 0.8, acwrHigh: row.acwr_high ?? 1.3, createdAt: row.createdat ?? row.created_at ?? new Date().toISOString(),
      };
    }));
    await writeCache(cacheKey, mapped);
    Sentry.addBreadcrumb({ category: "sqlite-query", message: "getClasses", level: "info", data: { ms: Date.now() - startedAt, rows: mapped.length } });
    return mapped;
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const activeOrganizationId = options.organizationId ?? (await getActiveOrganizationId());
      const cached = await readCache<ClassGroup[]>(buildClassesCacheKey(activeOrganizationId ?? null));
      return cached ?? [];
    }
    throw error;
  }
}

export async function getClassById(id: string, options: { organizationId?: string | null } = {}): Promise<ClassGroup | null> {
  const activeOrganizationId = options.organizationId ?? (await getActiveOrganizationId());
  try {
    const units = await safeGetUnits();
    const unitMap = new Map(units.map((unit) => [unit.id, canonicalizeUnitLabel(unit.name)]));
    const rows = await supabaseGet<ClassRow[]>(
      activeOrganizationId
        ? "/classes?select=*&id=eq." + encodeURIComponent(id) + "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
        : "/classes?select=*&id=eq." + encodeURIComponent(id)
    );
    const row = rows[0];
    if (!row) return null;
    const resolvedOrganizationId = row.organization_id ?? activeOrganizationId ?? "";
    return {
      id: row.id, name: row.name, organizationId: resolvedOrganizationId,
      unit: (row.unit_id ? unitMap.get(row.unit_id) : undefined) ?? canonicalizeUnitLabel(row.unit ?? null) ?? "Sem unidade",
      unitId: row.unit_id ?? "", colorKey: row.color_key ?? "",
      modality: resolveClassModality(row.modality) ?? "fitness",
      ageBand: normalizeAgeBand(row.ageband),
      gender: row.gender === "masculino" || row.gender === "feminino" ? row.gender : "misto",
      startTime: row.starttime ?? "14:00",
      endTime: row.end_time ?? row.endtime ?? computeEndTime(row.starttime, row.duration ?? 60) ?? (row.starttime ?? "14:00"),
      durationMinutes: row.duration ?? 60,
      daysOfWeek: Array.isArray(row.days) && row.days.length ? row.days : row.daysperweek === 3 ? [1, 3, 5] : [2, 4],
      daysPerWeek: row.daysperweek, goal: row.goal,
      equipment: row.equipment === "quadra" || row.equipment === "funcional" || row.equipment === "academia" || row.equipment === "misto" ? row.equipment : "misto",
      level: row.level === 2 || row.level === 3 ? row.level : 1,
      mvLevel: row.mv_level ?? "", cycleStartDate: row.cycle_start_date ?? "", cycleLengthWeeks: row.cycle_length_weeks ?? 0,
      acwrLow: row.acwr_low ?? 0.8, acwrHigh: row.acwr_high ?? 1.3, createdAt: row.createdat ?? row.created_at ?? new Date().toISOString(),
    };
  } catch (error) {
    if (isNetworkError(error) || isAuthError(error)) {
      const classes = await getClasses({ organizationId: activeOrganizationId });
      return classes.find((item) => item.id === id) ?? null;
    }
    throw error;
  }
}

export async function updateClass(id: string, data: { name: string; unit: string; daysOfWeek: number[]; goal: ClassGroup["goal"]; ageBand: ClassGroup["ageBand"]; gender: ClassGroup["gender"]; modality?: ClassGroup["modality"]; startTime: string; durationMinutes: number; unitId?: string; mvLevel?: string; colorKey?: string | null; cycleStartDate?: string; cycleLengthWeeks?: number; acwrLow?: number; acwrHigh?: number }) {
  const activeOrganizationId = await getActiveOrganizationId();
  const resolvedUnitRow = data.unitId ? { id: data.unitId, name: data.unit } : await ensureUnit(data.unit);
  const payload: Record<string, unknown> = {
    name: data.name, unit: resolvedUnitRow?.name ?? data.unit, days: data.daysOfWeek, goal: data.goal,
    ageband: normalizeAgeBand(data.ageBand), gender: data.gender, starttime: data.startTime,
    end_time: computeEndTime(data.startTime, data.durationMinutes), duration: data.durationMinutes,
  };
  if (data.modality) payload.modality = data.modality;
  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  if (resolvedUnit) payload.unit_id = resolvedUnit;
  if (data.colorKey !== undefined) payload.color_key = data.colorKey || null;
  if (data.mvLevel) payload.mv_level = data.mvLevel;
  if (data.cycleStartDate) payload.cycle_start_date = data.cycleStartDate;
  if (typeof data.cycleLengthWeeks === "number") payload.cycle_length_weeks = data.cycleLengthWeeks;
  if (typeof data.acwrLow === "number") payload.acwr_low = data.acwrLow;
  if (typeof data.acwrHigh === "number") payload.acwr_high = data.acwrHigh;
  await supabasePatch(
    activeOrganizationId ? "/classes?id=eq." + encodeURIComponent(id) + "&organization_id=eq." + encodeURIComponent(activeOrganizationId) : "/classes?id=eq." + encodeURIComponent(id),
    payload
  );
}

export async function updateClassColor(id: string, colorKey?: string | null) {
  const activeOrganizationId = await getActiveOrganizationId();
  await supabasePatch(
    activeOrganizationId ? "/classes?id=eq." + encodeURIComponent(id) + "&organization_id=eq." + encodeURIComponent(activeOrganizationId) : "/classes?id=eq." + encodeURIComponent(id),
    { color_key: colorKey ?? null }
  );
}

export async function updateClassAcwrLimits(id: string, limits: { low: number; high: number }) {
  const activeOrganizationId = await getActiveOrganizationId();
  await supabasePatch(
    activeOrganizationId ? "/classes?id=eq." + encodeURIComponent(id) + "&organization_id=eq." + encodeURIComponent(activeOrganizationId) : "/classes?id=eq." + encodeURIComponent(id),
    { acwr_low: limits.low, acwr_high: limits.high }
  );
}

export async function saveClass(data: { name: string; unit: string; ageBand: ClassGroup["ageBand"]; daysOfWeek: number[]; goal: ClassGroup["goal"]; gender: ClassGroup["gender"]; modality?: ClassGroup["modality"]; startTime: string; durationMinutes: number; unitId?: string; mvLevel?: string; cycleStartDate?: string; cycleLengthWeeks?: number; colorKey?: string | null; organizationId?: string | null }) {
  const classId = "c_" + Date.now();
  const resolvedUnitRow = data.unitId ? { id: data.unitId, name: data.unit } : await ensureUnit(data.unit);
  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  const activeOrganizationId = data.organizationId ?? (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    id: classId, name: data.name, unit: resolvedUnitRow?.name ?? data.unit, unit_id: resolvedUnit, color_key: data.colorKey ?? null,
    modality: data.modality ?? "fitness", ageband: normalizeAgeBand(data.ageBand), gender: data.gender,
    starttime: data.startTime, end_time: computeEndTime(data.startTime, data.durationMinutes), duration: data.durationMinutes,
    days: data.daysOfWeek, daysperweek: data.daysOfWeek.length, goal: data.goal, equipment: "misto", level: 1,
    mv_level: data.mvLevel, cycle_start_date: data.cycleStartDate, cycle_length_weeks: data.cycleLengthWeeks,
    created_at: new Date().toISOString(),
  };
  if (activeOrganizationId) payload.organization_id = activeOrganizationId;
  await supabasePost("/classes", [payload]);
  return classId;
}

export async function duplicateClass(base: ClassGroup) {
  const resolvedUnitRow = base.unitId ? { id: base.unitId, name: base.unit } : await ensureUnit(base.unit);
  const resolvedUnit = resolvedUnitRow?.id ?? undefined;
  const activeOrganizationId = base.organizationId ?? (await getActiveOrganizationId());
  const payload: Record<string, unknown> = {
    id: "c_" + Date.now(), name: base.name + " (cópia)", unit: resolvedUnitRow?.name ?? base.unit, unit_id: resolvedUnit,
    color_key: base.colorKey ?? null, modality: base.modality ?? "fitness", ageband: normalizeAgeBand(base.ageBand),
    gender: base.gender, starttime: base.startTime, end_time: computeEndTime(base.startTime, base.durationMinutes),
    duration: base.durationMinutes, days: base.daysOfWeek, daysperweek: base.daysOfWeek.length, goal: base.goal,
    equipment: base.equipment, level: base.level, mv_level: base.mvLevel, cycle_start_date: base.cycleStartDate,
    cycle_length_weeks: base.cycleLengthWeeks, acwr_low: base.acwrLow, acwr_high: base.acwrHigh,
    created_at: new Date().toISOString(),
  };
  if (activeOrganizationId) payload.organization_id = activeOrganizationId;
  await supabasePost("/classes", [payload]);
}

export async function deleteClass(id: string) {
  const activeOrganizationId = await getActiveOrganizationId();
  await supabaseDelete(
    activeOrganizationId ? "/classes?id=eq." + encodeURIComponent(id) + "&organization_id=eq." + encodeURIComponent(activeOrganizationId) : "/classes?id=eq." + encodeURIComponent(id)
  );
}

export async function deleteClassCascade(id: string) {
  const activeOrganizationId = await getActiveOrganizationId();
  const classFilter = "classid=eq." + encodeURIComponent(id) + (activeOrganizationId ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId) : "");
  await supabaseDelete("/training_plans?" + classFilter);
  await supabaseDelete("/class_plans?" + classFilter);
  await supabaseDelete("/attendance_logs?" + classFilter);
  await supabaseDelete("/scouting_logs?" + classFilter);
  await supabaseDelete("/students?" + classFilter);
  await supabaseDelete("/session_logs?" + classFilter);
  try {
    const sessionLinks = await supabaseGet<{ session_id: string }[]>(
      "/training_session_classes?select=session_id&class_id=eq." +
        encodeURIComponent(id) +
        (activeOrganizationId
          ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
          : "")
    );
    const sessionIds = Array.from(
      new Set(
        sessionLinks
          .map((item) => String(item.session_id ?? "").trim())
          .filter(Boolean)
      )
    );
    if (sessionIds.length) {
      const sessionFilter = sessionIds.map((item) => encodeURIComponent(item)).join(",");
      await supabaseDelete(
        "/training_session_attendance?class_id=eq." +
          encodeURIComponent(id) +
          (activeOrganizationId
            ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
            : "")
      );
      await supabaseDelete(
        "/training_session_classes?class_id=eq." +
          encodeURIComponent(id) +
          (activeOrganizationId
            ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
            : "")
      );
      const remainingLinks = await supabaseGet<{ session_id: string; class_id: string }[]>(
        "/training_session_classes?select=session_id,class_id&session_id=in.(" +
          sessionFilter +
          ")" +
          (activeOrganizationId
            ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
            : "")
      );
      const stillLinked = new Set(
        remainingLinks
          .map((item) => String(item.session_id ?? "").trim())
          .filter(Boolean)
      );

      const remainingSessionRows = await supabaseGet<{ id: string; organization_id?: string | null; start_at: string; end_at: string; created_at?: string | null; updated_at?: string | null; }[]>(
        "/training_sessions?select=id,organization_id,start_at,end_at,created_at,updated_at&id=in.(" +
          sessionFilter +
          ")" +
          (activeOrganizationId
            ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
            : "")
      );
      const classIdsBySession = new Map<string, string[]>();
      for (const link of remainingLinks) {
        const key = String(link.session_id ?? "").trim();
        if (!key) continue;
        const list = classIdsBySession.get(key) ?? [];
        list.push(String(link.class_id ?? "").trim());
        classIdsBySession.set(key, list.filter(Boolean));
      }
      for (const sessionRow of remainingSessionRows) {
        const linkedClassIds = classIdsBySession.get(sessionRow.id) ?? [];
        if (linkedClassIds.length > 1) {
          await syncTrainingIntegrationRuleFromSession({
            sessionId: sessionRow.id,
            classIds: linkedClassIds,
            startAt: sessionRow.start_at,
            endAt: sessionRow.end_at,
            organizationId: sessionRow.organization_id ?? activeOrganizationId,
            createdAt: sessionRow.created_at ?? undefined,
            updatedAt: sessionRow.updated_at ?? undefined,
          });
        } else {
          await deleteTrainingIntegrationRuleBySession(sessionRow.id, {
            organizationId: sessionRow.organization_id ?? activeOrganizationId,
          });
        }
      }
      const orphanIds = sessionIds.filter((sessionId) => !stillLinked.has(sessionId));
      if (orphanIds.length) {
        await supabaseDelete(
          "/training_sessions?id=in.(" +
            orphanIds.map((item) => encodeURIComponent(item)).join(",") +
            ")" +
            (activeOrganizationId
              ? "&organization_id=eq." + encodeURIComponent(activeOrganizationId)
              : "")
        );
      }
    }
  } catch (error) {
    if (
      !isMissingRelation(error, "training_session_classes") &&
      !isMissingRelation(error, "training_session_attendance") &&
      !isMissingRelation(error, "training_sessions")
    ) {
      throw error;
    }
  }
  await deleteClass(id);
}
