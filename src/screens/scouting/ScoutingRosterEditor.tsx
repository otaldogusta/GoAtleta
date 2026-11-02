import { useState } from "react";
import { View } from "react-native";
import type { Student } from "../../core/models";
import { Button } from "../../ui/Button";
import { Choice, Copy, ErrorNotice, Input, Link } from "./ScoutingUI";
import { validateScoutingRoster, type ScoutingRosterPlayer } from "./use-scouting-roster";

export function ScoutingRosterEditor({ students, players, saving, error, onSave, onCancel }: {
  students: Student[]; players: ScoutingRosterPlayer[] | null; saving: boolean; error: string;
  onSave: (players: ScoutingRosterPlayer[]) => Promise<boolean>; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ScoutingRosterPlayer[]>(players ?? []);
  const selected = new Map(draft.map(p => [p.studentId, p.jersey]));
  const invalid = validateScoutingRoster(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(players ?? []);
  return <View style={{ gap: 12 }}>
    <Copy title>Elenco deste jogo · {draft.length}</Copy>
    <Copy muted>Salvo neste navegador. Não altera a turma.</Copy>
    <ErrorNotice text={error} />
    {students.map(student => <View key={student.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1 }}><Choice compact label={student.name} accessibilityLabel={`Relacionar ${student.name}`} selected={selected.has(student.id)} disabled={saving}
        onPress={() => setDraft(old => selected.has(student.id) ? old.filter(p => p.studentId !== student.id) : [...old, { studentId: student.id, jersey: "" }])} /></View>
      {selected.has(student.id) ? <View style={{ width: 100 }}><Input label={`Camisa · ${student.name.split(" ")[0]}`} accessibilityLabel={`Camisa de ${student.name}`} value={selected.get(student.id)} keyboardType="number-pad" maxLength={2} editable={!saving}
        onChangeText={jersey => setDraft(old => old.map(p => p.studentId === student.id ? { ...p, jersey: jersey.replace(/\D/g, "").slice(0, 2) } : p))} /></View> : null}
    </View>)}
    {invalid && draft.length ? <Copy muted>{invalid}</Copy> : null}
    <Button label="Salvar elenco" loading={saving} disabled={saving || !!invalid || !changed} onPress={() => { void onSave(draft); }} />
    <Link label="Cancelar" disabled={saving} onPress={onCancel} />
  </View>;
}
