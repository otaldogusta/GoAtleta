import { SessionResistanceBlock } from "../SessionResistanceBlock";

const collectText = (node: unknown): string[] => {
  if (node == null) return [];
  if (typeof node === "string" || typeof node === "number") {
    return [String(node)];
  }
  if (Array.isArray(node)) {
    return node.flatMap((item) => collectText(item));
  }
  if (typeof node === "object") {
    const maybeNode = node as { props?: { children?: unknown } };
    return collectText(maybeNode.props?.children);
  }
  return [];
};

const colors = {
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
  warningBg: "#fef3c7",
  warningText: "#92400e",
  dangerSolidBg: "#dc2626",
  dangerSolidText: "#fff",
  infoBg: "#dbeafe",
  infoText: "#1d4ed8",
} as const;

describe("SessionResistanceBlock", () => {
  it("renders exercise table with real domain fields", () => {
    const element = SessionResistanceBlock({
      colors: colors as any,
      durationMin: 45,
      resistancePlan: {
        id: "plan-1",
        label: "Força Base",
        primaryGoal: "forca_base",
        transferTarget: "Salto e bloqueio",
        estimatedDurationMin: 45,
        exercises: [
          {
            name: "Agachamento",
            category: "membros_inferiores",
            sets: 4,
            reps: "6-8",
            rest: "90s",
            notes: "Controle na descida",
          },
        ],
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Sessão resistida");
    expect(text).toContain("Força Base");
    expect(text).toContain("Salto e bloqueio");
    expect(text).toContain("Impacto principal na quadra:");
    expect(text).toContain("Agachamento");
    expect(text).toContain("4 séries · 6-8 reps · 90s");
    expect(text).toContain("Impacto na quadra");
    expect(text).toContain("Controle na descida");
  });

  it("keeps rendering with partial exercise data", () => {
    const element = SessionResistanceBlock({
      colors: colors as any,
      resistancePlan: {
        id: "plan-2",
        label: "",
        primaryGoal: "potencia_atletica",
        transferTarget: "",
        estimatedDurationMin: 40,
        exercises: [
          {
            name: "",
            category: "potencia",
            sets: 3,
            reps: "5",
            rest: "",
          },
        ],
      },
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("potencia_atletica");
    expect(text).toContain("Exercício 1");
    expect(text).toContain("3 séries · 5 reps · intervalo não definido");
    expect(text).toContain("Duração prevista:");
    expect(text).toContain("40");
    expect(text).toContain("min");
  });
});
