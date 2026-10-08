import { useRef, useState } from "react";
import { View } from "react-native";
import type { ScoutingFormat, ScoutingSessionType } from "../../core/models";
import { createClientId } from "../../core/client-id";
import { createCollectedScouting } from "../../db/scouting-collection";
import { Button } from "../../ui/Button";
import { DateInput } from "../../ui/DateInput";
import { Copy, Choice, ErrorNotice, Input, ScoutingModal } from "./ScoutingUI";

export function NewScoutingModal({ org, classId, mode, onClose, onCreated }: { org: string; classId: string; mode: "treino" | "jogo"; onClose: () => void; onCreated: (id: string) => void }) {
  const [type, setType] = useState<ScoutingSessionType>(mode);
  const [format, setFormat] = useState<ScoutingFormat>(mode === "treino" ? "3x3" : "6x6");
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; });
  const [title, setTitle] = useState("");
  const [opponent, setOpponent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(createClientId());
  const submitted = useRef<Parameters<typeof createCollectedScouting>[0] | null>(null);
  const lock = useRef(false);
  const [frozen, setFrozen] = useState(false);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T12:00:00`).getTime()) && new Date(`${date}T12:00:00`).toISOString().slice(0, 10) === date;
  const save = async () => {
    if (lock.current || !validDate) return;
    lock.current = true; setBusy(true); setError(""); setFrozen(true);
    submitted.current ??= { requestId: requestId.current, organizationId: org, classId, type, date, format,
      title: title.trim() || (type === "treino" ? "Treino técnico" : opponent.trim() ? `Jogo · ${opponent.trim()}` : "Jogo"), opponent };
    try { const created = await createCollectedScouting(submitted.current); onCreated(created.id); }
    catch { setError("Criação não confirmada. Tente novamente para recuperar a mesma análise."); }
    finally { lock.current = false; setBusy(false); }
  };
  return <ScoutingModal title="Nova análise" onClose={() => { if (!busy) onClose(); }} footer={<Button label={error ? "Tentar novamente" : "Iniciar análise"} loading={busy} disabled={!validDate} onPress={() => { void save(); }} />}>
    <ErrorNotice text={error} />
    <View style={{ gap: 10 }}><Copy>Tipo de análise</Copy><View style={{ flexDirection: "row", gap: 8 }}>{(["treino", "jogo", "amistoso"] as const).map(t => <Choice key={t} label={t === "treino" ? "Treino" : t === "jogo" ? "Jogo" : "Amistoso"} selected={type === t} disabled={frozen} onPress={() => setType(t)} />)}</View></View>
    <View style={{ gap: 8, opacity: frozen ? .55 : 1 }} pointerEvents={frozen ? "none" : "auto"}><Copy>Data</Copy><DateInput value={date} onChange={setDate} /></View>
    <View style={{ gap: 10 }}><Copy>Contexto observado</Copy><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{(["2x2", "3x3", "4x4", "6x6", "outro"] as const).map(f => <Choice key={f} label={f === "outro" ? "Outro" : f.replace("x", " × ")} selected={format === f} disabled={frozen} onPress={() => setFormat(f)} />)}</View></View>
    <Input label="Título · opcional" value={title} editable={!frozen} onChangeText={setTitle} maxLength={100} placeholder={type === "treino" ? "Treino técnico" : "Jogo"} />
    {type !== "treino" ? <Input label="Adversário · opcional" value={opponent} editable={!frozen} onChangeText={setOpponent} maxLength={80} /> : null}
  </ScoutingModal>;
}
