import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import type { ScoutingActionFundamental } from "../../core/models";
import { captureCriterion, captureFundamentals, getCaptureResultOptions } from "../../core/scouting-rallies";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon, KeyboardIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { compactUiMetrics, radius, spacing } from "../../theme/tokens";
import { contactLabel, type ContactPadProps } from "./ScoutingCaptureUI";
import { CollectorAthlete, CollectorHelp, CollectorRosterPicker } from "./ScoutingCollectionParts";
import { Button } from "../../ui/Button";
import { Choice, Copy, ErrorNotice, Input, Link, ScoutingModal, skillLabel } from "./ScoutingUI";
import { benchCourtZones, parseScoutingCode, type ScoutingCodeContact, type ScoutingLineup } from "./scouting-bench";
import { ScoutingLineupCourt } from "./ScoutingLineupCourt";

function BenchText({ children, section = false }: { children: ReactNode; section?: boolean }) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.text, fontSize: section ? compactUiMetrics.titleFontSize : 14, lineHeight: section ? compactUiMetrics.titleLineHeight : 20, fontWeight: section ? "700" : "400" }}>{children}</Text>;
}
type Props = ContactPadProps & {
  lineup: ScoutingLineup; lineupLoading: boolean; lineupSaving: boolean; lineupError: string; courtEnabled: boolean;
  onSaveLineup: (lineup: ScoutingLineup) => Promise<boolean>; onEditRoster: () => void; canEditRoster: boolean;
  onCode: (contact: ScoutingCodeContact) => Promise<boolean>; onCodeDirty?: (dirty: boolean) => void; codeDraft?: string; onCodeDraftChange?: (value: string) => void; onLineupEditingChange?: (editing: boolean) => void; onLineupDirtyChange?: (dirty: boolean) => void; sequence?: ReactNode;
};

