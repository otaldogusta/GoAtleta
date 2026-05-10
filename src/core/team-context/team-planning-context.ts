import type {
  CoachIntervention,
  ResolveTeamPlanningContextInput,
  ScoutingImpact,
  TeamEvent,
  TeamEventDateRange,
  TeamPlanningContext,
  TeamPlanningLoadBias,
  TeamPlanningMode,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

const toLocalDate = (value: string) => {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffDays = (from: string, to: string) => {
  const fromDate = toLocalDate(from);
  const toDate = toLocalDate(to);
  if (!fromDate || !toDate) return null;
  return Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS);
};

const uniqueStrings = (values: string[]) => {
  const seen = new Set<string>();
  const output: string[] = [];
  values.forEach((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    output.push(value.trim());
  });
  return output;
};

const sortByDateAsc = <T extends { date: string }>(items: T[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date));

const isMatchEvent = (event: TeamEvent) =>
  event.type === "friendly" || event.type === "official_match";

export function getUpcomingTeamEvents(
  classId: string,
  dateRange: TeamEventDateRange,
  events: TeamEvent[] = []
): TeamEvent[] {
  return sortByDateAsc(
    events.filter((event) => {
      if (event.classId !== classId) return false;
      return event.date >= dateRange.startDate && event.date <= dateRange.endDate;
    })
  );
}

export function getRecentCoachInterventions(
  classId: string,
  days: number,
  interventions: CoachIntervention[] = [],
  referenceDate = new Date().toISOString().slice(0, 10)
): CoachIntervention[] {
  return [...interventions]
    .filter((item) => {
      if (item.classId !== classId) return false;
      const delta = diffDays(item.date, referenceDate);
      return delta !== null && delta >= 0 && delta <= days;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getRecentScoutingImpacts(
  classId: string,
  days: number,
  impacts: ScoutingImpact[] = [],
  referenceDate = new Date().toISOString().slice(0, 10)
): ScoutingImpact[] {
  return [...impacts]
    .filter((item) => {
      if (item.classId !== classId) return false;
      const delta = diffDays(item.date, referenceDate);
      return delta !== null && delta >= 0 && delta <= days;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

const pushFocusHintsFromInterventions = (
  interventions: CoachIntervention[],
  target: string[]
) => {
  interventions.forEach((item) => {
    if (item.summary.trim()) {
      target.push(item.summary.trim());
    }
    item.tags.forEach((tag) => {
      if (tag.trim()) {
        target.push(tag.trim());
      }
    });
  });
};

const pushFocusHintsFromScouting = (impacts: ScoutingImpact[], target: string[]) => {
  impacts.forEach((item) => {
    item.weaknesses.forEach((weakness) => {
      if (weakness.trim()) target.push(weakness.trim());
    });
    item.recommendedFocus.forEach((focus) => {
      if (focus.trim()) target.push(focus.trim());
    });
    item.tacticalNotes.forEach((note) => {
      if (note.trim()) target.push(note.trim());
    });
  });
};

const resolveLoadBias = (options: {
  planningMode: TeamPlanningMode;
  scoutingImpacts: ScoutingImpact[];
}): TeamPlanningLoadBias => {
  if (options.planningMode === "pre_match" || options.planningMode === "post_match") {
    return "reduce";
  }
  if (options.planningMode === "recovery") {
    return "reduce";
  }
  const loadSignals = options.scoutingImpacts.map((item) => item.loadImpact);
  if (loadSignals.includes("reduce")) return "reduce";
  if (loadSignals.includes("increase")) return "increase";
  return "maintain";
};

export function resolveTeamPlanningContext(
  input: ResolveTeamPlanningContextInput
): TeamPlanningContext {
  const referenceDate = input.referenceDate;
  const upcomingWindowDays = input.upcomingWindowDays ?? 7;
  const recentWindowDays = input.recentWindowDays ?? 7;
  const endDate = (() => {
    const ref = toLocalDate(referenceDate);
    if (!ref) return referenceDate;
    return new Date(ref.getTime() + upcomingWindowDays * DAY_MS).toISOString().slice(0, 10);
  })();

  const upcomingEvents = getUpcomingTeamEvents(
    input.classId,
    { startDate: referenceDate, endDate },
    input.events ?? []
  );
  const recentInterventions = getRecentCoachInterventions(
    input.classId,
    recentWindowDays,
    input.coachInterventions ?? [],
    referenceDate
  );
  const recentScoutingImpacts = getRecentScoutingImpacts(
    input.classId,
    recentWindowDays,
    input.scoutingImpacts ?? [],
    referenceDate
  );

  const recentEvents = [...(input.events ?? [])]
    .filter((event) => {
      if (event.classId !== input.classId) return false;
      const delta = diffDays(event.date, referenceDate);
      return delta !== null && delta >= 0 && delta <= 2;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const upcomingMatch = upcomingEvents.find((event) => isMatchEvent(event));
  const daysUntilMatch =
    upcomingMatch && diffDays(referenceDate, upcomingMatch.date) !== null
      ? diffDays(referenceDate, upcomingMatch.date)
      : null;

  let planningMode: TeamPlanningMode = "normal";
  if (upcomingEvents.some((event) => event.type === "recovery")) {
    planningMode = "recovery";
  } else if (upcomingEvents.some((event) => event.type === "evaluation")) {
    planningMode = "evaluation";
  } else if (upcomingMatch && daysUntilMatch !== null && daysUntilMatch <= 1) {
    planningMode = "pre_match";
  } else if (recentEvents.some((event) => isMatchEvent(event))) {
    planningMode = "post_match";
  }

  const focusHints: string[] = [];
  const avoidHints: string[] = [];
  const reasonParts: string[] = [];

  if (planningMode === "pre_match") {
    focusHints.push("ajuste tático", "organização coletiva", "comunicação");
    avoidHints.push("fadiga excessiva", "carga alta", "volume desnecessário");
    reasonParts.push(
      daysUntilMatch === 0
        ? "partida no mesmo dia"
        : `partida em ${daysUntilMatch} dia${daysUntilMatch === 1 ? "" : "s"}`
    );
  }

  if (planningMode === "post_match") {
    focusHints.push("recuperação ativa", "correções do jogo", "estabilidade técnica");
    avoidHints.push("volume excessivo", "complexidade desnecessária");
    reasonParts.push("jogo recente");
  }

  if (planningMode === "recovery") {
    focusHints.push("recuperação", "controle de carga", "clareza de execução");
    avoidHints.push("carga alta", "densidade excessiva");
    reasonParts.push("evento de recuperação no ciclo próximo");
  }

  if (planningMode === "evaluation") {
    focusHints.push("observação dirigida", "critérios claros", "coleta de referência");
    avoidHints.push("volume que atrapalhe a avaliação");
    reasonParts.push("evento de avaliação próximo");
  }

  if (recentInterventions.length) {
    pushFocusHintsFromInterventions(recentInterventions, focusHints);
    reasonParts.push("intervenções recentes do professor");
  }

  if (recentScoutingImpacts.length) {
    pushFocusHintsFromScouting(recentScoutingImpacts, focusHints);
    if (recentScoutingImpacts.some((item) => item.weaknesses.length > 0)) {
      reasonParts.push("scouting recente com fraquezas observadas");
    }
  }

  const recommendedLoadBias = resolveLoadBias({
    planningMode,
    scoutingImpacts: recentScoutingImpacts,
  });

  if (recommendedLoadBias === "increase" && planningMode === "normal") {
    reasonParts.push("scouting recente permite progressão controlada");
  }

  return {
    hasUpcomingMatch: Boolean(upcomingMatch),
    daysUntilMatch,
    planningMode,
    recommendedLoadBias,
    focusHints: uniqueStrings(focusHints),
    avoidHints: uniqueStrings(avoidHints),
    reason: uniqueStrings(reasonParts).join("; ") || "sem sinais competitivos ou intervenções recentes",
  };
}
