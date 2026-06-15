import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import TestRenderer, { act } from "react-test-renderer";

import { LessonActivityEditor } from "../../../lesson/components/LessonActivityEditor";
import { ModalSheet } from "../../../../ui/ModalSheet";
import { ConfirmCloseOverlay } from "../../../../ui/ConfirmCloseOverlay";
import { BlockEditModal } from "../BlockEditModal";

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

const catalogActivity = {
  id: "activity_1",
  name: "Caça da bola jogável",
  description: "Aumentar cooperação.",
  catalog: {
    source: "goAtletaCatalog" as const,
    familyId: "continuity",
    variantId: "playable-ball",
    addedAt: "2026-06-15T00:00:00.000Z",
  },
};

const renderWithSafeArea = (element: React.ReactElement) =>
  React.createElement(
    SafeAreaProvider,
    {
      initialMetrics: {
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    },
    element
  );

describe("BlockEditModal", () => {
  it("preserves catalog metadata when a catalog activity is edited", async () => {
    const onSave = jest.fn(async () => true);
    const onClose = jest.fn();
    let tree: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        renderWithSafeArea(
          React.createElement(BlockEditModal, {
            visible: true,
            title: "Aquecimento",
            durationMinutes: 10,
            activities: [catalogActivity],
            onClose,
            onSave,
          })
        )
      );
    });

    const editor = tree!.root.findByType(LessonActivityEditor);
    await act(async () => {
      editor.props.onChange([{ ...catalogActivity, description: "Descrição editada." }]);
    });
    await act(async () => {
      tree!.root.findAllByType(ModalSheet)[0].props.onClose();
    });
    await act(async () => {
      tree!.root.findByType(ConfirmCloseOverlay).props.onConfirm();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        activities: [
          expect.objectContaining({
            name: "Caça da bola jogável",
            catalog: catalogActivity.catalog,
          }),
        ],
      })
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("allows removing a catalog activity from a block", async () => {
    const onSave = jest.fn(async () => true);
    let tree: TestRenderer.ReactTestRenderer;

    await act(async () => {
      tree = TestRenderer.create(
        renderWithSafeArea(
          React.createElement(BlockEditModal, {
            visible: true,
            title: "Aquecimento",
            durationMinutes: 10,
            activities: [catalogActivity],
            onClose: jest.fn(),
            onSave,
          })
        )
      );
    });

    await act(async () => {
      tree!.root.findByType(LessonActivityEditor).props.onChange([]);
    });
    await act(async () => {
      tree!.root.findAllByType(ModalSheet)[0].props.onClose();
    });
    await act(async () => {
      tree!.root.findByType(ConfirmCloseOverlay).props.onConfirm();
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        activities: [],
      })
    );
  });
});
