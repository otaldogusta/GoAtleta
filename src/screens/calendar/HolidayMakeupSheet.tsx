import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { listCalendarPauses } from "../../api/holiday-decisions";
import { listHolidayMakeups, scheduleHolidayMakeup, type HolidayMakeup } from "../../api/holiday-makeups";
import { brazilDateKey, isPaused, type CalendarPause } from "../../core/holidays";
import type { ClassGroup } from "../../core/models";
import { compactUiMetrics as metrics, radius, spacing } from "../../theme/tokens";
import { Button } from "../../ui/Button";
import { CompactSelect } from "../../ui/CompactSelect";
import { DateInput, formatShortDate } from "../../ui/DateInput";
import { ModalSheet } from "../../ui/ModalSheet";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { TimeInput } from "../../ui/TimeInput";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { isHolidayLesson, suggestOriginalDate } from "./application/holiday-makeup";

type Props = {
  organizationId: string;
  classes: ClassGroup[];
  initialClassId?: string;
  originalDate?: string;
  date?: string;
  onClose: () => void;
  onSaved: (saved: HolidayMakeup) => void;
  onOpenAttendance?: (saved: HolidayMakeup) => void;
};

export function HolidayMakeupSheet({ organizationId, classes, initialClassId, originalDate, date, onClose, onSaved, onOpenAttendance }: Props) {
  const { colors } = useAppTheme();
  const [classId, setClassId] = useState(initialClassId ?? (classes.length === 1 ? classes[0].id : ""));
  const group = classes.find(row => row.id === classId);
  const [sourceInput, setSourceInput] = useState<string | null>(originalDate ?? null);
  const [destination, setDestination] = useState(date ?? "");
  const [time, setTime] = useState(group?.startTime.slice(0, 5) ?? "");
  const [calendar, setCalendar] = useState<{ pauses: CalendarPause[]; makeups: HolidayMakeup[] } | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([listCalendarPauses(organizationId), listHolidayMakeups(organizationId)])
      .then(([pauses, makeups]) => { if (alive) setCalendar({ pauses, makeups }); })
      .catch(() => { if (alive) setError("Não foi possível consultar as reposições."); });
    return () => { alive = false; };
  }, [organizationId, revision]);

  const covered = new Set(calendar?.makeups.filter(row => row.classId === classId).map(row => row.originalDate));
  const linkedDestination = calendar?.makeups.find(row => row.classId === classId && row.date === destination);
  const source = sourceInput ?? linkedDestination?.originalDate ?? (calendar ? suggestOriginalDate(group, destination, calendar.pauses, covered) : "");
  const existing = calendar?.makeups.find(row => row.classId === classId && row.originalDate === source);
  const pause = calendar?.pauses.find(row => row.class_id === classId && row.date === source);
  const validSource = Boolean(group && isHolidayLesson(group, source, pause));
  const destinationBusy = Boolean(group && destination && (
    group.daysOfWeek.includes(new Date(destination + "T00:00:00Z").getUTCDay())
    || isPaused(calendar?.pauses ?? [], classId, destination)
    || calendar?.makeups.some(row => row.classId === classId && row.date === destination)
  ));
  const ready = Boolean(calendar && validSource && destination > source && !destinationBusy && /^([01]\d|2[0-3]):[0-5]\d$/.test(time));
  const save = async () => {
    if (!ready || pending.current || existing) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await scheduleHolidayMakeup(organizationId, classId, source, destination, time);
      if (mounted.current) onSaved({ classId, originalDate: source, date: destination, startTime: time });
    } catch {
      if (mounted.current) {
        setError("Não foi possível agendar. Confira se a aula original já foi realizada ou se a data de reposição está ocupada.");
        setRevision(value => value + 1);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const label = [styles.label, { color: colors.text }];
  return <ModalSheet visible onClose={() => { if (!pending.current) onClose(); }} position="center"
    cardStyle={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{existing ? "Reposição agendada" : "Agendar reposição"}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar reposição" disabled={saving} onPress={onClose} style={styles.close}><GoAtletaIcon name="close" size={20} color={colors.muted} /></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={styles.content}>
      {initialClassId || classes.length === 1 ? <Text style={label}>{group?.name}</Text> :
        <CompactSelect label="Turma" value={classId} options={[{ value: "", label: "Selecionar turma" }, ...classes.map(row => ({ value: row.id, label: row.name }))]}
          onChange={id => { if (saving) return; setClassId(id); setSourceInput(originalDate ?? null); setTime(classes.find(row => row.id === id)?.startTime.slice(0, 5) ?? ""); setError(""); }} />}
      {existing ? <>
        <Text style={{ color: colors.muted }}>Aula de {formatShortDate(existing.originalDate)} · Feriado</Text>
        <Text style={label}>Reposição em {formatShortDate(existing.date)} às {existing.startTime}</Text>
        {onOpenAttendance && existing.date <= brazilDateKey() ? <Button label="Abrir chamada" onPress={() => onOpenAttendance(existing)} /> : null}
      </> : <>
        <Text style={label}>Aula original</Text>
        {originalDate ? <Text style={{ color: colors.text }}>{formatShortDate(source)} · Feriado</Text> :
          <DateInput value={source} onChange={value => { if (!saving) { setSourceInput(value); setError(""); } }} accessibilityLabel="Data da aula original" />}
        {source && group && calendar && !validSource ? <Text style={{ color: colors.dangerText }}>Escolha uma aula da turma em um feriado.</Text> : null}
        <Text style={label}>Data da reposição</Text>
        <DateInput value={destination} onChange={value => { if (!saving) { setDestination(value); setError(""); } }} accessibilityLabel="Data da reposição" />
        {destination && source && destination <= source ? <Text style={{ color: colors.dangerText }}>A reposição precisa ser posterior à aula original.</Text> :
          destinationBusy ? <Text style={{ color: colors.dangerText }}>Essa data já tem aula, reposição ou pausa para a turma.</Text> : null}
        <Text style={label}>Horário</Text>
        <TimeInput format="clock" value={time} editable={!saving} onChangeText={value => { setTime(value); setError(""); }} accessibilityLabel="Horário da reposição" placeholder="HH:MM" />
        {validSource && calendar ? <Text style={{ color: colors.muted }}>Ao confirmar, a aula de {formatShortDate(source)} ficará sem chamada por feriado.</Text> : null}
      </>}
      {error && !existing ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
    </ScrollView>
    {!calendar && error ? <Button label="Tentar novamente" onPress={() => { setError(""); setRevision(value => value + 1); }} /> :
      !existing ? <Button label="Confirmar reposição" disabled={!ready || saving} loading={saving} onPress={() => void save()} /> : null}
  </ModalSheet>;
}
const styles = StyleSheet.create({
  panel: { width: "100%", maxWidth: 440, maxHeight: "90%", borderRadius: radius.container, borderWidth: 1, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: metrics.titleFontSize, fontWeight: "700" },
  close: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  content: { gap: spacing.sm, paddingBottom: spacing.sm },
  label: { fontSize: metrics.bodyFontSize, fontWeight: "600" },
});
