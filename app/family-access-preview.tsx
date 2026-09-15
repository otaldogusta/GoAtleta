import { Redirect } from "expo-router";
import { Platform } from "react-native";
import { FamilyAccessPreview } from "../src/dev/FamilyAccessPreview";
// perf-check: ignore-render -- local-only route wrapper; the preview component owns its rendering.
// perf-check: ignore-measure -- static fictitious fixtures; this route performs no asynchronous loading.
// Local visual fixtures never grant roles or call the backend.
export default function FamilyAccessPreviewRoute() {
  if (!__DEV__ || Platform.OS !== "web" || typeof window === "undefined"
    || !["localhost", "127.0.0.1"].includes(window.location.hostname)) return <Redirect href="/" />;
  return <FamilyAccessPreview />;
}
