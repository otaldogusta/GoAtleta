import type { PropsWithChildren } from "react";
import { ScrollView, View } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import type { ScoutingActionFundamental, ScoutingContact, Student } from "../../core/models";
import { captureFundamentals, captureResult, getCaptureResultOptions } from "../../core/scouting-rallies";
import { useAppTheme } from "../../ui/app-theme";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { radius, spacing } from "../../theme/tokens";
import { Copy, Link, skillLabel } from "./ScoutingUI";

/** Same collector composition inside the studio, without a second modal or focus trap. */
export function ScoutingCapturePanel({ title, summary, footer, children, active = true, compact = false }: PropsWithChildren<{
  title: string; summary?: React.ReactNode; footer?: React.ReactNode; active?: boolean; compact?: boolean;
}>) {
  const { colors } = useAppTheme();
  return <View role="region" accessibilityLabel="Coletor de scouting" aria-hidden={!active} pointerEvents={active ? "auto" : "none"}
    style={{ flexGrow: compact ? 0 : 1, flexShrink: 1, flexBasis: compact ? "auto" : 0, alignSelf: compact ? "flex-start" : "stretch", maxWidth: compact ? 480 : 1040, maxHeight: "100%", minHeight: 0, minWidth: 0, width: "100%", backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden", display: active ? "flex" : "none" }}>
    <View style={{ flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 10, alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <View style={{ flex: 1, minWidth: 0 }}><Copy title>{title}</Copy></View>
    </View>
    {summary ? <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: 10 }}>{summary}</View> : null}
    <ScrollView style={{ flexGrow: compact ? 0 : 1, flexShrink: 1, flexBasis: compact ? "auto" : 0, minHeight: 0 }} contentContainerStyle={{ paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: spacing.xs }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
    {footer ? <View style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 4, borderTopWidth: 1, borderTopColor: colors.border }}>{footer}</View> : null}
  </View>;
}

export const contactLabel = (skill: ScoutingActionFundamental) => skill === "recepcao" ? "Passe" : skill === "levantamento" ? "Levant." : skillLabel(skill);
const compactName = (name: string, names: string[]) => {
  const words = name.trim().split(/\s+/);
  for (let n = 1; n < words.length; n += 1) {
    const candidate = words.slice(0, n).join(" ");
    if (!names.some(other => other !== name && other.trim().split(/\s+/).slice(0, n).join(" ") === candidate)) return candidate;
  }
  return name;
};
const questions: Partial<Record<ScoutingActionFundamental, string>> = { recepcao: "Quem passou?", levantamento: "Quem levantou?", ataque: "Quem atacou ou devolveu?", saque: "Quem sacou?", defesa: "Quem defendeu?", bloqueio: "Quem bloqueou?", cobertura: "Quem cobriu?" };
export function CaptureText({ children, muted, strong }: PropsWithChildren<{ muted?: boolean; strong?: boolean }>) {
  const { colors } = useAppTheme();
  return <Text style={{ color: muted ? colors.muted : colors.text, fontSize: 12, lineHeight: 18, fontWeight: strong ? "600" : "400" }}>{children}</Text>;
}
function ResultDot({ level }: { level: number }) {
  const { colors } = useAppTheme();
  return <View style={{ width: 5, height: 5, borderRadius: 1, backgroundColor: [colors.danger, colors.warning, colors.info, colors.success][level] ?? colors.muted }} />;
}
export function ContactSequence({ contacts, editing, disabled, onEdit, onUndo }: { contacts: ScoutingContact[]; editing: number | null; disabled: boolean; onEdit: (contact: ScoutingContact, index: number) => void; onUndo: () => void }) {
  const { colors } = useAppTheme();
  return <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: contacts.length ? 14 : 4, gap: 5 }}>
    <View style={{ minHeight: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <CaptureText>Esta jogada <Text style={{ color: colors.muted }}>· {contacts.length} {contacts.length === 1 ? "contato" : "contatos"}</Text></CaptureText>
      {contacts.length ? <Link label="Desfazer contato" disabled={disabled} onPress={onUndo} /> : null}
    </View>
    {contacts.length ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{contacts.map((c, index) => <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8, maxWidth: "100%" }}>
      {index > 0 ? <GoAtletaIcon name="chevronRight" size={12} color={colors.muted} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`Editar contato ${index + 1}: ${c.athleteName || "Equipe"}, ${skillLabel(c.fundamental)}, ${captureResult(c)?.label ?? c.resultKey}`} accessibilityState={{ selected: editing === index, disabled }} disabled={disabled} onPress={() => onEdit(c, index)}
        style={{ minHeight: 44, flexShrink: 1, paddingVertical: 4, paddingHorizontal: 8, gap: 2, borderWidth: 1, borderColor: editing === index ? colors.primaryBg : colors.border, borderRadius: 8, backgroundColor: colors.backgroundSubtle, opacity: disabled ? .55 : 1 }}>
        <CaptureText>{c.athleteName ? compactName(c.athleteName, contacts.map(contact => contact.athleteName || "")) : "Equipe"}</CaptureText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><CaptureText muted>{c.resultKey === 'freeball_devolvida' ? 'Bola de graça' : contactLabel(c.fundamental)}</CaptureText><ResultDot level={captureResult(c)?.level ?? 0} /><CaptureText muted>{c.resultKey === 'freeball_devolvida' ? 'Devolvida' : captureResult(c)?.label ?? c.resultKey}{c.zone ? ` · Z${c.zone}` : ""}</CaptureText></View>
      </Pressable>
    </View>)}</View> : null}
  </View>;
}
export function ContactPad({ skill, students, jerseys, studentId, athleteChosen, editing, disabled, wide, captureVersion = 2, onSkill, onAthlete, onResult }: {
  jerseys?: ReadonlyMap<string, string>;
  skill: ScoutingActionFundamental; students: Student[]; studentId: string | null; athleteChosen: boolean; editing: number | null; disabled: boolean; wide: boolean; captureVersion?: number;
  onSkill: (skill: ScoutingActionFundamental) => void; onAthlete: (id: string | null) => void; onResult: (key: string) => void;
}) {
  const { colors } = useAppTheme();
  const playerName = (s: Student) => compactName(s.name, students.map(other => other.name));
  const options = getCaptureResultOptions(skill, captureVersion);
  const fundamentals = captureFundamentals.includes(skill) ? captureFundamentals : [...captureFundamentals, skill];
  return <View style={{ gap: 12 }}>
    <View accessibilityLabel="Fundamento do contato" style={{ flexDirection: "row", gap: 2 }}>{fundamentals.map(f => <Pressable key={f} accessibilityRole="button" accessibilityLabel={skillLabel(f)} accessibilityState={{ selected: f === skill, disabled }} disabled={disabled} onPress={() => onSkill(f)}
      style={{ flex: 1, minWidth: 0, minHeight: 40, borderWidth: 1, borderColor: f === skill ? colors.borderStrong : "transparent", backgroundColor: f === skill ? colors.surfaceElevated : "transparent", borderRadius: 8, alignItems: "center", justifyContent: "center", opacity: disabled ? .55 : 1 }}>
      <Text style={{ fontSize: 12, color: f === skill ? colors.text : colors.muted }}>{contactLabel(f)}</Text>
    </Pressable>)}</View>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <CaptureText strong>{editing != null ? `Editar contato ${editing + 1}` : questions[skill] ?? "Quem fez?"}</CaptureText>
      <Link label="Sem atleta" selected={athleteChosen && studentId == null} disabled={disabled} onPress={() => onAthlete(null)} />
    </View>
    <View style={{ flexDirection: wide ? "row" : "column", gap: wide ? 16 : 12, alignItems: "stretch" }}>
      <View style={{ flex: wide ? 1.6 : undefined, flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {students.map(s => <View key={s.id} style={{ width: "23.5%", flexGrow: 1, maxWidth: "25%" }}>
          <Pressable accessibilityRole="button" accessibilityLabel={jerseys?.get(s.id) ? `Camisa ${jerseys.get(s.id)}: ${s.name}` : s.name} accessibilityState={{ selected: athleteChosen && studentId === s.id, disabled }} disabled={disabled} onPress={() => onAthlete(s.id)}
            style={{ minHeight: 44, padding: 6, borderWidth: 1, borderRadius: 10, borderColor: athleteChosen && studentId === s.id ? colors.primaryBg : colors.border, backgroundColor: athleteChosen && studentId === s.id ? colors.surfaceElevated : colors.backgroundSubtle, alignItems: "center", justifyContent: "center", opacity: disabled ? .55 : 1 }}>
            <CaptureText>{jerseys?.get(s.id) ? `${jerseys.get(s.id)} · ` : ""}{playerName(s)}</CaptureText>
          </Pressable>
        </View>)}
        {!students.length ? <CaptureText muted>Nenhum atleta nesta turma. Use “Sem atleta”.</CaptureText> : null}
      </View>
      <View style={{ flex: wide ? 1 : undefined, flexDirection: "row", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>{options.map(result => <View key={result.key} style={{ width: wide ? "47%" : "22%", flexGrow: 1 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={result.label} accessibilityState={{ disabled: disabled || !athleteChosen }} disabled={disabled || !athleteChosen} onPress={() => onResult(result.key)}
          style={{ minHeight: wide ? 44 : 48, padding: 6, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", opacity: disabled || !athleteChosen ? .55 : 1 }}>
          <ResultDot level={result.level} /><Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, flexShrink: 1 }}>{result.label}</Text>
        </Pressable>
      </View>)}</View>
    </View>
  </View>;
}
export function ContactCourt({ zone, disabled, onChange }: { zone: number | null; disabled: boolean; onChange: (zone: number | null) => void }) {
  const { colors } = useAppTheme();
  return <View style={{ width: "100%", maxWidth: 250, alignSelf: "center", gap: 8 }}>
    <CaptureText muted>Local do contato · nossa quadra</CaptureText>
    <Text style={{ color: colors.muted, fontSize: 10, letterSpacing: 2, textAlign: "center", paddingBottom: 4, borderBottomWidth: 2, borderBottomColor: colors.muted }}>REDE</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderColor: colors.borderStrong }}>{[4, 3, 2, 5, 6, 1].map(n => <Pressable key={n} accessibilityRole="button" accessibilityLabel={`Zona ${n}`} accessibilityState={{ selected: zone === n, disabled }} disabled={disabled} onPress={() => onChange(n === zone ? null : n)}
      style={{ width: "33.333%", minHeight: 44, borderWidth: 1, borderColor: zone === n ? colors.primaryBg : colors.border, alignItems: "center", justifyContent: "center", backgroundColor: zone === n ? colors.surfaceElevated : "transparent" }}><Copy>{n}</Copy></Pressable>)}</View>
    <Link label="Sem local" disabled={disabled} onPress={() => onChange(null)} />
  </View>;
}