/** The same collector commands, with an explicit lineup and optional keyboard entry. */
export function ScoutingBenchPad(props: Props) {
  const { colors } = useAppTheme();
  const {width}=useWindowDimensions();
  const mobile=width<768;
  const [courtExpanded,setCourtExpanded]=useState(false);
  const collapsedCourt=mobile&&!courtExpanded;
  const { students, jerseys, lineup, skill, disabled, athleteChosen, studentId, editing, captureVersion = 2 } = props;
  const [picker, setPicker] = useState(false), [more, setMore] = useState(false), [lineupEditor, setLineupEditor] = useState(false);
  const [localCode, setLocalCode] = useState(""), [codeError, setCodeError] = useState(""), [submitting, setSubmitting] = useState(false);
  const code=props.codeDraft??localCode;
  const setCode=(value:string)=>{if(props.onCodeDraftChange)props.onCodeDraftChange(value);else setLocalCode(value);props.onCodeDirty?.(!!value.trim());};
  const submittingRef = useRef(false);
  const selected = athleteChosen ? students.find(student => student.id === studentId) : undefined;
  const options = getCaptureResultOptions(skill, captureVersion);
  const submit = async () => {
    if (disabled || submittingRef.current || editing !== null || athleteChosen || !code.trim()) return;
    const parsed = parseScoutingCode(code, students, jerseys ?? new Map(), captureVersion);
    if (!parsed.contact) { setCodeError(parsed.error); return; }
    submittingRef.current = true; setSubmitting(true); setCodeError("");
    try { if (await props.onCode(parsed.contact)) { setCode(""); props.onCodeDirty?.(false); } }
    catch { setCodeError("Não foi possível adicionar este contato. Tente novamente."); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  const choose = (id: string | null) => { setCodeError(""); props.onAthlete(id); };
  const openLineup=()=>{setLineupEditor(true);props.onLineupEditingChange?.(true);};
  const closeLineup=()=>{setLineupEditor(false);props.onLineupEditingChange?.(false);};
  return <View style={{ gap: spacing.xs }}>
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{props.courtEnabled&&mobile?<Pressable accessibilityRole="button" accessibilityLabel={collapsedCourt?"Expandir quadra":"Recolher quadra"} accessibilityState={{expanded:!collapsedCourt}} onPress={()=>setCourtExpanded(value=>!value)} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:spacing.xs}}><BenchText section>Em quadra</BenchText><GoAtletaIcon name={collapsedCourt?"chevronDown":"chevronUp"} size={14} color={colors.muted}/></Pressable>:<BenchText section>{props.courtEnabled ? "Em quadra" : "Atletas"}</BenchText>}
        {props.courtEnabled ? <Link label={lineup.some(Boolean) ? "Editar" : "Definir em quadra"} disabled={disabled || props.lineupLoading || props.lineupSaving} onPress={openLineup} /> : <Link label="Elenco" disabled={disabled} onPress={() => setPicker(true)} />}</View>
      {props.courtEnabled ? <ScoutingLineupCourt students={students} jerseys={jerseys} lineup={lineup} collapsed={collapsedCourt} disabled={disabled} athleteChosen={athleteChosen} studentId={studentId} onStudent={choose} onEmpty={openLineup} /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{students.slice(0, 6).map(student => <View key={student.id} style={{ width: "31%", flexGrow: 1 }}><CollectorAthlete student={student} jersey={jerseys?.get(student.id)} selected={athleteChosen && studentId === student.id} disabled={disabled} onPress={() => choose(student.id)} /></View>)}</View>}
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Pressable accessibilityRole="button" accessibilityLabel={`Escolher no elenco completo, ${students.length} atletas`} disabled={disabled} onPress={() => setPicker(true)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44 }}><GoAtletaIcon name="students" size={18} color={colors.muted} /><BenchText>Elenco</BenchText></Pressable><Link label="Sem atleta" selected={athleteChosen && studentId === null} disabled={disabled} onPress={() => choose(null)} /></View>
      {props.lineupError ? <ErrorNotice text={props.lineupError} /> : null}
    </View>
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><BenchText section>{editing === null ? "Registrar ao vivo" : `Editar contato ${editing + 1}`}</BenchText><CollectorHelp label="Como registrar ao vivo" disabled={disabled}><Copy>Escolha atleta, fundamento e resultado para adicionar um contato. Ao terminar a jogada, confirme quem venceu.</Copy><Copy>Teclado: camisa + fundamento + nota de 0 a 3. Ex.: 7S2.</Copy><Copy>S saque · R passe · L levantamento · A ataque · B bloqueio · D defesa · C cobertura · T transição · M comunicação.</Copy><Copy>Atalhos de nota: =0, -1, +2, #3. Resultados com a mesma nota exigem o nome exato ou os botões.</Copy></CollectorHelp></View>
    <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "flex-end" }}><View accessibilityLabel="Fundamento do contato" style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{["saque", ...captureFundamentals.filter(f => f !== "saque")].map(f => <View key={f} style={{ width: "30%", flexGrow: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={skillLabel(f)} aria-pressed={skill === f} accessibilityState={{ selected: skill === f, disabled }} disabled={disabled} onPress={() => props.onSkill(f as ScoutingActionFundamental)} style={{ minHeight: 44, borderWidth: 1, borderColor: skill === f ? colors.primaryBg : colors.border, borderRadius: radius.internal, alignItems: "center", justifyContent: "center", padding: spacing.xs, opacity: disabled ? .55 : 1 }}><BenchText>{contactLabel(f as ScoutingActionFundamental)}</BenchText></Pressable></View>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Mais fundamentos" disabled={disabled} onPress={() => setMore(true)} style={{ height: 44, width: 44, justifyContent: "center", alignItems: "center" }}><GoAtletaIcon name="add" size={16} color={colors.muted} /></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>{options.map(result => <View key={result.key} style={{ width: "22%", flexGrow: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={result.label} accessibilityState={{ disabled: disabled || !athleteChosen }} disabled={disabled || !athleteChosen} onPress={() => props.onResult(result.key)} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.internal, padding: 3, alignItems: "center", justifyContent: "center", gap: 4, opacity: disabled || !athleteChosen ? .55 : 1 }}><Text style={{ fontSize: 13, lineHeight: 18, color: colors.text, textAlign: "center" }}>{result.label}</Text><View style={{ height: 4, width: 4, borderRadius: 1, backgroundColor: [colors.danger, colors.warning, colors.info, colors.success][result.level] }} /></Pressable></View>)}</View>
    {athleteChosen ? <View style={{ minHeight: 32, justifyContent: "center" }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 14 }}>{selected ? `${jerseys?.get(selected.id) ? `${jerseys.get(selected.id)} ` : ""}${selected.name.split(/\s+/)[0]}` : "Sem atleta"} · {skillLabel(skill)}</Text></View> : null}
    {props.sequence}
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, borderWidth: 1, borderColor: codeError ? colors.danger : colors.border, backgroundColor: colors.inputBg, borderRadius: radius.internal, paddingHorizontal: 14, marginTop: spacing.xs }}><KeyboardIcon size={16} color={colors.muted} /><TextInput accessibilityLabel="Registrar contato por código" placeholder="Ex.: 7S+" value={code} onChangeText={value => { setCode(value); setCodeError(""); props.onCodeDirty?.(!!value.trim()); }} onSubmitEditing={() => { void submit(); }} editable={!disabled && !submitting && editing === null} autoCapitalize="characters" autoCorrect={false} placeholderTextColor={colors.muted} style={{ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 8, borderRadius: 0, color: colors.text, fontSize: 14 }} /><Pressable accessibilityRole="button" accessibilityLabel="Adicionar contato por código" disabled={disabled || submitting || !code.trim() || athleteChosen || editing !== null} onPress={() => { void submit(); }} style={{ height: 44, width: 44, justifyContent: "center", alignItems: "center", opacity: !code.trim() || disabled || athleteChosen ? .55 : 1 }}><GoAtletaIcon name="chevronForward" size={14} color={colors.text} /></Pressable></View>
    <ErrorNotice text={codeError} />
    {picker && !disabled ? <CollectorRosterPicker students={students} jerseys={jerseys} selectedId={studentId} disabled={disabled} onSelect={choose} onClose={() => setPicker(false)} /> : null}
    {more && !disabled ? <ScoutingModal compact title="Mais fundamentos" onClose={() => setMore(false)} overlayZIndex={15000}>{(["cobertura", "transicao", "comunicacao"] as const).map(f => <Choice key={f} label={skillLabel(f)} selected={f === skill} onPress={() => { props.onSkill(f); setMore(false); }} />)}<CollectorHelp label={`Critérios de ${skillLabel(skill)}`}>{options.map(result => <Copy key={result.key}>{result.label}: {captureCriterion(skill, result.key)}</Copy>)}</CollectorHelp></ScoutingModal> : null}
    <BenchLineupEditor {...props} visible={lineupEditor && !disabled} onClose={closeLineup} />
  </View>;
}

