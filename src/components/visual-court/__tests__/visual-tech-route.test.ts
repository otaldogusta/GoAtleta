import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import ClassVisualTechRoute from "../../../../app/class/[id]/visual-tech";
import { buildRotation5x1Preset } from "../../../core/visual-court";

const mockGetClassById = jest.fn();
const mockEnsureDefaultVisualPresets = jest.fn();
const mockSaveTechnicalVisual = jest.fn();
const keyboardListeners: Array<(event: KeyboardEvent) => void> = [];

const dispatchKeyboardShortcut = (event: Partial<KeyboardEvent>) => {
  const preventDefault = jest.fn();
  keyboardListeners.forEach((listener) =>
    listener({
      ctrlKey: false,
      key: "",
      metaKey: false,
      preventDefault,
      shiftKey: false,
      ...event,
    } as KeyboardEvent)
  );
  return preventDefault;
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "class_1" }),
  useRouter: () => ({
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    replace: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => {
    const ReactMock = require("react");
    return ReactMock.createElement(ReactMock.Fragment, null, children);
  },
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

jest.mock("../../ui/BackTitleHeader", () => ({
  BackTitleHeader: ({ title }: { title: string }) => {
    const ReactMock = require("react");
    const { Text } = require("react-native");
    return ReactMock.createElement(Text, null, title);
  },
}));

jest.mock("../VisualCourtCanvas", () => ({
  VisualCourtCanvas: ({
    animationProgress,
    animationStepIndex,
    editable,
    onActorSelect,
    onActorMoveEnd,
    selectedActorId,
    showMovementLines,
    stepIndex,
  }: {
    animationProgress?: number;
    animationStepIndex?: number;
    editable?: boolean;
    onActorSelect?: (actorId: string) => void;
    onActorMoveEnd?: (actorId: string, point: { x: number; y: number }) => void;
    selectedActorId?: string | null;
    showMovementLines?: boolean;
    stepIndex: number;
  }) => {
    const ReactMock = require("react");
    const { Pressable, Text } = require("react-native");
    return ReactMock.createElement(
      Pressable,
      {
        accessibilityLabel: "Mover p1",
        onPress: () => {
          onActorSelect?.("p1");
          return editable ? onActorMoveEnd?.("p1", { x: 0.33, y: 0.77 }) : undefined;
        },
      },
      ReactMock.createElement(
        Text,
        null,
        `Canvas step ${stepIndex} ${editable ? "editavel" : "bloqueado"} progress ${
          typeof animationProgress === "number" ? animationProgress.toFixed(2) : "sem-previa"
        } animação ${animationStepIndex ?? "sem-animação"} setas ${
          showMovementLines ? "visiveis" : "escondidas"
        } selecionado ${selectedActorId ?? "nenhum"}`
      )
    );
  },
}));

jest.mock("../../../ui/Button", () => ({
  Button: ({
    disabled,
    label,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    onPress: () => void;
  }) => {
    const ReactMock = require("react");
    const { Pressable, Text } = require("react-native");
    return ReactMock.createElement(
      Pressable,
      {
        accessibilityLabel: label,
        accessibilityState: { disabled: Boolean(disabled) },
        disabled,
        onPress,
      },
      ReactMock.createElement(Text, null, label)
    );
  },
}));

jest.mock("../../../ui/app-theme", () => ({
  useAppTheme: () => ({
    mode: "light",
    colors: {
      background: "#FFFFFF",
      border: "#D1D5DB",
      card: "#FFFFFF",
      dangerBorder: "#DC2626",
      dangerSolidBg: "#DC2626",
      dangerSolidText: "#FFFFFF",
      infoBg: "#DBEAFE",
      infoText: "#1D4ED8",
      inputBg: "#F8FAFC",
      muted: "#64748B",
      primaryBg: "#16A34A",
      primaryText: "#FFFFFF",
      secondaryBg: "#F1F5F9",
      secondaryText: "#334155",
      successBg: "#DCFCE7",
      successText: "#166534",
      text: "#0F172A",
      warningBg: "#FEF3C7",
      warningText: "#92400E",
    },
  }),
}));

jest.mock("../../../db/seed", () => ({
  getClassById: (...args: unknown[]) => mockGetClassById(...args),
  ensureDefaultVisualPresets: (...args: unknown[]) =>
    mockEnsureDefaultVisualPresets(...args),
  saveTechnicalVisual: (...args: unknown[]) => mockSaveTechnicalVisual(...args),
}));

const collectChildrenText = (value: unknown): string[] => {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectChildrenText);
  return [];
};

const collectText = (root: TestRenderer.ReactTestInstance) =>
  root
    .findAll(() => true)
    .flatMap((node) => collectChildrenText(node.props.children))
    .join(" ")
    .replace(/\s+/g, " ");

const findPressableByText = (
  root: TestRenderer.ReactTestInstance,
  text: string
) => {
  const match = root.findAll(
    (node) => typeof node.props.onPress === "function" && collectText(node).includes(text)
  )[0];
  if (!match) throw new Error(`Pressable with text "${text}" not found.`);
  return match;
};

describe("ClassVisualTechRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    keyboardListeners.length = 0;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        addEventListener: jest.fn((type: string, listener: (event: KeyboardEvent) => void) => {
          if (type === "keydown") keyboardListeners.push(listener);
        }),
        removeEventListener: jest.fn((type: string, listener: (event: KeyboardEvent) => void) => {
          if (type !== "keydown") return;
          const index = keyboardListeners.indexOf(listener);
          if (index >= 0) keyboardListeners.splice(index, 1);
        }),
      },
    });
    mockGetClassById.mockResolvedValue({
      id: "class_1",
      name: "Turma Sub-15",
      organizationId: "org_1",
    });
    mockEnsureDefaultVisualPresets.mockResolvedValue([]);
    mockSaveTechnicalVisual.mockResolvedValue(null);
  });

  it("loads the local preset, advances steps and handles save fallback", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    expect(collectText(tree!.root)).toContain("Quadra visual local carregada");
    expect(collectText(tree!.root)).toContain("5x1 base - recepção em 3");
    expect(collectText(tree!.root)).toContain("5x1 base - equipe sacando");
    expect(collectText(tree!.root)).toContain("Defesa base — 6 fundo");
    expect(collectText(tree!.root)).toContain("Grade didática");
    expect(collectText(tree!.root)).toContain("6 passos");
    expect(collectText(tree!.root)).toContain("P1 - Antes do saque");
    expect(collectText(tree!.root)).toContain("Canvas step 0 bloqueado");
    expect(collectText(tree!.root)).toContain("Editar posições");
    expect(collectText(tree!.root)).toContain("Animar movimento");
    expect(collectText(tree!.root)).toContain("Alinhar passe");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Sem animação disponível" })
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: true });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Animar movimento" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Animando movimento");

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Alterações locais ainda não salvas");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Reproduzir animação" })
    ).toBeTruthy();
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: false });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Próximo passo" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("P6 - Antes do saque");
    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Passo anterior" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("P1 - Antes do saque");

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Alinhar passe" }).props.onPress();
    });
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Sem animação disponível" })
    ).toBeTruthy();
    expect(collectText(tree!.root)).toContain("setas escondidas");
    expect(collectText(tree!.root)).not.toContain("Animando movimento");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: true });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    expect(mockSaveTechnicalVisual).not.toHaveBeenCalled();
  });

  it("edits actor position with the pencil mode without creating a manual trajectory", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Editar posições" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Editando posições");

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Posição editada sem seta");

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
    expect(
      saveInput.payload.timeline.steps[0].trajectories?.some(
        (trajectory: { id: string }) => trajectory.id === "manual-move-p1"
      )
    ).not.toBe(true);
  });

  it("adds an extra actor from the legend and saves it in the current frame", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Adicionar P" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain("P adicionado na quadra");
    expect(collectText(tree!.root)).toContain("Editando posições");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: false });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });

    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "p_extra_1",
          label: "P",
          role: "outside",
        }),
      ])
    );
    expect(saveInput.payload.timeline.steps[0].visibleActorIds).toContain("p_extra_1");
    expect(saveInput.payload.timeline.steps[0].actorPositions.p_extra_1).toEqual({
      x: 0.5,
      y: 0.5,
    });
  });

  it("selects an actor on the court and duplicates it in the current frame", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Selecionado P");
    expect(collectText(tree!.root)).toContain("Duplicar");
    expect(collectText(tree!.root)).toContain("Excluir");

    act(() => {
      tree!.root
        .findByProps({ accessibilityLabel: "Duplicar posição selecionada" })
        .props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Posição duplicada");
    expect(collectText(tree!.root)).toContain("selecionado p_extra_1");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: false });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });

    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.actors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "p_extra_1",
          label: "P",
        }),
      ])
    );
    expect(saveInput.payload.timeline.steps[0].visibleActorIds).toContain("p_extra_1");
    expect(saveInput.payload.timeline.steps[0].actorPositions.p_extra_1).toEqual({
      x: 0.84,
      y: 0.74,
    });
  });

  it("selects an actor on the court and removes it from the current frame", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });
    act(() => {
      tree!.root
        .findByProps({ accessibilityLabel: "Excluir posição selecionada" })
        .props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Posição excluída do frame atual");
    expect(collectText(tree!.root)).not.toContain("Selecionado P");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: false });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });

    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.actors).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "p1" })])
    );
    expect(saveInput.payload.timeline.steps[0].visibleActorIds).not.toContain("p1");
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toBeUndefined();
    expect(saveInput.payload.timeline.steps[1].visibleActorIds).toContain("p1");
  });

  it("keeps save disabled when align pass only restores the initial view", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Alinhar passe" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain(
      "Linha de passe voltou para a posição inicial"
    );
    expect(collectText(tree!.root)).not.toContain("Alterações locais ainda não salvas");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: true });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    expect(mockSaveTechnicalVisual).not.toHaveBeenCalled();
  });

  it("shows align positions outside the reception card without marking the court dirty", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      findPressableByText(tree!.root, "5x1 base - equipe sacando").props.onPress();
    });

    expect(collectText(tree!.root)).toContain("P1 - saque");
    expect(collectText(tree!.root)).toContain("P1 - Antes do saque");
    expect(collectText(tree!.root)).not.toContain("Momento");
    expect(collectText(tree!.root)).not.toContain("Após o saque");
    expect(collectText(tree!.root)).toContain("Alinhar posições");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Alinhar posições" })
    ).toBeTruthy();

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Alinhar posições" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Posições voltaram para o início do frame");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: true });
  });

  it("creates and saves a play animation only when animation mode is enabled", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });
    expect(collectText(tree!.root)).not.toContain("Animação com setas ajustada");

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Animar movimento" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Animando movimento");

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });
    expect(collectText(tree!.root)).toContain("Animação com setas ajustada");

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
    expect(saveInput.payload.timeline.steps[0].trajectories).toContainEqual({
      id: "manual-move-p1",
      actorId: "p1",
      points: [
        buildRotation5x1Preset().timeline.steps[0].baselineActorPositions!.p1,
        { x: 0.33, y: 0.77 },
      ],
      color: "#60A5FA",
    });
  });

  it("resets saved animations for the current frame without moving actors", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Animar movimento" }).props.onPress();
    });
    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Redefinir animações");

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Redefinir animações" }).props.onPress();
    });

    expect(collectText(tree!.root)).toContain("Animações do frame redefinidas");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Sem animação disponível" })
    ).toBeTruthy();

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
    expect(saveInput.payload.timeline.steps[0].trajectories).toBeUndefined();
    expect(saveInput.payload.timeline.steps[0].transitions).toBeUndefined();
  });

  it("saves the latest dragged position even when save is pressed immediately", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Editar posições" }).props.onPress();
    });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });

    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
  });

  it("keeps the final animation preview after playback finishes", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    jest.useFakeTimers();
    try {
      act(() => {
        tree!.root.findByProps({ accessibilityLabel: "Animar movimento" }).props.onPress();
      });
      await act(async () => {
        tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
      });
      act(() => {
        tree!.root.findByProps({ accessibilityLabel: "Reproduzir animação" }).props.onPress();
      });
      expect(collectText(tree!.root)).toContain("Canvas step 0 bloqueado progress 0.00 animação 0");

      act(() => {
        jest.runOnlyPendingTimers();
      });

      expect(collectText(tree!.root)).toContain("Canvas step 0 bloqueado progress 1.00 animação 0");
      expect(
        tree!.root.findByProps({ accessibilityLabel: "Reproduzir animação" })
      ).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("undoes and redoes local court edits with keyboard shortcuts", async () => {
    let tree: TestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = TestRenderer.create(React.createElement(ClassVisualTechRoute));
    });

    act(() => {
      tree!.root.findByProps({ accessibilityLabel: "Animar movimento" }).props.onPress();
    });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Mover p1" }).props.onPress();
    });

    act(() => {
      dispatchKeyboardShortcut({ ctrlKey: true, key: "z" });
    });
    expect(collectText(tree!.root)).toContain("Ação desfeita");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: true });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    expect(mockSaveTechnicalVisual).not.toHaveBeenCalled();

    mockSaveTechnicalVisual.mockClear();
    act(() => {
      dispatchKeyboardShortcut({ ctrlKey: true, key: "z", shiftKey: true });
    });
    expect(collectText(tree!.root)).toContain("Ação refeita");
    expect(
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.accessibilityState
    ).toEqual({ disabled: false });

    await act(async () => {
      tree!.root.findByProps({ accessibilityLabel: "Salvar" }).props.onPress();
    });
    const [saveInput] = mockSaveTechnicalVisual.mock.calls[0];
    expect(saveInput.payload.timeline.steps[0].actorPositions.p1).toEqual({
      x: 0.33,
      y: 0.77,
    });
  });
});
