import type { ClassGroup, TrainingPlan } from "./models";

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const ROSTER_FUNDAMENTALS = [
  "Físico",
  "Toque",
  "Manchete",
  "Saque",
  "Ataque",
  "Bloqueio",
  "Apoio e Def",
  "Passe",
  "Levantamento",
  "Transição",
  "Jogo",
] as const;

export type RosterFundamental = (typeof ROSTER_FUNDAMENTALS)[number];

export type RosterMonthEntry = {
  day: number;
  dateKey: string;
  weekday: number;
};

const normalizeText = (value: string) =>
  stripAccents(value).toLowerCase().trim();

const includesAny = (text: string, terms: string[]) =>
  terms.some((term) => text.includes(term));

export const buildRosterMonthEntries = (
  value: string,
  classDaysOfWeek: number[]
): RosterMonthEntry[] => {
  const parsed = new Date(`${value}-01T00:00:00`);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const entries: RosterMonthEntry[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const current = new Date(year, monthIndex, day);
    if (!classDaysOfWeek.includes(current.getDay())) continue;
    entries.push({
      day,
      dateKey: `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      weekday: current.getDay(),
    });
  }

  return entries;
};

export function getBlockForToday(cls: ClassGroup): string {
  const goal = stripAccents(cls.goal).toLowerCase();
  if (goal.includes("forca") && goal.includes("potencia")) {
    return "Meso B/C - Força + Potência";
  }
  if (goal.includes("forca")) {
    return "Meso B - Força Geral";
  }
  if (goal.includes("potencia") || goal.includes("agilidade")) {
    return "Meso C - Potência/Agilidade";
  }
  return "Meso A - Fundamentos/Técnica";
}

export function getSuggestedFundamentalsForClass(cls: ClassGroup): RosterFundamental[] {
  const block = stripAccents(getBlockForToday(cls)).toLowerCase();
  if (block.includes("forca + potencia")) {
    return ["Físico", "Saque", "Ataque", "Bloqueio"] as RosterFundamental[];
  }
  if (block.includes("forca geral")) {
    return ["Físico", "Apoio e Def"] as RosterFundamental[];
  }
  if (block.includes("potencia/agilidade")) {
    return ["Físico", "Passe", "Levantamento", "Transição"] as RosterFundamental[];
  }
  return ["Físico", "Toque", "Manchete", "Saque", "Passe"] as RosterFundamental[];
}

export const inferRosterFundamentalsFromPlan = (
  plan: Pick<TrainingPlan, "title" | "tags" | "warmup" | "main" | "cooldown">
): RosterFundamental[] => {
  const text = normalizeText(
    [
      plan.title,
      ...(plan.tags ?? []),
      ...(plan.warmup ?? []),
      ...(plan.main ?? []),
      ...(plan.cooldown ?? []),
    ].join(" ")
  );

  const fundamentals: RosterFundamental[] = [];
  const push = (condition: boolean, fundamental: RosterFundamental) => {
    if (condition && !fundamentals.includes(fundamental)) {
      fundamentals.push(fundamental);
    }
  };

  push(
    includesAny(text, [
      "fisico",
      "forca",
      "potencia",
      "agilidade",
      "mobilidade",
      "core",
      "pliometria",
      "aterrissagem",
      "preven",
      "condicion",
      "coordena",
    ]),
    "Físico"
  );
  push(includesAny(text, ["toque", "bovenhands", "toets", "hands"]), "Toque");
  push(
    includesAny(text, ["manchete", "recepcao", "recepcao", "antebraco", "passe de antebraco"]),
    "Manchete"
  );
  push(includesAny(text, ["saque", "servico"]), "Saque");
  push(includesAny(text, ["ataque", "cortada", "smash", "finalizacao"]), "Ataque");
  push(includesAny(text, ["bloqueio", "block"]), "Bloqueio");
  push(
    includesAny(text, ["apoio", "defesa", "cobertura", "base defensiva", "recuperacao"]),
    "Apoio e Def"
  );
  push(includesAny(text, ["passe", "recepcao", "construcao do jogo"]), "Passe");
  push(
    includesAny(text, ["levantamento", "levantador", "set", "3 toques", "three touches"]),
    "Levantamento"
  );
  push(
    includesAny(text, ["transicao", "contra-ataque", "side-out", "rodizio", "rotacao"]),
    "Transição"
  );
  push(includesAny(text, ["jogo", "jogo reduzido", "partida", "condicionado"]), "Jogo");

  return fundamentals;
};

export const buildRosterFundamentalsByDay = (options: {
  classId: string;
  monthEntries: RosterMonthEntry[];
  plans: TrainingPlan[];
  fallback?: RosterFundamental[];
}): Record<number, RosterFundamental[]> => {
  const byDate: Record<string, TrainingPlan> = {};
  const byWeekday: Record<number, TrainingPlan> = {};

  options.plans
    .filter((plan) => plan.classId === options.classId)
    .forEach((plan) => {
      if (plan.applyDate && !byDate[plan.applyDate]) {
        byDate[plan.applyDate] = plan;
      }
      (plan.applyDays ?? []).forEach((weekday) => {
        if (!byWeekday[weekday]) {
          byWeekday[weekday] = plan;
        }
      });
    });

  return options.monthEntries.reduce<Record<number, RosterFundamental[]>>((acc, entry) => {
    const plan = byDate[entry.dateKey] ?? byWeekday[entry.weekday] ?? null;
    const inferred = plan ? inferRosterFundamentalsFromPlan(plan) : [];
    acc[entry.day] = inferred.length
      ? inferred
      : plan
        ? options.fallback ?? []
        : [];
    return acc;
  }, {});
};
