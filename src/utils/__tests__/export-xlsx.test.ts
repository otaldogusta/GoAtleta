import * as FileSystem from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Sharing from "expo-sharing";
import { exportWorkbookXlsx, XLSX_MIME } from "../export-xlsx";
import { loadXlsx } from "../load-xlsx";

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
  getContentUriAsync: jest.fn(async (uri: string) => `content://${uri}`),
  writeAsStringAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

jest.mock("expo-intent-launcher", () => ({
  __esModule: true,
  Action: { VIEW: "android.intent.action.VIEW" },
  startActivityAsync: jest.fn(async () => undefined),
}));

jest.mock("../load-xlsx", () => ({
  loadXlsx: jest.fn(async () => ({
    utils: {
      book_new: jest.fn(() => ({})),
      aoa_to_sheet: jest.fn(() => ({ "!ref": "A1:A2" })),
      encode_col: jest.fn((index: number) => String.fromCharCode(65 + index)),
      book_append_sheet: jest.fn(),
    },
    write: jest.fn(() => "UEsDBA=="),
  })),
}));

describe("exportWorkbookXlsx on Android", () => {
  beforeEach(() => jest.clearAllMocks());
  it("does not write/open/share after the caller scope changes during deferred XLSX loading", async () => {
    const runtime = await loadXlsx();
    let release!: (value: typeof runtime) => void;
    jest.mocked(loadXlsx).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    let current = true;
    const pending = exportWorkbookXlsx({fileName:"report.xlsx",sheets:[{name:"Report",rows:[["Data"]]}],assertCurrent:()=>{if(!current)throw new Error("Scope changed");}});
    current = false;release(runtime);
    await expect(pending).rejects.toThrow("Scope changed");
    expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();expect(IntentLauncher.startActivityAsync).not.toHaveBeenCalled();expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });
  it("opens the named workbook in a compatible app before offering sharing", async () => {
    const fileName = "chamada-turma-e2e-local-2026-08.xlsx";
    const uri = `file:///documents/${fileName}`;

    const result = await exportWorkbookXlsx({
      fileName,
      sheets: [{ name: "Chamadas", rows: [["Aluno"], ["Ana"]] }],
    });

    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      uri,
      "UEsDBA==",
      { encoding: FileSystem.EncodingType.Base64 }
    );
    expect(FileSystem.getContentUriAsync).toHaveBeenCalledWith(uri);
    expect(IntentLauncher.startActivityAsync).toHaveBeenCalledWith(
      "android.intent.action.VIEW",
      expect.objectContaining({ data: `content://${uri}`, type: XLSX_MIME })
    );
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ fileName, uri });
  });
});
