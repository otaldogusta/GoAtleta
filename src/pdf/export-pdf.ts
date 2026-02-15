import type { ReactElement } from "react";
import { Linking, Platform } from "react-native";
import {
  cacheDirectory,
  copyAsync,
  documentDirectory,
  EncodingType,
  getContentUriAsync,
  writeAsStringAsync,
} from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export const safeFileName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export const exportPdf = async ({
  html,
  fileName,
  webDocument,
}: {
  html: string;
  fileName: string;
  webDocument?: ReactElement;
}) => {
  if (Platform.OS !== "web") {
    // Mobile: Use Print and Share APIs
    const printResult = await Print.printToFileAsync({
      html,
      base64: true,
    });

    const targetUri = await writePdfWithName(printResult, fileName);
    const opened = await tryOpenPdf(targetUri);
    if (!opened) {
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(targetUri, {
          mimeType: "application/pdf",
          dialogTitle: "Salvar/Compartilhar PDF",
          UTI: "com.adobe.pdf",
        });
      }
    }

    return { uri: targetUri, fileName };
  }

  // Web: Export as file download
  if (!webDocument) {
    throw new Error("Missing webDocument for PDF export.");
  }
  // @ts-expect-error no types for browser bundle entry
  const { pdf } = await import("@react-pdf/renderer/lib/react-pdf.browser");
  const blob = await pdf(webDocument).toBlob();
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { uri: "", fileName };
  }
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { uri: url, fileName };
};

async function tryOpenPdf(uri: string): Promise<boolean> {
  try {
    if (Platform.OS === "android") {
      const contentUri = await getContentUriAsync(uri);
      try {
        const IntentLauncher = await import("expo-intent-launcher");
        const VIEW =
          // @ts-expect-error expo-intent-launcher Action enum
          IntentLauncher.Action?.VIEW ??
          // @ts-expect-error expo-intent-launcher ActivityAction enum
          IntentLauncher.ActivityAction?.VIEW ??
          "android.intent.action.VIEW";
        await IntentLauncher.startActivityAsync(VIEW, {
          data: contentUri,
          type: "application/pdf",
          flags: 1 | 268435456, // GRANT_READ_URI_PERMISSION | ACTIVITY_NEW_TASK
        });
        return true;
      } catch {
        const canOpen = await Linking.canOpenURL(contentUri);
        if (canOpen) {
          await Linking.openURL(contentUri);
          return true;
        }
      }
    }
    if (Platform.OS === "ios") {
      await Linking.openURL(uri);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function writePdfWithName(
  result: { uri: string; base64: string | null },
  fileName: string
) {
  const cleanName = fileName.endsWith(".pdf") ? fileName : `${fileName}.pdf`;
  const targetBase = documentDirectory ?? cacheDirectory ?? "";
  if (!targetBase) return result.uri;
  const targetUri = `${targetBase}${cleanName}`;
  try {
    if (result.base64) {
      await writeAsStringAsync(targetUri, result.base64, {
        encoding: EncodingType.Base64,
      });
      return targetUri;
    }
    if (result.uri !== targetUri) {
      await copyAsync({ from: result.uri, to: targetUri });
    }
    return targetUri;
  } catch {
    return result.uri;
  }
}
