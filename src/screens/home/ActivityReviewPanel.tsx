import { useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { ActivityReviewDetails, ActivityReviewReason } from "../../api/activity-review";
import type { MissingClassActivity } from "../../core/activity-review";
import { ModalSheet } from "../../ui/ModalSheet";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { overlayLayers } from "../../ui/overlay-layers";
import { DateInput } from "../../ui/DateInput";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { radius, spacing } from "../../theme/tokens";

const reasons = [
  ["recess", "Férias / recesso"], ["holiday", "Feriado"],
  ["tournament", "Campeonato / torneio"], ["suspended", "Aulas suspensas"], ["other", "Outro motivo"],
] as const;
export type ReviewDraft = ActivityReviewDetails & { reason: ActivityReviewReason | null; start: string; end: string };
export function validReviewDraft(draft: ReviewDraft, selected: string[]) {
  const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  const days = (Date.parse(draft.end) - Date.parse(draft.start)) / 86400000;
  return selected.length > 0 && draft.reason !== null && validDate(draft.start) && validDate(draft.end) && days >= 0 && days <= 92
    && (draft.reason !== "other" || draft.note.trim().length >= 3)
    && (draft.reason !== "tournament" || draft.resolution === "replaced" || (draft.resolution === "rescheduled" && draft.start === draft.end && validDate(draft.newDate) && draft.newDate > draft.end));
}

export function ActivityReviewPanel({ visible, items, selected, onSelected, draft, onDraft, saving, error, onClose, onSave }: {
  visible: boolean; items: MissingClassActivity[]; selected: string[]; onSelected: (ids: string[]) => void;
  draft: ReviewDraft; onDraft: (draft: ReviewDraft) => void; saving: boolean; error: string; onClose: () => void; onSave: () => void;
}) {
  const { colors } = useAppTheme();
  const compact = useWindowDimensions().width < 480;
  const [menu, setMenu] = useState(false);
  const reasonAnchor = useRef<View>(null);
  const [menuLayout, setMenuLayout] = useState<{x:number;y:number;width:number;height:number} | null>(null);
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) setMenu(false);
  }
  const toggleMenu = () => {
    if (menu) { setMenu(false); return; }
    reasonAnchor.current?.measureInWindow((x,y,width,height) => {
      setMenuLayout({x,y,width,height}); setMenu(true);
    });
  };
  const held = draft.reason === "held";
  const rescheduled = draft.reason === "tournament" && draft.resolution === "rescheduled";
  const change = (patch: Partial<ReviewDraft>) => onDraft({ ...draft, ...patch });
  const choice = (label: string, checked: boolean, action: () => void) => <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked }} disabled={saving} onPress={action} style={[s.choice, { backgroundColor: checked ? colors.successBg : colors.inputBg, borderColor: checked ? colors.successText : colors.border }]}>
    <View style={[s.radio, { borderColor: checked ? colors.successText : colors.muted }]}>{checked ? <View style={[s.dot, { backgroundColor: colors.successText }]} /> : null}</View><Text style={[s.choiceText, { color: colors.text }]}>{label}</Text>
  </Pressable>;
  return <ModalSheet visible={visible} onClose={onClose} position="center" backdropOpacity={0.4} overlayZIndex={30000} cardStyle={[s.panel, compact && s.compact, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={s.header}>
      {!compact ? <View style={[s.icon, { backgroundColor: colors.successBg }]}><GoAtletaIcon name="calendar" size={26} color={colors.successText} /></View> : null}
      <View style={s.grow}><Text accessibilityRole="header" style={[s.title, { color: colors.text }]}>Revisar período</Text><Text style={[s.subtitle, { color: colors.muted }]}>Confirme o que aconteceu nas datas sem chamada.</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar revisão do período" disabled={saving} onPress={onClose} style={[s.close, { borderColor: colors.border }]}><GoAtletaIcon name="close" size={20} color={colors.muted} /></Pressable>
    </View>
    <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.row}><Text style={[s.label, { color: colors.text }]}>Turmas</Text><Text style={{ color: colors.muted }}>{selected.length} selecionadas</Text></View>
      <View style={[s.classes, { borderColor: colors.border }]}>{items.map((item, index) => <Pressable key={item.classId} accessibilityRole="checkbox" accessibilityLabel={item.name} accessibilityState={{ checked: selected.includes(item.classId) }} disabled={saving} onPress={() => onSelected(selected.includes(item.classId) ? selected.filter(id => id !== item.classId) : [...selected, item.classId])} style={[s.classRow, index > 0 && s.divider, { borderColor: colors.border }]}>
        <View style={[s.check, { backgroundColor: selected.includes(item.classId) ? colors.primaryBg : colors.inputBg, borderColor: colors.border }]}>{selected.includes(item.classId) ? <GoAtletaIcon name="checkmark" size={15} color={colors.primaryText} /> : null}</View>
        <View style={s.grow}><Text style={[s.className, { color: colors.text }]}>{item.name}</Text><Text numberOfLines={2} style={[s.unit, { color: colors.muted }]}>{item.unit}</Text></View>
        <Text style={[s.badge, { backgroundColor: colors.inputBg, color: colors.muted }]}>{item.dates.length} datas</Text>
      </Pressable>)}</View>
      <Text style={[s.label, s.section, { color: colors.text }]}>O que aconteceu?</Text>
      <View style={s.choices}>{choice("Não houve aula", draft.reason !== null && !held, () => change({ reason: "recess", resolution: null, newDate: "", note: "" }))}{choice("A aula aconteceu", held, () => { setMenu(false); change({ reason: "held", resolution: null, newDate: "", note: "" }); })}</View>
      {!held && draft.reason !== null ? <>
        <Text style={[s.label, s.section, { color: colors.text }]}>Motivo</Text>
        <View ref={reasonAnchor} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel="Escolher motivo" accessibilityState={{ expanded: menu }} disabled={saving} onPress={toggleMenu} style={[s.select, { backgroundColor: colors.inputBg, borderColor: colors.border }]}><Text style={[s.grow, { color: colors.text }]}>{reasons.find(([id]) => id === draft.reason)?.[1]}</Text><GoAtletaIcon name={menu ? "chevronUp" : "chevronDown"} size={18} color={colors.muted} /></Pressable></View>
        <AnchoredDropdown visible={menu && visible} layout={menuLayout} container={null} animationStyle={null} zIndex={overlayLayers.floatingList} maxHeight={180} nestedScrollEnabled density="compact" fitContent portalToBodyOnWeb interactiveRefs={[reasonAnchor]} onRequestClose={() => setMenu(false)}>
          {reasons.map(([value, label]) => <AnchoredDropdownOption key={value} active={draft.reason === value} density="compact" disabled={saving} onPress={() => { change({ reason: value, resolution: null, note: "", newDate: "" }); setMenu(false); }}><Text style={[s.optionLabel, { color: draft.reason === value ? colors.primaryText : colors.text }]}>{label}</Text></AnchoredDropdownOption>)}
        </AnchoredDropdown>
        {draft.reason === "other" ? <View style={[s.note, { backgroundColor: colors.inputBg, borderColor: colors.border }]}><TextInput accessibilityLabel="Descreva o motivo" editable={!saving} value={draft.note} onChangeText={note => change({ note })} maxLength={240} placeholder="Descreva o motivo" placeholderTextColor={colors.muted} style={[s.textInput, { color: colors.text }]} /></View> : null}
        {draft.reason === "tournament" ? <><Text style={[s.label, s.section, { color: colors.text }]}>Como ficou a aula?</Text><View style={[s.choices, compact && s.vertical]}>{choice("Foi substituída pelo evento", draft.resolution === "replaced", () => change({ resolution: "replaced", newDate: "" }))}{choice("Foi remarcada", rescheduled, () => change({ resolution: "rescheduled", end: draft.start }))}</View></> : null}
      </> : null}
      <Text style={[s.label, s.section, { color: colors.text }]}>{rescheduled ? "Remarcação" : "Período"}</Text>
      <View style={s.choices} pointerEvents={saving ? "none" : "auto"}>
        <View style={s.grow}><Text style={[s.dateLabel, { color: colors.muted }]}>{rescheduled ? "Data original" : "Início"}</Text><DateInput value={draft.start} onChange={start => change(rescheduled ? { start, end: start } : { start })} accessibilityLabel="Início da revisão" /></View>
        <View style={s.grow}><Text style={[s.dateLabel, { color: colors.muted }]}>{rescheduled ? "Nova data" : "Fim"}</Text><DateInput value={rescheduled ? draft.newDate : draft.end} onChange={date => change(rescheduled ? { newDate: date } : { end: date })} accessibilityLabel={rescheduled ? "Nova data da aula" : "Fim da revisão"} /></View>
      </View>
      <Text style={[s.hint, { color: colors.muted }]}>{held ? "As chamadas continuam pendentes para preenchimento." : rescheduled ? "Uma reposição será criada em Eventos na nova data, com horário a definir." : draft.reason === "tournament" ? "O motivo ficará registrado nas datas substituídas pelo evento." : `Pausa para ${selected.length} turma(s) no período selecionado.`}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
    </ScrollView>
    <View style={[s.footer, { borderColor: colors.border }]}><Text style={[s.grow, s.hint, { color: colors.muted }]}>Chamadas existentes serão mantidas.</Text><Button label="Confirmar" loading={saving} disabled={saving || !validReviewDraft(draft, selected)} onPress={onSave} /></View>
  </ModalSheet>;
}
const s = StyleSheet.create({
  panel: { width: "100%", maxWidth: 600, maxHeight: "90%", padding: spacing.lg, borderWidth: 1, borderRadius: radius.container, gap: spacing.md },
  compact: { padding: spacing.md }, header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  icon: { width: 48, height: 48, borderRadius: radius.internal, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700" }, subtitle: { fontSize: 13, marginTop: 6, lineHeight: 19 },
  grow: { flex: 1, minWidth: 0 }, close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flexShrink: 1 }, content: { gap: spacing.sm }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontSize: 14, fontWeight: "600" }, section: { marginTop: spacing.sm }, classes: { borderWidth: 1, borderRadius: radius.internal, overflow: "hidden" },
  classRow: { padding: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm }, divider: { borderTopWidth: 1 },
  className: { fontSize: 14, fontWeight: "600" }, unit: { fontSize: 12, marginTop: 4 },
  check: { width: 21, height: 21, borderWidth: 1, borderRadius: 5, alignItems: "center", justifyContent: "center" }, badge: { fontSize: 11, padding: 6, borderRadius: 6 },
  choices: { flexDirection: "row", gap: spacing.sm }, vertical: { flexDirection: "column" },
  choice: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", padding: spacing.sm, gap: spacing.sm, borderRadius: radius.internal, borderWidth: 1 },
  choiceText: { flex: 1, fontSize: 13 }, radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" }, dot: { width: 7, height: 7, borderRadius: 4 },
  select: { minHeight: 46, borderWidth: 1, borderRadius: radius.internal, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  optionLabel: { fontSize: 12, fontWeight: "700" }, note: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" }, textInput: { borderRadius: 0, minHeight: 46, fontSize: 14 },
  dateLabel: { fontSize: 12, marginBottom: 6 }, hint: { fontSize: 12, lineHeight: 18 }, footer: { borderTopWidth: 1, paddingTop: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md },
});
