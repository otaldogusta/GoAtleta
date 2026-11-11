import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, ScrollView, TextInput, View, useWindowDimensions } from "react-native";
import type { ScoutingActionFundamental } from "../../core/models";
import { captureCriterion, captureFundamentals, getCaptureResultOptions } from "../../core/scouting-rallies";
import { OperationalText as Text } from "../../ui/OperationalText";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon, KeyboardIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { compactUiMetrics, radius, spacing, typography } from "../../theme/tokens";
import { contactLabel, type ContactPadProps } from "./ScoutingCaptureUI";
import { CollectorAthlete, CollectorHelp, CollectorRosterPicker } from "./ScoutingCollectionParts";
import { Button } from "../../ui/Button";
import { Choice, Copy, ErrorNotice, Input, Link, ScoutingModal, skillLabel } from "./ScoutingUI";
import { benchCourtZones, parseScoutingCode, type ScoutingCodeContact, type ScoutingLineup } from "./scouting-bench";
import { ScoutingLineupCourt } from "./ScoutingLineupCourt";
import { validateScoutingRoster } from "./use-scouting-roster";

function BenchText({ children, section = false }: { children: ReactNode; section?: boolean }) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.text, fontSize: section ? compactUiMetrics.titleFontSize : 14, lineHeight: section ? compactUiMetrics.titleLineHeight : 20, fontWeight: section ? "700" : "400" }}>{children}</Text>;
}
type Props = ContactPadProps & {
  lineup: ScoutingLineup; lineupLoading: boolean; lineupSaving: boolean; lineupError: string; courtEnabled: boolean;
  onSaveLineup: (lineup: ScoutingLineup) => Promise<boolean>; onEditRoster: () => void; canEditRoster: boolean;
  onCode: (contact: ScoutingCodeContact) => Promise<boolean>; onCodeDirty?: (dirty: boolean) => void; codeDraft?: string; onCodeDraftChange?: (value: string) => void; onLineupEditingChange?: (editing: boolean) => void; onLineupDirtyChange?: (dirty: boolean) => void; sequence?: ReactNode;
  guestName?: string | null;
  onGuest?: () => void;
  jerseySaving?: boolean; jerseyError?: string;
  onSaveJerseys?: (jerseys: ReadonlyMap<string, string>) => Promise<boolean>;
};

