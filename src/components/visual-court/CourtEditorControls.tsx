import { useEffect, useState, type ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ViewStyle } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { createWebPortal } from "../../ui/web-portal";
import { radius, spacing } from "../../theme/tokens";

export type CourtActionIcon = GoAtletaIconName | "courtArrow" | "courtBall" | "courtCone" | "courtTarget" | "courtLadder" | "courtCurve" | "courtArea" | "courtText";
export function CourtToolIcon({ name, color, size = 22 }: { name: CourtActionIcon; color: string; size?: number }) {
  let drawing: ReactNode;
  switch (name) {
    case "courtArrow": drawing = <Path d="M4 20 20 4M11 4h9v9" />; break;
    case "courtBall": drawing = <><Circle cx="12" cy="12" r="9" /><Path d="M3 12c5-4 12-4 18 0M7 4c5 3 8 9 7 17M19 6c-5 1-10 7-11 14" /></>; break;
    case "courtCone": drawing = <><Path d="M5 19 10 4h4l5 15M3 20h18M8 10h8M6 16h12" /></>; break;
    case "courtTarget": drawing = <><Circle cx="12" cy="12" r="9" /><Circle cx="12" cy="12" r="5" /><Circle cx="12" cy="12" r="1" /></>; break;
    case "courtLadder": drawing = <><Path d="M6 3v18M18 3v18M6 5h12M6 10h12M6 15h12M6 20h12" /></>; break;
    case "courtCurve": drawing = <><Path d="M3 19C3 6 11 4 20 7M15 3l5 4-4 5" /></>; break;
    case "courtArea": drawing = <Rect x="3" y="5" width="18" height="14" rx="3" fill={color} fillOpacity={0.12} strokeDasharray="3 3" />; break;
    case "courtText": drawing = <Path d="M4 5h16M12 5v15M8 20h8M4 5v3M20 5v3" />; break;
    default: return <GoAtletaIcon name={name} color={color} size={size} />;
  }
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{drawing}</Svg>;
}

const SHORTCUTS: Record<string, string> = { "Selecionar e mover": "V · Arraste no vazio para selecionar", Desfazer: "Ctrl/Cmd + Z", Refazer: "Ctrl/Cmd + Shift + Z", "Apagar seleção": "Delete" };
export function CourtActionButton({ label, icon, onPress, active = false, disabled = false, text = false, tile = false, danger = false }: {
  label: string; icon: CourtActionIcon; onPress: () => void; active?: boolean; disabled?: boolean; text?: boolean; tile?: boolean; danger?: boolean;
}) {
  const { colors } = useAppTheme();
  const [tip, setTip] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!tip || Platform.OS !== "web") return;
    const hide = () => setTip(null);
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("resize", hide); window.removeEventListener("scroll", hide, true); window.removeEventListener("keydown", key); };
  }, [tip]);
  const show = (event: unknown) => {
    if (Platform.OS !== "web" || text || tile) return;
    const rect = (event as { currentTarget?: HTMLElement }).currentTarget?.getBoundingClientRect?.();
    if (!rect) return;
    setTip({ left: Math.max(8, Math.min(window.innerWidth - 228, rect.left < 80 ? rect.right + 10 : rect.left - 80)), top: Math.max(8, Math.min(window.innerHeight - 52, rect.left < 80 ? rect.top : rect.top < 64 ? rect.bottom + 8 : rect.top - 48)) });
  };
  const ink = danger ? colors.dangerText : active ? colors.primaryText : colors.text;
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active, disabled }} disabled={disabled}
      onHoverIn={show} onHoverOut={() => setTip(null)} onFocus={show} onBlur={() => setTip(null)}
      onPress={() => { setTip(null); onPress(); }}
      style={({ hovered, pressed }) => [styles.action, text && styles.textAction, tile && styles.tile, { opacity: disabled ? 0.4 : 1, backgroundColor: active ? colors.primaryBg : hovered || pressed ? colors.secondaryBg : "transparent", borderColor: tile ? active ? colors.primaryBg : colors.border : "transparent" }]}>
      <CourtToolIcon name={icon} size={tile ? 25 : 21} color={ink} />
      {text || tile ? <Text style={{ color: ink, fontSize: 12, fontWeight: "600", textAlign: tile ? "center" : "left" }}>{label}</Text> : null}
    </Pressable>
    {tip && Platform.OS === "web" ? createWebPortal(<View pointerEvents="none" style={{ position: "fixed", ...tip, zIndex: 10000, maxWidth: 220, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 } as unknown as ViewStyle}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      {SHORTCUTS[label] ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{SHORTCUTS[label]}</Text> : null}
    </View>, document.body) : null}
  </>;
}

