import React from "react";
import { webcrypto } from "node:crypto";
import TestRenderer, { act } from "react-test-renderer";
import { newCourtBoard } from "../../../core/visual-court-editor";
import { exportCourt } from "../court-export";
import { StandaloneCourtWorkspace } from "../StandaloneCourtWorkspace";
import type { useStandaloneCourt } from "../useStandaloneCourt";

let mockOrg: string | null;
let mockUser: string | null;
jest.mock("../../../auth/auth", () => ({ useAuth: () => ({ session: mockUser ? { user: { id: mockUser } } : null }) }));
jest.mock("../../../providers/organization-context", () => ({ useOptionalOrganization: () => mockOrg ? { activeOrganizationId: mockOrg } : null }));
jest.mock("../CourtWorkspaceView", () => ({ CourtWorkspaceView: "Workspace" }));
jest.mock("../CourtShareClassPicker", () => ({ CourtShareClassPicker: "ClassPicker" }));
jest.mock("../CourtSharing", () => ({ CourtSharing: "Sharing" }));
jest.mock("../court-export", () => ({ exportCourt: jest.fn() }));

describe("sharing from the independent court", () => {
  let tree: TestRenderer.ReactTestRenderer;
  const screen = () => React.createElement(StandaloneCourtWorkspace, { onBack: jest.fn() });
  const workspace = () => tree.root.findByType("Workspace" as never).props;
  const editor = (): ReturnType<typeof useStandaloneCourt> => workspace().editor;
  const picker = () => tree.root.findByType("ClassPicker" as never).props;
  const sharing = () => tree.root.findAllByType("Sharing" as never);

  beforeEach(() => {
    mockOrg = "org-1"; mockUser = "prof-1"; jest.clearAllMocks();
    act(() => { tree = TestRenderer.create(screen()); });
  });
  afterEach(() => act(() => tree.unmount()));

  it("opens the current snapshot for the selected class and resumes the same play on close", async () => {
    const model = editor().documents.find(document => document.id === "template_6x0")!;
    await act(async () => { await editor().open(model.payload, model.id); });
    act(() => editor().commit(payload => ({ ...payload, editor: { ...payload.editor!, title: "Ataque da ponta" } }), 2));
    const edited = editor().payload;
    act(() => workspace().onShare());
    expect(workspace().suspended).toBe(true);
    expect(sharing()).toHaveLength(0);
    act(() => picker().onSelect({ org: "org-2", classId: "other" }));
    expect(sharing()).toHaveLength(0);
    act(() => picker().onSelect({ org: "org-1", classId: "class-1" }));
    expect(sharing()[0].props.payload).toBe(edited);
    expect(sharing()[0].props.scope).toEqual({ org: "org-1", classId: "class-1", key: "standalone:template_6x0" });
    act(() => sharing()[0].props.onClose());
    expect(workspace().suspended).toBe(false);
    expect(editor().stepIndex).toBe(2);
    expect(editor().payload).toBe(edited);
  });

  it("keys imported files by their original contents, preserving their link across undo and reimport", async () => {
    jest.replaceProperty(globalThis, "crypto", webcrypto as unknown as Crypto);
    try {
      const board = newCourtBoard("Importada");
      await act(async () => { await editor().open(board); });
      const importedKey = editor().shareKey;
      expect(importedKey).toMatch(/^standalone:import:[0-9a-f]{64}$/);
      const otherPlay = { ...board, editor: { ...board.editor!, title: "Outra jogada com a mesma primeira etapa" } };
      await act(async () => { await editor().open(otherPlay); });
      expect(editor().shareKey).not.toBe(importedKey);
      act(() => editor().undo());
      expect(editor().shareKey).toBe(importedKey);
      await act(async () => { await editor().open(JSON.parse(JSON.stringify(board))); });
      expect(editor().shareKey).toBe(importedKey);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it.each(["account", "organization"])("closes sharing when the %s changes", change => {
    act(() => workspace().onShare());
    act(() => picker().onSelect({ org: "org-1", classId: "class-1" }));
    if (change === "account") mockUser = "prof-2";
    else mockOrg = "org-2";
    act(() => tree.update(screen()));
    expect(sharing()).toHaveLength(0);
    expect(workspace().suspended).toBe(false);
  });

  it("downloads the editable copy without a session and never opens link management", async () => {
    mockOrg = null; mockUser = null;
    act(() => tree.update(screen()));
    const payload = editor().payload;
    act(() => workspace().onShare());
    await act(async () => { await picker().onDownload(); });
    expect(exportCourt).toHaveBeenCalledWith(payload, 0, "json");
    expect(sharing()).toHaveLength(0);
    expect(workspace().suspended).toBe(false);
  });
});
