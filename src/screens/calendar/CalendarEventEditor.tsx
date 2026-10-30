import { useIsFocused } from "expo-router";
import { registerPendingEditsNavigation } from "../../navigation/pending-edits-navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createEvent, deleteEvent, setEventClasses, updateEvent, type EventListItem } from "../../api/events";
import { useAuth } from "../../auth/auth";
import { getSessionIdentity, isSessionIdentityCurrent } from "../../auth/session";
import type { ClassGroup } from "../../core/models";
import { useOrganization } from "../../providers/organization-context";
import { validateTournamentRules } from "../../regulation/tournament-rule-check";
import { AnchoredDropdown } from "../../ui/AnchoredDropdown";
import { DatePickerModal } from "../../ui/DatePickerModal";
import { GoAtletaIcon, type GoAtletaIconName } from "../../ui/icon-registry";
import { ModalSheet } from "../../ui/ModalSheet";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { useSaveToast } from "../../ui/save-toast";
import { duplicateEventDraft, eventDraftInterval, initialEventDraft, moveEventDraftStart, quickEventDraft, type EventDraft } from "./application/event-draft";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry, type CalendarEntryShareSnapshot } from "./application/share-calendar-entry";
import { CalendarTimePicker, CalendarTimeWheels, useCalendarReducedMotion } from "./CalendarTimePicker";
import { CalendarPickerDisclosure } from "./CalendarInlineTimePicker";
import { brandPalette, compactUiMetrics } from "../../theme/tokens";
import { CalendarEventAttachments } from "./CalendarEventAttachments";
import { useCalendarEventAttachments } from "./useCalendarEventAttachments";
import { ensureEventAttachmentsAvailable } from "../../api/event-attachments";
import { CalendarEntryDetails, calendarEntryDetailsShellStyle } from "./CalendarEntryDetails";
import { useCalendarEditorScrollbars } from "./useCalendarEditorScrollbars";

const categories = { treino: "Treino", torneio: "Torneio", amistoso: "Amistoso", reuniao: "Reunião", outro: "Outro" };
const sports = { geral: "Geral", volei_quadra: "Vôlei de quadra", volei_praia: "Vôlei de praia", futebol: "Futebol" };
const highlighted = (state: { pressed: boolean }, selected = false) => selected || state.pressed || Boolean((state as { hovered?: boolean }).hovered);

