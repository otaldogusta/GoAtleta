import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ClassGroup, Student } from "../../../core/models";
import { StudentProfilePage } from "../StudentProfilePage";
import { Pressable } from "../../../ui/Pressable";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock("../../../ui/app-theme", () => ({ useAppTheme: () => ({ colors: { text: "#fff", muted: "#aaa", border: "#222", card: "#111", primaryBg: "#0f0" } }) }));
jest.mock("../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("react-native-svg", () => ({ __esModule: true, default: "Svg", Circle: "Circle", Path: "Path", Rect: "Rect" }));

const student = { id: "athlete", name: "Ana Atleta", age: 12, birthDate: "", membershipStatus: "active", guardianName: "Responsável", cpfMasked: "private-document", healthIssueNotes: "private-health" } as Student;
const classGroup = { id: "class", name: "Turma Azul", unit: "Central", daysOfWeek: [1, 3], startTime: "18:00", endTime: "19:00" } as ClassGroup;

it("opens the read-only profile and delegates editing, photo, class and message actions", () => {
  const onBack = jest.fn(), onEdit = jest.fn(), onEditPhoto = jest.fn(), onMessage = jest.fn(), onManageClass = jest.fn();
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(StudentProfilePage, { student, classGroup, organizationName: "Rede", organizationId: "org", canViewFinance: false, photoUri: null, onBack, onEdit, onEditPhoto, onMessage, onManageClass })); });
  const text = JSON.stringify(view.toJSON());
  expect(text).toContain("Ana Atleta");
  expect(text).toContain("Turma Azul");
  expect(text).not.toContain("private-document");
  expect(text).not.toContain("private-health");
  expect(view.root.findAllByType("TextInput" as React.ElementType)).toHaveLength(0);
  for (const [label, callback] of [["Editar perfil", onEdit], ["Editar foto do perfil", onEditPhoto], ["Gerenciar turma do atleta", onManageClass], ["Mensagem", onMessage], ["Voltar", onBack]] as const) {
    act(() => view.root.findAll(n => n.props.accessibilityRole === "button" && n.props.accessibilityLabel === label && typeof n.props.onPress === "function")[0].props.onPress());
    expect(callback).toHaveBeenCalledTimes(1);
  }
  act(() => view.root.findAllByType(Pressable).filter(n => n.props.accessibilityRole === "tab")[1].props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain("Turma Azul");
  expect(JSON.stringify(view.toJSON())).not.toContain("Responsável");
  expect(view.root.findAll(n => n.props.accessibilityLabel === "Editar perfil na aba")).toHaveLength(0);
  expect(JSON.stringify(view.toJSON())).not.toContain("Financeiro");
  act(() => view.unmount());
});

it("shows the finance tab only to an authorized viewer", () => {
  let view!: TestRenderer.ReactTestRenderer;
  act(() => { view = TestRenderer.create(React.createElement(StudentProfilePage, { student, classGroup, organizationName: "Rede", organizationId: "org", canViewFinance: true, photoUri: null, onBack: jest.fn(), onEdit: jest.fn(), onEditPhoto: jest.fn(), onMessage: jest.fn(), onManageClass: jest.fn() })); });
  expect(JSON.stringify(view.toJSON())).toContain("Financeiro");
  act(() => view.unmount());
});
