import { useState } from "react";
import { ActivityIndicator, View, Text, useWindowDimensions } from "react-native";
import type { ScoutingActionFundamental, ScoutingActionPhase, ScoutingContact, ScoutingSide, Student } from "../../core/models";
import { captureCriterion, captureFundamentals, captureResult, contactOutcome, getCaptureResultOptions, nextCaptureFundamental, validateRallyContacts } from "../../core/scouting-rallies";
import { scoutingActionPhases } from "../../core/scouting";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { amount, Copy, Choice, ErrorNotice, Input, Link, ScoutingModal, shortDate, skillLabel } from "./ScoutingUI";
import { useScoutingCollection } from "./use-scouting-collection";

export function ScoutingCollector({ org, sessionId, userId, students, onClose, onSaved }: {
  org: string; sessionId: string; userId: string; students: Student[]; onClose: () => void; onSaved: () => void;
}) {
  const flow = useScoutingCollection(org, sessionId, userId, onSaved);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [fundamental, setFundamental] = useState<ScoutingActionFundamental | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [zone, setZone] = useState<number | null>(null);
  const [phase, setPhase] = useState<ScoutingActionPhase | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(false);
  const [criteria, setCriteria] = useState(false);
  const [history, setHistory] = useState(false);
  const [allPlayers, setAllPlayers] = useState(false);
  const [configure, setConfigure] = useState(false);
  const [serve, setServe] = useState<ScoutingSide>("us");
  const [rotation, setRotation] = useState<number | null>(null);
  const [scoreUs, setScoreUs] = useState("0");
  const [scoreThem, setScoreThem] = useState("0");
  const [initialSet, setInitialSet] = useState("1");
  const detail = flow.detail;
  const session = detail?.session;
  const state = session?.matchState;
  const isGame = session?.type !== "treino";
  const editable = detail?.captureReady && session?.status !== "concluido";
  const disabled = flow.busy || !!flow.pending || flow.conflict || !editable;
  const configuring = editable && isGame && (!state || configure);
  const last = flow.contacts[flow.contacts.length - 1];
  const skill = fundamental ?? nextCaptureFundamental(last, state?.serve);
  const terminal = contactOutcome(last);
  const contacts = flow.contacts;
  const shortName = (name: string) => { const words = name.trim().split(/\s+/); return words.length > 1 ? `${words[0]} ${words[words.length - 1]}` : name; };
  const playerName = (name: string) => students.filter(s => shortName(s.name) === shortName(name)).length > 1 ? name : shortName(name);
  const nextSet = state ? state.setNumber + 1 : Number(initialSet);
  const validSet = /^\d+$/.test(scoreUs) && /^\d+$/.test(scoreThem) && Number(scoreUs) <= 999 && Number(scoreThem) <= 999 && Number.isInteger(nextSet) && nextSet >= 1 && nextSet <= 99;
  const commitContact = async (resultKey: string) => {
    if (disabled || (isGame && terminal && editing == null)) return;
    const student = students.find(s => s.id === studentId);
    const contact: ScoutingContact = { studentId, athleteName: student?.name ?? null, fundamental: skill,
      resultKey, zone, phase: phase ?? (skill === "saque" ? "saque" : isGame ? state?.serve === "them" && !contacts.some(c => c.fundamental === "ataque") ? "side_out" : "transicao" : ["recepcao", "levantamento", "ataque"].includes(skill) ? "side_out" : "transicao") };
    if (!isGame) { await flow.execute({ name: "action", payload: { contacts: [contact] } }); return; }
    const next = editing == null ? [...contacts, contact] : contacts.map((c, i) => i === editing ? contact : c);
    const invalid = validateRallyContacts(next);
    if (invalid) { flow.setError(invalid); return; }
    flow.changeContacts(next); setEditing(null); setFundamental(null); setStudentId(null); setZone(null); setPhase(null);
  };
  const closePoint = async (winner: ScoutingSide) => {
    if (editing != null) { flow.setError("Salve ou cancele a edição do contato antes de fechar o ponto."); return; }
    const invalid = validateRallyContacts(contacts, winner);
    if (invalid) { flow.setError(invalid); return; }
    if (await flow.execute({ name: "point", payload: { contacts, winner } })) {
      setFundamental(null); setStudentId(null); setZone(null); setPhase(null);
    }
  };
  const editContact = (c: ScoutingContact, index: number) => {
    setEditing(index); setFundamental(c.fundamental); setStudentId(c.studentId ?? null); setZone(c.zone ?? null); setPhase(c.phase); setExtra(c.zone != null);
  };
  const resetEditor = () => { setEditing(null); setFundamental(null); setStudentId(null); setZone(null); setPhase(null); };
  const footer = editable && !configuring ? <>
    {flow.pending ? <Button label="Tentar novamente" loading={flow.busy} onPress={() => { void flow.execute(); }} /> : isGame && state ?
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button label="Nosso ponto" loading={flow.busy} disabled={disabled || terminal === "them" || editing != null} onPress={() => { void closePoint("us"); }} /></View>
        <View style={{ flex: 1 }}><Button label="Adversário" variant="outline" loading={flow.busy} disabled={disabled || terminal === "us" || editing != null} onPress={() => { void closePoint("them"); }} /></View>
      </View> : null}
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <Copy muted>{flow.busy ? "Salvando…" : flow.pending ? "Envio pendente" : contacts.length ? `${amount(contacts.length, "contato")} · rascunho` : amount(detail?.actions.length ?? 0, "registro salvo", "registros salvos")}</Copy>
      <Link label="Concluir análise" disabled={disabled || contacts.length > 0} onPress={() => { void flow.execute({ name: "complete", payload: {} }); }} />
    </View>
  </> : undefined;
  const scoreboard = state ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <View style={{ gap: 3 }}><Copy>Set {state.setNumber} · saque {state.serve === "us" ? "nosso" : "adversário"}</Copy><Copy muted>{state.rotation ? `R${state.rotation} · posição do levantador` : "Rodízio não informado"}</Copy></View>
    <Text style={{ fontSize: 30, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] }}>{state.scoreUs} <Text style={{ color: colors.muted, fontSize: 20 }}>×</Text> {state.scoreThem}</Text>
  </View> : null;
  return <ScoutingModal title={session?.title || "Análise"} subtitle={session ? `${isGame ? "Jogo" : "Treino"} · ${session.format ?? "Contexto não informado"} · ${shortDate(session.date)}` : undefined}
    onClose={() => { if (!flow.busy) onClose(); }} footer={footer} summary={scoreboard}>
    {flow.loading ? <ActivityIndicator color={colors.text} /> : null}
    <ErrorNotice text={flow.error} />
    {!detail && !flow.loading ? <Button label="Tentar carregar novamente" onPress={() => { void flow.reload(); }} /> : null}
    {detail && !detail.captureReady ? <Copy muted>A atualização de coleta ainda não está disponível. O histórico continua acessível.</Copy> : null}
    {flow.conflict ? <View style={{ gap: 10 }}><Copy>Placar atual: {state?.scoreUs ?? "—"} × {state?.scoreThem ?? "—"}. Confira se estes contatos ainda pertencem à jogada.</Copy>
      <Button label="Manter contatos e continuar" onPress={() => { void flow.reconcile(true); }} /><Link label="Usar somente o registro salvo" onPress={() => { void flow.reconcile(false); }} /></View> : null}
    {configuring ? <View style={{ gap: 16 }}>
      <Copy title>{state ? "Próximo set" : "Preparar o placar"}</Copy>
      {!!detail?.actions.length && !state ? <Copy muted>As ações anteriores permanecem no histórico. Informe o placar a partir de agora.</Copy> : null}
      {!state ? <Input label="Set" value={initialSet} onChangeText={setInitialSet} keyboardType="number-pad" maxLength={2} /> : <Copy>Set {nextSet}</Copy>}
      <View style={{ flexDirection: "row", gap: 12 }}><Input label="Nós" value={scoreUs} onChangeText={setScoreUs} keyboardType="number-pad" maxLength={3} /><Input label="Adversário" value={scoreThem} onChangeText={setScoreThem} keyboardType="number-pad" maxLength={3} /></View>
      <Copy>Quem começa sacando?</Copy><View style={{ flexDirection: "row", gap: 8 }}><Choice label="Nossa equipe" selected={serve === "us"} onPress={() => setServe("us")} /><Choice label="Adversário" selected={serve === "them"} onPress={() => setServe("them")} /></View>
      {session?.format === "6x6" ? <><Copy>Posição do levantador · opcional</Copy><View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{[1, 2, 3, 4, 5, 6].map(n => <Choice key={n} label={`R${n}`} selected={rotation === n} onPress={() => setRotation(rotation === n ? null : n)} />)}</View></> : null}
      <Button label={flow.pending ? "Tentar novamente" : "Começar coleta"} loading={flow.busy} disabled={!validSet || flow.conflict} onPress={() => { void flow.execute({ name: "start_set", payload: { setNumber: nextSet, scoreUs: Number(scoreUs), scoreThem: Number(scoreThem), serve, rotation: session?.format === "6x6" ? rotation : null } }).then(ok => { if (ok) setConfigure(false); }); }} />
      {state ? <Link label="Cancelar" disabled={flow.busy || !!flow.pending} onPress={() => setConfigure(false)} /> : null}
    </View> : editable ? <>
      {isGame ? <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Copy title>Jogada atual</Copy><Copy muted>{contacts.length ? amount(contacts.length, "contato") : "Ainda sem contatos"}</Copy></View>
        {contacts.length ? contacts.map((c, index) => <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Text style={{ color: colors.muted, width: 18, fontSize: 12 }}>{index + 1}</Text>
          <View style={{ flex: 1 }}><Choice compact label={`${c.athleteName || "Equipe"} · ${skillLabel(c.fundamental)} · ${captureResult(c)?.label ?? c.resultKey}${c.zone ? ` · Z${c.zone}` : ""}`} selected={editing === index} disabled={disabled} onPress={() => editContact(c, index)} /></View>
          <Link label="Remover" disabled={disabled} onPress={() => { flow.changeContacts(contacts.filter((_, i) => i !== index)); resetEditor(); }} />
        </View>) : <Copy muted>Marque os contatos que observou e, ao final, registre o ponto.</Copy>}
        {!!state?.recoveredDraft.length && !contacts.length ? <Link label="Descartar contatos reabertos" disabled={disabled} onPress={() => { void flow.execute({ name: "discard_draft", payload: {} }); }} /> : null}
      </View> : null}
      {terminal && editing == null ? <Copy>Jogada encerrada pelo último contato. Registre o ponto abaixo.</Copy> : <View style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Copy title>{editing != null ? `Editar contato ${editing + 1}` : isGame ? "Adicionar contato" : "Registrar repetição"}</Copy>{editing != null ? <Link label="Cancelar edição" onPress={resetEditor} /> : null}</View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{captureFundamentals.map(f => <Choice compact key={f} label={skillLabel(f)} selected={skill === f} disabled={disabled} onPress={() => { setFundamental(f); setPhase(null); }} />)}</View>
        <View style={{ flexDirection: width >= 650 ? "row" : "column", gap: 18 }}>
          <View style={{ flex: 1, gap: 9 }}><Copy>Quem fez?</Copy><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <Choice label="Equipe" selected={studentId == null} disabled={disabled} onPress={() => setStudentId(null)} />
            {(allPlayers ? students : students.slice(0, 6)).map(s => <Choice key={s.id} label={playerName(s.name)} accessibilityLabel={s.name} selected={studentId === s.id} disabled={disabled} onPress={() => setStudentId(s.id)} />)}
          </View>{students.length > 6 ? <Link label={allPlayers ? "Mostrar menos" : `Ver todos (${students.length})`} onPress={() => setAllPlayers(!allPlayers)} /> : null}</View>
          <View style={{ flex: 1, gap: 9 }}><Copy>{editing != null ? "Novo resultado" : "Toque no resultado"}</Copy>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{getCaptureResultOptions(skill).map(result => <View key={result.key} style={{ width: "48%" }}><Choice label={result.label} disabled={disabled} onPress={() => { void commitContact(result.key); }} /></View>)}</View>
            <Link label={criteria ? "Ocultar critérios" : "Como avaliar"} onPress={() => setCriteria(!criteria)} />
          </View>
        </View>
        {criteria ? <View style={{ gap: 8 }}>{getCaptureResultOptions(skill).map(r => <Copy muted key={r.key}>{r.label}: {captureCriterion(skill, r.key)}</Copy>)}</View> : null}
        <Link label={extra ? "Ocultar local e fase" : "Local e fase · opcional"} onPress={() => setExtra(!extra)} />
        {extra ? <View style={{ gap: 10 }}><Copy>Zona do contato · nossa quadra</Copy><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[1, 2, 3, 4, 5, 6].map(n => <Choice key={n} label={`Z${n}`} selected={zone === n} disabled={disabled} onPress={() => setZone(zone === n ? null : n)} />)}</View><Copy>Fase</Copy><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{scoutingActionPhases.map(p => <Choice key={p.id} label={p.label} selected={phase === p.id} disabled={disabled} onPress={() => setPhase(p.id)} />)}</View></View> : null}
      </View>}
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, flexDirection: "row", justifyContent: "space-between", gap: 16 }}>
        <Link label={isGame ? "Reabrir último ponto" : "Desfazer último registro"} disabled={disabled || contacts.length > 0 || (isGame ? !detail?.rallies.length || detail.rallies[detail.rallies.length - 1].setNumber !== state?.setNumber : !detail?.actions.length)} onPress={() => {
          if (!detail) return;
          void flow.execute(isGame ? { name: "reopen_point", payload: { rallyId: detail.rallies[detail.rallies.length - 1].id } } : { name: "undo_action", payload: { actionId: detail.actions[0].id } }).then(ok => { if (ok) resetEditor(); });
        }} />
        {isGame ? <Link label="Próximo set" disabled={disabled || contacts.length > 0 || (state?.setNumber ?? 0) >= 99} onPress={() => { setScoreUs("0"); setScoreThem("0"); setRotation(null); setConfigure(true); }} /> : null}
      </View>
    </> : null}
    {detail && (detail.actions.length > 0 || detail.rallies.length > 0) ? <View style={{ gap: 12 }}>
      <Link label={history || !editable ? "Registros da análise" : `Ver registros (${amount(detail.actions.length, "ação", "ações")}${isGame ? ` · ${amount(detail.rallies.length, "ponto")}` : ""})`} onPress={() => setHistory(!history)} />
      {history || !editable ? <>
        {detail.rallies.slice().reverse().map(r => <View key={r.id} style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}><Copy>Set {r.setNumber} · {r.scoreUs} × {r.scoreThem} · {r.won ? "Nosso ponto" : "Adversário"}</Copy><Copy muted>{r.contacts.map(c => `${c.athleteName || "Equipe"}: ${skillLabel(c.fundamental)} ${captureResult(c)?.label ?? c.resultKey}`).join(" → ") || "Somente placar"}</Copy></View>)}
        {detail.actions.filter(a => !a.rallyId).map(a => <View key={a.id} style={{ paddingVertical: 7 }}><Copy>{a.athleteName || "Equipe"} · {skillLabel(a.fundamental)} · {a.resultLabel}</Copy><Copy muted>{a.zone ? `Zona ${a.zone} · ` : ""}{scoutingActionPhases.find(p => p.id === a.phase)?.label}</Copy></View>)}
      </> : null}
    </View> : session?.status === "concluido" ? <Copy muted>Análise concluída sem registros.</Copy> : null}
  </ScoutingModal>;
}