export function CourtSwitchRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.switchRow}><Text style={{ flex: 1, color: colors.text, fontSize: 13 }}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: colors.border, true: colors.primaryBg }} thumbColor={value ? colors.primaryText : colors.text} />
  </View>;
}

const OBJECT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80];
export function CourtSizeControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [draftSize, setInput] = useState<string | null>(null);
  const input = draftSize ?? String(value);

  const choose = (next: number) => {
    const size = Math.max(12, Math.min(80, next));
    setInput(null);
    if (size !== value) onChange(size);
  };
  const commit = () => { const next = Number(input); choose(input.trim() && Number.isFinite(next) ? next : value); };
  return <View style={{ gap: 6 }}>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Tamanho</Text>
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, borderRadius: 12, backgroundColor: colors.inputBg, paddingLeft: 14 }}>
      <TextInput accessibilityLabel="Tamanho" keyboardType="numeric" value={input} onChangeText={setInput} onBlur={commit} onSubmitEditing={() => { commit(); setOpen(false); }}
        style={{ flex: 1, minWidth: 0, minHeight: 50, borderRadius: 0, color: colors.text, fontSize: 14 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Mostrar tamanhos" accessibilityState={{ expanded: open }} onPress={() => setOpen(v => !v)} style={{ minWidth: 44, minHeight: 50, alignItems: "center", justifyContent: "center" }}>
        <GoAtletaIcon name={open ? "chevronUp" : "chevronDown"} size={18} color={colors.text} />
      </Pressable>
    </View>
    {open ? <ScrollView nestedScrollEnabled style={{ maxHeight: 180, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.inputBg }}>
      {OBJECT_SIZES.map(size => <Pressable key={size} accessibilityRole="button" accessibilityLabel={`Tamanho ${size}`} accessibilityState={{ selected: value === size }} onPress={() => { choose(size); setOpen(false); }}
        style={({ hovered }) => ({ minHeight: 44, paddingHorizontal: 14, justifyContent: "center", backgroundColor: value === size ? colors.primaryBg : hovered ? colors.secondaryBg : "transparent" })}>
        <Text style={{ color: value === size ? colors.primaryText : colors.text, fontSize: 14 }}>{size}</Text>
      </Pressable>)}
    </ScrollView> : null}
  </View>;
}
const styles = StyleSheet.create({
  action: { minWidth: 44, minHeight: 44, paddingHorizontal: spacing.sm, gap: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: radius.md, borderWidth: 1 },
  textAction: { flexShrink: 1, justifyContent: "flex-start" },
  tile: { width: "47%", minHeight: 76, flexDirection: "column", paddingVertical: spacing.sm },
  switchRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: spacing.md },
});

export function CourtRosterPicker({ roster, selectedId, onChange }: { roster: { id: string; name: string }[]; selectedId?: string; onChange: (id?: string) => void }) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState("");
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
  const matches = query.trim() ? roster.filter(student => student.id !== selectedId && normalize(student.name).includes(normalize(query))) : [];
  const selected = roster.find(student => student.id === selectedId);
  return <View style={{ gap: 8 }}>
    {selectedId ? <View style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "100%", borderRadius: 22, paddingLeft: 14, backgroundColor: colors.secondaryBg, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.text, fontSize: 13, flexShrink: 1 }}>{selected?.name ?? "Atleta vinculado"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Remover vínculo de ${selected?.name ?? "atleta"}`} onPress={() => onChange(undefined)} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <GoAtletaIcon name="close" color={colors.muted} size={16} />
      </Pressable>
    </View> : null}
    <View style={{ backgroundColor: colors.inputBg, minHeight: 50, borderRadius: 12, paddingHorizontal: 14 }}>
      <TextInput accessibilityLabel="Pesquisar atleta da turma" placeholder={selectedId ? "Pesquisar para trocar" : "Pesquisar atleta"} placeholderTextColor={colors.muted} value={query} onChangeText={setQuery}
        style={{ color: colors.text, minHeight: 50, borderRadius: 0, fontSize: 14 }} />
    </View>
    {query.trim() ? <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: 220 }}>
      {matches.length ? matches.map(student => <Pressable key={student.id} accessibilityRole="button" accessibilityLabel={`Vincular ${student.name}`} onPress={() => { onChange(student.id); setQuery(""); }}
        style={({ hovered }) => ({ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12, backgroundColor: hovered ? colors.secondaryBg : "transparent" })}>
        <Text style={{ color: colors.text, fontSize: 13 }}>{student.name}</Text>
      </Pressable>) : <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: 8 }}>Nenhum atleta encontrado.</Text>}
    </ScrollView> : null}
  </View>;
}
