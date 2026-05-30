import type { ClassCalendarException, ClassGroup, DecisionReason } from "./models";

export type PlannedSessionStatus = "planned" | "skipped";

export type PlannedSession = {
  date: string;
  weekday: number;
  weekIndex: number;
  sessionIndexInWeek: number;
  durationMinutes: number;
  status: PlannedSessionStatus;
  reasons: DecisionReason[];
};

export type SessionCalendarEngineResult = {
  sessions: PlannedSession[];
  reasons: DecisionReason[];
};

type BuildSessionCalendarParams = {
  classGroup: Pick<ClassGroup, "daysOfWeek" | "durationMinutes" | "daysPerWeek">;
  startDate: string;
  endDate: string;
  exceptions?: ClassCalendarException[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeDaysOfWeek = (daysOfWeek: number[] | undefined, limit?: number) => {
  const days = [
    ...new Set(
      (daysOfWeek ?? [])
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ),
  ].sort((left, right) => left - right);

  const sessionLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.floor(limit)
      : days.length;

  return days.slice(0, sessionLimit);
};

const buildReason = (message: string, evidence?: string): DecisionReason => ({
  kind: "calendar",
  source: "calendar_engine",
  confidence: "high",
  message,
  evidence,
});

export const buildSessionCalendar = (
  params: BuildSessionCalendarParams
): SessionCalendarEngineResult => {
  const start = parseIsoDate(params.startDate);
  const end = parseIsoDate(params.endDate);
  if (!start || !end || end.getTime() < start.getTime()) {
    return {
      sessions: [],
      reasons: [
        {
          kind: "calendar",
          source: "safe_default",
          confidence: "low",
          message: "Calendario nao gerado: intervalo invalido.",
          evidence: `${params.startDate} - ${params.endDate}`,
        },
      ],
    };
  }

  const daysOfWeek = normalizeDaysOfWeek(
    params.classGroup.daysOfWeek,
    params.classGroup.daysPerWeek
  );
  if (!daysOfWeek.length) {
    return {
      sessions: [],
      reasons: [
        {
          kind: "calendar",
          source: "safe_default",
          confidence: "low",
          message: "Calendario nao gerado: turma sem dias de aula configurados.",
        },
      ],
    };
  }

  const noTrainingDates = new Map(
    (params.exceptions ?? [])
      .filter((item) => item.kind === "no_training")
      .map((item) => [item.date, item.reason] as const)
  );
  const durationMinutes = Math.max(15, Number(params.classGroup.durationMinutes || 60));
  const reasons = [
    buildReason(
      "Calendario montado pelos dias reais da turma.",
      `Dias da semana: ${daysOfWeek.join(", ")}`
    ),
  ];
  const sessions: PlannedSession[] = [];
  const sessionCountByWeek = new Map<number, number>();
  const startTime = start.getTime();

  for (let time = startTime; time <= end.getTime(); time += DAY_MS) {
    const current = new Date(time);
    const weekday = current.getDay();
    if (!daysOfWeek.includes(weekday)) continue;

    const date = toIsoDate(current);
    const weekIndex = Math.floor((time - startTime) / (7 * DAY_MS));
    const nextIndex = (sessionCountByWeek.get(weekIndex) ?? 0) + 1;
    sessionCountByWeek.set(weekIndex, nextIndex);
    const exceptionReason = noTrainingDates.get(date);
    const sessionReasons = exceptionReason
      ? [buildReason("Sessao removida por excecao de calendario.", exceptionReason)]
      : [...reasons];
    if (exceptionReason) {
      reasons.push(buildReason("Sessao removida por excecao de calendario.", `${date}: ${exceptionReason}`));
    }

    sessions.push({
      date,
      weekday,
      weekIndex,
      sessionIndexInWeek: nextIndex,
      durationMinutes,
      status: exceptionReason ? "skipped" : "planned",
      reasons: sessionReasons,
    });
  }

  return {
    sessions: sessions.filter((session) => session.status === "planned"),
    reasons,
  };
};
