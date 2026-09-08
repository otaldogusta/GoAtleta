import { useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { ClassGroup } from "../../core/models";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { ModalSheet } from "../../ui/ModalSheet";
import { useAppTheme } from "../../ui/app-theme";
import { radius, shadow, spacing } from "../../theme/tokens";

export function HolidayRecommendation({ holiday, date, classes, pausedIds = [], saving, error, onSave }: {
  holiday: string; date: string; classes: ClassGroup[]; pausedIds?: string[];
  saving: boolean; error: string; onSave: (ids: string[]) => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const compact = width < 480;
  const [dismissed, setDismissed] = useState(false);
  const [selection, setSelection] = useState<string[] | null>(null);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(new Date(date + "T12:00:00"));
  const suspendedCount = classes.filter(c => selection?.includes(c.id) || pausedIds.includes(c.id)).length;
  const closePanel = () => { if (!saving) setSelection(null); };
  if (dismissed) return null;
  return <>
    {selection === null ? <View style={[styles.floating, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <GoAtletaIcon name="assistant" size={24} color={colors.successText} />
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>Hoje é feriado</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>{dateLabel} · {holiday}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Dispensar aviso de feriado" onPress={() => setDismissed(true)} style={styles.close}>
          <GoAtletaIcon name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.footer}>
        <Text style={[styles.question, { color: colors.text }]}>Como ficam as aulas de hoje?</Text>
        <Button label="Revisar aulas" onPress={() => setSelection([...pausedIds])} />
      </View>
    </View> : null}
    <ModalSheet visible={selection !== null} onClose={closePanel} backdropOpacity={0.35} position="center" overlayZIndex={30000}
      cardStyle={[styles.dialog, { maxHeight: height - 48, backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <GoAtletaIcon name="assistant" size={28} color={colors.successText} />
        <View style={styles.copy}>
          <Text accessibilityRole="header" style={[styles.panelTitle, { color: colors.text }]}>Revisar aulas</Text>
          <Text style={[styles.caption, { color: colors.muted }]}>Hoje, {dateLabel} · {holiday}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar revisão de aulas" disabled={saving} onPress={closePanel} style={styles.close}>
          <GoAtletaIcon name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" disabled={saving} suppressWebHoverFeedback onPress={() => setSelection(classes.map(c => c.id))} style={styles.bulk}>
          <Text style={[styles.caption, { color: colors.muted }]}>Marcar todas sem aula</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {classes.map(c => {
          const locked = pausedIds.includes(c.id);
          const suspended = locked || Boolean(selection?.includes(c.id));
          return <View key={c.id} style={[styles.item, compact && styles.itemCompact, { borderColor: colors.border }]}>
            <View style={styles.copy}>
              <Text style={[styles.className, { color: colors.text }]}>{c.name}</Text>
              <Text style={[styles.caption, { color: colors.muted }]}>{c.startTime}{c.endTime ? ` – ${c.endTime}` : ""}</Text>
              {locked ? <Text style={[styles.caption, { color: colors.muted }]}>Pausa já cadastrada</Text> : null}
            </View>
            <View style={[styles.segmented, { borderColor: colors.border }]}>
              {[false, true].map(noClass => <Pressable key={String(noClass)} accessibilityRole="radio"
                accessibilityLabel={`${c.name}: ${noClass ? "Sem aula" : "Com aula"}`} accessibilityState={{ checked: suspended === noClass, disabled: saving || locked }}
                disabled={saving || locked} onPress={() => setSelection(ids => noClass ? [...new Set([...(ids ?? []), c.id])] : (ids ?? []).filter(id => id !== c.id))}
                style={[styles.segment, { backgroundColor: suspended === noClass ? (noClass ? colors.border : colors.successBg) : "transparent" }]}>
                <Text style={[styles.segmentLabel, { color: suspended === noClass && !noClass ? colors.successText : colors.text }]}>{noClass ? "Sem aula" : "Com aula"}</Text>
              </Pressable>)}
            </View>
          </View>;
        })}
      </ScrollView>
      <Text style={[styles.caption, { color: colors.muted }]}>As alterações só serão salvas ao confirmar.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
      <View style={[styles.footer, styles.panelFooter, { borderColor: colors.border }]}>
        <Text style={[styles.caption, { color: colors.muted }]}>{classes.length - suspendedCount} com aula · {suspendedCount} sem aula</Text>
        <Button label="Confirmar" loading={saving} loadingLabel="Salvando..." disabled={saving || !classes.length} onPress={() => void onSave(selection ?? [])} />
      </View>
    </ModalSheet>
  </>;
}
const styles = StyleSheet.create({
  floating: { position: "absolute", bottom: spacing.lg, right: spacing.md, left: spacing.md, maxWidth: 440, borderWidth: 1, borderRadius: radius.container, padding: spacing.md, gap: spacing.md, ...shadow.elevated },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  copy: { flex: 1, minWidth: 0, gap: 4 }, close: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "700" }, panelTitle: { fontSize: 20, fontWeight: "700" }, caption: { fontSize: 13, lineHeight: 19 },
  question: { fontSize: 14, fontWeight: "500", flexShrink: 1 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: spacing.sm },
  dialog: { width: "100%", maxWidth: 520, borderWidth: 1, borderRadius: radius.container, padding: spacing.lg, gap: spacing.sm },
  toolbar: { alignItems: "flex-end" }, bulk: { minHeight: 36, justifyContent: "center" },
  list: { flexShrink: 1 }, item: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1 },
  itemCompact: { flexDirection: "column", alignItems: "stretch" }, className: { fontSize: 15, fontWeight: "600" },
  segmented: { flexDirection: "row", borderWidth: 1, borderRadius: radius.internal, overflow: "hidden" },
  segment: { minHeight: 40, minWidth: 86, flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.sm },
  segmentLabel: { fontSize: 13, fontWeight: "500" }, panelFooter: { borderTopWidth: 1, paddingTop: spacing.md },
});
