import { Alert } from "react-native";
import { useCallback } from "react";

import * as DocumentPicker from "expo-document-picker";
import { EncodingType, readAsStringAsync } from "expo-file-system/legacy";
import * as XLSX from "xlsx";

import {
  detectImportDelimiter,
  type ImportedPlanRow,
  parseDelimitedImportRows,
  parseImportRowsFromMatrix,
} from "../../../core/periodization-import";
import type { ClassGroup } from "../../../core/models";
import {
  deleteTrainingPlansByClassAndDate,
  saveTrainingPlan,
} from "../../../db/seed";

// ---------------------------------------------------------------------------
// Local helper (mirrors splitImportList in app/periodization/index.tsx)
// ---------------------------------------------------------------------------

const splitImportList = (value: string) =>
  String(value ?? "")
    .split(/\r?\n|\|/g)
    .map((item) => item.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------

export type UseImportPlansFileParams = {
  selectedClass: ClassGroup | null;
  setIsImportingPlansFile: (value: boolean) => void;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useImportPlansFile({
  selectedClass,
  setIsImportingPlansFile,
}: UseImportPlansFileParams) {
  const handleImportPlansFile = useCallback(async () => {
    if (!selectedClass) {
      Alert.alert("Importacao", "Selecione uma turma antes de importar.");
      return;
    }

    setIsImportingPlansFile(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        base64: false,
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/octet-stream",
          "application/pdf",
        ],
      });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error("Arquivo invalido.");
      const fileName = String(asset.name ?? "").trim().toLowerCase();
      if (fileName.endsWith(".pdf") || asset.mimeType === "application/pdf") {
        Alert.alert("Importacao", "PDF nao e suportado para importacao direta. Use CSV/XLSX.");
        return;
      }

      const isSpreadsheet =
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls") ||
        asset.mimeType?.includes("spreadsheet") ||
        asset.mimeType?.includes("excel");

      let importedRows: ImportedPlanRow[] = [];
      if (isSpreadsheet) {
        const workbook =
          typeof window !== "undefined"
            ? XLSX.read(await (await fetch(asset.uri)).arrayBuffer(), { type: "array" })
            : XLSX.read(await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 }), {
                type: "base64",
              });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) throw new Error("Planilha vazia.");
        const worksheet = workbook.Sheets[firstSheet];
        if (!worksheet) throw new Error("Nao foi possivel ler a primeira aba.");
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as unknown[][];
        const matrix = rows.map((row) =>
          Array.isArray(row) ? row.map((cell) => String(cell ?? "").trim()) : []
        );
        importedRows = parseImportRowsFromMatrix(matrix);
      } else {
        const csvText =
          typeof window !== "undefined"
            ? await (await fetch(asset.uri)).text()
            : await readAsStringAsync(asset.uri, { encoding: EncodingType.UTF8 });
        const matrix = parseDelimitedImportRows(
          csvText,
          detectImportDelimiter(csvText)
        );
        importedRows = parseImportRowsFromMatrix(matrix);
      }

      if (!importedRows.length) {
        throw new Error("Nenhuma linha válida encontrada no arquivo.");
      }

      for (const row of importedRows) {
        await deleteTrainingPlansByClassAndDate(selectedClass.id, row.date);
        await saveTrainingPlan({
          id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          classId: selectedClass.id,
          title: row.title,
          tags: splitImportList(row.tags).length
            ? splitImportList(row.tags)
            : ["importado", "planejamento"],
          warmup: splitImportList(row.warmup),
          main: splitImportList(row.main),
          cooldown: splitImportList(row.cooldown),
          warmupTime: row.warmup_time || "",
          mainTime: row.main_time || "",
          cooldownTime: row.cooldown_time || "",
          applyDays: [],
          applyDate: row.date,
          createdAt: new Date().toISOString(),
        });
      }

      Alert.alert("Importacao", `Planejamento importado com ${importedRows.length} linha(s).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao importar arquivo.";
      Alert.alert("Importacao", message);
    } finally {
      setIsImportingPlansFile(false);
    }
  }, [selectedClass, setIsImportingPlansFile]);

  return { handleImportPlansFile };
}
