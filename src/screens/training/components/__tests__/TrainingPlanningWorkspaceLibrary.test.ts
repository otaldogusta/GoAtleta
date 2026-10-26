import { createElement } from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ClassGroup } from "../../../../core/models";
import type { TrainingPlanSummary } from "../../../../db/training";
import { TrainingPlanningWorkspaceLibrary } from "../TrainingPlanningWorkspaceLibrary";

jest.mock("../../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: {
  card: "#fff", border: "#ddd", text: "#111", muted: "#777", primaryBg: "#167", inputBg: "#eee",
} }) }));
jest.mock("../../../../ui/Pressable", () => ({ Pressable: "Pressable" }));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: "Icon" }));

const text = (node: unknown): string => {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join(" ");
  return node && typeof node === "object" ? text((node as { props?: { children?: unknown } }).props?.children) : "";
};

it("searches all lightweight summaries and selects a result without requiring a plan body", async () => {
  const plans: TrainingPlanSummary[] = [
    { id: "old", classId: "class-a", title: "Plano antigo", tags: ["saque"], applyDate: "2025-01-01", createdAt: "2025-01-01" },
    { id: "current", classId: "class-a", title: "Plano recente", tags: ["recepção"], applyDate: "2026-10-24", createdAt: "2026-10-24" },
  ];
  const onSelect = jest.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(createElement(TrainingPlanningWorkspaceLibrary, {
      collapsed: false, plans, classes: [{ id: "class-a", name: "Turma A", unit: "Unidade", daysOfWeek: [1] } as ClassGroup],
      onToggleCollapsed: jest.fn(), onSelectPlan: onSelect,
    }));
  });
  act(() => renderer.root.findByProps({ accessibilityLabel: "Buscar plano, turma ou unidade" }).props.onChangeText("saque"));
  const row = renderer.root.findAllByType("Pressable" as never).find(node => node.props.accessibilityState?.selected === false &&
    text(node.props.children).includes("Plano antigo"));
  expect(row).toBeDefined();
  act(() => row!.props.onPress());
  expect(onSelect).toHaveBeenCalledWith(plans[0]);
  expect(onSelect.mock.calls[0][0]).not.toHaveProperty("warmup");
  expect(onSelect.mock.calls[0][0]).not.toHaveProperty("pedagogy");
  act(() => renderer.unmount());
});
