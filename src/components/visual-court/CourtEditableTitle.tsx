import { useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput } from "react-native";
import { Pressable } from "../../ui/Pressable";

export function CourtEditableTitle({ title, color, disabled, onCommit }: { title: string; color: string; disabled: boolean; onCommit: (title: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const finished = useRef(false);
  const finish = (confirm: boolean) => {
    if (finished.current) return;
    finished.current = true;
    const next = draft.trim();
    setEditing(false);
    if (confirm && next && next !== title) onCommit(next);
  };
  return editing ? <TextInput accessibilityLabel="Nome da quadra" autoFocus selectTextOnFocus value={draft} onChangeText={setDraft} onBlur={() => finish(true)} onSubmitEditing={() => finish(true)} onKeyPress={event => { if (event.nativeEvent.key === "Escape") { event.stopPropagation(); finish(false); } }} returnKeyType="done" style={[styles.title, { color, width: "100%", minWidth: 0, backgroundColor: "transparent", borderWidth: 0, borderRadius: 0, padding: 0 }, Platform.OS === "web" ? { outlineStyle: "none", cursor: "text" } as never : null]} />
    : <Pressable accessibilityRole="button" accessibilityLabel={`Editar nome da quadra: ${title}`} disabled={disabled} suppressWebHoverFeedback onPress={() => { finished.current = false; setDraft(title); setEditing(true); }} style={Platform.OS === "web" ? { cursor: disabled ? "default" : "text" } as never : undefined}><Text numberOfLines={1} style={[styles.title, { color, textDecorationLine: "underline" }]}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({ title: { minHeight: 22, fontSize: 16, fontWeight: "600" } });
