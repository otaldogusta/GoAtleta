import { AssistantPending } from "../../../assistant/components/AssistantPending";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Pressable } from "../../../ui/Pressable";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { useAppTheme } from "../../../ui/app-theme";
import { checkLessonAudioAvailability, transcribeLessonAudio } from "../../../api/lesson-audio";

type Props = { organizationId: string; classId?: string; disabled: boolean; onText: (text: string) => void; onActiveChange?: (active: boolean) => void };
export default function LessonVoiceRecorder({ organizationId, classId, disabled, onText, onActiveChange }: Props) {
  const { colors } = useAppTheme();
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, isMeteringEnabled: true });
  const state = useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const [pendingLabel, setPendingLabel] = useState("Abrindo microfone");
  const [error, setError] = useState("");
  const [levels, setLevels] = useState<number[]>(Array(20).fill(3));
  const [inputs, setInputs] = useState<{ uid: string; name: string }[]>([]);
  const [selectedInput, setSelectedInput] = useState<string | null>(null);
  const [showInputs, setShowInputs] = useState(false);
  const peak = useRef<number | null>(null);
  const active = busy || state.isRecording;
  useEffect(() => { onActiveChange?.(active); }, [active, onActiveChange]);
  useEffect(() => {
    if (!state.isRecording) return;
    const timer = setInterval(() => {
      const measured = recorder.getStatus().metering;
      if (typeof measured === "number" && Number.isFinite(measured)) peak.current = Math.max(peak.current ?? -160, measured);
      const level = measured ?? -60;
      setLevels(previous => [...previous.slice(1), Math.max(3, Math.min(28, 28 * Math.pow(10, level / 40)))]);
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
      setLevels(Array(20).fill(3));
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
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= 60_000 && !lock.current) void stop();
  });
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
  return <View style={[styles.root, active && styles.active]}>
    {!busy && state.isRecording ? <>
      <Pressable accessibilityRole="button" accessibilityLabel="Cancelar gravação" onPress={() => { void cancel(); }} style={styles.control}>
        <GoAtletaIcon name="close" size={20} color={colors.text} />
      </Pressable>
      <View accessibilityLabel="Nível do áudio" style={styles.wave}>
        {levels.map((height, index) => <View key={index} style={[styles.bar, { height, backgroundColor: colors.primaryBg }]} />)}
      </View>
      <Text style={{ color: colors.muted }}>{`0:${String(Math.floor(state.durationMillis / 1000)).padStart(2, "0")}`}</Text>
    </> : busy ? <View style={styles.pending}><AssistantPending label={pendingLabel} /></View> : null}
    {!busy ? <Pressable accessibilityRole="button" accessibilityLabel={busy ? "Transcrevendo áudio" : state.isRecording ? `Concluir gravação, ${Math.floor(state.durationMillis / 1000)} segundos` : "Gravar mensagem de voz"}
      disabled={busy || (disabled && !state.isRecording)}
      style={[styles.control, { backgroundColor: state.isRecording ? colors.primaryBg : colors.secondaryBg, borderColor: colors.border, opacity: busy || disabled ? 0.55 : 1 }]}
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
  active: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  wave: { flex: 1, minWidth: 0, height: 32, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly", overflow: "hidden" },
  bar: { width: 3, borderRadius: 2 },
  pending: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center" },
  inputChoice: { paddingVertical: 8 },
  control: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  error: { position: "absolute", bottom: 52, right: 0, width: 220, padding: 10, borderWidth: 1, borderRadius: 12, zIndex: 20 },
});