/** The same collector commands, with an explicit lineup and optional keyboard entry. */
export function ScoutingBenchPad(props: Props) {
  const { colors } = useAppTheme();
  const {width}=useWindowDimensions();
  const mobile=width<768;
  const [courtExpanded,setCourtExpanded]=useState(false);
  const collapsedCourt=mobile&&!courtExpanded;
  const { students, jerseys, lineup, skill, disabled, athleteChosen, studentId, editing, guestName, onGuest, captureVersion = 2 } = props;
  const [picker, setPicker] = useState(false), [more, setMore] = useState(false), [lineupEditor, setLineupEditor] = useState(false);
  const [lineupSlot, setLineupSlot] = useState(0);
  const [localCode, setLocalCode] = useState(""), [codeError, setCodeError] = useState(""), [submitting, setSubmitting] = useState(false);
  const code = props.codeDraft ?? localCode;
  const hasCode = !!code.trim();
  const manualContactOpen = athleteChosen || editing !== null;
  const manualBlocked = disabled || submitting || hasCode;
  const codeBlocked = disabled || submitting || manualContactOpen;
  const setCode = (value: string) => {
    if (props.onCodeDraftChange) props.onCodeDraftChange(value);
    else setLocalCode(value);
    props.onCodeDirty?.(!!value.trim());
    setCodeError("");
  };
  const submittingRef = useRef(false);
  const selected = athleteChosen ? students.find(student => student.id === studentId) : undefined;
  const options = getCaptureResultOptions(skill, captureVersion);
  const submit = async () => {
    if (codeBlocked || submittingRef.current || !hasCode) return;
    const parsed = parseScoutingCode(code, students, jerseys ?? new Map(), captureVersion);
    if (!parsed.contact) { setCodeError(parsed.error); return; }
    submittingRef.current = true; setSubmitting(true); setCodeError("");
    try { if (await props.onCode(parsed.contact)) setCode(""); }
    catch { setCodeError("Não foi possível adicionar este contato. Tente novamente."); }
    finally { submittingRef.current = false; setSubmitting(false); }
  };
  const choose = (id: string | null) => {
    if (!manualBlocked && !submittingRef.current) props.onAthlete(id);
  };
  const openLineup = (slot = lineupSlot) => {
    setLineupSlot(slot);
    setLineupEditor(true);
    props.onLineupEditingChange?.(true);
  };
  const closeLineup=()=>{setLineupEditor(false);props.onLineupEditingChange?.(false);};
  return <View style={{ gap: spacing.xs }}>
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.xs }}>
      <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{props.courtEnabled&&mobile?<Pressable accessibilityRole="button" accessibilityLabel={collapsedCourt?"Expandir quadra":"Recolher quadra"} accessibilityState={{expanded:!collapsedCourt}} onPress={()=>setCourtExpanded(value=>!value)} style={{minHeight:44,flexDirection:"row",alignItems:"center",gap:spacing.xs}}><BenchText section>Em quadra</BenchText><GoAtletaIcon name={collapsedCourt?"chevronDown":"chevronUp"} size={14} color={colors.muted}/></Pressable>:<BenchText section>{props.courtEnabled ? "Em quadra" : "Atletas"}</BenchText>}
        {props.courtEnabled ? <Link label={lineup.some(Boolean) ? "Editar" : "Definir em quadra"} disabled={disabled || props.lineupLoading || props.lineupSaving} onPress={() => openLineup()} /> : null}</View>
      {props.courtEnabled ? <ScoutingLineupCourt students={students} jerseys={jerseys} lineup={lineup} collapsed={collapsedCourt} disabled={manualBlocked} athleteChosen={athleteChosen} studentId={studentId} onStudent={choose} onEmpty={openLineup} /> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{students.slice(0, 6).map(student => <View key={student.id} style={{ width: "31%", flexGrow: 1 }}><CollectorAthlete student={student} jersey={jerseys?.get(student.id)} selected={athleteChosen && studentId === student.id} disabled={manualBlocked} onPress={() => choose(student.id)} /></View>)}</View>}
      <View style={{ minHeight: 44, flexDirection: "row", flexWrap: "wrap", columnGap: spacing.xs, alignItems: "center", justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Escolher no elenco completo, ${students.length} atletas`} disabled={manualBlocked} onPress={() => setPicker(true)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 44, opacity: manualBlocked ? .55 : 1 }}><GoAtletaIcon name="students" size={18} color={colors.muted} /><BenchText>Elenco</BenchText></Pressable>
        {onGuest ? <Link label="Convidado" selected={athleteChosen && !!guestName} disabled={manualBlocked} onPress={onGuest} /> : null}
        <Link label="Sem atleta" selected={athleteChosen && studentId === null && !guestName} disabled={manualBlocked} onPress={() => choose(null)} />
      </View>
      {props.lineupError ? <ErrorNotice text={props.lineupError} /> : null}
    </View>
    <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><BenchText section>{editing === null ? "Registrar ao vivo" : `Editar contato ${editing + 1}`}</BenchText><CollectorHelp label="Como registrar ao vivo" disabled={disabled}><Copy>Escolha atleta, fundamento e resultado para adicionar um contato. Ao terminar a jogada, confirme quem venceu.</Copy><Copy>Teclado: camisa + fundamento + nota de 0 a 3. Ex.: 7S2.</Copy><Copy>S saque · R passe · L levantamento · A ataque · B bloqueio · D defesa · C cobertura · T transição · M comunicação.</Copy><Copy>Atalhos de nota: =0, -1, +2, #3. Resultados com a mesma nota exigem o nome exato ou os botões.</Copy></CollectorHelp></View>
    <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "flex-end" }}><View accessibilityLabel="Fundamento do contato" style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>{["saque", ...captureFundamentals.filter(f => f !== "saque")].map(f => <View key={f} style={{ width: "30%", flexGrow: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={skillLabel(f)} aria-pressed={skill === f} accessibilityState={{ selected: skill === f, disabled }} disabled={disabled} onPress={() => props.onSkill(f as ScoutingActionFundamental)} style={{ minHeight: 44, borderWidth: 1, borderColor: skill === f ? colors.primaryBg : colors.border, borderRadius: radius.internal, alignItems: "center", justifyContent: "center", padding: spacing.xs, opacity: disabled ? .55 : 1 }}><BenchText>{contactLabel(f as ScoutingActionFundamental)}</BenchText></Pressable></View>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Mais fundamentos" disabled={disabled} onPress={() => setMore(true)} style={{ height: 44, width: 44, justifyContent: "center", alignItems: "center" }}><GoAtletaIcon name="add" size={16} color={colors.muted} /></Pressable></View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs }}>{options.map(result => <View key={result.key} style={{ width: "22%", flexGrow: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={result.label} accessibilityState={{ disabled: manualBlocked || !athleteChosen }} disabled={manualBlocked || !athleteChosen} onPress={() => props.onResult(result.key)} style={{ minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.internal, padding: 3, alignItems: "center", justifyContent: "center", gap: 4, opacity: manualBlocked || !athleteChosen ? .55 : 1 }}><Text style={{ fontSize: 13, lineHeight: 18, color: colors.text, textAlign: "center" }}>{result.label}</Text><View style={{ height: 4, width: 4, borderRadius: 1, backgroundColor: [colors.danger, colors.warning, colors.info, colors.success][result.level] }} /></Pressable></View>)}</View>
    {athleteChosen ? <View style={{ minHeight: 32, justifyContent: "center" }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: 14 }}>{selected ? `${jerseys?.get(selected.id) ? `${jerseys.get(selected.id)} ` : ""}${selected.name.split(/\s+/)[0]}` : guestName || "Sem atleta"} · {skillLabel(skill)}</Text></View> : null}
    {props.sequence}
    <View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, borderWidth: 1, borderColor: codeError ? colors.danger : colors.border, backgroundColor: colors.inputBg, borderRadius: radius.internal, paddingHorizontal: 14, marginTop: spacing.xs }}>
      <KeyboardIcon size={16} color={colors.muted} />
      <TextInput
        accessibilityLabel="Registrar contato por código"
        placeholder={manualContactOpen ? "Conclua o contato manual" : "Ex.: 7S+"}
        value={code}
        onChangeText={value => { if (!codeBlocked && !submittingRef.current) setCode(value); }}
        onSubmitEditing={() => { void submit(); }}
        editable={!codeBlocked}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={{ flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: 8, borderRadius: 0, color: colors.text, fontSize: 14 }}
      />
      {code.length > 0 ? <Pressable
        accessibilityRole="button"
        accessibilityLabel="Limpar código do contato"
        disabled={disabled || submitting}
        onPress={() => { if (!disabled && !submittingRef.current) setCode(""); }}
        style={{ height: 44, width: 44, justifyContent: "center", alignItems: "center", opacity: disabled || submitting ? .55 : 1 }}
      ><GoAtletaIcon name="close" size={14} color={colors.muted} /></Pressable> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adicionar contato por código"
        disabled={codeBlocked || !hasCode}
        onPress={() => { void submit(); }}
        style={{ height: 44, width: 44, justifyContent: "center", alignItems: "center", opacity: codeBlocked || !hasCode ? .55 : 1 }}
      ><GoAtletaIcon name="chevronForward" size={14} color={colors.text} /></Pressable>
    </View>
    {hasCode && !disabled && !submitting ? <Copy muted>{manualContactOpen ? "Limpe o código para continuar o contato manual." : "Envie ou limpe o código para continuar."}</Copy> : null}
    <ErrorNotice text={codeError} />
    {picker && !manualBlocked ? <CollectorRosterPicker students={students} jerseys={jerseys} selectedId={studentId} disabled={manualBlocked} onSelect={choose} onClose={() => setPicker(false)} /> : null}
    {more && !disabled ? <ScoutingModal compact title="Mais fundamentos" onClose={() => setMore(false)} overlayZIndex={15000}>{(["cobertura", "transicao", "comunicacao"] as const).map(f => <Choice key={f} label={skillLabel(f)} selected={f === skill} onPress={() => { props.onSkill(f); setMore(false); }} />)}<CollectorHelp label={`Critérios de ${skillLabel(skill)}`}>{options.map(result => <Copy key={result.key}>{result.label}: {captureCriterion(skill, result.key)}</Copy>)}</CollectorHelp></ScoutingModal> : null}
    <BenchLineupEditor {...props} visible={lineupEditor && (!disabled || !!props.jerseySaving)} onClose={closeLineup} slot={lineupSlot} setSlot={setLineupSlot} />
  </View>;
}

function BenchJerseyField({ name, value, disabled, onChange, onFocus }: {
  name: string; value: string; disabled: boolean; onChange: (value: string) => void; onFocus?: () => void;
}) {
  const { colors } = useAppTheme();
  return <View style={{ width: compactUiMetrics.touchTarget + compactUiMetrics.smallGap, minHeight: compactUiMetrics.touchTarget, paddingHorizontal: compactUiMetrics.smallGap, justifyContent: "center", opacity: disabled ? .55 : 1 }}>
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: (compactUiMetrics.touchTarget - compactUiMetrics.controlHeight) / 2, height: compactUiMetrics.controlHeight, borderRadius: spacing.xs, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }} />
    {Platform.OS === "web" ? <input className="sb-jersey-input" aria-label={`Camisa de ${name}`} type="number" inputMode="numeric" min={0} max={99} step={1} value={value} placeholder="Nº" disabled={disabled}
      onFocus={event => { event.currentTarget.select(); onFocus?.(); }}
      onChange={event => { const next = event.currentTarget.value; if (!disabled && /^\d{0,2}$/.test(next)) onChange(next); }}
      style={{ position: "relative", zIndex: 1, width: "100%", minWidth: 0, height: compactUiMetrics.touchTarget, padding: 0, border: 0, borderRadius: 0, background: "transparent", color: colors.text, fontFamily: typography.body.fontFamily, fontSize: compactUiMetrics.bodyFontSize, fontWeight: 600, textAlign: "center", fontVariantNumeric: "tabular-nums" }} />
      : <TextInput accessibilityLabel={`Camisa de ${name}`} value={value} placeholder="Nº" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={2} selectTextOnFocus editable={!disabled} onFocus={onFocus}
      onChangeText={next => { if (!disabled) onChange(next.replace(/\D/g, "").slice(0, 2)); }}
      style={{ position: "relative", zIndex: 1, borderRadius: 0, minHeight: compactUiMetrics.touchTarget, padding: 0, color: colors.text, fontSize: compactUiMetrics.bodyFontSize, fontWeight: "600", textAlign: "center", fontVariant: ["tabular-nums"] }} />}
  </View>;
}

function BenchLineupSlot({ zone, name, jersey, selected, disabled, jerseyDisabled, onJerseyChange, onSelect, onRemove }: {
  zone: number; name?: string; jersey?: string; selected: boolean; disabled: boolean; jerseyDisabled: boolean;
  onJerseyChange?: (value: string) => void; onSelect: () => void; onRemove: () => void;
}) {
  const { colors } = useAppTheme();
  const shortName = name?.trim().split(/\s+/)[0] ?? "Vazio";
  const playerLabel = name && jersey ? `${jersey} · ${shortName}` : shortName;
  return <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: "27%", minWidth: 128, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: selected ? colors.primaryBg : colors.border, borderRadius: radius.internal, backgroundColor: selected ? colors.backgroundSubtle : colors.surface }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Z${zone} · ${playerLabel}`} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onSelect}
      style={{ flex: 1, minWidth: 0, minHeight: compactUiMetrics.touchTarget, paddingLeft: spacing.xs, paddingRight: compactUiMetrics.smallGap, justifyContent: "center", borderRadius: radius.internal, opacity: disabled ? .55 : 1 }}>
      <Text style={{ fontSize: compactUiMetrics.metadataFontSize, lineHeight: compactUiMetrics.metadataLineHeight, fontWeight: "600", color: selected ? colors.text : colors.muted }}>Z{zone}</Text>
      <Text numberOfLines={1} style={{ fontSize: compactUiMetrics.bodyFontSize, lineHeight: compactUiMetrics.bodyLineHeight, color: name ? colors.text : colors.muted, fontWeight: name ? "600" : "400" }}>{name ? onJerseyChange ? shortName : playerLabel : "Escolher"}</Text>
    </Pressable>
    {name && onJerseyChange ? <View style={{ marginRight: compactUiMetrics.touchTarget / 2 + 2 }}><BenchJerseyField name={name} value={jersey ?? ""} disabled={disabled || jerseyDisabled} onChange={onJerseyChange} onFocus={onSelect} /></View> : null}
    {name ? <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${name} da zona ${zone}`} accessibilityState={{ disabled }} disabled={disabled} onPress={onRemove}
      style={{ position: "absolute", top: -spacing.sm, right: -spacing.lg, width: compactUiMetrics.touchTarget, height: compactUiMetrics.touchTarget, alignItems: "center", justifyContent: "center", borderRadius: compactUiMetrics.touchTarget / 2, opacity: disabled ? .55 : 1 }}>
      <View pointerEvents="none" style={{ width: compactUiMetrics.iconSize, height: compactUiMetrics.iconSize, borderRadius: spacing.xs, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}><GoAtletaIcon name="close" size={compactUiMetrics.bodyFontSize} color={colors.muted} /></View>
    </Pressable> : <View pointerEvents="none" style={{ width: compactUiMetrics.touchTarget, alignItems: "center" }}><GoAtletaIcon name="add" size={compactUiMetrics.secondaryIconSize} color={colors.muted} /></View>}
  </View>;
}

type BenchLineupDraft = { baseline: ScoutingLineup; value: ScoutingLineup; jerseyValues?: Record<string, string>; pending?: boolean; saveError?: string };

function BenchLineupEditor({ students, jerseys, lineup, lineupSaving, lineupError, onSaveLineup, onClose, onEditRoster, canEditRoster, onLineupDirtyChange, visible, slot, setSlot, jerseySaving = false, onSaveJerseys }: Props & { visible: boolean; onClose: () => void; slot: number; setSlot: (slot: number) => void }) {
  const [draftState, setDraftState] = useState<BenchLineupDraft>({ baseline: lineup, value: lineup }), [query, setQuery] = useState("");
  const hasDraft = JSON.stringify(draftState.value) !== JSON.stringify(draftState.baseline);
  const draft = hasDraft ? draftState.value : lineup;
  const published = useRef(false);
  const savingLock = useRef(false);
  const setDraft = (update: (current: ScoutingLineup) => ScoutingLineup) => setDraftState(current => {
    const pending = JSON.stringify(current.value) !== JSON.stringify(current.baseline);
    return { ...current, baseline: pending ? current.baseline : lineup, value: update(pending ? current.value : lineup), saveError: "" };
  });
  const lineupChanged = JSON.stringify(draft) !== JSON.stringify(lineup);
  const displayJerseys = new Map(jerseys);
  for (const [id, value] of Object.entries(draftState.jerseyValues ?? {})) if (students.some(student => student.id === id)) displayJerseys.set(id, value);
  const jerseyChanges = new Map([...displayJerseys].filter(([id, value]) => students.some(student => student.id === id) && (value ? String(Number(value)) : "") !== (jerseys?.get(id) ?? "")).map(([id, value]) => [id, value ? String(Number(value)) : ""]));
  const jerseysChanged = jerseyChanges.size > 0;
  const changed = lineupChanged || jerseysChanged;
  const busy = lineupSaving || jerseySaving || !!draftState.pending;
  const invalid = jerseysChanged ? validateScoutingRoster(students.map(student => ({ studentId: student.id, jersey: displayJerseys.get(student.id) ?? "" }))) : null;
  const changeJersey = (id: string, value: string) => {
    if (!busy && canEditRoster && onSaveJerseys) setDraftState(current => ({ ...current, jerseyValues: { ...current.jerseyValues, [id]: value }, saveError: "" }));
  };
  const save = async () => {
    if (busy || savingLock.current || !changed || invalid || (jerseysChanged && (!canEditRoster || !onSaveJerseys))) return;
    savingLock.current = true;
    setDraftState(current => ({ ...current, pending: true, saveError: "" }));
    try {
      if (jerseysChanged && !await onSaveJerseys!(jerseyChanges)) {
        setDraftState(current => ({ ...current, saveError: "Não foi possível salvar as camisas. Tente novamente." })); return;
      }
      if (lineupChanged && !await onSaveLineup(draft)) {
        setDraftState(current => ({ ...current, saveError: "Não foi possível salvar as posições. Tente novamente." })); return;
      }
      setDraftState({ baseline: draft, value: draft }); onClose();
    } catch { setDraftState(current => ({ ...current, saveError: "Não foi possível salvar. Tente novamente." })); }
    finally { savingLock.current = false; setDraftState(current => ({ ...current, pending: false })); }
  };
  useEffect(()=>{if(visible||changed||published.current){published.current=true;onLineupDirtyChange?.(changed);}},[visible,changed,onLineupDirtyChange]);
  useEffect(()=>()=>{if(published.current)onLineupDirtyChange?.(false);},[onLineupDirtyChange]);
  const filtered = students.filter(student => !draft.includes(student.id) && `${student.name} ${displayJerseys.get(student.id) ?? ""}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase()));
  if (!visible) return null;
  return <ScoutingModal compact maxWidth={520} title="Atletas em quadra" onClose={() => { if (!busy) onClose(); }} overlayZIndex={15000}>
    {Platform.OS === "web" ? <style>{`.sb-jersey-input::-webkit-inner-spin-button{opacity:1}.sb-jersey-input::placeholder{color:currentColor;opacity:.6}`}</style> : null}
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: spacing.sm, columnGap: spacing.lg + compactUiMetrics.smallGap, paddingTop: spacing.sm, paddingRight: spacing.lg, flexShrink: 0 }}>
      {benchCourtZones.map((zone, index) => {
        const id = draft[index];
        return <BenchLineupSlot key={zone} zone={zone} name={students.find(student => student.id === id)?.name} jersey={id ? displayJerseys.get(id) : undefined} selected={slot === index} disabled={busy} jerseyDisabled={!canEditRoster}
          onJerseyChange={id && onSaveJerseys ? value => changeJersey(id, value) : undefined}
          onSelect={() => { if (!busy) setSlot(index); }}
          onRemove={() => { if (!busy) { setDraft(old => old.map((value, position) => position === index ? null : value)); setSlot(index); setQuery(""); } }} />;
      })}
    </View>
    <View style={{ flexDirection: "row", flexShrink: 0 }}>
      <Input label={`Buscar para a zona ${benchCourtZones[slot]}`} placeholder="Nome ou camisa" value={query} onChangeText={setQuery} autoCorrect={false} editable={!busy} />
    </View>
    <ScrollView accessibilityLabel="Escolher atletas em quadra" nestedScrollEnabled style={{ maxHeight: 230, flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: compactUiMetrics.smallGap }} keyboardShouldPersistTaps="handled">{filtered.map(student => <View key={student.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <View style={{ flex: 1, minWidth: 0 }}><CollectorAthlete student={student} fullName inlineJersey jersey={onSaveJerseys ? undefined : displayJerseys.get(student.id)} selected={false} disabled={busy} onPress={() => { if (!busy) { setDraft(old => old.map((id, index) => index === slot ? student.id : id === student.id ? null : id)); setQuery(""); } }} /></View>
      {onSaveJerseys ? <BenchJerseyField name={student.name} value={displayJerseys.get(student.id) ?? ""} disabled={busy || !canEditRoster} onChange={value => changeJersey(student.id, value)} /> : null}
    </View>)}{!filtered.length ? <Copy muted>{query.trim() ? "Nenhum atleta encontrado." : "Nenhum atleta disponível."}</Copy> : null}</ScrollView>
    <ErrorNotice text={invalid || draftState.saveError || lineupError} />
    <Button label="Salvar em quadra" loading={busy} disabled={busy || !changed || !!invalid || (jerseysChanged && !canEditRoster)} onPress={() => { void save(); }} />
    {changed ? <Link label="Descartar alterações" disabled={busy} onPress={() => { if (!busy) { setDraftState({ baseline: lineup, value: lineup }); setQuery(""); } }} /> : null}
    {canEditRoster ? <Link label={onSaveJerseys ? "Editar elenco" : "Editar elenco e camisas"} disabled={busy || changed} onPress={() => { if (!busy && !changed) { onClose(); onEditRoster(); } }} /> : null}
  </ScoutingModal>;
}
