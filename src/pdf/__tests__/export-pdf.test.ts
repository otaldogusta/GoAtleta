jest.mock("react-native", () => ({
  Platform: { OS: "android" },
  Linking: {
    canOpenURL: jest.fn(async () => false),
    openURL: jest.fn(async () => undefined),
  },
}));

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/",
  documentDirectory: "file:///documents/",
  EncodingType: { Base64: "base64" },
  copyAsync: jest.fn(async () => undefined),
  getContentUriAsync: jest.fn(async (uri: string) => `content://${uri}`),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-print", () => ({
  printToFileAsync: jest.fn(async () => ({
    uri: "file:///cache/generated-uuid.pdf",
    base64: "UERG",
  })),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-intent-launcher", () => ({
  Action: { VIEW: "android.intent.action.VIEW" },
  startActivityAsync: jest.fn(async () => undefined),
}));

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { exportPdf } from "../export-pdf";

describe("exportPdf on Android", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  });

  it("persists and hands off the readable requested filename", async () => {
    const result = await exportPdf({
      html: "<html><body>Relatório</body></html>",
      fileName: "relatorio-turma-e2e-2026-08-26.pdf",
    });

    const expectedUri =
      "file:///documents/relatorio-turma-e2e-2026-08-26.pdf";
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expectedUri,
      "UERG",
      { encoding: FileSystem.EncodingType.Base64 }
    );
    expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith(expectedUri);
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expectedUri,
      expect.objectContaining({ mimeType: "application/pdf" })
    );
    expect(result).toEqual({
      uri: expectedUri,
      fileName: "relatorio-turma-e2e-2026-08-26.pdf",
    });
  });

  it("fails explicitly when Android cannot open or share the generated file", async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    await expect(
      exportPdf({
        html: "<html><body>Relatório</body></html>",
        fileName: "relatorio-sem-destino.pdf",
      })
    ).rejects.toThrow("No PDF viewer or sharing destination is available.");

    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
});
