import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoadLevel = "low" | "moderate" | "high";
export type LoadTrend = "increase" | "maintain" | "deload";
export type EventImpact = "low" | "medium" | "high";

export interface AIPeriodizationSnapshot {
  classId: string;
  date: string;

  /** The active planning cycle (annual frame). */
  cycle?: {
    name?: string;
    /** Which week within the cycle (1-indexed). */
    weekIndex?: number;
    totalWeeks?: number;
    objective?: string;
  };

  /** Derived from the weekly plan (class_plans row) covering today. */
  currentWeek?: {
    focus?: string;
    loadTarget?: LoadLevel;
    loadTrend?: LoadTrend;
    technicalPriority?: string;
    tacticalPriority?: string;
    pedagogicalRule?: string;
  };

  /**
   * Upcoming events (torneio / amistoso) that affect load management.
   * Capped at 3 events within the next EVENT_LOOK_AHEAD_DAYS days.
   */
  upcomingEvents?: Array<{
    title: string;
    eventType: string;
    daysUntil: number;
    impact: EventImpact;
  }>;

  /**
   * Pre-computed natural-language hints injected directly into the system prompt.
   * These are the only lines the AI needs to change its behaviour today.
   */
  decisionHints: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many days ahead to look for upcoming events. */
const EVENT_LOOK_AHEAD_DAYS = 14;

/** Max events to surface to avoid bloating the prompt. */
const MAX_EVENTS = 3;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

function eventImpact(eventType: string, daysUntil: number): EventImpact {
  if (eventType === "torneio" || eventType === "amistoso") {
    if (daysUntil <= 3) return "high";
    if (daysUntil <= 7) return "medium";
  }
  return "low";
}

function loadLevelFromRpe(rpeTarget: string): LoadLevel {
  const rpe = parseFloat(rpeTarget);
  if (!isNaN(rpe)) {
    if (rpe <= 5) return "low";
    if (rpe <= 7) return "moderate";
    return "high";
  }
  const normalized = rpeTarget.toLowerCase();
  if (normalized.includes("baixo") || normalized.includes("low")) return "low";
  if (normalized.includes("alto") || normalized.includes("high")) return "high";
  return "moderate";
}

function weekIndexInCycle(cycleStartDate: string, today: string): number {
  const days = daysBetween(cycleStartDate, today);
  return Math.max(1, Math.floor(days / 7) + 1);
}

function totalWeeksInCycle(startDate: string, endDate: string): number {
  const days = daysBetween(startDate, endDate);
  return Math.max(1, Math.round(days / 7));
}

// ─── Main resolver ────────────────────────────────────────────────────────────

/**
 * Resolves a compact periodization snapshot for the given class and date.
 *
 * Security rules:
 * - Uses the caller's Supabase client (their JWT) → RLS is enforced automatically.
 * - Does NOT use service_role.
 * - Returns null if classId is absent, the user lacks access, or no data exists.
 * - Never throws; logs a warning on unexpected errors.
 */
export async function resolveAIPeriodizationContext(
  supabase: SupabaseClient,
  classId: string,
  date: string
): Promise<AIPeriodizationSnapshot | null> {
  // Guard: classId is required
  if (!classId || classId.trim() === "") return null;

  const safeDate = date || new Date().toISOString().slice(0, 10);

  try {
    // ── 1. Active planning cycle ─────────────────────────────────────────────
    const { data: cycleRow, error: cycleError } = await supabase
      .from("planning_cycles")
      .select("id, title, startdate, enddate, year")
      .eq("classid", classId)
      .eq("status", "active")
      .order("year", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleError) {
      console.warn("[AIPeriodization] planning_cycles query error:", cycleError.message);
    }

    // ── 2. Current weekly plan (class_plans row covering today) ──────────────
    // class_plans.startdate is the Monday of the week; we look for the most
    // recent week that started on or before today.
    const { data: weekRow, error: weekError } = await supabase
      .from("class_plans")
      .select(
        "id, startdate, weeknumber, phase, theme, technical_focus, physical_focus, constraints, rpe_target, mv_format, pedagogical_rule"
      )
      .eq("classid", classId)
      .lte("startdate", safeDate)
      .order("startdate", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (weekError) {
      console.warn("[AIPeriodization] class_plans query error:", weekError.message);
    }

    // ── 3. Upcoming events linked to this class ──────────────────────────────
    const lookAheadDate = new Date(safeDate);
    lookAheadDate.setDate(lookAheadDate.getDate() + EVENT_LOOK_AHEAD_DAYS);
    const lookAheadIso = lookAheadDate.toISOString();

    const { data: eventRows, error: eventsError } = await supabase
      .from("events")
      .select(
        `id, title, event_type, starts_at,
         event_classes!inner(class_id)`
      )
      .eq("event_classes.class_id", classId)
      .gte("starts_at", `${safeDate}T00:00:00Z`)
      .lte("starts_at", lookAheadIso)
      .in("event_type", ["torneio", "amistoso"])
      .order("starts_at", { ascending: true })
      .limit(MAX_EVENTS);

    if (eventsError) {
      console.warn("[AIPeriodization] events query error:", eventsError.message);
    }

    // ── 4. Return null if there is truly nothing ─────────────────────────────
    if (!cycleRow && !weekRow && (!eventRows || eventRows.length === 0)) {
      return null;
    }

    // ── 5. Build snapshot ────────────────────────────────────────────────────

    const cycle: AIPeriodizationSnapshot["cycle"] = cycleRow
      ? {
          name: cycleRow.title || undefined,
          weekIndex: weekIndexInCycle(cycleRow.startdate, safeDate),
          totalWeeks: totalWeeksInCycle(cycleRow.startdate, cycleRow.enddate),
        }
      : undefined;

    const currentWeek: AIPeriodizationSnapshot["currentWeek"] = weekRow
      ? {
          focus: weekRow.theme || weekRow.phase || undefined,
          loadTarget: weekRow.rpe_target ? loadLevelFromRpe(String(weekRow.rpe_target)) : undefined,
          technicalPriority: weekRow.technical_focus || undefined,
          tacticalPriority: weekRow.mv_format || undefined,
          pedagogicalRule: weekRow.pedagogical_rule || undefined,
        }
      : undefined;

    const upcomingEvents: AIPeriodizationSnapshot["upcomingEvents"] = (eventRows ?? []).map(
      (ev) => {
        const daysUntil = daysBetween(safeDate, ev.starts_at.slice(0, 10));
        return {
          title: ev.title,
          eventType: ev.event_type,
          daysUntil,
          impact: eventImpact(ev.event_type, daysUntil),
        };
      }
    );

    // ── 6. Build decision hints ──────────────────────────────────────────────
    const hints: string[] = [];

    if (cycle?.weekIndex !== undefined && cycle?.totalWeeks !== undefined) {
      hints.push(
        `A turma está na semana ${cycle.weekIndex}/${cycle.totalWeeks} do ciclo${cycle.name ? ` "${cycle.name}"` : ""}.`
      );
    }

    if (currentWeek?.focus) {
      hints.push(`Foco da semana: ${currentWeek.focus}.`);
    }

    if (currentWeek?.technicalPriority) {
      hints.push(`Prioridade técnica: ${currentWeek.technicalPriority}.`);
    }

    if (currentWeek?.loadTarget) {
      const labelMap: Record<LoadLevel, string> = {
        low: "baixa",
        moderate: "moderada",
        high: "alta",
      };
      hints.push(`Carga planejada da semana: ${labelMap[currentWeek.loadTarget]}.`);
    }

    if (currentWeek?.pedagogicalRule) {
      hints.push(`Regra pedagógica ativa: ${currentWeek.pedagogicalRule}.`);
    }

    for (const ev of upcomingEvents ?? []) {
      if (ev.impact === "high") {
        hints.push(
          `ATENÇÃO: ${ev.eventType === "torneio" ? "Torneio" : "Amistoso"} "${ev.title}" em ${ev.daysUntil} dia(s). Evite carga excessiva hoje.`
        );
      } else if (ev.impact === "medium") {
        hints.push(
          `${ev.eventType === "torneio" ? "Torneio" : "Amistoso"} "${ev.title}" em ${ev.daysUntil} dia(s). Prefira carga moderada ou baixa esta semana.`
        );
      }
    }

    return {
      classId,
      date: safeDate,
      cycle,
      currentWeek,
      upcomingEvents: upcomingEvents.length > 0 ? upcomingEvents : undefined,
      decisionHints: hints,
    };
  } catch (err) {
    console.warn("[AIPeriodization] Unexpected error:", String(err));
    return null;
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Converts a periodization snapshot into a system-prompt block.
 *
 * Follows the same pattern as buildSystemAIMemoryPrompt:
 * - Returns a no-op string when snapshot is null (no injection).
 * - The block starts with "PERIODIZATION_CONTEXT:" so it can be grepped in tests.
 */
export function buildSystemAIPeriodizationPrompt(
  snapshot: AIPeriodizationSnapshot | null
): string {
  if (!snapshot || snapshot.decisionHints.length === 0) {
    return "PERIODIZATION_CONTEXT: Sem dados de periodização disponíveis para esta turma.";
  }

  const lines = [
    "PERIODIZATION_CONTEXT: Use o contexto abaixo para adaptar suas sugestões ao ciclo atual da turma.",
    "A IA não deve substituir o planejamento do professor — apenas interpretar o ciclo e orientar dentro dele.",
    "",
    ...snapshot.decisionHints.map((h) => `- ${h}`),
  ];

  return lines.join("\n");
}
