import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, View, useWindowDimensions } from "react-native";
import { OperationalText as Text } from "../../ui/OperationalText";
import type { ScoutingActionFundamental, ScoutingActionPhase, ScoutingContact, ScoutingRallyOutcome, ScoutingSide, Student } from "../../core/models";
import { captureCriterion, captureResult, contactOutcome, getCaptureResultOptions, nextCaptureFundamental, rallyOutcomeWinner, scoutingRallyOutcomeLabel, validateScoutingRally } from "../../core/scouting-rallies";
import { scoutingActionPhases } from "../../core/scouting";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { amount, Copy, Choice, ErrorNotice, Input, Link, ScoutingModal, shortDate, skillLabel } from "./ScoutingUI";
import { useScoutingCollection } from "./use-scouting-collection";
import { CaptureText, ContactCourt, ContactPad, ContactSequence, ScoutingCapturePanel } from "./ScoutingCaptureUI";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { compactUiMetrics as metrics, spacing } from "../../theme/tokens";
import { CollectorHelp } from "./ScoutingCollectionParts";
import { useScoutingRoster } from "./use-scouting-roster";
import { ScoutingRosterEditor } from "./ScoutingRosterEditor";
import { useScoutingShortcuts } from "./use-scouting-shortcuts";
import { ScoutingRallyOutcomeControl } from "./ScoutingRallyOutcomeControl";
import { ScoutingRecordedReview } from "./ScoutingRecordedReview";
import type { ScoutingCaptureBridge } from "./live/live-scouting-contract";
import { ScoutingBenchPad } from "./ScoutingBenchPad";
import { ScoutingBenchSetup } from "./ScoutingBenchSetup";
import { useScoutingLineup } from "./use-scouting-lineup";
import type { ScoutingCodeContact } from "./scouting-bench";

