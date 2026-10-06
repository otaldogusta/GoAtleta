import React, { useState } from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ReportPhotoGallery } from "../ReportPhotoGallery";
import { SessionReportActions } from "../SessionReportActions";

jest.mock("../../../../ui/ModalSheet", () => ({ ModalSheet: ({ visible, children }: any) => visible ? children : null }));
jest.mock("../../../../ui/Pressable", () => ({ Pressable: jest.requireActual("react-native").Pressable }));
jest.mock("../../../../ui/icon-registry", () => ({ GoAtletaIcon: () => null }));
jest.mock("../../../../ui/Button", () => ({ Button: ({ label, loadingLabel, loading, disabled, onPress }: any) => jest.requireActual("react").createElement(jest.requireActual("react-native").Pressable, { accessibilityRole: "button", accessibilityLabel: loading ? loadingLabel : label, disabled: disabled || loading, onPress }, jest.requireActual("react").createElement(jest.requireActual("react-native").Text, null, loading ? loadingLabel : label)) }));

const colors = {} as any;
const handlers = () => ({ onAdd: jest.fn(), onReplace: jest.fn(), onRemove: jest.fn() });

function GalleryHarness({ uris, busy = false, actions }: { uris: string[]; busy?: boolean; actions: ReturnType<typeof handlers> }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return React.createElement(ReportPhotoGallery, { colors, compact: false, uris, limit: 3, busy, selectedIndex, onOpen: setSelectedIndex, onClose: () => setSelectedIndex(null), ...actions });
}

describe("report photo interactions", () => {
  it("opens the selected image and replaces that index through the existing picker", () => {
    const actions = handlers();
    const ui = render(React.createElement(GalleryHarness, { uris: ["photo-a", "photo-b"], actions }));
    fireEvent.press(ui.getByLabelText("Ampliar foto 2"));
    expect(ui.getByLabelText("Foto ampliada da aula").props.source.uri).toBe("photo-b");
    fireEvent.press(ui.getByLabelText("Trocar foto"));
    fireEvent.press(ui.getByLabelText("Escolher da galeria"));
    expect(actions.onReplace).toHaveBeenCalledWith("library", 1);
    expect(actions.onAdd).not.toHaveBeenCalled();
  });

  it("routes add and remove separately and respects the photo limit", () => {
    const actions = handlers();
    const ui = render(React.createElement(GalleryHarness, { uris: ["a", "b"], actions }));
    fireEvent.press(ui.getByLabelText("Adicionar foto"));
    fireEvent.press(ui.getByLabelText("Tirar foto"));
    expect(actions.onAdd).toHaveBeenCalledWith("camera");
    fireEvent.press(ui.getByLabelText("Remover foto 2"));
    expect(actions.onRemove).toHaveBeenCalledWith(1);
    ui.rerender(React.createElement(GalleryHarness, { uris: ["a", "b", "c"], actions }));
    expect(ui.queryByLabelText("Adicionar foto")).toBeNull();
    expect(ui.getByLabelText("3 de 3 fotos")).toBeTruthy();
  });

  it("starts empty without illustrative photos and blocks repeated picker actions", () => {
    const actions = handlers();
    const ui = render(React.createElement(GalleryHarness, { uris: [], busy: true, actions }));
    expect(ui.queryByLabelText("Ampliar foto 1")).toBeNull();
    fireEvent.press(ui.getByLabelText("Adicionar foto"));
    expect(ui.queryByLabelText("Tirar foto")).toBeNull();
    expect(actions.onAdd).not.toHaveBeenCalled();
  });

  it("keeps both report actions locked while generating a PDF", () => {
    const onSave = jest.fn(), onExport = jest.fn();
    const ui = render(React.createElement(SessionReportActions, { colors, compact: true, dirty: true, hasExistingReport: true, draftStatus: "saved", pendingAction: "pdf", onSave, onExport }));
    expect(ui.getByText("Rascunho salvo no aparelho")).toBeTruthy();
    fireEvent.press(ui.getByLabelText("Salvar relatório"));
    fireEvent.press(ui.getByLabelText("Gerando PDF…"));
    expect(onSave).not.toHaveBeenCalled();
    expect(onExport).not.toHaveBeenCalled();
  });
});
