import { Animated } from "react-native";

import { SessionDateNavigator } from "../SessionDateNavigator";
import { SessionEmptyPlanCard } from "../SessionEmptyPlanCard";
import { SessionObjectiveCard } from "../SessionObjectiveCard";
import { SessionAppliedPlanSection } from "../SessionAppliedPlanSection";
import { SessionPlanGenerationState } from "../SessionPlanGenerationState";
import { SessionResistanceTrainingSection } from "../SessionResistanceTrainingSection";
import { SessionReportTab } from "../SessionReportTab";
import { SessionTabBar } from "../SessionTabBar";
import { SessionTrainingBlockCard } from "../SessionTrainingBlockCard";

const collectTextAndLabels = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectTextAndLabels(item));
  }
  if (typeof node === "object") {
    const maybeNode = node as {
      type?: unknown;
      props?: {
        accessibilityLabel?: unknown;
        children?: unknown;
        label?: unknown;
        placeholder?: unknown;
      };
    };
    if (
      typeof maybeNode.type === "function" &&
      maybeNode.props &&
      /^Session/.test(maybeNode.type.name)
    ) {
      return collectTextAndLabels(maybeNode.type(maybeNode.props));
    }
    return [
      typeof maybeNode.props?.accessibilityLabel === "string"
        ? maybeNode.props.accessibilityLabel
        : "",
      typeof maybeNode.props?.label === "string" ? maybeNode.props.label : "",
      typeof maybeNode.props?.placeholder === "string" ? maybeNode.props.placeholder : "",
      ...collectTextAndLabels(maybeNode.props?.children),
    ].filter(Boolean);
  }
  return [];
};

const colors = {
  backgroundSubtle: "#f8fafc",
  surface: "#fff",
  surfaceElevated: "#fff",
  textPrimary: "#111",
  textSecondary: "#333",
  textMuted: "#666",
  borderSubtle: "#ddd",
  borderStrong: "#aaa",
  primary: "#22c55e",
  primaryPressed: "#16a34a",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
  background: "#fff",
  card: "#fff",
  border: "#ddd",
  text: "#111",
  muted: "#666",
  placeholder: "#999",
  inputBg: "#fff",
  inputText: "#111",
  primaryBg: "#111",
  primaryText: "#fff",
  primaryDisabledBg: "#bbb",
  secondaryBg: "#f4f4f4",
  secondaryText: "#111",
  dangerBg: "#fee2e2",
  dangerBorder: "#fecaca",
  dangerText: "#991b1b",
  thumbFallback: "#e5e7eb",
  successBg: "#dcfce7",
  successText: "#166534",
  successBorder: "#bbf7d0",
  warningBg: "#fef3c7",
  warningText: "#92400e",
  warningBorder: "#fde68a",
  dangerSolidBg: "#dc2626",
  dangerSolidText: "#fff",
  infoBg: "#dbeafe",
  infoText: "#1d4ed8",
} as const;

