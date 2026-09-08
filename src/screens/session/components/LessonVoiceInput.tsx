import { Component, lazy, Suspense, type ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { useAppTheme } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";

const Recorder = lazy(() => import("./LessonVoiceRecorder"));
class AudioBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
export function LessonVoiceInput(props: { organizationId: string; classId?: string; disabled: boolean; onText: (text: string) => void; onActiveChange?: (active: boolean) => void }) {
  const { colors } = useAppTheme();
  const fallback = <Pressable accessibilityRole="button" accessibilityLabel="Microfone indisponível. Você pode digitar." disabled
    style={[styles.fallback, { borderColor: colors.border }]}><GoAtletaIcon name="microphone" size={20} color={colors.muted} /></Pressable>;
  const loading = <Pressable accessibilityRole="button" accessibilityLabel="Carregando microfone" disabled
    style={[styles.fallback, { borderColor: colors.border }]}><GoAtletaIcon name="microphone" size={20} color={colors.muted} /></Pressable>;
  if (Platform.OS !== "web" && !requireOptionalNativeModule("ExpoAudio")) {
    return fallback;
  }
  return <AudioBoundary fallback={fallback}>
    <Suspense fallback={loading}><Recorder {...props} /></Suspense>
  </AudioBoundary>;
}
const styles = StyleSheet.create({ fallback: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", opacity: 0.55 } });
