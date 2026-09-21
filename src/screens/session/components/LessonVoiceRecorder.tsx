import { AssistantPending } from "../../../assistant/components/AssistantPending";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useAppTheme } from "../../../ui/app-theme";
import { checkLessonAudioAvailability, transcribeLessonAudio } from "../../../api/lesson-audio";
import { radius, typography } from "../../../theme/tokens";

type Props = { organizationId: string; classId?: string; disabled: boolean; onText: (text: string) => void; onActiveChange?: (active: boolean) => void };
const formatElapsed = (durationMillis: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
};
export default function LessonVoiceRecorder({ organizationId, classId, disabled, onText, onActiveChange }: Props) {
  const { colors } = useAppTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("Abrindo microfone");
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(Array.from({ length: 36 }, (_, index) => 4 + (index % 5) * 1.2));
  const [inputs, setInputs] = useState<{ uid: string; name: string }[]>([]);
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [showInputs, setShowInputs] = useState(false);
  const peak = useRef<number | null>(null);
  const visualizerTick = useRef(0);
  const active = busy || state.isRecording;
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => {
    if (!state.isRecording) return;
    const timer = setInterval(() => {
      const measured = recorder.getStatus().metering;
      if (typeof measured === "number" && Number.isFinite(measured)) peak.current = Math.max(peak.current ?? -160, measured);
      visualizerTick.current += 1;
      const normalized = typeof measured === "number" && Number.isFinite(measured)
        ? Math.max(0.18, Math.min(1, (measured + 58) / 48))
        : 0.7;
      setLevels(previous => previous.map((current, index) => {
        const center = 1 - Math.abs(index - (previous.length - 1) / 2) / (previous.length / 2);
        const texture = 0.48 + 0.52 * Math.abs(Math.sin(index * 1.73 + visualizerTick.current * 0.78));
        const next = 5 + 25 * normalized * (0.48 + center * 0.52) * texture;
        return Math.max(4, Math.min(28, current * 0.38 + next * 0.62));
      }));
    }, 100);
    return () => clearInterval(timer);
  }, [state.isRecording, recorder]);
  const alive = useRef(true);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  const recordingUri = useRef<string | null>(null);
  function clearRecording(uri: string | null) {
    if (!uri) return;
    if (Platform.OS === "web") URL.revokeObjectURL(uri);
    else void import("expo-file-system/legacy").then(fs => fs.deleteAsync(uri, { idempotent: true })).catch(() => {});
  }
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener("change", value => {
      if (value !== "active") void recorder.stop().catch(() => {});
    });
    return () => {
      alive.current = false; request.current?.abort(); subscription.remove();
      void recorder.stop().catch(() => {}).finally(() => {
        clearRecording(recordingUri.current ?? recorder.uri);
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      });
    };
  }, [recorder]);
  async function start() {
    if (lock.current || disabled) return;
    setPendingLabel("Abrindo microfone");
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      await checkLessonAudioAvailability(controller.signal);
      const permission = await requestRecordingPermissionsAsync();
      if (!alive.current) return;
      if (!permission.granted) throw new Error("Microfone não permitido. Você pode digitar.");
      clearRecording(recorder.uri);
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (selectedInput) recorder.setInput(selectedInput);
      await recorder.prepareToRecordAsync();
      if (!alive.current) {
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        clearRecording(recorder.uri);
        return;
      }
      setLevels(Array.from({ length: 36 }, (_, index) => 4 + (index % 5) * 1.2));
      setInputs(recorder.getAvailableInputs());
      setShowInputs(false);
      peak.current = null;
      recorder.record();
    } catch (e) { if (alive.current) setError(e instanceof Error && e.name === "Error" ? e.message : "Não foi possível abrir o microfone. Verifique a conexão e a permissão ou digite."); }
    finally { clearTimeout(timeout); lock.current = false; if (alive.current) setBusy(false); }
  }
  async function stop() {
    if (lock.current) return;
    setPendingLabel("Transcrevendo");
    lock.current = true; setBusy(true); setError("");
    const controller = new AbortController(); request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 55_000);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri; recordingUri.current = uri;
      if (!uri || !alive.current) return;
      if (peak.current !== null && peak.current <= -90) throw new Error("O microfone não captou sinal. Confira se está mudo ou escolha outro microfone.");
      const text = await transcribeLessonAudio(uri, { organizationId, classId }, controller.signal);
      if (alive.current) onText(text);
    } catch (e) { if (alive.current) setError(e instanceof Error && e.name === "Error" ? e.message : "A transcrição foi interrompida. Tente novamente ou digite."); }
    finally {
      clearTimeout(timeout); clearRecording(recordingUri.current); recordingUri.current = null;
      lock.current = false; if (alive.current) setBusy(false);
    }
  }
  async function cancel() {
    if (lock.current) return;
    lock.current = true;
    try { await recorder.stop(); } catch { /* No audio is submitted when cancelling. */ }
    finally {
      clearRecording(recorder.uri);
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      lock.current = false;
    }
  }
  return <View style={[styles.root, active && styles.active, active && { backgroundColor: colors.secondaryBg, borderColor: colors.border }]}>
    {!busy && state.isRecording ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar gravação" onPress={() => { void cancel(); }} style={[styles.control, styles.cancelControl, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <GoAtletaIcon name="close" size={20} color={colors.text} />
      </Pressable>
      <View accessibilityLabel="Gravação em andamento" style={styles.wave}>
        {levels.map((height, index) => <View key={index} style={[styles.bar, { height, backgroundColor: colors.text }]} />)}
      </View>
      <Text accessibilityLabel={`Tempo gravado ${formatElapsed(state.durationMillis)}`} style={[styles.timer, { color: colors.muted }]}>{formatElapsed(state.durationMillis)}</Text>
    </> : busy ? <View style={styles.pending}><AssistantPending label={pendingLabel} /></View> : null}
    {!busy ? <Pressable accessibilityRole="button" accessibilityLabel={busy ? "Transcrevendo áudio" : state.isRecording ? `Concluir gravação, ${Math.floor(state.durationMillis / 1000)} segundos` : "Gravar mensagem de voz"}
      disabled={busy || (disabled && !state.isRecording)}
      style={[styles.control, state.isRecording && styles.stopControl, { backgroundColor: state.isRecording ? colors.primaryBg : colors.secondaryBg, borderColor: state.isRecording ? colors.primaryBg : colors.border, opacity: busy || disabled ? 0.55 : 1 }]}
      onPress={() => { void (state.isRecording ? stop() : start()); }}>
      <GoAtletaIcon name={busy ? "hourglass" : state.isRecording ? "stopRecording" : "microphone"} size={20} color={state.isRecording ? colors.primaryText : colors.text} />
    </Pressable> : null}
    {error ? <View style={[styles.error, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text>
      {inputs.length > 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Escolher microfone" onPress={() => setShowInputs(!showInputs)} style={styles.inputChoice}>
        <Text style={{ color: colors.text }}>Escolher microfone</Text>
      </Pressable> : null}
      {showInputs ? inputs.map(input => <Pressable key={input.uid} accessibilityRole="button" accessibilityLabel={`Usar ${input.name}`} onPress={() => { setSelectedInput(input.uid); setShowInputs(false); setError(""); }} style={styles.inputChoice}>
        <Text style={{ color: colors.text }}>{input.name}</Text>
      </Pressable>) : null}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { position: "relative", overflow: "visible" },
  active: { flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0, paddingHorizontal: 4, paddingVertical: 3, borderWidth: 1, borderRadius: radius.full },
  wave: { flex: 1, minWidth: 80, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, overflow: "hidden" },
  bar: { width: 2, borderRadius: radius.full, opacity: 0.88 },
  timer: { minWidth: 40, textAlign: "right", fontSize: 12, fontVariant: ["tabular-nums"], fontFamily: typography.mono.fontFamily },
  pending: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center" },
  inputChoice: { paddingVertical: 8 },
  control: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelControl: { width: 40, height: 40 },
  stopControl: { width: 40, height: 40 },
  error: { position: "absolute", bottom: 52, right: 0, width: 220, padding: 10, borderWidth: 1, borderRadius: 12, zIndex: 20 },
});
