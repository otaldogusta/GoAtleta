import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowDimensions } from "react-native";
import { useIsFocused } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../auth/auth";
import { getSessionIdentity, isSessionIdentityCurrent, SessionIdentityChangedError } from "../../auth/session";
import type { ClassGroup } from "../../core/models";
import { resolveClassDevelopmentLevelLabel } from "../../core/class-development-level";
import { getClassModalityLabel } from "../../core/class-modality";
import { getReadCacheGeneration } from "../../db/client";
import { getClassCalendarExceptions, saveClassCalendarException } from "../../db/periodization";
import { useOrganization } from "../../providers/organization-context";
import { ModalSheet } from "../../ui/ModalSheet";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { useSaveToast } from "../../ui/save-toast";
import { CalendarEntryDetails, calendarEntryDetailsShellStyle, type CalendarEntryDetailsProps } from "./CalendarEntryDetails";
import { useCalendarReducedMotion } from "./CalendarTimePicker";
import { useCalendarEditorScrollbars } from "./useCalendarEditorScrollbars";
import { eventDraftInterval, type EventDraft } from "./application/event-draft";
import { copyCalendarEntry, exportCalendarEntry, shareCalendarEntry, type CalendarEntryShareSnapshot } from "./application/share-calendar-entry";

export type CalendarClassOpenOptions = { settings?: "1"; settingsSection?: "basics" | "agenda" | "profile" };
type Props = { classGroup: ClassGroup; date: string; timeLabel: string; unitLabel: string; accentColor?: string; onClose: () => void; onOpenClass: (options?: CalendarClassOpenOptions) => void; onDuplicate?: (draft: EventDraft) => void; onChanged?: () => void };
type CloseIntent = { scope: string } & ({ kind: "close" } | { kind: "class"; options?: CalendarClassOpenOptions } | { kind: "duplicate"; draft: EventDraft });

