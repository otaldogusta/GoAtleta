import { SessionResistanceNotice } from "../SessionResistanceNotice";

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

describe("SessionResistanceNotice", () => {
  it("renders title, description and actions", () => {
    const element = SessionResistanceNotice({
      colors: colors as any,
      title: "Sessão resistida indisponível",
      description: "Os exercícios ainda não foram gerados.",
      tone: "warning",
      actions: [
        { label: "Regenerar sessão", onPress: jest.fn(), variant: "primary" },
        { label: "Usar treino de quadra", onPress: jest.fn() },
      ],
    });

    const text = collectText(element).join(" ");

    expect(text).toContain("Sessão resistida indisponível");
    expect(text).toContain("Os exercícios ainda não foram gerados.");
    expect(text).toContain("Regenerar sessão");
    expect(text).toContain("Usar treino de quadra");
  });
});
