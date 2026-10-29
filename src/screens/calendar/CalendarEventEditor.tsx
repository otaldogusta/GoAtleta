import { useIsFocused } from "expo-router";
import { registerPendingEditsNavigation } from "../../navigation/pending-edits-navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createEvent, deleteEvent, setEventClasses, updateEvent, type EventListItem } from "../../api/events";
import { useAuth } from "../../auth/auth";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../auth/session";
import type { ClassGroup } from "../../core/models";
import { useOrganization } from "../../providers/organization-context";
import { validateTournamentRules } from "../../regulation/tournament-rule-check";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { AnchoredDropdownOption } from "../../ui/AnchoredDropdownOption";
import { Button } from "../../ui/Button";
import { DateInput } from "../../ui/DateInput";
import { DatePickerModal } from "../../ui/DatePickerModal";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { useSaveToast } from "../../ui/save-toast";
import { eventDraftInterval, initialEventDraft, quickEventDraft, type EventDraft } from "./application/event-draft";

const categories = { treino: "Treino", torneio: "Torneio", amistoso: "Amistoso", reuniao: "Reunião", outro: "Outro" };
const sports = { geral: "Geral", volei_quadra: "Vôlei de quadra", volei_praia: "Vôlei de praia", futebol: "Futebol" };
function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Record<T, string>; onChange: (value: T) => void }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  return <View style={styles.field}>
    <Text style={{ color: colors.muted }}>{label}</Text>
    <View ref={trigger} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options[value]}`} onPress={() => trigger.current?.measureInWindow((x, y, width, height) => setLayout({ x, y, width, height }))} style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, flex: 1 }}>{options[value]}</Text><GoAtletaIcon name="chevronDown" size={16} color={colors.muted} />
    </Pressable></View>
    <AnchoredDropdown visible={Boolean(layout)} layout={layout} container={null} animationStyle={{ opacity: 1 }} onRequestClose={() => setLayout(null)} zIndex={340} nestedScrollEnabled maxHeight={240} scrollContentStyle={{ padding: 6 }}>
      {(Object.keys(options) as T[]).map(key => <AnchoredDropdownOption key={key} active={key === value} onPress={() => { onChange(key); setLayout(null); }}><Text style={{ color: key === value ? colors.primaryText : colors.text }}>{options[key]}</Text></AnchoredDropdownOption>)}
    </AnchoredDropdown>
  </View>;
}

type Props = { date: string; event?: EventListItem; classes: ClassGroup[]; onClose: () => void; onSaved: () => void; quick?: boolean; seed?: EventDraft; suggestedTimes?: string[]; resumeId?: string; onExpand?: (draft: EventDraft, resumeId?: string) => void };
export function CalendarEventEditor({ date, event, classes, onClose, onSaved, quick = false, seed, suggestedTimes = [], resumeId, onExpand }: Props) {
  const isFocused = useIsFocused();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
  const { confirm } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const canManage = (activeOrganization?.role_level ?? 0) >= 50;
  const [editing, setEditing] = useState(!event);
  const [draft, setDraft] = useState(() => seed ?? initialEventDraft(date, event));
  const baseline = useRef(JSON.stringify(seed ? initialEventDraft(date, event) : draft));
  const [saving, setSaving] = useState(false);
  const [datePicker, setDatePicker] = useState<"startDate" | "endDate" | null>(null);
  const [more, setMore] = useState(Boolean(event?.description || event?.classIds.length));
  const mounted = useRef(true);
  const pending = useRef(false);
  const renderIdentity = getSessionIdentity();
  const scope = JSON.stringify([session?.user?.id, renderIdentity.generation, activeOrganization?.id, canManage, event?.id, isFocused]);
  const live = useRef({ scope, draft });
  useLayoutEffect(() => { live.current = { scope, draft }; }, [scope, draft]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const change = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => { if (!pending.current) setDraft(current => ({ ...current, [key]: value })); };
  const close = async (navigate = onClose) => {
    if (pending.current) return;
    const current = JSON.stringify(live.current.draft);
    if (editing && current !== baseline.current) {
      const discard = await confirm({ title: "Descartar alterações?", message: "O evento ainda não foi salvo.", confirmLabel: "Descartar", cancelLabel: "Continuar editando", onConfirm: () => undefined });
      if (!discard || !mounted.current || live.current.scope !== scope || JSON.stringify(live.current.draft) !== current) return;
    }
    navigate();
  };
  const leave = useRef(close);
  useLayoutEffect(() => { leave.current = close; });
  useEffect(() => {
    if (!isFocused) return;
    return registerPendingEditsNavigation(navigate => { void leave.current(() => { onClose(); navigate(); }); });
  }, [isFocused, scope, onClose]);
  const savedId = useRef(event?.id ?? resumeId);
  const mutate = async (remove = false) => {
    if (pending.current || !isFocused || !canManage || !activeOrganization?.id || !session?.user?.id || (event && event.organizationId !== activeOrganization.id)) return;
    const identity = getSessionIdentity();
    const serialized = JSON.stringify(live.current.draft);
    const currentDraft = quick ? quickEventDraft(live.current.draft) : live.current.draft;
    const isCurrent = () => mounted.current && isSessionIdentityCurrent(identity) && live.current.scope === scope && JSON.stringify(live.current.draft) === serialized;
    const interval = eventDraftInterval(currentDraft);
    if (!remove && (!currentDraft.title.trim() || !interval)) return;
    pending.current = true;
    setSaving(true);
    try {
      if (remove && event) {
        const accepted = await confirm({ title: "Excluir evento?", message: event.title, confirmLabel: "Excluir", cancelLabel: "Cancelar", tone: "danger", onConfirm: () => undefined });
        if (!accepted || !isCurrent()) return;
        await deleteEvent(event.id, activeOrganization.id);
      } else if (interval) {
        const selectedClasses = classes.filter(item => currentDraft.classIds.includes(item.id));
        const unitId = selectedClasses[0]?.unitId ?? event?.unitId ?? null;
        const rules = await validateTournamentRules({ organizationId: activeOrganization.id, eventType: currentDraft.eventType, eventSport: currentDraft.sport, ...interval, locationLabel: currentDraft.locationLabel.trim(), linkedClassCount: currentDraft.classIds.length, unitId, existingRuleSetId: event?.ruleSetId });
        if (!isCurrent()) return;
        const errors = rules.issues.filter(issue => issue.severity === "error");
        if (errors.length) throw new Error(errors.map(issue => issue.message).join("\n"));
        const warnings = rules.issues.filter(issue => issue.severity === "warning");
        if (warnings.length) {
          const accepted = await confirm({ title: "Atenção ao regulamento", message: warnings.map(issue => issue.message).join("\n"), confirmLabel: "Continuar", cancelLabel: "Revisar", onConfirm: () => undefined });
          if (!accepted || !isCurrent()) return;
        }
        const payload = { organizationId: activeOrganization.id, title: currentDraft.title.trim(), description: currentDraft.description.trim(), eventType: currentDraft.eventType, sport: currentDraft.sport, startsAt: interval.startsAt.toISOString(), endsAt: interval.endsAt.toISOString(), allDay: currentDraft.allDay, locationLabel: currentDraft.locationLabel.trim(), unitId, ruleSetId: rules.ruleSetId };
        const saved = savedId.current ? await updateEvent(savedId.current, payload) : await createEvent({ ...payload, createdBy: session.user.id });
        savedId.current = saved.id;
        if (!isCurrent()) return;
        await setEventClasses(saved.id, activeOrganization.id, currentDraft.classIds);
      }
      if (isCurrent()) { onSaved(); onClose(); showSaveToast({ message: remove ? "Evento excluído." : "Evento salvo.", variant: "success" }); }
    } catch (error) {
      if (isCurrent()) showSaveToast({ error, message: "Não foi possível salvar o evento.", variant: "error" });
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const field = (label: string, key: "title" | "description" | "startTime" | "endTime" | "locationLabel", placeholder?: string) => <View style={styles.field}>
    <Text style={{ color: colors.muted }}>{label}</Text>
    <View style={[styles.inputBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.placeholder} value={draft[key]} editable={!saving} onChangeText={value => change(key, value)} multiline={key === "description"} style={[styles.input, { color: colors.inputText }]} /></View>
  </View>;
  if (quick && !canManage) return null;
  if (quick) {
    const parsed = quickEventDraft(draft);
    const valid = Boolean(parsed.title && eventDraftInterval(parsed));
    return <View testID="calendar-quick-editor" style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        <TextInput autoFocus accessibilityLabel="Título do evento rápido" placeholder={`Adicionar em ${new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`} placeholderTextColor={colors.placeholder} value={draft.title} editable={!saving} onChangeText={value => change("title", value)} onSubmitEditing={() => { if (valid) void mutate(); }} returnKeyType="done" style={[styles.quickInput, { color: colors.inputText }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Salvar evento rápido" disabled={!valid || saving} onPress={() => void mutate()} style={[styles.quickCircle, { backgroundColor: valid ? colors.primaryBg : colors.secondaryBg, opacity: saving ? 0.55 : 1 }]}><GoAtletaIcon name="checkmark" size={22} color={valid ? colors.primaryText : colors.muted} /></Pressable>
      </View>
      <View style={styles.quickTools}>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChips}>{[...new Set([parsed.startTime, ...suggestedTimes])].filter(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).slice(0, 3).map(time => <Pressable key={time} accessibilityRole="button" accessibilityLabel={`Horário ${time}`} disabled={saving} onPress={() => setDraft(current => ({ ...current, title: quickEventDraft(current).title, startTime: time }))} style={[styles.timeChip, { backgroundColor: colors.secondaryBg }]}><Text style={{ color: colors.text, fontWeight: "600" }}>{time}</Text></Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir detalhes do evento" disabled={saving} onPress={() => { if (savedId.current) onExpand?.(parsed, savedId.current); else onExpand?.(parsed); }} style={styles.quickCircle}><GoAtletaIcon name="add" size={24} color={colors.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar criação rápida" disabled={saving} onPress={() => void close()} style={styles.quickCircle}><GoAtletaIcon name="close" size={18} color={colors.muted} /></Pressable>
      </View>
    </View>;
  }
  return <ModalSheet visible onClose={() => void close()} position={width < 600 ? "bottom" : "center"} cardStyle={[styles.card, { width: "100%", maxWidth: 520, maxHeight: "92%" }]}>
    <View style={styles.header}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{event ? editing ? "Editar evento" : event.title : "Novo evento"}</Text><Pressable accessibilityRole="button" accessibilityLabel="Fechar evento" onPress={() => void close()} style={styles.close}><GoAtletaIcon name="close" size={20} color={colors.text} /></Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
      {!editing ? <>
        <Text style={{ color: colors.text, fontSize: 16 }}>{new Date(event!.startsAt).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</Text>
        {draft.startDate !== draft.endDate ? <Text style={{ color: colors.muted }}>Até {new Date(draft.endDate + "T00:00:00").toLocaleDateString("pt-BR")}</Text> : null}
        <Text style={{ color: colors.muted }}>{event!.allDay ? "Dia todo" : `${draft.startTime} – ${draft.endTime}`}</Text>
        {event!.locationLabel ? <Text style={{ color: colors.text }}>{event!.locationLabel}</Text> : null}
        {event!.description ? <Text style={{ color: colors.text }}>{event!.description}</Text> : null}
        <Text style={{ color: colors.muted }}>{categories[event!.eventType]} · {sports[event!.sport]}</Text>
        {event!.classIds.length ? <Text style={{ color: colors.muted }}>{classes.filter(item => event!.classIds.includes(item.id)).map(item => item.name).join(", ")}</Text> : null}
      </> : <>
        {field("Título", "title", "Título do evento")}
        <View style={styles.header}><Text style={{ color: colors.text }}>Dia todo</Text><Switch accessibilityLabel="Dia todo" value={draft.allDay} disabled={saving} onValueChange={value => change("allDay", value)} /></View>
        <View style={styles.row}>{(["startDate", "endDate"] as const).map((key, index) => <View key={key} style={styles.column}><Text style={{ color: colors.muted }}>{index ? "Fim" : "Início"}</Text><DateInput value={draft[key]} onChange={value => change(key, value)} accessibilityLabel={index ? "Data de término" : "Data de início"} onOpenCalendar={() => setDatePicker(key)} />{!draft.allDay ? field(index ? "Hora de término" : "Hora de início", index ? "endTime" : "startTime", "09:00") : null}</View>)}</View>
        {!eventDraftInterval(draft) ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Confira as datas e os horários de início e término.</Text> : null}
        {field("Local", "locationLabel", "Quadra, ginásio ou endereço")}
        <View style={styles.row}><Choice label="Categoria" value={draft.eventType} options={categories} onChange={value => change("eventType", value)} /><Choice label="Esporte" value={draft.sport} options={sports} onChange={value => change("sport", value)} /></View>
        <Pressable accessibilityRole="button" onPress={() => setMore(value => !value)}><Text style={{ color: colors.text, fontWeight: "600" }}>{more ? "Ocultar detalhes" : "Descrição e turmas"}</Text></Pressable>
        {more ? <>{field("Descrição", "description")}
          <Text style={{ color: colors.muted }}>Turmas vinculadas</Text><View style={styles.chips}>{classes.map(item => { const selected = draft.classIds.includes(item.id); return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.name} disabled={saving} onPress={() => change("classIds", selected ? draft.classIds.filter(id => id !== item.id) : [...draft.classIds, item.id])} style={[styles.chip, { borderColor: colors.border, backgroundColor: selected ? colors.primaryBg : colors.secondaryBg }]}><Text style={{ color: selected ? colors.primaryText : colors.text }}>{item.name}</Text></Pressable>; })}</View>
        </> : null}
      </>}
    </ScrollView>
    {canManage ? <View style={styles.row}>{event ? <View style={styles.column}><Button label="Excluir" variant="danger" disabled={saving} onPress={() => void mutate(true)} /></View> : null}<View style={styles.column}><Button label={editing ? "Salvar evento" : "Editar evento"} loading={saving} disabled={editing && (!draft.title.trim() || !eventDraftInterval(draft))} onPress={() => editing ? void mutate() : setEditing(true)} /></View></View> : null}
    <DatePickerModal visible={Boolean(datePicker)} value={datePicker ? draft[datePicker] : date} onChange={value => { if (datePicker) change(datePicker, value); }} onClose={() => setDatePicker(null)} closeOnSelect initialViewMode="day" />
  </ModalSheet>;
}
const styles = StyleSheet.create({
  quickCard: { width: "100%", maxWidth: 440, alignSelf: "center", borderRadius: 28, borderWidth: 1, padding: 12, gap: 4 }, quickInput: { flex: 1, minWidth: 0, minHeight: 44, fontSize: 16, borderRadius: 0 }, quickCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, quickTools: { flexDirection: "row", alignItems: "center", gap: 2 }, timeChips: { gap: 8, alignItems: "center" }, timeChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20 },
  card: { padding: 20, gap: 16 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, title: { fontSize: 20, fontWeight: "700", flex: 1 }, close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, body: { gap: 16, paddingBottom: 12 }, field: { flex: 1, gap: 6 }, inputBox: { minHeight: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, input: { flex: 1, borderRadius: 0, paddingVertical: 12, fontSize: 15 }, row: { flexDirection: "row", gap: 12 }, column: { flex: 1, minWidth: 0, gap: 8 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, chip: { paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
});
