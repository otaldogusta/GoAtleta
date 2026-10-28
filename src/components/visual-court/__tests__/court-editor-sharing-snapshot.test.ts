import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { CourtEditorWorkspace } from "../CourtEditorWorkspace";

let mockEditor = { cls: { organizationId: "org_1" }, payload: newCourtBoard(), activeDocumentId: "template_0" };
const mockController = jest.fn();
jest.mock("../useCourtEditor", () => ({ useCourtEditor: (...args: unknown[]) => mockController(...args) }));
jest.mock("../CourtWorkspaceView", () => ({ CourtWorkspaceView: "Workspace" }));
jest.mock("../CourtSharing", () => ({ CourtSharing: "Sharing" }));

describe("court sharing during autosave", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const props = { classId: "class_1", onBack: jest.fn() };
  beforeEach(() => { mockController.mockClear(); mockController.mockImplementation(() => mockEditor); mockEditor = { cls: { organizationId: "org_1" }, payload: newCourtBoard(), activeDocumentId: "template_0" }; });
  afterEach(() => { if (tree) act(() => tree.unmount()); });

  it("retains the opened share snapshot when a pending save assigns the document ID", () => {
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorWorkspace, props)); });
    const original = mockEditor.payload;
    act(() => tree.root.findByType("Workspace" as never).props.onShare());
    expect(mockController).toHaveBeenLastCalledWith("class_1", { autosavePaused: true });
    const opened = tree.root.findByType("Sharing" as never);
    mockEditor = { ...mockEditor, activeDocumentId: "saved_document", payload: newCourtBoard("Changed after opening") };
    act(() => tree.update(React.createElement(CourtEditorWorkspace, props)));
    expect(tree.root.findByType("Sharing" as never)).toBe(opened);
    expect(opened.props.scope).toEqual({ org: "org_1", classId: "class_1", key: "template_0" });
    expect(opened.props.payload).toBe(original);
    act(() => opened.props.onClose());
    expect(mockController).toHaveBeenLastCalledWith("class_1", { autosavePaused: false });
  });

  it("does not retain a share on another class or organization", () => {
    act(() => { tree = TestRenderer.create(React.createElement(CourtEditorWorkspace, props)); });
    act(() => tree.root.findByType("Workspace" as never).props.onShare());
    act(() => tree.update(React.createElement(CourtEditorWorkspace, { ...props, classId: "class_2" })));
    expect(tree.root.findAllByType("Sharing" as never)).toHaveLength(0);
    expect(tree.root.findByType("Workspace" as never).props.suspended).toBe(false);
    act(() => tree.update(React.createElement(CourtEditorWorkspace, props)));
    act(() => tree.root.findByType("Workspace" as never).props.onShare());
    expect(tree.root.findAllByType("Sharing" as never)).toHaveLength(1);
    mockEditor = { ...mockEditor, cls: { organizationId: "org_2" } };
    act(() => tree.update(React.createElement(CourtEditorWorkspace, props)));
    expect(tree.root.findAllByType("Sharing" as never)).toHaveLength(0);
  });
});
