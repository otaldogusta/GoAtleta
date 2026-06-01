import { SessionDateNavigator } from "../SessionDateNavigator";
import { SessionEmptyPlanCard } from "../SessionEmptyPlanCard";
import { SessionObjectiveCard } from "../SessionObjectiveCard";
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
      props?: {
        accessibilityLabel?: unknown;
        children?: unknown;
        placeholder?: unknown;
      };
    };
    return [
      typeof maybeNode.props?.accessibilityLabel === "string"
        ? maybeNode.props.accessibilityLabel
        : "",
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
});
