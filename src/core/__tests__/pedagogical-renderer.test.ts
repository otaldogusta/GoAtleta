import {
    renderAlreadyIntroducedList,
    renderBlockRecommendationSummary,
    renderGameFormLabel,
    renderNextStepList,
    renderPedagogicalObjective,
    renderStageFocusSummary,
} from "../pedagogy/pedagogical-renderer";
import type { NextPedagogicalStep } from "../pedagogy/pedagogical-types";

const makeStep = (overrides: Partial<NextPedagogicalStep> = {}): NextPedagogicalStep => ({
  stageId: "08-10_feb_02",
  sequenceIndex: 2,
  monthStageCount: 3,
  currentStage: "fundamentos_basicos_com_continuidade",
  gameForm: "mini_2x2",
  complexityLevel: "baixo_moderado",
  alreadyIntroduced: ["set_self_control", "underhand_serve_intro"],
  alreadyPracticedContexts: ["pair_work", "simple_target"],
  nextStep: ["two_action_continuity", "mini_game_2x2_intro"],
  pedagogicalConstraints: ["manter linguagem simples"],
  blockRecommendations: {
    warmup: {
      skills: ["set_self_control"],
      contexts: ["pair_work"],
      organization: "dupla",
      taskStyle: "brincadeira",
      intensity: "leve",
    },
    main: {
      skills: ["two_action_continuity", "mini_game_2x2_intro"],
      contexts: ["continuity_game", "reduced_court"],
      organization: "equipes_reduzidas",
      taskStyle: "mini_jogo",
      intensity: "moderada",
    },
    cooldown: {
      skills: [],
      contexts: [],
      organization: "roda",
      taskStyle: "fechamento",
      intensity: "leve",
    },
  },
  selectionReason: "stage base do mês selecionado",
  sourceTrail: [{ methodology: "rede_esperanca", sourceLabel: "Rede Esperança — fevereiro" }],
  ...overrides,
});

describe("pedagogical-renderer", () => {
  it("renders objective with two next steps in Portuguese", () => {
    const obj = renderPedagogicalObjective(makeStep());
    expect(obj).toContain("continuidade com 2 ações");
    expect(obj).toContain("mini jogo 2x2 adaptado");
    expect(obj).not.toContain("_");
  });

  it("renders objective with single next step", () => {
    const obj = renderPedagogicalObjective(makeStep({ nextStep: ["receive_simple"] }));
    expect(obj).toContain("recepção simples");
    expect(obj).not.toContain("mini");
  });

  it("renders fallback objective when nextStep is empty", () => {
    const obj = renderPedagogicalObjective(makeStep({ nextStep: [] }));
    expect(obj).toContain("fase da turma");
  });

  it("renders game form label correctly", () => {
    expect(renderGameFormLabel(makeStep())).toBe("Mini 2x2");
    expect(renderGameFormLabel(makeStep({ gameForm: "mini_3x3" }))).toBe("Mini 3x3");
  });

  it("renders stage focus summary with game form", () => {
    const summary = renderStageFocusSummary(makeStep());
    expect(summary).toContain("Mini 2x2");
    expect(summary).toContain("fundamentos basicos com continuidade");
  });

  it("renders already introduced list in Portuguese", () => {
    const list = renderAlreadyIntroducedList(makeStep());
    expect(list).toContain("toque para cima");
    expect(list).toContain("saque por baixo adaptado");
  });

  it("renders next step list limited to first 2", () => {
    const list = renderNextStepList(
      makeStep({ nextStep: ["two_action_continuity", "mini_game_2x2_intro", "lift_front_intro"] })
    );
    expect(list).toHaveLength(2);
    expect(list[0]).toBe("continuidade com 2 ações");
  });

  it("renders block recommendation summary in court language", () => {
    const summary = renderBlockRecommendationSummary(makeStep(), "main");
    expect(summary).toContain("mini jogo orientado");
    expect(summary).toContain("equipes reduzidas");
    expect(summary).toContain("continuidade com 2 ações");
  });
});