function BenchLineupEditor({ students, jerseys, lineup, lineupSaving, lineupError, onSaveLineup, onClose, onEditRoster, canEditRoster, onLineupDirtyChange, visible }: Props & { visible: boolean; onClose: () => void }) {
  const [draftState, setDraftState] = useState({ baseline: lineup, value: lineup }), [slot, setSlot] = useState(0), [query, setQuery] = useState("");
  const hasDraft = JSON.stringify(draftState.value) !== JSON.stringify(draftState.baseline);
  const draft = hasDraft ? draftState.value : lineup;
  const published = useRef(false);
  const setDraft = (update: (current: ScoutingLineup) => ScoutingLineup) => setDraftState(current => {
    const pending = JSON.stringify(current.value) !== JSON.stringify(current.baseline);
    return { baseline: pending ? current.baseline : lineup, value: update(pending ? current.value : lineup) };
  });
  const changed = JSON.stringify(draft) !== JSON.stringify(lineup);
  useEffect(()=>{if(visible||changed||published.current){published.current=true;onLineupDirtyChange?.(changed);}},[visible,changed,onLineupDirtyChange]);
  useEffect(()=>()=>{if(published.current)onLineupDirtyChange?.(false);},[onLineupDirtyChange]);
  const filtered = students.filter(student => `${student.name} ${jerseys?.get(student.id) ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));
  if (!visible) return null;
  return <ScoutingModal compact title="Atletas em quadra" onClose={() => { if (!lineupSaving) onClose(); }} overlayZIndex={15000}>
    <Copy muted>Posições escolhidas por você, salvas neste aparelho.</Copy><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{benchCourtZones.map((zone, index) => <Choice key={zone} compact label={`Z${zone} · ${students.find(student => student.id === draft[index])?.name.split(/\s+/)[0] ?? "Vazio"}`} selected={slot === index} disabled={lineupSaving} onPress={() => setSlot(index)} />)}</View>
    <Input label={`Buscar para a zona ${benchCourtZones[slot]}`} value={query} onChangeText={setQuery} autoCorrect={false} editable={!lineupSaving} />
    <ScrollView accessibilityLabel="Escolher atletas em quadra" nestedScrollEnabled style={{ maxHeight: 250 }} contentContainerStyle={{ gap: 4 }} keyboardShouldPersistTaps="handled">{filtered.map(student => <CollectorAthlete key={student.id} student={student} fullName jersey={jerseys?.get(student.id)} selected={draft[slot] === student.id} disabled={lineupSaving} onPress={() => { setDraft(old => old.map((id, index) => index === slot ? student.id : id === student.id ? null : id)); setQuery(""); setSlot(Math.min(slot + 1, 5)); }} />)}{!filtered.length ? <Copy muted>Nenhum atleta encontrado.</Copy> : null}</ScrollView>
    <Link label="Deixar posição vazia" disabled={lineupSaving || !draft[slot]} onPress={() => setDraft(old => old.map((id, index) => index === slot ? null : id))} /><ErrorNotice text={lineupError} />
    <Button label="Salvar em quadra" loading={lineupSaving} disabled={lineupSaving || !changed} onPress={() => { void onSaveLineup(draft).then(ok => { if (ok) { setDraftState({baseline:draft,value:draft}); onClose(); } }); }} />
    {changed ? <Link label="Descartar alterações" disabled={lineupSaving} onPress={() => { if (!lineupSaving) { setDraftState({baseline:lineup,value:lineup}); setQuery(""); } }} /> : null}
    {canEditRoster ? <Link label="Editar elenco e camisas" disabled={lineupSaving || changed} onPress={() => { if (!lineupSaving && !changed) { onClose(); onEditRoster(); } }} /> : null}
  </ScoutingModal>;
}
