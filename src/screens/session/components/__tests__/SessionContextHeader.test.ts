import { SessionContextHeader } from "../SessionContextHeader";

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

describe("SessionContextHeader", () => {
  it("renders integrated session context labels", () => {
    const element = SessionContextHeader({
      colors: colors as any,
      environment: "academia",
      weeklyPhysicalEmphasis: "potencia_atletica",
      courtGymRelationship: "integrado_transferencia_direta",
      transferTarget: "Salto de ataque e bloqueio",
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Contexto integrado da sessão");
    expect(text).toContain("Academia");
    expect(text).toContain("Potência atlética");
    expect(text).toContain("Academia sustenta a quadra");
    expect(text).toContain("Salto de ataque e bloqueio");
  });

  it("keeps fallback labels when optional values are absent", () => {
    const element = SessionContextHeader({
      colors: colors as any,
      environment: "academia",
      transferTarget: "",
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Não definido");
    expect(text).toContain("Não definida");
  });
});