export type ScoutingCollectorActions={requestFinish:()=>void;canFinish:boolean;status:"loading"|"saved"|"dirty"|"pending"|"busy"|"error"};
export function ScoutingCollector({ org, sessionId, userId, students, onClose, onSaved, onOpenVideo, presentation = "modal", active = true, keyboardActive = true, bench = false, teamName, onDirtyChange, onBusyChange, onActionsChange, containerWidth, captureBridge }: {
  org: string; sessionId: string; userId: string; students: Student[]; onClose: () => void; onSaved: () => void; onOpenVideo?: () => void;
  presentation?: "modal" | "embedded"; active?: boolean; keyboardActive?: boolean; bench?: boolean; teamName?: string; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; onActionsChange?:(actions:ScoutingCollectorActions|null)=>void; containerWidth?: number; captureBridge?: ScoutingCaptureBridge;
}) {
  const flow = useScoutingCollection(org, sessionId, userId, onSaved, captureBridge);
  const {confirm}=useConfirmDialog();
  const compact=presentation==="embedded"&&Platform.OS==="web";
  const inBench=compact&&bench;
  const roster = useScoutingRoster(userId, org, sessionId);
  const [editingRoster, setEditingRoster] = useState(false);
  const jerseys = useMemo(() => new Map(roster.players?.map(p => [p.studentId, p.jersey]) ?? []), [roster.players]);
  const rosterStudents = useMemo(() => roster.players ? students.filter(s => jerseys.has(s.id)).sort((a, b) => {
    const an = jerseys.get(a.id); const bn = jerseys.get(b.id);
    return (an ? Number(an) : 100) - (bn ? Number(bn) : 100) || a.name.localeCompare(b.name);
  }) : students, [students, roster.players, jerseys]);
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [fundamental, setFundamental] = useState<ScoutingActionFundamental | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [athleteChosen, setAthleteChosen] = useState(false);
  const [zone, setZone] = useState<number | null>(null);
  const [phase, setPhase] = useState<ScoutingActionPhase | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(false);
  const [criteria, setCriteria] = useState(false);
  const [history, setHistory] = useState(false);
  const [collectionMenu,setCollectionMenu]=useState(false);
  const [codeDraft,setCodeDraft]=useState("");
  const [lineupEditing,setLineupEditing]=useState(false);
  const [lineupDirty,setLineupDirty]=useState(false);
  const codeDirty=!!codeDraft.trim();
  const [configure, setConfigure] = useState(false);
  const [serve, setServe] = useState<ScoutingSide>("us");
  const [rotation, setRotation] = useState<number | null>(null);
  const [scoreUs, setScoreUs] = useState("0");
  const [scoreThem, setScoreThem] = useState("0");
  const [initialSet, setInitialSet] = useState("1");
  const [undonePoint, setUndonePoint] = useState<{ revision: number; setNumber: number; contacts: ScoutingContact[]; winner: ScoutingSide; outcome?: ScoutingRallyOutcome | null } | null>(null);
  const detail = flow.detail;
  const session = detail?.session;
  const state = session?.matchState;
  const isGame = session?.type !== "treino";
  const lineup = useScoutingLineup(userId, org, session?.classId ?? "", sessionId, rosterStudents, inBench && session?.format === "6x6");
  const editable = detail?.captureReady && session?.status !== "concluido";
  const disabled = !active || flow.busy || !!flow.pending || flow.conflict || flow.readBlocked || !editable || roster.loading || roster.saving;
  const configuring = editable && isGame && (!state || configure);
  const last = flow.contacts[flow.contacts.length - 1];
  const skill = fundamental ?? nextCaptureFundamental(last, state?.serve);
  const terminal = rallyOutcomeWinner(flow.outcome) ?? contactOutcome(last);
  const captureVersion = detail?.captureVersion ?? 2;
  const contacts = flow.contacts;
  const configuringDraft = configuring && (scoreUs !== "0" || scoreThem !== "0" || initialSet !== "1" || serve !== "us" || rotation != null);
  const dirty = contacts.length > 0 || !!flow.outcome || athleteChosen || codeDirty || lineupDirty || editing != null || configure || configuringDraft || editingRoster || flow.busy || !!flow.pending || roster.saving;
  const saving = flow.busy || roster.saving;
  const finishOwner=useMemo(()=>({org,userId,sessionId}),[org,userId,sessionId]);
  const canFinish=!!editable&&!flow.loading&&!flow.readBlocked&&!flow.conflict&&!flow.busy&&!flow.pending&&!roster.loading&&!roster.saving&&!contacts.length&&!flow.outcome&&!configuring&&!editingRoster&&!lineupEditing&&!lineupDirty&&!codeDirty&&editing==null&&(!isGame||!athleteChosen);
  const finishState=useRef<{owner:typeof finishOwner;canFinish:boolean;execute:typeof flow.execute}|null>(null),finishOpening=useRef(false);
  useLayoutEffect(()=>{const current={owner:finishOwner,canFinish,execute:flow.execute};finishState.current=current;return()=>{if(finishState.current===current)finishState.current=null;};},[finishOwner,canFinish,flow.execute]);
  const requestFinish=useCallback(()=>{
    const current=finishState.current;if(!current?.canFinish||finishOpening.current)return;
    finishOpening.current=true;
    void confirm({title:"Encerrar análise?",message:"Os registros serão mantidos. Novas ações não poderão ser adicionadas.",confirmLabel:"Encerrar análise",cancelLabel:"Continuar registrando",loadingLabel:"Encerrando…",onConfirm:async()=>{
      const latest=finishState.current;
      if(!latest||latest.owner!==current.owner||!latest.canFinish)throw new Error("A análise mudou. Conclua a edição atual antes de encerrar.");
      if(!await latest.execute({name:"complete",payload:{}}))throw new Error("Não foi possível encerrar a análise. Confira o registro pendente e tente novamente.");
    }}).finally(()=>{finishOpening.current=false;});
  },[confirm]);
  const collectorStatus:ScoutingCollectorActions["status"]=flow.loading||roster.loading?"loading":saving?"busy":flow.pending?"pending":flow.error||flow.readBlocked||roster.error?"error":dirty?"dirty":"saved";
  useEffect(()=>{onActionsChange?.({requestFinish,canFinish,status:collectorStatus});},[onActionsChange,requestFinish,canFinish,collectorStatus]);
  useEffect(()=>()=>onActionsChange?.(null),[onActionsChange]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  useEffect(() => { onBusyChange?.(saving); }, [saving, onBusyChange]);
  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);
  const nextSet = state ? state.setNumber + 1 : Number(initialSet);
  const validSet = /^\d+$/.test(scoreUs) && /^\d+$/.test(scoreThem) && Number(scoreUs) <= 999 && Number(scoreThem) <= 999 && Number.isInteger(nextSet) && nextSet >= 1 && nextSet <= 99;
  const commitContact = async (resultKey: string, code?: ScoutingCodeContact): Promise<boolean> => {
    if (disabled || (!code && !athleteChosen) || (code && (editing !== null || athleteChosen)) || (isGame && terminal && editing == null)) return false;
    const contactStudentId = code?.studentId ?? studentId, contactSkill = code?.fundamental ?? skill;
    const student = students.find(s => s.id === contactStudentId);
    if (code && (!student || !jerseys.has(code.studentId) || !rosterStudents.some(value => value.id === code.studentId))) return false;
    const defaultPhase:ScoutingActionPhase=contactSkill === "saque" ? "saque" : isGame ? state?.serve === "them" && !contacts.some(c => c.fundamental === "ataque") ? "side_out" : "transicao" : ["recepcao", "levantamento", "ataque"].includes(contactSkill) ? "side_out" : "transicao";
    const contact: ScoutingContact = { studentId: contactStudentId, athleteName: student?.name ?? null, fundamental: contactSkill,
      resultKey, zone: code ? null : zone, phase: code ? defaultPhase : phase ?? defaultPhase };
    if (!isGame) { const ok = await flow.execute({ name: "action", payload: { contacts: [contact] } }); if(ok&&code) resetEditor(); return ok; }
    const next = editing == null ? [...contacts, contact] : contacts.map((c, i) => i === editing ? contact : c);
    const invalid = validateScoutingRally(next, undefined, flow.outcome, state?.serve);
    if (invalid) { flow.setError(invalid); return false; }
    flow.changeContacts(next, { kind: editing == null ? "append" : "replace", index: editing ?? contacts.length }); resetEditor();
    setUndonePoint(null);
    return true;
  };
  const closePoint = async (winner: ScoutingSide) => {
    if (disabled) return;
    if (editing != null || athleteChosen || codeDirty) { flow.setError(codeDirty?"Conclua ou limpe o contato antes de fechar o ponto.":"Escolha o resultado ou cancele este contato antes de fechar o ponto."); return; }
    const invalid = validateScoutingRally(contacts, winner, flow.outcome, state?.serve);
    if (invalid) { flow.setError(invalid); return; }
    if (await flow.execute({ name: "point", payload: { contacts, winner, ...(captureVersion >= 3 || flow.outcome ? { outcome: flow.outcome } : {}) } })) {
      setUndonePoint(null);
      resetEditor();
    }
  };
  const editContact = (c: ScoutingContact, index: number) => {
    setEditing(index); setFundamental(c.fundamental); setStudentId(c.studentId ?? null); setAthleteChosen(true); setZone(c.zone ?? null); setPhase(c.phase); setExtra(c.zone != null);
  };
  const resetEditor = () => { setEditing(null); setFundamental(null); setStudentId(null); setAthleteChosen(false); setZone(null); setPhase(null); setExtra(false); };
  const canReopen = !disabled && !contacts.length && !flow.outcome && (!isGame || !athleteChosen) && (isGame ? !!detail?.rallies.length && detail.rallies[detail.rallies.length - 1].setNumber === state?.setNumber : !!detail?.actions.length);
  const reopen = () => {
    if (!detail || !canReopen) return;
    const point = detail.rallies[detail.rallies.length - 1];
    void flow.execute(isGame ? { name: "reopen_point", payload: { rallyId: point.id } } : { name: "undo_action", payload: { actionId: detail.actions[0].id } }).then(ok => {
      if (ok) {
        resetEditor();
        setUndonePoint(isGame ? { revision: (session?.revision ?? 0) + 1, setNumber: point.setNumber, contacts: point.contacts, winner: point.won ? "us" : "them", outcome: point.outcome ?? null } : null);
      }
    });
  };
  const canRedo = !disabled && !athleteChosen && editing == null && !!undonePoint && session?.revision === undonePoint.revision && state?.setNumber === undonePoint.setNumber && JSON.stringify(contacts) === JSON.stringify(undonePoint.contacts) && JSON.stringify(flow.outcome ?? null) === JSON.stringify(undonePoint.outcome ?? null);
  const redo = () => {
    if (!canRedo || !undonePoint) return;
    void flow.execute({ name: "point", payload: { contacts: undonePoint.contacts, winner: undonePoint.winner, ...(captureVersion >= 3 || undonePoint.outcome ? { outcome: undonePoint.outcome ?? null } : {}) } }).then(ok => {
      if (ok) { setUndonePoint(null); resetEditor(); }
    });
  };
  useScoutingShortcuts({ enabled: active && keyboardActive && !!editable && isGame && !editingRoster && !lineupEditing && !configuring,
    canUndo: canReopen, canRedo, undo: reopen, redo });
  const footer = (editable || !!flow.pending) && !configuring && !editingRoster ? <>
    {isGame && (flow.busy || editing != null || athleteChosen) ? <CaptureText muted>{flow.busy ? compact?"Salvando…":"Salvando ponto…" : editing != null ? "Escolha o resultado da correção." : "Escolha o resultado do contato."}</CaptureText> : null}
    {isGame && state && captureVersion >= 3 && (!inBench || !!flow.outcome) ? <ScoutingRallyOutcomeControl outcome={flow.outcome} serve={state.serve} disabled={!!disabled || athleteChosen || editing != null} onChange={value => { flow.changeOutcome(value); setUndonePoint(null); }}/> : null}
    {flow.pending && !flow.busy ? <Button label="Tentar novamente" onPress={() => { void flow.execute(); }} /> : isGame && state ?
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <View style={compact?{flex:1,minWidth:0}:undefined}><Button label={inBench?"Nosso ponto":"＋ Nosso ponto"} loading={flow.busy} disabled={disabled || terminal === "them" || athleteChosen || codeDirty || editing != null} onPress={() => { void closePoint("us"); }} /></View>
        <View style={compact?{flex:1,minWidth:0}:undefined}><Button label={inBench?"Adversário":"＋ Ponto adversário"} variant="outline" loading={flow.busy} disabled={disabled || terminal === "us" || athleteChosen || codeDirty || editing != null} onPress={() => { void closePoint("them"); }} /></View>
      </View> : null}
    {!compact||!onActionsChange ? <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <CaptureText muted>{flow.busy ? "Salvando…" : flow.pending ? "Envio pendente" : contacts.length ? "Rascunho da jogada" : amount(detail?.rallies.length || detail?.actions.length || 0, isGame ? "ponto salvo" : "registro salvo", isGame ? "pontos salvos" : "registros salvos")}</CaptureText>
      {!compact || !onActionsChange ? <Link label={isGame ? "Encerrar jogo" : "Encerrar análise"} disabled={!active||!canFinish} onPress={() => { if(active)requestFinish(); }} /> : null}
    </View> : null}
  </> : undefined;
  const rosterControl = editable && !editingRoster ? <Link label={roster.loading ? "Carregando elenco…" : `Elenco · ${rosterStudents.length}`} disabled={disabled || athleteChosen || editing != null || contacts.length > 0} onPress={() => setEditingRoster(true)} /> : null;
  const videoControl = onOpenVideo && detail && !editingRoster ? <Link label="Vídeo" disabled={!active || flow.busy} onPress={() => { if (!active) return; if (athleteChosen || editing != null || configure) { flow.setError("Conclua ou cancele a edição atual antes de abrir o vídeo."); return; } onOpenVideo(); }} /> : null;
  const compactScoreboard=state ? <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:spacing.xs,minHeight:56}}>
    <View style={{gap:2,flex:1,minWidth:0}}>{inBench?<Text style={{color:colors.text,fontSize:metrics.titleFontSize,lineHeight:metrics.titleLineHeight,fontWeight:"700"}}>Set {state.setNumber}</Text>:<><CaptureText strong>Set {state.setNumber}{state.rotation?` · P${state.rotation}`:""}</CaptureText><Text numberOfLines={1} style={{fontSize:metrics.metadataFontSize,lineHeight:metrics.metadataLineHeight,color:colors.muted}}>{state.serve==="us"?"Nosso saque":"Saque adversário"}</Text></>}</View>
    <View accessibilityLabel={`Placar: nós ${state.scoreUs}, adversário ${state.scoreThem}`} style={{flexDirection:"row",alignItems:"center",gap:spacing.xs}}><CaptureText muted>Nós</CaptureText><Text style={{fontSize:24,lineHeight:30,fontWeight:"600",fontVariant:["tabular-nums"],color:colors.text}}>{state.scoreUs} × {state.scoreThem}</Text><CaptureText muted>Adv.</CaptureText></View>
    <View style={{flexDirection:"row",alignItems:"center"}}>{editable&&isGame?<Pressable accessibilityRole="button" accessibilityLabel="Desfazer ponto" accessibilityState={{disabled:!canReopen}} disabled={!canReopen} onPress={reopen} style={{width:metrics.touchTarget,height:metrics.touchTarget,alignItems:"center",justifyContent:"center",opacity:canReopen?1:.55}}><GoAtletaIcon name="restore" size={metrics.iconSize} color={colors.muted}/></Pressable>:null}<Pressable accessibilityRole="button" accessibilityLabel="Opções da coleta" accessibilityState={{expanded:collectionMenu}} onPress={()=>setCollectionMenu(true)} style={{width:metrics.touchTarget,height:metrics.touchTarget,alignItems:"center",justifyContent:"center"}}><GoAtletaIcon name="options" size={metrics.iconSize} color={colors.muted}/></Pressable></View>
  </View> : null;
  const benchScoreboard=state?<View style={{gap:spacing.xs}}><View style={{minHeight:44,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><Text style={{color:colors.text,fontSize:metrics.titleFontSize,lineHeight:metrics.titleLineHeight,fontWeight:"700"}}>Set {state.setNumber}</Text><Pressable accessibilityRole="button" accessibilityLabel="Opções da coleta" accessibilityState={{expanded:collectionMenu}} onPress={()=>setCollectionMenu(true)} style={{width:44,height:44,alignItems:"center",justifyContent:"center"}}><GoAtletaIcon name="chevronDown" size={16} color={colors.muted}/></Pressable></View><View style={{flexDirection:"row",gap:spacing.xs,alignItems:"center"}}><View style={{flex:1,gap:spacing.xs}}>{[[teamName||"Nós",state.scoreUs],[session?.opponent||"Adversário",state.scoreThem]].map(([name,score],index)=><View key={index} style={{minHeight:28,flexDirection:"row",alignItems:"center",gap:spacing.xs}}><View style={{width:3,height:18,borderRadius:1,backgroundColor:index===0?colors.primaryBg:colors.info}}/><Text numberOfLines={1} style={{flex:1,minWidth:0,color:colors.text,fontSize:14,lineHeight:20,fontWeight:"600"}}>{name}</Text><Text style={{color:colors.text,fontSize:24,lineHeight:30,fontWeight:"700",fontVariant:["tabular-nums"]}}>{score}</Text></View>)}</View><Pressable accessibilityRole="button" accessibilityLabel="Desfazer ponto" accessibilityState={{disabled:!canReopen}} disabled={!canReopen} onPress={reopen} style={{width:44,height:44,alignItems:"center",justifyContent:"center",opacity:canReopen?1:.55}}><GoAtletaIcon name="restore" size={18} color={colors.muted}/></Pressable></View></View>:null;
  const scoreboard = inBench ? height <= 820 || width < 768 ? compactScoreboard : benchScoreboard : compact ? compactScoreboard : state ? <View style={{ gap: 4 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <View style={{ flex: 1, gap: 3 }}><CaptureText muted>Set {state.setNumber}{state.rotation ? ` · P${state.rotation}` : ""}</CaptureText><CaptureText muted>Quem saca agora</CaptureText><CaptureText strong>{state.serve === "us" ? "Nossa equipe" : "Adversário"}</CaptureText></View>
    <View accessibilityLabel={`Placar: nós ${state.scoreUs}, adversário ${state.scoreThem}`} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <View style={{ alignItems: "center" }}><CaptureText muted>Nós</CaptureText><Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{state.scoreUs}</Text></View>
      <CaptureText muted>:</CaptureText><View style={{ alignItems: "center" }}><CaptureText muted>Adversário</CaptureText><Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{state.scoreThem}</Text></View>
    </View>
    <View style={{ flex: 1, alignItems: "flex-end", gap: 2 }}>
      {editable && isGame ? <Button label="Desfazer ponto" variant="outline" disabled={!canReopen} onPress={reopen} /> : null}
      {undonePoint && canRedo ? <Link label="Refazer ponto" onPress={redo} /> : null}
      <Link label={history ? "Voltar à jogada" : "Ver pontos"} onPress={() => setHistory(!history)} />
    </View>
    </View>
    <View style={{ flexDirection: "row", gap: 20, alignItems: "center", flexWrap: "wrap" }}>{rosterControl}{videoControl}
      {isGame && editable ? <Link label="Próximo set" disabled={disabled || contacts.length > 0 || !!flow.outcome || athleteChosen || (state?.setNumber ?? 0) >= 99} onPress={() => { setScoreUs("0"); setScoreThem("0"); setRotation(null); setConfigure(true); setHistory(false); }} /> : null}
    </View>
  </View> : null;
  const startSet = () => {
    if (!active) return;
    void flow.execute({ name: "start_set", payload: { setNumber: nextSet, scoreUs: Number(scoreUs), scoreThem: Number(scoreThem), serve, rotation: session?.format === "6x6" ? rotation : null } }).then(ok => { if (ok) setConfigure(false); });
  };
  const setupFooter = <><Button label={flow.pending ? "Tentar novamente" : "Começar coleta"} loading={flow.busy} disabled={!active || !validSet || flow.conflict} onPress={startSet} />{state ? <Link label="Cancelar" disabled={flow.busy || !!flow.pending} onPress={() => setConfigure(false)} /> : null}</>;
  const content = <>
    {flow.loading ? <ActivityIndicator color={colors.text} /> : null}
    <ErrorNotice text={flow.error} />
    {!editingRoster ? <ErrorNotice text={roster.error} /> : null}
    {!state && !editingRoster && !(inBench && configuring) ? <View style={{ flexDirection: "row", gap: 20 }}>{rosterControl}{videoControl}</View> : null}
    {editingRoster ? <ScoutingRosterEditor students={students} players={roster.players} saving={roster.saving} error={roster.error}
      onCancel={() => setEditingRoster(false)} onSave={async players => { if (!active) return false; const ok = await roster.save(players); if (ok) { resetEditor(); setEditingRoster(false); } return ok; }} /> : null}
    {(!detail || flow.readBlocked) && !flow.loading ? <Button label="Tentar carregar novamente" onPress={() => { void flow.reload(); }} /> : null}
    {detail && !detail.captureReady ? <Copy muted>A atualização de coleta ainda não está disponível. O histórico continua acessível.</Copy> : null}
    {flow.conflict ? <View style={{ gap: 10 }}><Copy>Placar atual: {state?.scoreUs ?? "—"} × {state?.scoreThem ?? "—"}. Confira se estes contatos ainda pertencem à jogada.</Copy>
      <Button label="Manter contatos e continuar" onPress={() => { void flow.reconcile(true); }} /><Link label="Usar somente o registro salvo" onPress={() => { void flow.reconcile(false); }} /></View> : null}
    {!editingRoster && configuring ? inBench ? <ScoutingBenchSetup
      setNumber={nextSet} initialSet={initialSet} onInitialSet={setInitialSet} nextSet={!!state}
      scoreUs={scoreUs} scoreThem={scoreThem} onScoreUs={setScoreUs} onScoreThem={setScoreThem}
      teamName={teamName || "Nós"} opponent={session?.opponent || "Adversário"} serve={serve} onServe={setServe}
      rotation={rotation} onRotation={setRotation} courtEnabled={session?.format === "6x6"}
      students={rosterStudents} jerseys={jerseys} lineup={lineup.lineup} disabled={!!disabled || !active}
      onEditRoster={() => setEditingRoster(true)}
    /> : <View style={{ gap: 12 }}>
      <View style={{ gap: 12 }}>
        <Copy title>{state ? "Próximo set" : "Placar atual"}</Copy>
        {!state && !detail?.actions.length ? <Copy muted>Informe o placar de agora. Se o jogo ainda não começou, mantenha 0 a 0.</Copy> : null}
        {!!detail?.actions.length && !state ? <Copy muted>As ações anteriores permanecem no histórico. Informe o placar a partir de agora.</Copy> : null}
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-end" }}>
          <View style={{ width: 64 }}>{!state ? <Input label="Set" value={initialSet} onChangeText={setInitialSet} keyboardType="number-pad" maxLength={2} /> : <Copy>Set {nextSet}</Copy>}</View>
          <Input label="Nós" value={scoreUs} onChangeText={setScoreUs} keyboardType="number-pad" maxLength={3} />
          <Input label="Adversário" value={scoreThem} onChangeText={setScoreThem} keyboardType="number-pad" maxLength={3} />
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Copy>Quem começa sacando?</Copy>
        <View style={{ flexDirection: "row", gap: 8 }}><Choice label="Nossa equipe saca" selected={serve === "us"} onPress={() => setServe("us")} /><Choice label="Adversário saca" selected={serve === "them"} onPress={() => setServe("them")} /></View>
      </View>
      {session?.format === "6x6" ? <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}><Copy>Posição do levantador</Copy><Copy muted>Opcional</Copy></View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{[1, 6, 5, 4, 3, 2].map(n => <Choice key={n} label={`P${n}`} selected={rotation === n} onPress={() => setRotation(rotation === n ? null : n)} />)}</View>
      </View> : null}
      <Button label={flow.pending ? "Tentar novamente" : "Começar coleta"} loading={flow.busy} disabled={!active || !validSet || flow.conflict} onPress={startSet} />
      {state ? <Link label="Cancelar" disabled={flow.busy || !!flow.pending} onPress={() => setConfigure(false)} /> : null}
    </View> : !editingRoster && editable && !history ? <>
      {isGame ? !inBench&&(!compact||contacts.length) ? <ContactSequence contacts={contacts} editing={editing} disabled={disabled} onEdit={editContact} onUndo={() => { flow.changeContacts(contacts.slice(0, -1), { kind: "remove", index: contacts.length - 1 }); resetEditor(); }} /> : null :
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><CaptureText>{amount(detail?.actions.length ?? 0, "ação registrada", "ações registradas")}</CaptureText><Link label="Desfazer ação" disabled={!canReopen} onPress={reopen} /></View>}
      {(!!state?.recoveredDraft.length || !!state?.recoveredOutcome) && !contacts.length ? <Link label="Descartar contatos reabertos" disabled={disabled} onPress={() => { void flow.execute({ name: "discard_draft", payload: {} }); }} /> : null}
      {terminal && editing == null && !inBench ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12 }}>
        <GoAtletaIcon name="checkmarkCircle" size={16} color={colors.success} />
        <CaptureText strong>{flow.outcome ? scoutingRallyOutcomeLabel(flow.outcome) : `${last?.athleteName || "Equipe"} · ${captureResult(last!)?.label ?? "Ponto"}`}</CaptureText>
      </View> : <View style={{ gap: 4 }}>
        {inBench?<ScoutingBenchPad key={`${org}:${userId}:${sessionId}`} compact skill={skill} captureVersion={captureVersion} students={rosterStudents} jerseys={jerseys} studentId={studentId} athleteChosen={athleteChosen} editing={editing} disabled={disabled||!!terminal&&editing===null} wide={false} lineup={lineup.lineup} lineupLoading={lineup.loading} lineupSaving={lineup.saving} lineupError={lineup.error} courtEnabled={session?.format==="6x6"} onSaveLineup={lineup.save} canEditRoster={!disabled&&!athleteChosen&&editing===null&&!contacts.length&&!codeDirty} onEditRoster={()=>setEditingRoster(true)} codeDraft={codeDraft} onCodeDraftChange={setCodeDraft} onLineupEditingChange={setLineupEditing} onLineupDirtyChange={setLineupDirty} onCode={contact=>commitContact(contact.resultKey,contact)} onSkill={f=>{setFundamental(f);setPhase(null);}} onAthlete={id=>{setStudentId(id);setAthleteChosen(true);}} onResult={key=>{void commitContact(key);}} sequence={<ContactSequence compact contacts={contacts} editing={editing} disabled={disabled} onEdit={editContact} onUndo={()=>{flow.changeContacts(contacts.slice(0,-1),{kind:"remove",index:contacts.length-1});resetEditor();}}/>}/>:<ContactPad compact={compact} availableWidth={Math.max(0,(containerWidth??width)-spacing.sm*2)} key={compact?`${org}:${userId}:${sessionId}`:undefined} skill={skill} captureVersion={captureVersion} students={rosterStudents} jerseys={jerseys} studentId={studentId} athleteChosen={athleteChosen} editing={editing} disabled={disabled} wide={(containerWidth ?? width) >= 600}
          onSkill={f => { setFundamental(f); setPhase(null); }} onAthlete={id => { setStudentId(id); setAthleteChosen(true); }} onResult={key => { void commitContact(key); }} />}
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          {!inBench||extra?<Link icon="dashboard" label={zone ? `Zona ${zone} · opcional` : "Local na quadra · opcional"} selected={extra} onPress={() => setExtra(!extra)} />:null}
          {!compact ? <Link label="Critérios" selected={criteria} onPress={() => setCriteria(!criteria)} /> : null}
          {editing != null || (isGame && athleteChosen) ? <Link label={editing != null ? "Cancelar edição" : "Cancelar contato"} disabled={disabled} onPress={resetEditor} /> : null}
          {editing != null ? <Link label="Remover contato" disabled={disabled} onPress={() => { flow.changeContacts(contacts.filter((_, index) => index !== editing), { kind: "remove", index: editing }); resetEditor(); }} /> : null}
        </View>
        {criteria ? <View style={{ gap: 8, paddingVertical: 8 }}>{getCaptureResultOptions(skill, captureVersion).map(r => <Copy muted key={r.key}>{r.label}: {captureCriterion(skill, r.key)}</Copy>)}</View> : null}
        {extra ? <View style={{ gap: 10 }}><ContactCourt zone={zone} disabled={disabled} onChange={setZone} /><CaptureText muted>Fase do contato</CaptureText><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{scoutingActionPhases.map(p => <Choice compact key={p.id} label={p.label} selected={phase === p.id} disabled={disabled} onPress={() => setPhase(p.id)} />)}</View></View> : null}
      </View>}
    </> : null}
    {compact&&!inBench&&isGame&&detail?.rallies.length&&!history&&!editingRoster&&!configuring ? <View style={{gap:spacing.xs,borderTopWidth:1,borderTopColor:colors.border,paddingTop:spacing.xs}}><View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}><CaptureText strong>Últimos pontos</CaptureText><Link label="Ver pontos" onPress={()=>setHistory(true)}/></View><ScrollView accessibilityLabel="Últimos pontos, lista rolável" nestedScrollEnabled style={{maxHeight:150}} contentContainerStyle={{gap:spacing.xs}}>{detail.rallies.slice(-12).reverse().map(rally=><View key={rally.id} style={{minHeight:metrics.touchTarget,flexDirection:"row",alignItems:"center",gap:spacing.sm,borderBottomWidth:1,borderBottomColor:colors.border,paddingVertical:spacing.xs}}><CaptureText strong>{rally.scoreUs} × {rally.scoreThem}</CaptureText><View style={{flex:1,minWidth:0}}><Text numberOfLines={2} style={{fontSize:metrics.bodyFontSize,lineHeight:metrics.bodyLineHeight,color:colors.muted}}>{rally.outcome?scoutingRallyOutcomeLabel(rally.outcome):rally.contacts.map(contact=>`${contact.athleteName||"Equipe"} · ${skillLabel(contact.fundamental)} · ${captureResult(contact)?.label??contact.resultKey}`).join(" → ")||"Somente placar"}</Text></View></View>)}</ScrollView></View> : null}
    {!editingRoster && detail && (history || !isGame || !editable) && (detail.actions.length > 0 || detail.rallies.length > 0) ? <View style={{ gap: 12 }}>
      <Link label={history || !editable ? "Registros da análise" : `Ver registros (${amount(detail.actions.length, "ação", "ações")}${isGame ? ` · ${amount(detail.rallies.length, "ponto")}` : ""})`} onPress={() => setHistory(!history)} />
      {history || !editable ? <>
        {detail.rallies.slice().reverse().map(r => <View key={r.id} style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}><Copy>Set {r.setNumber} · {r.scoreUs} × {r.scoreThem} · {r.won ? "Nosso ponto" : "Adversário"}</Copy>{r.outcome ? <Copy>{scoutingRallyOutcomeLabel(r.outcome)}</Copy> : null}<Copy muted>{r.contacts.map(c => `${c.athleteName || "Equipe"}: ${c.resultKey === 'freeball_devolvida' ? 'Bola de graça devolvida' : `${skillLabel(c.fundamental)} ${captureResult(c)?.label ?? c.resultKey}`}`).join(" → ") || (r.outcome ? "Sem contatos registrados" : "Somente placar")}</Copy></View>)}
        {detail.actions.filter(a => !a.rallyId).map(a => <View key={a.id} style={{ paddingVertical: 7 }}><Copy>{a.athleteName || "Equipe"} · {skillLabel(a.fundamental)} · {a.resultLabel}</Copy><Copy muted>{a.zone ? `Zona ${a.zone} · ` : ""}{scoutingActionPhases.find(p => p.id === a.phase)?.label}</Copy></View>)}
      </> : null}
    </View> : session?.status === "concluido" || history ? <Copy muted>{history ? "Nenhum ponto registrado nesta análise." : "Análise concluída sem registros."}</Copy> : null}
  </>;
  const composition = {
    title: editable ? isGame ? "Registrar jogada" : "Registrar treino" : session?.title || "Análise",
    subtitle: session ? `${session.title} · ${session.format ?? "Contexto não informado"} · ${shortDate(session.date)}` : undefined,
    onClose: () => { if (active && !flow.busy && !roster.saving) onClose(); },
    footer: inBench && configuring && !editingRoster ? setupFooter : footer, summary: configuring || editingRoster ? undefined : scoreboard,
  };
  if (presentation === "embedded" && detail && !editable && !flow.pending && !flow.busy && !flow.loading && !flow.readBlocked && !flow.error) return <ScoutingRecordedReview detail={detail} containerWidth={containerWidth ?? width} />;
  return presentation === "embedded" ? <><ScoutingCapturePanel {...composition} title={editable ? composition.title : "Revisar registros"} active={active} compact={!!configuring} dense={compact} bench={inBench}>{content}</ScoutingCapturePanel>{compact&&collectionMenu&&active?<ScoutingModal compact title="Opções da coleta" onClose={()=>setCollectionMenu(false)} overlayZIndex={15000}><Link label={history?"Voltar à jogada":"Ver pontos"} onPress={()=>{setHistory(!history);setCollectionMenu(false);}}/>{canRedo?<Link label="Refazer ponto" onPress={()=>{redo();setCollectionMenu(false);}}/>:null}{editable?<><Link label="Editar elenco" disabled={!!disabled||athleteChosen||editing!=null||contacts.length>0||codeDirty} onPress={()=>{setEditingRoster(true);setCollectionMenu(false);}}/>{isGame?<Link label="Próximo set" disabled={!!disabled||contacts.length>0||!!flow.outcome||athleteChosen||codeDirty||(state?.setNumber??0)>=99} onPress={()=>{setScoreUs("0");setScoreThem("0");setRotation(null);setConfigure(true);setHistory(false);setCollectionMenu(false);}}/>:null}</>:null}{inBench&&editable?<Link label={zone?`Zona ${zone} do contato`:"Local do contato"} onPress={()=>{setExtra(true);setHistory(false);setCollectionMenu(false);}}/>:null}{inBench&&isGame&&state&&captureVersion>=3?<ScoutingRallyOutcomeControl outcome={flow.outcome} serve={state.serve} disabled={!!disabled||athleteChosen||editing!==null} onChange={value=>{flow.changeOutcome(value);setUndonePoint(null);}}/>:null}<CollectorHelp label="Sobre a coleta"><Copy>Escolha fundamento, atleta e resultado para registrar cada contato. Confirme quem venceu ao terminar a jogada.</Copy></CollectorHelp></ScoutingModal>:null}</>
    : active ? <ScoutingModal {...composition} compact={!!configuring}>{content}</ScoutingModal> : null;
}