describe("session training UI components", () => {
  it("renders the objective card in view and saving edit states", () => {
    const viewText = collectTextAndLabels(
      SessionObjectiveCard({
        colors: colors as any,
        label: "Objetivo da aula",
        placeholder: "Objetivo da aula",
        objective: "Desenvolver levantamento em jogo reduzido.",
        fallbackObjective: "Conduzir treino do dia",
        guideline: "Priorizar repetibilidade técnica.",
        isEditing: false,
        draft: "",
        isSaving: false,
        onChangeDraft: jest.fn(),
        onStartEdit: jest.fn(),
        onSave: jest.fn(),
        onCancel: jest.fn(),
      })
    ).join(" ");

    expect(viewText).toContain("Objetivo da aula");
    expect(viewText).toContain("Desenvolver levantamento");
    expect(viewText).toContain("Priorizar repetibilidade técnica.");
    expect(viewText).toContain("Editar objetivo");

    const savingText = collectTextAndLabels(
      SessionObjectiveCard({
        colors: colors as any,
        label: "Objetivo da aula",
        placeholder: "Objetivo da aula",
        objective: "",
        fallbackObjective: "Conduzir treino do dia",
        guideline: "",
        isEditing: true,
        draft: "Objetivo editado.",
        isSaving: true,
        onChangeDraft: jest.fn(),
        onStartEdit: jest.fn(),
        onSave: jest.fn(),
        onCancel: jest.fn(),
      })
    ).join(" ");

    expect(savingText).toContain("Objetivo da aula");
    expect(savingText).toContain("Salvando");
    expect(savingText).toContain("Cancelar");
  });

  it("renders a training block with preview items and updated state", () => {
    const text = collectTextAndLabels(
      SessionTrainingBlockCard({
        colors: colors as any,
        block: {
          key: "main",
          label: "Parte principal • 45 min",
          previewItems: ["Passe orientado", "3x3 com três contatos"],
          updated: true,
        },
        onPress: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Parte principal");
    expect(text).toContain("Passe orientado");
    expect(text).toContain("3x3 com três contatos");
    expect(text).toContain("Atualizado");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders empty plan actions with and without saved plans", () => {
    const noPlanText = collectTextAndLabels(
      SessionEmptyPlanCard({
        colors: colors as any,
        title: "Sem plano aplicado",
        description: "Escolha um treino salvo ou crie um novo plano de aula.",
        applyTrainingLabel: "Aplicar treino",
        generateAutomaticPlanLabel: "Gerar plano automático",
        showSavedClassPlans: false,
        savedPlans: [],
        isGeneratingPlan: false,
        isSavingPlan: false,
        onToggleSavedClassPlans: jest.fn(),
        onGeneratePlan: jest.fn(),
        onApplySavedPlan: jest.fn(),
      })
    ).join(" ");

    expect(noPlanText).toContain("Sem plano aplicado");
    expect(noPlanText).toContain("Aplicar treino");
    expect(noPlanText).toContain("Gerar plano automático");

    const savedText = collectTextAndLabels(
      SessionEmptyPlanCard({
        colors: colors as any,
        title: "Sem plano aplicado",
        description: "Escolha um treino salvo ou crie um novo plano de aula.",
        applyTrainingLabel: "Aplicar treino",
        generateAutomaticPlanLabel: "Gerar plano automático",
        showSavedClassPlans: true,
        savedPlans: [
          {
            id: "plan_1",
            title: "Treino técnico",
            meta: "Sábado • v2",
            preview: "Aquecimento, jogo reduzido.",
            applicationLabel: "Aplicação direta em 06/06/2026.",
            isApplying: true,
          },
        ],
        isGeneratingPlan: false,
        isSavingPlan: false,
        onToggleSavedClassPlans: jest.fn(),
        onGeneratePlan: jest.fn(),
        onApplySavedPlan: jest.fn(),
      })
    ).join(" ");

    expect(savedText).toContain("Planos salvos desta turma");
    expect(savedText).toContain("Treino técnico");
    expect(savedText).toContain("Aplicando...");
  });

  it("renders date navigation labels", () => {
    const text = collectTextAndLabels(
      SessionDateNavigator({
        colors: colors as any,
        dateLabel: "06/06/2026",
        timeLabel: "09:00 - 10:00",
        fallbackTimeLabel: "Horário não definido",
        onPrevious: jest.fn(),
        onNext: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Aula anterior");
    expect(text).toContain("Próxima aula");
    expect(text).toContain("06/06/2026");
    expect(text).toContain("09:00 - 10:00");
  });

  it("renders plan generation status and training skeletons", () => {
    const text = collectTextAndLabels(
      SessionPlanGenerationState({
        colors: colors as any,
        label: "Gerando plano automático",
        subtitle: "Preparando blocos do treino.",
        dots: [new Animated.Value(1), new Animated.Value(1), new Animated.Value(1)],
        pulse: new Animated.Value(1) as any,
        animation: new Animated.Value(0),
        showBlockSkeletons: true,
      })
    ).join(" ");

    expect(text).toContain("Gerando plano automático");
    expect(text).toContain("Preparando blocos do treino.");
    expect(text).toContain("Aquecimento");
    expect(text).toContain("Parte principal");
    expect(text).toContain("Volta a calma");
  });

  it("renders resistance section with actionable unavailable notice", () => {
    const text = collectTextAndLabels(
      SessionResistanceTrainingSection({
        colors: colors as any,
        showUnavailableNotice: true,
        unavailableTitle: "Sessão resistida indisponível",
        unavailableDescription:
          "O contexto da semana indica academia, mas os exercícios ainda não foram gerados.",
        unavailableActions: [
          {
            label: "Regenerar sessão",
            onPress: jest.fn(),
            variant: "primary",
          },
        ],
        resistancePreview: {
          sessionEnvironment: "mista",
          weeklyContext: {
            weeklyPhysicalEmphasis: "forca_base",
            courtGymRelationship: "integrado_transferencia_direta",
          },
          resistancePlan: {
            primaryGoal: "Força base",
            label: "Força base",
            transferTarget: "salto e estabilização",
            estimatedDurationMin: 20,
            exercises: [
              {
                name: "Agachamento",
                category: "membros_inferiores",
                sets: 2,
                reps: "8",
                rest: "60s",
              },
            ],
          } as any,
          durationMin: 20,
        },
        bridgeDescription: "Conectar força ao salto antes do jogo reduzido.",
      })
    ).join(" ");

    expect(text).toContain("Sessão resistida indisponível");
    expect(text).toContain("Regenerar sessão");
    expect(text).toContain("Sessão resistida");
    expect(text).toContain("Ponte para a quadra");
    expect(text).toContain("Conectar força ao salto");
  });

  it("renders applied plan blocks and keeps internal explanation hidden", () => {
    const text = collectTextAndLabels(
      SessionAppliedPlanSection({
        colors: colors as any,
        blocks: [
          {
            key: "warmup",
            label: "Aquecimento • 10 min",
            previewItems: ["Mobilidade e ativação"],
            updated: false,
          },
          {
            key: "main",
            label: "Parte principal • 45 min",
            previewItems: ["3x3 com três contatos"],
            updated: true,
          },
          {
            key: "cooldown",
            label: "Volta à calma • 5 min",
            previewItems: ["Feedback final"],
            updated: false,
          },
        ],
        isRemovingAppliedPlan: false,
        onSelectBlock: jest.fn(),
        onRemoveAppliedPlan: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Aquecimento");
    expect(text).toContain("Parte principal");
    expect(text).toContain("Volta à calma");
    expect(text).toContain("Remover plano do dia");
    expect(text).not.toContain("Academia não priorizada");
    expect(text).not.toContain("Detalhes do plano");
  });

  it("renders the report tab fields, training preview and photo actions", () => {
    const nullRef = { current: null } as any;
    const text = collectTextAndLabels(
      SessionReportTab({
        colors: colors as any,
        containerRef: nullRef,
        pseTriggerRef: nullRef,
        techniqueTriggerRef: nullRef,
        onContainerLayout: jest.fn(),
        sessionDateLabel: "06/06/2026",
        hasExistingReport: true,
        pse: 6,
        technique: "boa",
        participantsCount: "12",
        activity: "Passe orientado em estações.",
        conclusion: "Turma manteve atenção e evolução técnica.",
        autoActivity: "Aquecimento / passe orientado / roda rápida.",
        canApplyAutoActivity: false,
        showAppliedPreview: true,
        canSuggestActivity: true,
        canSuggestConclusion: true,
        isRewritingActivity: false,
        isRewritingConclusion: false,
        reportPhotoUris: ["data:image/png;base64,abc"],
        photoLimit: 3,
        isPickingPhoto: false,
        reportHasChanges: true,
        showPsePicker: true,
        showTechniquePicker: false,
        showPsePickerContent: true,
        showTechniquePickerContent: true,
        pseTriggerLayout: null,
        techniqueTriggerLayout: null,
        containerWindow: null,
        psePickerAnimationStyle: {},
        techniquePickerAnimationStyle: {},
        photoActionIndex: 0,
        onTogglePsePicker: jest.fn(),
        onToggleTechniquePicker: jest.fn(),
        onClosePickers: jest.fn(),
        onSelectPse: jest.fn(),
        onSelectTechnique: jest.fn(),
        onChangeParticipantsCount: jest.fn(),
        onChangeActivity: jest.fn(),
        onChangeConclusion: jest.fn(),
        onRewriteActivity: jest.fn(),
        onRewriteConclusion: jest.fn(),
        onApplyAutoActivity: jest.fn(),
        onToggleAppliedPreview: jest.fn(),
        onPickPhoto: jest.fn(),
        onOpenPhotoActions: jest.fn(),
        onClosePhotoActions: jest.fn(),
        onReplacePhoto: jest.fn(),
        onRemovePhoto: jest.fn(),
        onSaveReport: jest.fn(),
        onSaveAndGenerateReport: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Relatório da aula");
    expect(text).toContain("06/06/2026");
    expect(text).toContain("Editando relatório existente");
    expect(text).toContain("PSE (0-10)");
    expect(text).toContain("Técnica geral");
    expect(text).toContain("Número de participantes");
    expect(text).toContain("Atividade");
    expect(text).toContain("Conclusão");
    expect(text).toContain("Preview do treino aplicado");
    expect(text).toContain("Aquecimento / passe orientado");
    expect(text).toContain("Fotos");
    expect(text).toContain("Tirar foto");
    expect(text).toContain("Galeria");
    expect(text).toContain("Foto do relatório");
    expect(text).toContain("Substituir (câmera)");
    expect(text).toContain("Gerar relatório");
    expect(text).not.toContain("Academia não priorizada");
    expect(text).not.toContain("Detalhes do plano");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });

  it("renders only training and report tabs for the session screen", () => {
    const text = collectTextAndLabels(
      SessionTabBar({
        colors: colors as any,
        tabs: [
          { id: "treino", label: "Treino" },
          { id: "relatório", label: "Fazer relatório" },
        ],
        activeTab: "treino",
        tabAnimations: {
          treino: new Animated.Value(1),
          relatório: new Animated.Value(0),
        },
        onSelectTab: jest.fn(),
      })
    ).join(" ");

    expect(text).toContain("Treino");
    expect(text).toContain("Fazer relatório");
    expect(text).not.toContain("Scouting");
    expect(text).not.toMatch(/[\uF000-\uF8FF]/);
  });
});