/** A lesson keeps its class identity; only an explicit duplicate becomes a new event draft. */
export function CalendarClassDetails({ classGroup, date, timeLabel, unitLabel, accentColor, onClose, onOpenClass, onDuplicate, onChanged }: Props) {
  useCalendarEditorScrollbars(true);
  const { width, height } = useWindowDimensions(), insets = useSafeAreaInsets();
  const reducedMotion = useCalendarReducedMotion(), focused = useIsFocused();
  const { session } = useAuth(), { activeOrganization } = useOrganization();
  const { confirm } = useConfirmDialog(), { showSaveToast } = useSaveToast();
  const identity = getSessionIdentity(), generation = getReadCacheGeneration();
  const canManage = focused && Boolean(session?.user?.id) && activeOrganization?.id === classGroup.organizationId && (activeOrganization?.role_level ?? 0) >= 50;
  const scope = JSON.stringify([identity.userId, identity.generation, generation, activeOrganization?.id, activeOrganization?.role_level, focused, classGroup.id, classGroup.organizationId, date, timeLabel]);
  const liveScope = useRef(scope), mounted = useRef(true), pending = useRef<{ scope: string; key: string } | null>(null);
  const intent = useRef<CloseIntent | null>(null), completed = useRef(false);
  useLayoutEffect(() => {
    liveScope.current = scope;
    if (pending.current?.scope !== scope) pending.current = null;
    if (intent.current?.scope !== scope) { intent.current = null; completed.current = false; }
  }, [scope]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [closing, setClosing] = useState(false), [busy, setBusy] = useState<string | null>(null);
  const [activityScope, setActivityScope] = useState(scope);
  if (activityScope !== scope) { setActivityScope(scope); setClosing(false); setBusy(null); }
  const current = () => mounted.current && liveScope.current === scope && focused && activeOrganization?.id === classGroup.organizationId && Boolean(identity.userId) && isSessionIdentityCurrent(identity) && getReadCacheGeneration() === generation;
  const assertCurrent = () => { if (!current()) throw new SessionIdentityChangedError(); };
  const requestClose = (next: CloseIntent) => {
    if (intent.current || !current()) return;
    intent.current = next; setClosing(true);
  };
  const completeClose = () => {
    const next = intent.current;
    if (!next || completed.current || next.scope !== liveScope.current || !current()) return;
    completed.current = true;
    if (next.kind === "class") onOpenClass(next.options);
    else if (next.kind === "duplicate") onDuplicate?.(next.draft);
    else onClose();
  };
  const run = async (key: string, action: () => Promise<void>) => {
    if (pending.current || intent.current || !current()) return;
    const job = { scope, key }; pending.current = job; setBusy(key);
    try { await action(); }
    catch (error) { if (current()) showSaveToast({ error, message: "Não foi possível concluir a ação.", variant: "error" }); }
    finally { if (pending.current === job) { pending.current = null; if (mounted.current && liveScope.current === scope) setBusy(null); } }
  };
  const range = timeLabel.match(/^\s*((?:[01]\d|2[0-3]):[0-5]\d)\s*[-–]\s*((?:[01]\d|2[0-3]):[0-5]\d)\s*$/);
  const startTime = range?.[1], endTime = range?.[2];
  let endDate = date;
  if (startTime && endTime && endTime <= startTime) {
    const next = new Date(`${date}T12:00:00`);
    if (!Number.isNaN(next.getTime())) {
      next.setDate(next.getDate() + 1);
      endDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
    }
  }
  const location = [unitLabel.trim(), classGroup.trainingSpace?.trim()].filter(Boolean).join(" · ");
  const snapshot: CalendarEntryShareSnapshot = { title: classGroup.name, location, startDate: date, endDate, startTime, endTime, uid: `class-${classGroup.id}-${date}` };
  const duplicateDraft: EventDraft = { title: `${classGroup.name} (cópia)`, description: "", startDate: date, endDate, startTime: startTime ?? "", endTime: endTime ?? "", allDay: false, locationLabel: location, eventType: "treino", sport: classGroup.modality === "voleibol" ? "volei_quadra" : classGroup.modality === "voleibol_areia" ? "volei_praia" : classGroup.modality === "futebol" ? "futebol" : "geral", classIds: [classGroup.id] };
  const disabled = Boolean(busy) || closing;
  const edit = (settingsSection: CalendarClassOpenOptions["settingsSection"] = "basics") => {
    if (!canManage) return;
    void run("edit", async () => {
      const accepted = await confirm({ title: "Editar turma e seus horários", message: "As alterações valem para a turma e seus horários recorrentes, incluindo outras aulas.", confirmLabel: "Editar turma", cancelLabel: "Voltar", onConfirm: () => undefined });
      assertCurrent();
      if (accepted) requestClose({ kind: "class", scope, options: { settings: "1", settingsSection } });
    });
  };
  const cancelLesson = () => {
    if (!canManage) return;
    void run("cancel", async () => {
      const accepted = await confirm({ title: "Cancelar somente esta aula?", message: `${classGroup.name} · ${new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR")}. A turma, os planejamentos e as chamadas serão preservados.`, confirmLabel: "Cancelar aula", cancelLabel: "Manter aula", tone: "danger", onConfirm: () => undefined });
      assertCurrent(); if (!accepted) return;
      const organizationId = classGroup.organizationId;
      const existing = await getClassCalendarExceptions(classGroup.id, { organizationId, assertCurrent });
      assertCurrent();
      if (!existing.some(item => item.date === date && item.kind === "no_training")) {
        await saveClassCalendarException({ id: `agenda_${classGroup.id}_${date}`, organizationId, classId: classGroup.id, date, kind: "no_training", reason: "Aula cancelada pela agenda.", createdAt: new Date().toISOString() }, { organizationId, assertCurrent });
        assertCurrent();
      }
      onChanged?.(); showSaveToast({ message: "Aula cancelada.", variant: "success" });
      requestClose({ kind: "close", scope });
    });
  };
  const openClass = () => { if (!pending.current) requestClose({ kind: "class", scope }); };
  const sport = getClassModalityLabel(classGroup.modality);
  const rows: CalendarEntryDetailsProps["rows"] = [
    ...(unitLabel.trim() ? [{ key: "unit", icon: "organization" as const, label: "Unidade", value: unitLabel, onPress: canManage ? () => edit("basics") : undefined, disabled }] : []),
    ...(classGroup.trainingSpace?.trim() ? [{ key: "space", icon: "location" as const, label: "Local", value: classGroup.trainingSpace.trim(), onPress: canManage ? () => edit("basics") : undefined, disabled }] : []),
    ...(classGroup.ageBand?.trim() ? [{ key: "age", icon: "students" as const, label: "Faixa etária", value: classGroup.ageBand, onPress: canManage ? () => edit("profile") : undefined, disabled }] : []),
    ...(classGroup.level || classGroup.mvLevel?.trim() ? [{ key: "level", icon: "trend" as const, label: "Nível", value: resolveClassDevelopmentLevelLabel(classGroup), onPress: canManage ? () => edit("profile") : undefined, disabled }] : []),
    ...(sport ? [{ key: "sport", icon: "training" as const, label: "Esporte", value: sport, onPress: canManage ? () => edit("basics") : undefined, disabled }] : []),
    ...(!range && timeLabel.trim() ? [{ key: "time", icon: "time" as const, label: "Horário", value: timeLabel, onPress: canManage ? () => edit("agenda") : undefined, disabled }] : []),
  ];
  const actions: NonNullable<CalendarEntryDetailsProps["actions"]> = [
    ...(canManage && onDuplicate ? [{ key: "duplicate", label: "Duplicar", accessibilityLabel: "Duplicar como novo evento", icon: "copy" as const, disabled: disabled || !eventDraftInterval(duplicateDraft), onPress: () => { if (!pending.current && current()) requestClose({ kind: "duplicate", scope, draft: duplicateDraft }); } }] : []),
    ...(canManage ? [{ key: "edit", label: "Editar", accessibilityLabel: "Editar turma e horários recorrentes", icon: "edit" as const, disabled, onPress: () => edit() }] : []),
    { key: "share", label: "Compartilhar", icon: "share", disabled, onPress: () => void run("share", () => shareCalendarEntry(snapshot, { isCurrent: current })) },
    ...(canManage ? [{ key: "cancel", label: busy === "cancel" ? "Cancelando…" : "Excluir", accessibilityLabel: "Cancelar somente esta aula", icon: "trash" as const, disabled, destructive: true, onPress: () => cancelLesson() }] : []),
    { key: "more", label: "Mais", icon: "ellipsisVertical", disabled, onPress: () => undefined, menuItems: [
      { key: "class", label: "Ir para a turma", icon: "classes", onPress: () => openClass(), disabled },
      ...(canManage ? [{ key: "edit-class", label: "Editar turma e horários recorrentes", icon: "edit" as const, onPress: () => edit(), disabled }] : []),
      { key: "copy", label: "Copiar informações", icon: "copy", disabled, onPress: () => void run("copy", () => copyCalendarEntry(snapshot, { isCurrent: current })) },
      { key: "export", label: "Exportar aula (.ics)", icon: "download", disabled, onPress: () => void run("export", () => exportCalendarEntry(snapshot, { isCurrent: current })) },
    ] },
  ];
  const availableHeight = height - insets.top - insets.bottom;
  const detailHeight = Math.max(160, width < 600 ? availableHeight - 32 : Math.min(availableHeight - 64, 760));
  return <ModalSheet visible={!closing} transition="calendar" reduceMotion={reducedMotion} onClose={() => { if (!pending.current) requestClose({ kind: "close", scope }); }} onExited={completeClose}
    position="center" containerPadding={width < 600 ? 12 : 16} backdropOpacity={width < 600 ? 1 : 0.5}
    cardStyle={[calendarEntryDetailsShellStyle, { width: width < 600 ? Math.max(0, width - 24) : "100%", maxWidth: 400, maxHeight: detailHeight }]}>
    <CalendarEntryDetails title={classGroup.name} accentColor={accentColor} startDate={date} endDate={endDate} startTime={startTime} endTime={endTime} disabled={disabled}
      onTitlePress={canManage ? () => edit() : undefined} onAccentPress={canManage ? () => edit() : undefined}
      onStartDatePress={canManage ? () => edit("agenda") : undefined} onEndDatePress={canManage ? () => edit("agenda") : undefined}
      onStartTimePress={canManage ? () => edit("agenda") : undefined} onEndTimePress={canManage ? () => edit("agenda") : undefined}
      rows={rows} onClose={() => { if (!pending.current) requestClose({ kind: "close", scope }); }} actions={actions} />
  </ModalSheet>;
}
