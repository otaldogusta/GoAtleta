import type { ReactElement } from "react";
import { Platform } from "react-native";
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
    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: "Salvar/Compartilhar PDF",
        UTI: "com.adobe.pdf",
      });
    }

    return { uri, fileName };
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
