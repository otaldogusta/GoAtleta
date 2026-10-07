import { useState } from "react";
import { ActivityIndicator, View, Text, useWindowDimensions } from "react-native";
import type { ScoutingActionFundamental, ScoutingActionPhase, ScoutingContact, ScoutingSide, Student } from "../../core/models";
import { captureCriterion, captureResult, contactOutcome, getCaptureResultOptions, nextCaptureFundamental, validateRallyContacts } from "../../core/scouting-rallies";
import { scoutingActionPhases } from "../../core/scouting";
import { useAppTheme } from "../../ui/app-theme";
import { Button } from "../../ui/Button";
import { amount, Copy, Choice, ErrorNotice, Input, Link, ScoutingModal, shortDate, skillLabel } from "./ScoutingUI";
import { useScoutingCollection } from "./use-scouting-collection";
import { CaptureText, ContactCourt, ContactPad, ContactSequence } from "./ScoutingCaptureUI";
import { GoAtletaIcon } from "../../ui/icon-registry";

export function ScoutingCollector({ org, sessionId, userId, students, onClose, onSaved }: {
  org: string; sessionId: string; userId: string; students: Student[]; onClose: () => void; onSaved: () => void;
}) {
  const flow = useScoutingCollection(org, sessionId, userId, onSaved);
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [fundamental, setFundamental] = useState<ScoutingActionFundamental | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [athleteChosen, setAthleteChosen] = useState(false);
  const [zone, setZone] = useState<number | null>(null);
  const [phase, setPhase] = useState<ScoutingActionPhase | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [extra, setExtra] = useState(false);
  const [criteria, setCriteria] = useState(false);
  const [history, setHistory] = useState(false);
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
  const nextSet = state ? state.setNumber + 1 : Number(initialSet);
  const validSet = /^\d+$/.test(scoreUs) && /^\d+$/.test(scoreThem) && Number(scoreUs) <= 999 && Number(scoreThem) <= 999 && Number.isInteger(nextSet) && nextSet >= 1 && nextSet <= 99;
  const commitContact = async (resultKey: string) => {
    if (disabled || !athleteChosen || (isGame && terminal && editing == null)) return;
    const student = students.find(s => s.id === studentId);
    const contact: ScoutingContact = { studentId, athleteName: student?.name ?? null, fundamental: skill,
      resultKey, zone, phase: phase ?? (skill === "saque" ? "saque" : isGame ? state?.serve === "them" && !contacts.some(c => c.fundamental === "ataque") ? "side_out" : "transicao" : ["recepcao", "levantamento", "ataque"].includes(skill) ? "side_out" : "transicao") };
    if (!isGame) { await flow.execute({ name: "action", payload: { contacts: [contact] } }); return; }
    const next = editing == null ? [...contacts, contact] : contacts.map((c, i) => i === editing ? contact : c);
    const invalid = validateRallyContacts(next);
    if (invalid) { flow.setError(invalid); return; }
    flow.changeContacts(next); resetEditor();
  };
  const closePoint = async (winner: ScoutingSide) => {
    if (editing != null || athleteChosen) { flow.setError("Escolha o resultado ou cancele este contato antes de fechar o ponto."); return; }
    const invalid = validateRallyContacts(contacts, winner);
    if (invalid) { flow.setError(invalid); return; }
    if (await flow.execute({ name: "point", payload: { contacts, winner } })) {
      resetEditor();
    }
  };
  const editContact = (c: ScoutingContact, index: number) => {
    setEditing(index); setFundamental(c.fundamental); setStudentId(c.studentId ?? null); setAthleteChosen(true); setZone(c.zone ?? null); setPhase(c.phase); setExtra(c.zone != null);
  };
  const resetEditor = () => { setEditing(null); setFundamental(null); setStudentId(null); setAthleteChosen(false); setZone(null); setPhase(null); setExtra(false); };
  const canReopen = !disabled && !contacts.length && (!isGame || !athleteChosen) && (isGame ? !!detail?.rallies.length && detail.rallies[detail.rallies.length - 1].setNumber === state?.setNumber : !!detail?.actions.length);
  const reopen = () => {
    if (!detail || !canReopen) return;
    void flow.execute(isGame ? { name: "reopen_point", payload: { rallyId: detail.rallies[detail.rallies.length - 1].id } } : { name: "undo_action", payload: { actionId: detail.actions[0].id } }).then(ok => { if (ok) resetEditor(); });
  };
  const footer = editable && !configuring ? <>
    {isGame ? <CaptureText muted>{flow.busy ? "Salvando ponto…" : editing != null ? "Escolha o resultado para salvar a correção." : athleteChosen ? "Escolha o resultado deste contato." : terminal ? `Confirme: ponto ${terminal === "us" ? "nosso" : "do adversário"}.` : contacts.length ? "Contatos prontos. Quem fez o ponto?" : "Quem fez o ponto?"}</CaptureText> : null}
    {flow.pending && !flow.busy ? <Button label="Tentar novamente" onPress={() => { void flow.execute(); }} /> : isGame && state ?
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}><Button label="＋ Nosso ponto" loading={flow.busy} disabled={disabled || terminal === "them" || athleteChosen || editing != null} onPress={() => { void closePoint("us"); }} /></View>
        <View style={{ flex: 1 }}><Button label="＋ Ponto adversário" variant="outline" loading={flow.busy} disabled={disabled || terminal === "us" || athleteChosen || editing != null} onPress={() => { void closePoint("them"); }} /></View>
      </View> : null}
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      {detail?.rallies.length ? <Link label="Reabrir último ponto" disabled={!canReopen} onPress={reopen} /> : <CaptureText muted>{flow.busy ? "Salvando…" : flow.pending ? "Envio pendente" : contacts.length ? "Rascunho da jogada" : amount(detail?.actions.length ?? 0, "registro salvo", "registros salvos")}</CaptureText>}
      <Link label="Encerrar análise" disabled={disabled || contacts.length > 0 || (isGame && athleteChosen)} onPress={() => { void flow.execute({ name: "complete", payload: {} }); }} />
    </View>
  </> : undefined;
  const scoreboard = state ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
    <View style={{ flex: 1, gap: 3 }}><CaptureText muted>Set {state.setNumber}{state.rotation ? ` · R${state.rotation}` : ""}</CaptureText><CaptureText>{state.serve === "us" ? "Nosso saque" : "Saque adversário"}</CaptureText></View>
    <View accessibilityLabel={`Placar: nós ${state.scoreUs}, adversário ${state.scoreThem}`} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
      <View style={{ alignItems: "center" }}><CaptureText muted>Nós</CaptureText><Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{state.scoreUs}</Text></View>
      <CaptureText muted>:</CaptureText><View style={{ alignItems: "center" }}><CaptureText muted>Adversário</CaptureText><Text style={{ color: colors.text, fontSize: 26, lineHeight: 32, fontWeight: "600", fontVariant: ["tabular-nums"] }}>{state.scoreThem}</Text></View>
    </View>
    <View style={{ flex: 1, alignItems: "flex-end" }}><Link label={history ? "Voltar à jogada" : "Ver pontos"} onPress={() => setHistory(!history)} /></View>
  </View> : null;
  return <ScoutingModal title={editable ? isGame ? "Registrar jogada" : "Registrar treino" : session?.title || "Análise"} subtitle={session ? `${session.title} · ${session.format ?? "Contexto não informado"} · ${shortDate(session.date)}` : undefined}
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
    </View> : editable && !history ? <>
      {isGame ? <ContactSequence contacts={contacts} editing={editing} disabled={disabled} onEdit={editContact} onUndo={() => { flow.changeContacts(contacts.slice(0, -1)); resetEditor(); }} /> :
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><CaptureText>{amount(detail?.actions.length ?? 0, "ação registrada", "ações registradas")}</CaptureText><Link label="Desfazer ação" disabled={!canReopen} onPress={reopen} /></View>}
      {!!state?.recoveredDraft.length && !contacts.length ? <Link label="Descartar contatos reabertos" disabled={disabled} onPress={() => { void flow.execute({ name: "discard_draft", payload: {} }); }} /> : null}
      {terminal && editing == null ? <View style={{ alignItems: "center", gap: 8, paddingVertical: 24 }}>
        <GoAtletaIcon name="checkmarkCircle" size={36} color={colors.success} /><Copy title>Jogada pronta</Copy>
        <Copy>{last.athleteName || "Equipe"} · {skillLabel(last.fundamental)} · {captureResult(last)?.label}</Copy>
        <CaptureText muted>Confirme o ponto abaixo. Toque em um contato para corrigir.</CaptureText>
      </View> : <View style={{ gap: 4 }}>
        <ContactPad skill={skill} students={students} studentId={studentId} athleteChosen={athleteChosen} editing={editing} disabled={disabled} wide={width >= 600}
          onSkill={f => { setFundamental(f); setPhase(null); }} onAthlete={id => { setStudentId(id); setAthleteChosen(true); }} onResult={key => { void commitContact(key); }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }}>
          <Link icon="dashboard" label={zone ? `Zona ${zone} · opcional` : "Local na quadra · opcional"} selected={extra} onPress={() => setExtra(!extra)} />
          <Link label="Critérios" selected={criteria} onPress={() => setCriteria(!criteria)} />
          {editing != null || (isGame && athleteChosen) ? <Link label={editing != null ? "Cancelar edição" : "Cancelar contato"} disabled={disabled} onPress={resetEditor} /> : null}
          {editing != null ? <Link label="Remover contato" disabled={disabled} onPress={() => { flow.changeContacts(contacts.filter((_, index) => index !== editing)); resetEditor(); }} /> : null}
        </View>
        {criteria ? <View style={{ gap: 8, paddingVertical: 8 }}>{getCaptureResultOptions(skill).map(r => <Copy muted key={r.key}>{r.label}: {captureCriterion(skill, r.key)}</Copy>)}</View> : null}
        {extra ? <View style={{ gap: 10 }}><ContactCourt zone={zone} disabled={disabled} onChange={setZone} /><CaptureText muted>Fase do contato</CaptureText><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>{scoutingActionPhases.map(p => <Choice compact key={p.id} label={p.label} selected={phase === p.id} disabled={disabled} onPress={() => setPhase(p.id)} />)}</View></View> : null}
      </View>}
    </> : null}
    {detail && (history || !isGame || !editable) && (detail.actions.length > 0 || detail.rallies.length > 0) ? <View style={{ gap: 12 }}>
      <Link label={history || !editable ? "Registros da análise" : `Ver registros (${amount(detail.actions.length, "ação", "ações")}${isGame ? ` · ${amount(detail.rallies.length, "ponto")}` : ""})`} onPress={() => setHistory(!history)} />
      {history || !editable ? <>
        {detail.rallies.slice().reverse().map(r => <View key={r.id} style={{ gap: 4, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}><Copy>Set {r.setNumber} · {r.scoreUs} × {r.scoreThem} · {r.won ? "Nosso ponto" : "Adversário"}</Copy><Copy muted>{r.contacts.map(c => `${c.athleteName || "Equipe"}: ${skillLabel(c.fundamental)} ${captureResult(c)?.label ?? c.resultKey}`).join(" → ") || "Somente placar"}</Copy></View>)}
        {detail.actions.filter(a => !a.rallyId).map(a => <View key={a.id} style={{ paddingVertical: 7 }}><Copy>{a.athleteName || "Equipe"} · {skillLabel(a.fundamental)} · {a.resultLabel}</Copy><Copy muted>{a.zone ? `Zona ${a.zone} · ` : ""}{scoutingActionPhases.find(p => p.id === a.phase)?.label}</Copy></View>)}
      </> : null}
    </View> : session?.status === "concluido" || history ? <Copy muted>{history ? "Nenhum ponto registrado nesta análise." : "Análise concluída sem registros."}</Copy> : null}
    {history && isGame && editable ? <Link label="Próximo set" disabled={disabled || contacts.length > 0 || athleteChosen || (state?.setNumber ?? 0) >= 99} onPress={() => { setScoreUs("0"); setScoreThem("0"); setRotation(null); setConfigure(true); setHistory(false); }} /> : null}
  </ScoutingModal>;
}
