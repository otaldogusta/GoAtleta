/**
 * Tests for ai-periodization-context.ts
 *
 * Strategy: mock the Supabase client at the query level so no real DB is needed.
 * Each test controls exactly what each table returns.
 */

import {
  resolveAIPeriodizationContext,
  buildSystemAIPeriodizationPrompt,
  AIPeriodizationSnapshot,
} from "../ai-periodization-context.ts";

// ─── Supabase mock factory ────────────────────────────────────────────────────

type QueryResult = { data: unknown; error: unknown };

/**
 * Builds a mock Supabase client where each `.from(table)` returns the value
 * registered in `tableResults`.  The fluent chain (select/eq/gte/lte/order/
 * limit/maybeSingle/in) resolves to the registered result for that table.
 */
function makeSupabaseMock(tableResults: Record<string, QueryResult>) {
  const makeChain = (table: string) => {
    const result = tableResults[table] ?? { data: null, error: null };

    // All chain methods return `this` except terminal methods
    const chain: Record<string, unknown> = {};
    const fluent = () => chain;

    chain.select = fluent;
    chain.eq = fluent;
    chain.lte = fluent;
    chain.gte = fluent;
    chain.in = fluent;
    chain.order = fluent;
    chain.limit = fluent;
    chain.maybeSingle = () => Promise.resolve(result);
    // For the events query which uses a non-maybeSingle terminal
    chain.then = (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);

    // Allow `.limit(n)` to either be followed by `.maybeSingle()` or resolve directly
    chain.limit = () => {
      const limitChain: Record<string, unknown> = {};
      limitChain.maybeSingle = () => Promise.resolve(result);
      // For array queries that don't call maybeSingle
      Object.defineProperty(limitChain, "then", {
        get() {
          return (resolve: (v: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
        },
      });
      return limitChain;
    };

    return chain;
  };

  return {
    from: (table: string) => makeChain(table),
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CYCLE_ROW = {
  id: "pc_class1_2026",
  title: "Temporada 2026",
  startdate: "2026-01-06",
  enddate: "2026-12-15",
  year: 2026,
};

const WEEK_ROW = {
  id: "wp_001",
  startdate: "2026-07-07",
  weeknumber: 27,
  phase: "Desenvolvimento",
  theme: "Recepção em deslocamento",
  technical_focus: "Controle de plataforma",
  physical_focus: "Resistência aeróbica",
  constraints: "",
  rpe_target: "6",
  mv_format: "3x3",
  pedagogical_rule: null,
};

const EVENT_ROW = {
  id: "evt_001",
  title: "Festival Regional",
  event_type: "torneio",
  starts_at: "2026-07-12T09:00:00Z",
  event_classes: [{ class_id: "class1" }],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("resolveAIPeriodizationContext", () => {
  // 1. Sem classId → retorna null
  test("returns null when classId is empty", async () => {
    const supabase = makeSupabaseMock({}) as any;
    const result = await resolveAIPeriodizationContext(supabase, "", "2026-07-09");
    expect(result).toBeNull();
  });

  test("returns null when classId is whitespace-only", async () => {
    const supabase = makeSupabaseMock({}) as any;
    const result = await resolveAIPeriodizationContext(supabase, "   ", "2026-07-09");
    expect(result).toBeNull();
  });

  // 2. classId válido com ciclo ativo → retorna snapshot
  test("returns snapshot with cycle and week when both exist", async () => {
    const supabase = makeSupabaseMock({
      planning_cycles: { data: CYCLE_ROW, error: null },
      class_plans: { data: WEEK_ROW, error: null },
      events: { data: [], error: null },
    }) as any;

    const result = await resolveAIPeriodizationContext(supabase, "class1", "2026-07-09");

    expect(result).not.toBeNull();
    expect(result!.classId).toBe("class1");
    expect(result!.cycle?.name).toBe("Temporada 2026");
    expect(result!.cycle?.weekIndex).toBeGreaterThan(0);
    expect(result!.currentWeek?.focus).toBe("Recepção em deslocamento");
    expect(result!.currentWeek?.technicalPriority).toBe("Controle de plataforma");
    expect(result!.currentWeek?.loadTarget).toBe("moderate"); // rpe_target = 6
    expect(result!.decisionHints.length).toBeGreaterThan(0);
  });

  // 3. Turma sem periodização → retorna null sem quebrar o assistant
  test("returns null when no cycle, no week, and no events exist", async () => {
    const supabase = makeSupabaseMock({
      planning_cycles: { data: null, error: null },
      class_plans: { data: null, error: null },
      events: { data: [], error: null },
    }) as any;

    const result = await resolveAIPeriodizationContext(supabase, "class_empty", "2026-07-09");
    expect(result).toBeNull();
  });

  // 4. RLS bloqueia → tratado como ausência de dados (não explode)
  test("returns null when planning_cycles query returns RLS error", async () => {
    const supabase = makeSupabaseMock({
      planning_cycles: { data: null, error: { message: "Row level security" } },
      class_plans: { data: null, error: null },
      events: { data: [], error: null },
    }) as any;

    const result = await resolveAIPeriodizationContext(supabase, "class_other_org", "2026-07-09");
    // Should return null gracefully (no cycle + no week + no events)
    expect(result).toBeNull();
  });

  // 5. Evento próximo em até 14 dias → aparece em upcomingEvents
  test("includes upcoming high-impact event (torneio in 3 days)", async () => {
    // Event is 3 days from 2026-07-09 = 2026-07-12
    const supabase = makeSupabaseMock({
      planning_cycles: { data: CYCLE_ROW, error: null },
      class_plans: { data: WEEK_ROW, error: null },
      events: { data: [EVENT_ROW], error: null },
    }) as any;

    const result = await resolveAIPeriodizationContext(supabase, "class1", "2026-07-09");

    expect(result).not.toBeNull();
    expect(result!.upcomingEvents).toHaveLength(1);
    expect(result!.upcomingEvents![0].title).toBe("Festival Regional");
    expect(result!.upcomingEvents![0].impact).toBe("high");
    expect(result!.upcomingEvents![0].daysUntil).toBe(3);

    // High-impact event must appear in decisionHints
    const hasEventHint = result!.decisionHints.some((h) =>
      h.includes("Festival Regional") && h.includes("3")
    );
    expect(hasEventHint).toBe(true);
  });

  // 6. Snapshot não contém PII desnecessária
  test("snapshot does not include student IDs, CPF, or personal data", async () => {
    const supabase = makeSupabaseMock({
      planning_cycles: { data: CYCLE_ROW, error: null },
      class_plans: { data: WEEK_ROW, error: null },
      events: { data: [EVENT_ROW], error: null },
    }) as any;

    const result = await resolveAIPeriodizationContext(supabase, "class1", "2026-07-09");
    const serialized = JSON.stringify(result ?? {});

    expect(serialized).not.toMatch(/cpf/i);
    expect(serialized).not.toMatch(/student_id/i);
    expect(serialized).not.toMatch(/phone/i);
    expect(serialized).not.toMatch(/email/i);
    // class_id is acceptable as it's structural, not PII
  });
});

// ─── buildSystemAIPeriodizationPrompt ────────────────────────────────────────

describe("buildSystemAIPeriodizationPrompt", () => {
  // 7. Prompt final contém PERIODIZATION_CONTEXT quando existe snapshot
  test("returns block starting with PERIODIZATION_CONTEXT when snapshot has hints", () => {
    const snapshot: AIPeriodizationSnapshot = {
      classId: "class1",
      date: "2026-07-09",
      cycle: { name: "Temporada 2026", weekIndex: 27, totalWeeks: 48 },
      currentWeek: { focus: "Recepção" },
      decisionHints: [
        "A turma está na semana 27/48 do ciclo.",
        "Foco da semana: Recepção.",
      ],
    };

    const prompt = buildSystemAIPeriodizationPrompt(snapshot);

    expect(prompt).toContain("PERIODIZATION_CONTEXT:");
    expect(prompt).toContain("semana 27/48");
    expect(prompt).toContain("Recepção");
    // Should include the no-substitution rule
    expect(prompt).toContain("não deve substituir");
  });

  // 8. Prompt final não contém PERIODIZATION_CONTEXT ativo quando snapshot é null
  test("returns empty/no-data string when snapshot is null", () => {
    const prompt = buildSystemAIPeriodizationPrompt(null);

    // Should still start with PERIODIZATION_CONTEXT: for grep-ability,
    // but declare no data available
    expect(prompt).toContain("PERIODIZATION_CONTEXT:");
    expect(prompt).toContain("Sem dados");
    // Must NOT contain any hints
    expect(prompt).not.toContain("semana");
    expect(prompt).not.toContain("Foco");
  });

  test("returns no-data string when snapshot has empty decisionHints", () => {
    const snapshot: AIPeriodizationSnapshot = {
      classId: "class1",
      date: "2026-07-09",
      decisionHints: [],
    };

    const prompt = buildSystemAIPeriodizationPrompt(snapshot);
    expect(prompt).toContain("Sem dados");
  });
});
