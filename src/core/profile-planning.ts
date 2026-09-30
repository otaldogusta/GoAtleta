import { profileGameFormat, profileSummary, profilePlanningGuidance, type PedagogicalProfile, type GameFormat } from "./class-pedagogical-profile";
import type { ClassGroup, ClassPlan } from "./models";
import type { PedagogicalPlanPackage, LessonPlanDraft, PedagogicalActivity } from "./pedagogical-planning";
import { resolveClassProfile } from "./class-profile-resolver";

export { resolveClassProfile } from "./class-profile-resolver";

export function profileDiagnosticValues(profile: PedagogicalProfile, baseline: { gameLevel: GameFormat; netHeightMeters: number }) {
  const netHeight = Number(profile.facts.netHeight?.value);
  return {
    gameLevel: profileGameFormat(profile) ?? baseline.gameLevel,
    netHeightMeters: netHeight >= 1.5 && netHeight <= 2.5 ? netHeight : baseline.netHeightMeters,
    teacherContext: profileSummary(profile),
  };
}

export function applyProfileToWeeklyPlan(plan: ClassPlan, cls: ClassGroup): ClassPlan {
  const record = resolveClassProfile(cls);
  if (!record || plan.source === "MANUAL") return plan;
  const guidance = profilePlanningGuidance(record.profile);
  const result = { ...plan };
  let snapshot: Record<string, unknown> = {};
  try { snapshot = JSON.parse(plan.generationContextSnapshotJson || "{}"); } catch { /* legacy */ }
  const manual: string[] = (() => { try { return JSON.parse(plan.manualOverrideMaskJson || "[]"); } catch { return []; } })();
  const focus = guidance.progression[(Math.max(1, plan.weekNumber) - 1) % Math.max(1, guidance.progression.length)];
  const set = <K extends keyof ClassPlan>(key: K, value: ClassPlan[K]) => { if (!manual.includes(key)) result[key] = value; };
  if (guidance.format) set("mvFormat", guidance.format);
  if (focus) {
    set("theme", focus); set("generalObjective", focus);
    set("specificObjective", guidance.priorities.join("; ") || focus);
    set("technicalFocus", guidance.priorities.join("; ") || plan.technicalFocus);
  }
  if (guidance.rule) set("pedagogicalRule", guidance.rule);
  const baseConstraints = typeof snapshot.profileBaseConstraints === "string" ? snapshot.profileBaseConstraints : plan.constraints;
  set("constraints", [baseConstraints, guidance.rule, guidance.summary].filter(Boolean).join(" | "));
  result.generationContextSnapshotJson = JSON.stringify({ ...snapshot, profileBaseConstraints: baseConstraints, pedagogicalProfile: record,
    lineage: { ...(snapshot.lineage as object ?? {}), pedagogicalProfileVersion: record.version } });
  return result;
}

/** Build the game using the actual baseline; load and medical guards run AFTER this adapter. */
export function applyProfileToPackage(pkg: PedagogicalPlanPackage, cls: ClassGroup): PedagogicalPlanPackage {
  const record = resolveClassProfile(cls);
  if (!record) return pkg;
  const guidance = profilePlanningGuidance(record.profile);
  const apply = <T extends LessonPlanDraft>(plan: T): T => {
    const activities = plan.main.activities.map((activity): PedagogicalActivity => {
      if (activity.stage !== "game") return { ...activity,
        coachFocus: [activity.coachFocus, guidance.priorities.join("; ")].filter(Boolean).join(" · "),
        adaptation: [activity.adaptation, ...guidance.adaptations].filter(Boolean).join("; "),
      };
      if (!guidance.format) return { ...activity, adaptation: guidance.adaptations.join("; ") };
      const focus = guidance.priorities[0] || "organização, continuidade e tomada de decisão";
      return { ...activity, name: `Jogo ${guidance.format} · ${focus}`,
        description: `Jogar ${guidance.format}, com equipes equilibradas e rodízio de participação. Observar ${focus}. Pausar brevemente para orientar e retomar o jogo. ${guidance.adaptations.join("; ")}`,
        participants: guidance.format, organization: `Equipes em ${guidance.format}, preservando participação e restrições individuais.`,
        simpleRule: guidance.adaptations.join("; ") || "Regras já utilizadas pela turma, sem acrescentar exigências não confirmadas.",
        coachFocus: focus, successCriteria: `Observar ${focus} mantendo as adaptações combinadas; registrar o que funcionou e o que precisa de apoio.`,
        adaptation: guidance.adaptations.join("; "),
        // Do not leave an alternate renderer carrying the old reduced-game instructions.
        action: undefined, execution: undefined, presentation: undefined, scoring: undefined,
      };
    });
    return { ...plan, main: { ...plan.main, activities },
      explanations: [...plan.explanations, { message: `Perfil da turma v${record.version}: ${guidance.rule || guidance.summary}`, source: "contexto", appliedTo: "geral" }],
    };
  };
  return { ...pkg, input: { ...pkg.input, objective: guidance.priorities[0] || pkg.input.objective },
    draft: apply(pkg.draft), generated: apply(pkg.generated), final: apply(pkg.final) };
}