function CalendarNotesField({ value, disabled, onChange, autoFocus = false }: { value: string; disabled: boolean; onChange: (value: string) => void; autoFocus?: boolean }) {
  const { colors } = useAppTheme();
  const input = useRef<TextInput>(null);
  const [height, setHeight] = useState(24);
  const fitWebContent = useCallback(() => {
    if (Platform.OS !== "web") return;
    const node = input.current as unknown as { scrollHeight: number; style: { height: string } } | null;
    if (!node?.style || typeof node.scrollHeight !== "number") return;
    // Measure intrinsic height after removing the previous height, so deletion shrinks too.
    node.style.height = "0px";
    const next = Math.max(24, node.scrollHeight);
    node.style.height = `${next}px`;
    setHeight(current => current === next ? current : next);
  }, []);
  useLayoutEffect(fitWebContent, [value, fitWebContent]);
  return <View testID="calendar-notes-row" onLayout={fitWebContent} style={[styles.setting, styles.notesRow, { borderColor: colors.border }]}>
    <View pointerEvents="none" style={styles.notesIcon}><GoAtletaIcon name="notes" size={compactUiMetrics.iconSize} color={colors.muted} /></View>
    <TextInput ref={input} accessibilityLabel="Anotações" placeholder="Anotações" placeholderTextColor={colors.placeholder} autoFocus={autoFocus}
      value={value} editable={!disabled} onChangeText={onChange} multiline scrollEnabled={false} textAlignVertical="top"
      onContentSizeChange={Platform.OS === "web" ? undefined : event => setHeight(Math.max(24, event.nativeEvent.contentSize.height))}
      style={[styles.notesInput, { height, color: colors.inputText }]} />
  </View>;
}
function AllDaySwitch({ value, disabled, reducedMotion, onChange }: { value: boolean; disabled: boolean; reducedMotion: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  const [position] = useState(() => new Animated.Value(value ? 16 : 0));
  useLayoutEffect(() => {
    position.stopAnimation();
    if (reducedMotion) { position.setValue(value ? 16 : 0); return; }
    const animation = Animated.timing(position, { toValue: value ? 16 : 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [value, position, reducedMotion]);
  return <Pressable accessibilityRole="switch" accessibilityLabel="Dia todo" accessibilityState={{ checked: value, disabled }} disabled={disabled}
    suppressWebHoverFeedback disableWebPressScale onPress={() => onChange(!value)}
    {...(Platform.OS === "web" ? { "aria-checked": value, "aria-disabled": disabled, onKeyDown: (event: { key: string; repeat?: boolean; defaultPrevented?: boolean; preventDefault: () => void }) => {
      if ((event.key === " " || event.key === "Spacebar") && !event.defaultPrevented) { event.preventDefault(); if (!event.repeat && !disabled) onChange(!value); }
    } } : {})}
    style={[styles.switchTarget, { opacity: disabled ? 0.55 : 1 }]}>
    <View pointerEvents="none" style={styles.switchTrack}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: 11, backgroundColor: value ? colors.primaryBg : colors.text, opacity: value ? 1 : 0.32 }]} />
      <Animated.View style={[styles.switchThumb, { backgroundColor: brandPalette.white, transform: [{ translateX: position }] }]} />
    </View>
  </Pressable>;
}
function Choice<T extends string>({ label, value, options, onChange, icon, disabled, autoOpen = false }: { label: string; value: T; options: Record<T, string>; onChange: (value: T) => void; icon: GoAtletaIconName; disabled: boolean; autoOpen?: boolean }) {
  const { colors } = useAppTheme();
  const trigger = useRef<View>(null);
  const [layout, setLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const requested = useRef(false);
  useLayoutEffect(() => {
    if (autoOpen && !disabled && !requested.current) {
      requested.current = true;
      trigger.current?.measureInWindow((x, y, width, height) => setLayout({ x, y, width, height }));
    }
  }, [autoOpen, disabled]);
  return <View style={[styles.setting, { borderColor: colors.border }]}>
    <View ref={trigger} collapsable={false}><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options[value]}`} disabled={disabled} suppressWebHoverFeedback disableWebPressScale onPress={() => trigger.current?.measureInWindow((x, y, width, height) => setLayout({ x, y, width, height }))} style={styles.settingTrigger}>
      {state => <><GoAtletaIcon name={icon} size={compactUiMetrics.iconSize} color={colors.muted} /><Text style={[styles.settingText, { color: colors.text, flex: 1 }]}>{label}</Text><Text style={[styles.settingText, { color: highlighted(state, Boolean(layout)) ? colors.text : colors.muted, flexShrink: 1 }]}>{options[value]}</Text><GoAtletaIcon name="chevronDown" size={compactUiMetrics.secondaryIconSize} color={highlighted(state, Boolean(layout)) ? colors.text : colors.muted} /></>}
    </Pressable></View>
    <AnchoredDropdown visible={!disabled && Boolean(layout)} layout={layout} container={null} animationStyle={{ opacity: 1 }} onRequestClose={() => setLayout(null)} zIndex={340} nestedScrollEnabled fitContent maxHeight={240} scrollContentStyle={{ padding: 6 }}>
      {(Object.keys(options) as T[]).map(key => <Pressable key={key} accessibilityRole="button" accessibilityLabel={options[key]} accessibilityState={{ selected: key === value }} suppressWebHoverFeedback disableWebPressScale onPress={() => { onChange(key); setLayout(null); }} style={state => [styles.choiceOption, { backgroundColor: highlighted(state) ? colors.inputBg : "transparent" }]}><Text style={[styles.settingText, { color: colors.text, flex: 1, fontWeight: key === value ? "600" : "400" }]}>{options[key]}</Text>{key === value ? <GoAtletaIcon name="checkmark" size={compactUiMetrics.iconSize} color={colors.primaryBg} /> : null}</Pressable>)}
    </AnchoredDropdown>
  </View>;
}

type Props = { date: string; event?: EventListItem; classes: ClassGroup[]; onClose: () => void; onSaved: () => void; quick?: boolean; seed?: EventDraft; suggestedTimes?: string[]; resumeId?: string; onExpand?: (draft: EventDraft, resumeId?: string) => void; onDuplicate?: (draft: EventDraft) => void };
type EditorCloseRequest = { scope: string; navigate: () => void };
type EventEditTarget = "title" | "locationLabel" | "description" | "startDate" | "endDate" | "startTime" | "endTime" | "eventType" | "sport" | "classIds";
export function CalendarEventEditor({ date, event, classes, onClose, onSaved, quick = false, seed, suggestedTimes = [], resumeId, onExpand, onDuplicate }: Props) {
  const isFocused = useIsFocused();
  const { colors } = useAppTheme();
  useCalendarEditorScrollbars(!quick);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { activeOrganization } = useOrganization();
  const { confirm } = useConfirmDialog();
  const { showSaveToast } = useSaveToast();
  const canManage = (activeOrganization?.role_level ?? 0) >= 50;
  const [editing, setEditing] = useState(!event);
  const [editTarget, setEditTarget] = useState<EventEditTarget | null>(null);
  const [actionOwner, setActionOwner] = useState<string | null>(null);
  const actionPending = useRef<string | null>(null);
  const [draft, setDraft] = useState(() => seed ?? initialEventDraft(date, event));
  const baseline = useRef(JSON.stringify(seed ? initialEventDraft(date, event) : draft));
  const [saving, setSaving] = useState(false);
  const [closeRequest, setEditorCloseRequest] = useState<EditorCloseRequest | null>(null);
  const completedClose = useRef<EditorCloseRequest | null>(null);
  const [quickProgress] = useState(() => new Animated.Value(quick ? 0 : 1));
  const reducedMotion = useCalendarReducedMotion();
  const [datePicker, setDatePicker] = useState<"startDate" | "endDate" | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerOpening, setDatePickerOpening] = useState(0);
  const [timePicker, setTimePicker] = useState<string | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [inlineTimeTarget, setInlineTimeTarget] = useState<"startTime" | "endTime">("startTime");
  const [inlineTimeOpen, setInlineTimeOpen] = useState(false);
  const [pickerKind, setPickerKind] = useState<"date" | "time">("time");
  const [more, setMore] = useState(Boolean((seed?.classIds ?? event?.classIds)?.length));
  const mounted = useRef(true);
  const pending = useRef(false);
  const renderIdentity = getSessionIdentity();
  const scope = JSON.stringify([session?.user?.id, renderIdentity.generation, activeOrganization?.id, canManage, event?.id, isFocused]);
  const acting = actionOwner === scope;
  if (closeRequest && closeRequest.scope !== scope) setEditorCloseRequest(null);
  const closing = Boolean(closeRequest && closeRequest.scope === scope);
  const busy = saving || closing;
  const attachments = useCalendarEventAttachments({ eventId: event?.id ?? resumeId, organizationId: activeOrganization?.id, scope, canManage, busy, enabled: !quick && isFocused });
  const live = useRef({ scope, draft, attachmentSignature: attachments.signature, attachmentChanges: attachments.hasChanges });
  useLayoutEffect(() => { live.current = { scope, draft, attachmentSignature: attachments.signature, attachmentChanges: attachments.hasChanges }; }, [scope, draft, attachments.signature, attachments.hasChanges]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const completeClose = useCallback(() => {
    if (!closeRequest || completedClose.current === closeRequest) return;
    if (!mounted.current || live.current.scope !== closeRequest.scope) return;
    completedClose.current = closeRequest;
    closeRequest.navigate();
  }, [closeRequest]);
  useLayoutEffect(() => {
    if (!quick) {
      if (closing && reducedMotion) completeClose();
      return; // ModalSheet owns completion of its full exit.
    }
    quickProgress.stopAnimation();
    if (reducedMotion) { quickProgress.setValue(closing ? 0 : 1); if (closing) completeClose(); return; }
    const animation = Animated.timing(quickProgress, { toValue: closing ? 0 : 1, duration: closing ? 180 : 240, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    animation.start(({ finished }) => { if (finished && closing) completeClose(); });
    return () => animation.stop();
  }, [quick, quickProgress, reducedMotion, completeClose, closing]);
  const finishClose = (navigate = onClose) => {
    setEditorCloseRequest({ scope, navigate });
    setTimePickerOpen(false);
  };
  const change = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) => { if (!pending.current && !closing) setDraft(current => ({ ...current, [key]: value })); };
  const close = async (navigate = onClose) => {
    if (pending.current || actionPending.current === scope || closing) return;
    const current = JSON.stringify([live.current.draft, live.current.attachmentSignature]);
    if (editing && (JSON.stringify(live.current.draft) !== baseline.current || live.current.attachmentChanges)) {
      const discard = await confirm({ title: "Descartar alterações?", message: "O evento ainda não foi salvo.", confirmLabel: "Descartar", cancelLabel: "Continuar editando", onConfirm: () => undefined });
      if (!discard || !mounted.current || live.current.scope !== scope || JSON.stringify([live.current.draft, live.current.attachmentSignature]) !== current) return;
    }
    finishClose(navigate);
  };
  const leave = useRef(close);
  useLayoutEffect(() => { leave.current = close; });
  useEffect(() => {
    if (!isFocused) return;
    return registerPendingEditsNavigation(navigate => { void leave.current(() => { onClose(); navigate(); }); });
  }, [isFocused, scope, onClose]);
  const savedId = useRef(event?.id ?? resumeId);
  const contextCurrent = () => mounted.current && isFocused && isSessionIdentityCurrent(renderIdentity) && live.current.scope === scope
    && (!event || event.organizationId === activeOrganization?.id);
  const canAct = () => contextCurrent() && !busy && !pending.current && actionPending.current !== scope;
  const beginEdit = (target: EventEditTarget = "title") => {
    if (!canManage || !canAct()) return;
    setEditTarget(target); setEditing(true);
    if (target === "startDate" || target === "endDate") {
      setInlineTimeOpen(false); setPickerKind("date"); setDatePicker(target); setDatePickerOpening(current => current + 1); setDatePickerOpen(true);
    } else if (target === "startTime" || target === "endTime") {
      setDatePickerOpen(false); setPickerKind("time"); setInlineTimeTarget(target); setInlineTimeOpen(true);
    } else if (target === "classIds") setMore(true);
  };
  const shareSnapshot = (): CalendarEntryShareSnapshot => ({ title: draft.title, description: draft.description, location: draft.locationLabel,
    startDate: draft.startDate, endDate: draft.endDate, startTime: draft.startTime, endTime: draft.endTime, allDay: draft.allDay, uid: event ? `${event.id}@goatleta` : undefined });
  const runEntryAction = async (action: "share" | "copy" | "export") => {
    if (!canAct()) return;
    const snapshot = shareSnapshot(); actionPending.current = scope; setActionOwner(scope);
    try {
      const options = { isCurrent: () => contextCurrent() && !pending.current && !closing };
      await (action === "share" ? shareCalendarEntry(snapshot, options) : action === "copy" ? copyCalendarEntry(snapshot, options) : exportCalendarEntry(snapshot, options));
      if (options.isCurrent() && action === "copy") showSaveToast({ message: "Informações copiadas.", variant: "success" });
    } catch (error) {
      if (contextCurrent()) showSaveToast({ error, message: "Não foi possível concluir a ação. Tente novamente.", variant: "error" });
    } finally { if (actionPending.current === scope) actionPending.current = null; if (contextCurrent()) setActionOwner(current => current === scope ? null : current); }
  };
  const duplicate = async () => {
    if (!event || !onDuplicate || !canManage || !canAct() || attachments.loading || attachments.picking) return;
    actionPending.current = scope; setActionOwner(scope);
    try {
      if (attachments.attachments.length || attachments.files.length || attachments.error) {
        const accepted = await confirm({ title: "Duplicar sem os anexos?", message: "A cópia inclui os dados e as turmas. Os arquivos permanecem no evento original.", confirmLabel: "Continuar", cancelLabel: "Cancelar", onConfirm: () => undefined });
        if (!accepted || !contextCurrent() || pending.current || closing) return;
      }
      if (contextCurrent()) finishClose(() => onDuplicate(duplicateEventDraft(date, event)));
    } catch (error) {
      if (contextCurrent()) showSaveToast({ error, message: "Não foi possível preparar a cópia. Tente novamente.", variant: "error" });
    } finally { if (actionPending.current === scope) actionPending.current = null; if (contextCurrent()) setActionOwner(current => current === scope ? null : current); }
  };
  const mutate = async (remove = false) => {
    if (pending.current || actionPending.current === scope || closing || attachments.picking || !isFocused || !canManage || !activeOrganization?.id || !session?.user?.id || (event && event.organizationId !== activeOrganization.id)) return;
    const identity = getSessionIdentity();
    const serialized = JSON.stringify([live.current.draft, live.current.attachmentSignature]);
    const currentDraft = quick ? quickEventDraft(live.current.draft) : live.current.draft;
    const isCurrent = () => mounted.current && isSessionIdentityCurrent(identity) && live.current.scope === scope && JSON.stringify([live.current.draft, live.current.attachmentSignature]) === serialized;
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
        if (attachments.hasChanges) {
          await ensureEventAttachmentsAvailable({ organizationId: activeOrganization.id });
          if (!isCurrent()) return;
        }
        const selectedClasses = classes.filter(item => currentDraft.classIds.includes(item.id));
        const unitId = selectedClasses[0]?.unitId ?? currentDraft.unitId ?? event?.unitId ?? null;
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
        if (!isCurrent()) return;
        await attachments.commit(saved.id, isCurrent);
      }
      if (isCurrent()) { onSaved(); finishClose(); showSaveToast({ message: remove ? "Evento excluído." : "Evento salvo.", variant: "success" }); }
    } catch (error) {
      if (isCurrent()) showSaveToast({ error, message: "Não foi possível salvar o evento.", variant: "error" });
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const field = (label: string, key: "title" | "locationLabel", icon?: GoAtletaIconName) => <View style={[styles.setting, styles.textSetting, { borderColor: colors.border }]}>
    {icon ? <GoAtletaIcon name={icon} size={compactUiMetrics.iconSize} color={colors.muted} /> : null}
    <View style={[styles.inputBox, { backgroundColor: colors.inputBg }]}><TextInput accessibilityLabel={label} placeholder={label === "Título" ? "Título do evento" : label} placeholderTextColor={colors.placeholder} value={draft[key]} editable={!busy} autoFocus={editTarget === key} onChangeText={value => change(key, value)} style={[styles.input, key === "title" ? styles.eventTitleInput : null, { color: colors.inputText }]} /></View>
  </View>;
  const attachmentField = <CalendarEventAttachments attachments={attachments.attachments} files={attachments.files} removedIds={attachments.removedIds}
    canManage={canManage && editing} disabled={busy} loading={attachments.loading} picking={attachments.picking} error={attachments.error}
    progress={attachments.progress ? `Salvando anexos: ${attachments.progress.completed} de ${attachments.progress.total}` : null}
    onPick={() => { void attachments.pick(); }} onOpen={file => { void attachments.open(file); }}
    onRemovePending={attachments.removePending} onRemoveExisting={attachments.removeExisting} onRetry={attachments.retryLoad} />;
  if (quick && !canManage) return null;
  if (quick) {
    const parsed = quickEventDraft(draft);
    const valid = Boolean(parsed.title && eventDraftInterval(parsed));
    return <><Animated.View testID="calendar-quick-editor" style={[styles.quickCard, { backgroundColor: colors.secondaryBg, borderColor: colors.border, height: quickProgress.interpolate({ inputRange: [0, 1], outputRange: [50, 118] }), paddingVertical: quickProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }]}>
      <View style={styles.header}>
        <TextInput autoFocus accessibilityLabel="Título do evento rápido" placeholder={`Adicionar em ${new Date(date + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}`} placeholderTextColor={colors.placeholder} value={draft.title} editable={!busy} onChangeText={value => change("title", value)} onSubmitEditing={() => { if (valid) void mutate(); }} returnKeyType="done" style={[styles.quickInput, { color: colors.inputText }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Salvar evento rápido" disabled={!valid || busy} onPress={() => void mutate()} style={[styles.quickCircle, { backgroundColor: valid ? colors.primaryBg : colors.secondaryBg, opacity: saving ? 0.55 : 1 }]}><GoAtletaIcon name="checkmark" size={compactUiMetrics.iconSize} color={valid ? colors.primaryText : colors.muted} /></Pressable>
      </View>
      <Animated.View style={[styles.quickTools, { opacity: quickProgress }]}>
        <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeChips}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Alterar horário: ${parsed.startTime}`} disabled={busy} onPress={() => { Keyboard.dismiss(); setTimePicker(parsed.startTime); setTimePickerOpen(true); }} style={[styles.quickTimeBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[styles.settingText, { color: colors.text, fontWeight: "600" }]}>{parsed.startTime}</Text><GoAtletaIcon name="chevronDown" size={12} color={colors.muted} />
          </Pressable>
          {[...new Set(suggestedTimes)].filter(value => value !== parsed.startTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)).slice(0, 2).map(time => <Pressable key={time} accessibilityRole="button" accessibilityLabel={`Horário ${time}`} disabled={busy} onPress={() => setDraft(current => ({ ...current, title: quickEventDraft(current).title, startTime: time }))} style={[styles.timeChip, { backgroundColor: colors.secondaryBg }]}><Text style={[styles.settingText, { color: colors.text, fontWeight: "600" }]}>{time}</Text></Pressable>)}
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Abrir detalhes do evento" disabled={busy} onPress={() => { if (savedId.current) onExpand?.(parsed, savedId.current); else onExpand?.(parsed); }} style={styles.quickCircle}><GoAtletaIcon name="add" size={18} color={colors.text} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar criação rápida" disabled={busy} onPress={() => void close()} style={styles.quickCircle}><GoAtletaIcon name="close" size={18} color={colors.muted} /></Pressable>
      </Animated.View>
    </Animated.View>{timePicker !== null ? <CalendarTimePicker visible={timePickerOpen} value={timePicker} onClose={() => setTimePickerOpen(false)} onConfirm={time => { change("title", quickEventDraft(draft).title); change("startTime", time); setTimePickerOpen(false); }} /> : null}</>;
  }
  const dateLabel = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("pt-BR", value.slice(0, 4) !== date.slice(0, 4) ? { day: "2-digit", month: "2-digit", year: "numeric" } : { weekday: "short", day: "numeric", month: "short" });
  const valid = Boolean(draft.title.trim() && eventDraftInterval(draft));
  const linkedClasses = event ? classes.filter(item => event.classIds.includes(item.id)).map(item => item.name) : [];
  const unresolvedClasses = (event?.classIds.length ?? 0) - linkedClasses.length;
  const classNames = [...linkedClasses, ...(unresolvedClasses ? [`${unresolvedClasses} ${unresolvedClasses === 1 ? "turma vinculada" : "turmas vinculadas"}`] : [])].join(", ");
  const availableHeight = height - insets.top - insets.bottom;
  const detailHeight = Math.max(160, width < 600 ? availableHeight - 32 : Math.min(availableHeight - 64, 760));
  return <ModalSheet visible={!closing} transition="calendar" onClose={() => void close()} onExited={completeClose} reduceMotion={reducedMotion}
    position={editing && width < 600 ? "bottom" : "center"} containerPadding={!editing && width < 600 ? 12 : 16} backdropOpacity={!editing && width < 600 ? 1 : 0.5}
    cardStyle={editing ? [styles.card, { width: width < 600 ? Math.max(0, width - 24) : "100%", maxWidth: 440, height: Math.min(Math.max(160, height - 64), 704), maxHeight: Math.max(160, height - 64), backgroundColor: colors.card }]
      : [calendarEntryDetailsShellStyle, { width: width < 600 ? Math.max(0, width - 24) : "100%", maxWidth: 400, maxHeight: detailHeight }]}>
    {!editing && event ? <CalendarEntryDetails title={event.title} accentColor={colors.warningText} startDate={draft.startDate} endDate={draft.endDate} startTime={draft.startTime} endTime={draft.endTime} allDay={draft.allDay}
      disabled={busy || acting} onClose={() => void close()}
      onTitlePress={canManage ? () => beginEdit("title") : undefined}
      onStartDatePress={canManage ? () => beginEdit("startDate") : undefined} onEndDatePress={canManage ? () => beginEdit("endDate") : undefined}
      onStartTimePress={canManage ? () => beginEdit("startTime") : undefined} onEndTimePress={canManage ? () => beginEdit("endTime") : undefined}
      rows={[
        ...(event.locationLabel ? [{ key: "location", icon: "location" as const, value: event.locationLabel, onPress: canManage ? () => beginEdit("locationLabel") : undefined }] : []),
        ...(event.description ? [{ key: "notes", icon: "notes" as const, label: "Anotações", value: event.description, onPress: canManage ? () => beginEdit("description") : undefined }] : []),
        { key: "category", icon: "options", label: "Categoria", value: categories[event.eventType], onPress: canManage ? () => beginEdit("eventType") : undefined },
        { key: "sport", icon: "training", label: "Esporte", value: sports[event.sport], onPress: canManage ? () => beginEdit("sport") : undefined },
        ...(classNames ? [{ key: "classes", icon: "classes" as const, label: "Turmas vinculadas", value: classNames, onPress: canManage ? () => beginEdit("classIds") : undefined }] : []),
      ]} extra={attachmentField} actions={[
        ...(canManage && onDuplicate ? [{ key: "duplicate", label: "Duplicar", accessibilityLabel: "Duplicar evento", icon: "copy" as const, disabled: busy || acting || attachments.loading || attachments.picking, onPress: () => void duplicate() }] : []),
        ...(canManage ? [{ key: "edit", label: "Editar", accessibilityLabel: "Editar evento", icon: "edit" as const, disabled: busy || acting, onPress: () => beginEdit() }] : []),
        { key: "share", label: "Compartilhar", accessibilityLabel: "Compartilhar evento", icon: "share", disabled: busy || acting, onPress: () => void runEntryAction("share") },
        ...(canManage ? [{ key: "delete", label: "Excluir", accessibilityLabel: "Excluir evento", icon: "trash" as const, disabled: busy || acting, destructive: true, onPress: () => void mutate(true) }] : []),
        { key: "more", label: "Mais", accessibilityLabel: "Mais opções do evento", icon: "ellipsisHorizontal", disabled: busy || acting,
          menuItems: [
            { key: "copy", label: "Copiar informações", icon: "copy", onPress: () => void runEntryAction("copy") },
            { key: "export", label: "Exportar .ics", icon: "download", onPress: () => void runEntryAction("export") },
          ] },
      ]} /> : <>
    <View style={styles.header}><GoAtletaIcon name="events" size={18} color={colors.muted} /><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{event ? "Editar evento" : "Novo evento"}</Text>{event && canManage ? <Pressable accessibilityRole="button" accessibilityLabel="Excluir evento" disabled={busy} onPress={() => void mutate(true)} style={styles.close}><GoAtletaIcon name="trash" size={compactUiMetrics.iconSize} color={colors.dangerText} /></Pressable> : null}</View>
    <ScrollView nativeID="calendar-event-editor-scroll" keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={styles.body}>
        {field("Título", "title")}
        <View style={styles.allDay}><GoAtletaIcon name="time" size={compactUiMetrics.iconSize} color={colors.muted} /><Text style={[styles.settingText, { color: colors.text, flex: 1 }]}>Dia todo</Text><AllDaySwitch value={draft.allDay} disabled={busy} reducedMotion={reducedMotion} onChange={value => { change("allDay", value); setInlineTimeOpen(false); setDatePickerOpen(false); }} /></View>
        <View style={[styles.interval, { borderColor: colors.border }]}>{(["startDate", "endDate"] as const).map((key, index) => {
          const timeKey = index ? "endTime" : "startTime";
          const active = inlineTimeOpen && inlineTimeTarget === timeKey;
          const activeDate = datePickerOpen && datePicker === key;
          return <View key={key} style={styles.dateSide}>
            <Pressable accessibilityRole="button" accessibilityLabel={index ? "Data de término" : "Data de início"} accessibilityHint={draft[key]} accessibilityState={{ expanded: activeDate }} disabled={busy} suppressWebHoverFeedback disableWebPressScale onPress={() => { Keyboard.dismiss(); setInlineTimeOpen(false); setPickerKind("date"); setDatePicker(key); if (!activeDate) setDatePickerOpening(current => current + 1); setDatePickerOpen(!activeDate); }} style={styles.dateAction}>{state => <View style={[styles.intervalPill, { backgroundColor: highlighted(state, activeDate) ? colors.inputBg : "transparent" }]}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[styles.intervalText, { color: colors.text, fontWeight: activeDate ? "600" : "400" }]}>{dateLabel(draft[key])}</Text></View>}</Pressable>
            <CalendarPickerDisclosure open={!draft.allDay} testID={`calendar-${timeKey}-row`} initialHeight={44} contentPaddingVertical={0}><Pressable accessibilityRole="button" accessibilityLabel={index ? "Hora de término" : "Hora de início"} accessibilityState={{ expanded: active }} disabled={busy || draft.allDay} suppressWebHoverFeedback disableWebPressScale onPress={() => { Keyboard.dismiss(); setDatePickerOpen(false); setPickerKind("time"); setInlineTimeTarget(timeKey); setInlineTimeOpen(!active); }} style={styles.timeAction}>{state => <View style={[styles.intervalPill, { backgroundColor: highlighted(state, active) ? colors.inputBg : "transparent" }]}><Text style={[styles.intervalText, { color: colors.text, fontWeight: active ? "600" : "400", fontVariant: ["tabular-nums"] }]}>{draft[timeKey]}</Text></View>}</Pressable></CalendarPickerDisclosure>
          </View>;
        })}<View pointerEvents="none" style={styles.intervalArrow}><GoAtletaIcon name="arrowForward" size={compactUiMetrics.iconSize} color={colors.muted} /></View></View>
        <CalendarPickerDisclosure open={!busy && (datePickerOpen || (inlineTimeOpen && !draft.allDay))} testID={pickerKind === "date" ? "calendar-inline-date-picker" : "calendar-inline-time-picker"}>
          {pickerKind === "date" ? datePicker ? <DatePickerModal key={`${datePicker}:${datePickerOpening}`} inline visible value={draft[datePicker]} onChange={value => { if (datePickerOpen && !busy) setDraft(current => datePicker === "startDate" ? moveEventDraftStart(current, current.startTime, value) : { ...current, endDate: value }); }} onClose={() => setDatePickerOpen(false)} closeOnSelect initialViewMode="day" /> : null : <CalendarTimeWheels key={inlineTimeTarget} value={draft[inlineTimeTarget]} disabled={busy || !inlineTimeOpen || draft.allDay} onChange={time => { if (!pending.current && inlineTimeOpen && !draft.allDay) setDraft(current => inlineTimeTarget === "startTime" ? moveEventDraftStart(current, time) : { ...current, endTime: time }); }} />}
        </CalendarPickerDisclosure>
        {!eventDraftInterval(draft) ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>Confira as datas e os horários de início e término.</Text> : null}
        {field("Local", "locationLabel", "location")}
        <Choice label="Categoria" value={draft.eventType} options={categories} icon="options" disabled={busy} autoOpen={editTarget === "eventType"} onChange={value => change("eventType", value)} />
        <Choice label="Esporte" value={draft.sport} options={sports} icon="training" disabled={busy} autoOpen={editTarget === "sport"} onChange={value => change("sport", value)} />
        <CalendarNotesField value={draft.description} disabled={busy} autoFocus={editTarget === "description"} onChange={value => change("description", value)} />
        {attachmentField}
        <View style={[styles.setting, { borderColor: colors.border }]}><Pressable accessibilityRole="button" accessibilityLabel="Turmas vinculadas" accessibilityState={{ expanded: more }} disabled={busy} suppressWebHoverFeedback disableWebPressScale onPress={() => setMore(value => !value)} style={styles.settingTrigger}>{state => <><GoAtletaIcon name="classes" size={compactUiMetrics.iconSize} color={colors.muted} /><Text style={[styles.settingText, { color: colors.text, flex: 1 }]}>Turmas vinculadas</Text><Text style={[styles.settingText, { color: highlighted(state, more) ? colors.text : colors.muted }]}>{draft.classIds.length || "Nenhuma"}</Text><GoAtletaIcon name={more ? "chevronUp" : "chevronDown"} size={compactUiMetrics.secondaryIconSize} color={highlighted(state, more) ? colors.text : colors.muted} /></>}</Pressable></View>
        {more ? <>
          <View style={styles.chips}>{classes.map(item => { const selected = draft.classIds.includes(item.id); return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={item.name} disabled={busy} onPress={() => change("classIds", selected ? draft.classIds.filter(id => id !== item.id) : [...draft.classIds, item.id])} style={[styles.chip, { borderColor: colors.border, backgroundColor: selected ? colors.primaryBg : colors.secondaryBg }]}><Text style={[styles.settingText, { color: selected ? colors.primaryText : colors.text }]}>{item.name}</Text></Pressable>; })}{!classes.length ? <Text style={[styles.settingText, { color: colors.muted }]}>Nenhuma turma disponível.</Text> : null}</View>
        </> : null}
    </ScrollView>
    {canManage ? <View style={[styles.footer, { backgroundColor: colors.inputBg }]}><Pressable accessibilityRole="button" accessibilityLabel="Fechar evento" disabled={busy} suppressWebHoverFeedback disableWebPressScale onPress={() => void close()} style={state => [styles.footerAction, { backgroundColor: highlighted(state) ? colors.card : "transparent" }]}><Text style={[styles.footerText, { color: colors.text }]}>Cancelar</Text></Pressable><View style={[styles.footerDivider, { backgroundColor: colors.border }]} /><Pressable accessibilityRole="button" accessibilityLabel="Salvar evento" accessibilityState={{ busy: saving }} disabled={busy || attachments.picking || !valid} suppressWebHoverFeedback disableWebPressScale onPress={() => void mutate()} style={state => [styles.footerAction, { backgroundColor: highlighted(state) ? colors.card : "transparent", opacity: busy || !valid ? 0.55 : 1 }]}>{saving ? <ActivityIndicator size="small" color={colors.text} /> : null}<Text style={[styles.footerText, { color: colors.text }]}>Salvar</Text></Pressable></View> : null}
    </>}
  </ModalSheet>;
}
const styles = StyleSheet.create({
  choiceOption: { minHeight: compactUiMetrics.touchTarget, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: compactUiMetrics.gap },
  notesRow: { minHeight: compactUiMetrics.touchTarget, paddingHorizontal: 4, paddingVertical: 10, flexDirection: "row", alignItems: "flex-start", gap: compactUiMetrics.gap }, notesIcon: { height: 24, justifyContent: "center" }, notesInput: { flex: 1, minWidth: 0, minHeight: 24, borderRadius: 0, padding: 0, fontSize: compactUiMetrics.bodyFontSize, lineHeight: 24, backgroundColor: "transparent" },
  switchTarget: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22 }, switchTrack: { width: 38, height: 22, borderRadius: 11, padding: 2, justifyContent: "center" }, switchThumb: { width: 18, height: 18, borderRadius: 9 },
  quickTimeBox: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  quickCard: { width: "100%", maxWidth: 360, alignSelf: "center", borderRadius: 24, borderWidth: 1, padding: 12, gap: 4, overflow: "hidden" }, quickInput: { flex: 1, minWidth: 0, minHeight: 44, fontSize: compactUiMetrics.bodyFontSize, borderRadius: 0 }, quickCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }, quickTools: { flexDirection: "row", alignItems: "center", gap: 2 }, timeChips: { gap: 8, alignItems: "center" }, timeChip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20 },
  card: { padding: 16, gap: compactUiMetrics.gap, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: compactUiMetrics.gap }, title: { fontSize: compactUiMetrics.titleFontSize, fontWeight: "600", flex: 1 }, close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }, body: { paddingBottom: 8 },
  setting: { borderBottomWidth: StyleSheet.hairlineWidth }, settingTrigger: { minHeight: compactUiMetrics.touchTarget, paddingHorizontal: 4, paddingVertical: 6, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: compactUiMetrics.gap }, settingText: { fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight }, textSetting: { flexDirection: "row", alignItems: "center", gap: compactUiMetrics.gap, paddingVertical: 6, paddingLeft: 4 }, inputBox: { flex: 1, minHeight: 50, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" }, input: { flex: 1, minWidth: 0, borderRadius: 0, paddingVertical: 10, fontSize: 14 }, eventTitleInput: { fontSize: compactUiMetrics.titleFontSize, paddingVertical: 12 },
  allDay: { flexDirection: "row", alignItems: "center", gap: compactUiMetrics.gap, paddingHorizontal: 4, minHeight: compactUiMetrics.touchTarget }, interval: { flexDirection: "row", gap: 16, paddingBottom: compactUiMetrics.gap, borderBottomWidth: StyleSheet.hairlineWidth }, dateSide: { flex: 1, minWidth: 0, alignItems: "center" }, dateAction: { maxWidth: "100%", minHeight: 44, alignItems: "center", justifyContent: "center" }, timeAction: { minHeight: 44, alignItems: "center", justifyContent: "center" }, intervalPill: { maxWidth: "100%", height: 32, borderRadius: 16, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }, intervalText: { fontSize: 14, textAlign: "center" }, intervalArrow: { position: "absolute", top: "50%", left: "50%", marginLeft: -10, marginTop: -10 },
  footer: { width: "100%", maxWidth: 200, alignSelf: "center", borderRadius: 25, minHeight: 50, flexDirection: "row", alignItems: "center", overflow: "hidden" }, footerAction: { flex: 1, minHeight: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }, footerText: { fontWeight: "600", fontSize: 14 }, footerDivider: { width: StyleSheet.hairlineWidth, height: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 12 }, chip: { minHeight: compactUiMetrics.touchTarget, justifyContent: "center", paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 10 },
});
