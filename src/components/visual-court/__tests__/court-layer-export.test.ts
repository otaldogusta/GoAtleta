import { exportCourt as exportWeb } from "../court-export.web";
import * as FileSystem from "expo-file-system/legacy";
import { newCourtBoard, parseEditorImport } from "../../../core/visual-court-editor";

jest.mock("expo-file-system/legacy", () => ({ cacheDirectory: "memory://", writeAsStringAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("../CourtEditorScene", () => ({ CourtEditorScene: "CourtEditorScene" }));

const { exportCourt: exportNative } = jest.requireActual<typeof import("../court-export")>("../court-export.tsx");

describe("court layer state in editable JSON exports", () => {
  it.each(["web", "native"] as const)("reopens visibility and locks from %s export without private athlete links", async platform => {
    const payload = newCourtBoard(), id = payload.actors[0].id, step = payload.timeline.steps[0].id;
    payload.editor!.actorMeta[id] = { team: "B", hidden: true, locked: true, studentId: "private-athlete" };
    payload.editor!.drawings[step] = [{ id: "note", kind: "text", text: "Nota", hidden: true, locked: true, color: "#fff", points: [{ x: .5, y: .5 }], size: 32, rotation: 0 }];
    payload.editor!.lessonLink = { date: "private-date", block: "private-block", revision: "private-revision" };
    const before = JSON.stringify(payload);
    const saved = ["Blob", "document"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
    const urlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
    let exported = "";
    jest.useFakeTimers();
    try {
      Object.defineProperty(globalThis, "Blob", { configurable: true, value: class { constructor(parts: string[]) { exported = parts.join(""); } } });
      Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => ({ style: {}, click: jest.fn(), remove: jest.fn() }), body: { appendChild: jest.fn() } } });
      Object.defineProperty(URL, "createObjectURL", { configurable: true, value: () => "memory://json" });
      if (platform === "web") await exportWeb(payload, 0, "json");
      else {
        await exportNative(payload, 0, "json");
        exported = (FileSystem.writeAsStringAsync as jest.Mock).mock.calls.at(-1)![1];
      }
      const reopened = parseEditorImport(exported);
      expect(reopened.editor!.actorMeta[id]).toMatchObject({ hidden: true, locked: true, team: "B" });
      expect(reopened.editor!.drawings[step][0]).toMatchObject({ hidden: true, locked: true });
      expect(exported).not.toContain("private-athlete");
      expect(exported).not.toContain("private-block");
      expect(JSON.stringify(payload)).toBe(before);
    } finally {
      for (const [key, descriptor] of saved) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      if (urlDescriptor) Object.defineProperty(URL, "createObjectURL", urlDescriptor);
      else Reflect.deleteProperty(URL, "createObjectURL");
      jest.clearAllTimers(); jest.useRealTimers();
    }
  });
});
