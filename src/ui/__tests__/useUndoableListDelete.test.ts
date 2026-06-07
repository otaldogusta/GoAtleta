import React, { useState } from "react";
import TestRenderer, { act } from "react-test-renderer";
import type { ConfirmUndoOptions } from "../confirm-undo";
import { useUndoableListDelete } from "../useUndoableListDelete";

type TestItem = {
  id: string;
  name: string;
};

type Snapshot = {
  items: TestItem[];
  deleteOne: (target: TestItem | string) => void;
  deleteMany: (targets: Array<TestItem | string>) => void;
};

const initialItems = (): TestItem[] => [
  { id: "a", name: "Ana" },
  { id: "b", name: "Bia" },
  { id: "c", name: "Caio" },
  { id: "d", name: "Duda" },
];

function renderHarness({
  confirm,
  deleteItems = jest.fn(),
  onError,
  reconcileAfterConfirm,
  reconcile,
}: {
  confirm: (options: ConfirmUndoOptions) => void;
  deleteItems?: (ids: string[], items: TestItem[]) => void | Promise<void>;
  onError?: (error: unknown, items: TestItem[], ids: string[]) => void;
  reconcileAfterConfirm?: boolean;
  reconcile?: () => void | Promise<void>;
}) {
  let latest: Snapshot | null = null;

  function Harness() {
    const [items, setItems] = useState<TestItem[]>(initialItems);
    const deleteApi = useUndoableListDelete({
      items,
      setItems,
      getId: (item) => item.id,
      confirm,
      title: "Excluir?",
      message: "Confirmar exclusão?",
      confirmLabel: "Excluir",
      undoMessage: "Item excluído. Desfazer?",
      deleteItems,
      onError,
      reconcileAfterConfirm,
      reconcile,
    });

    latest = {
      items,
      deleteOne: deleteApi.deleteOne,
      deleteMany: deleteApi.deleteMany,
    };
    return null;
  }

  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(React.createElement(Harness));
  });
  return {
    renderer: renderer!,
    get latest() {
      if (!latest) throw new Error("Harness did not render.");
      return latest;
    },
  };
}

describe("useUndoableListDelete", () => {
  let pendingConfirm: ConfirmUndoOptions | null = null;

  beforeEach(() => {
    pendingConfirm = null;
    jest.clearAllMocks();
  });

  const captureConfirm = jest.fn((options: ConfirmUndoOptions) => {
    pendingConfirm = options;
  });

  it("removes one item optimistically", () => {
    const harness = renderHarness({ confirm: captureConfirm });

    act(() => {
      harness.latest.deleteOne("b");
    });
    act(() => {
      pendingConfirm?.onOptimistic();
    });

    expect(harness.latest.items.map((item) => item.id)).toEqual(["a", "c", "d"]);
  });

  it("removes many items optimistically", () => {
    const harness = renderHarness({ confirm: captureConfirm });

    act(() => {
      harness.latest.deleteMany(["b", "d"]);
    });
    act(() => {
      pendingConfirm?.onOptimistic();
    });

    expect(harness.latest.items.map((item) => item.id)).toEqual(["a", "c"]);
  });

  it("undo restores removed items in their original order", async () => {
    const harness = renderHarness({ confirm: captureConfirm });

    act(() => {
      harness.latest.deleteMany(["b", "d"]);
    });
    act(() => {
      pendingConfirm?.onOptimistic();
    });
    await act(async () => {
      await pendingConfirm?.onUndo();
    });

    expect(harness.latest.items.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("confirm calls the real delete with ids and items", async () => {
    const deleteItems = jest.fn();
    const harness = renderHarness({ confirm: captureConfirm, deleteItems });

    act(() => {
      harness.latest.deleteMany(["b", "c"]);
    });
    await act(async () => {
      await pendingConfirm?.onConfirm();
    });

    expect(deleteItems).toHaveBeenCalledWith(
      ["b", "c"],
      [
        { id: "b", name: "Bia" },
        { id: "c", name: "Caio" },
      ]
    );
  });

  it("delete error restores the item and calls onError", async () => {
    const error = new Error("delete failed");
    const onError = jest.fn();
    const harness = renderHarness({
      confirm: captureConfirm,
      deleteItems: jest.fn(() => Promise.reject(error)),
      onError,
    });

    act(() => {
      harness.latest.deleteOne("b");
    });
    act(() => {
      pendingConfirm?.onOptimistic();
    });
    await act(async () => {
      await pendingConfirm?.onConfirm();
    });

    expect(harness.latest.items.map((item) => item.id)).toEqual(["a", "b", "c", "d"]);
    expect(onError).toHaveBeenCalledWith(error, [{ id: "b", name: "Bia" }], ["b"]);
  });

  it("does not reconcile by default", async () => {
    const reconcile = jest.fn();
    const harness = renderHarness({ confirm: captureConfirm, reconcile });

    act(() => {
      harness.latest.deleteOne("b");
    });
    await act(async () => {
      await pendingConfirm?.onConfirm();
    });

    expect(reconcile).not.toHaveBeenCalled();
  });

  it("reconciles after confirm when enabled", async () => {
    const reconcile = jest.fn();
    const harness = renderHarness({
      confirm: captureConfirm,
      reconcileAfterConfirm: true,
      reconcile,
    });

    act(() => {
      harness.latest.deleteOne("b");
    });
    await act(async () => {
      await pendingConfirm?.onConfirm();
    });

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("does not set state after unmount when confirm fails", async () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const harness = renderHarness({
      confirm: captureConfirm,
      deleteItems: jest.fn(() => Promise.reject(new Error("delete failed"))),
    });

    act(() => {
      harness.latest.deleteOne("b");
    });
    act(() => {
      pendingConfirm?.onOptimistic();
    });
    act(() => {
      harness.renderer.unmount();
    });
    await act(async () => {
      await pendingConfirm?.onConfirm();
    });

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
