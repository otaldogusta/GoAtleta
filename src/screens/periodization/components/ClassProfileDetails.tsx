// perf-check: ignore-inline-row-style - bounded profile facts and revisions use current theme tokens.
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import type { useClassDiagnostic } from "../../../assistant/hooks/useClassDiagnostic";
import { AssistantComposer } from "../../../assistant/components/AssistantComposer";
import { PROFILE_LABELS, type ProfileKey, type ProfileFact } from "../../../core/class-pedagogical-profile";
import { useAppTheme } from "../../../ui/app-theme";
import { Button } from "../../../ui/Button";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import { radius, spacing } from "../../../theme/tokens";
import { readClassProfileSource } from "../../../api/class-pedagogical-profile";

function OriginalReport({ fact, organizationId, classId }: { fact: ProfileFact; organizationId: string; classId: string }) {
  const { colors } = useAppTheme();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { const message = await readClassProfileSource(organizationId, classId, fact.sourceId); setText(message?.content ?? fact.quote); }
    catch { setText("Não foi possível carregar o relato original."); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 4 }}>
    <Text style={{ color: colors.muted, fontSize: 12 }}>“{fact.quote}” · {new Date(fact.updatedAt).toLocaleDateString("pt-BR")}</Text>
    {fact.origin === "teacher" ? <Button label={busy ? "Carregando…" : text ? "Ocultar relato" : "Ver relato original"} variant="ghost" disabled={busy} onPress={() => text ? setText("") : void load()} /> : null}
    {text ? <Text style={{ color: colors.text, fontSize: 13 }}>{text}</Text> : null}
  </View>;
}

type DiagnosticController = ReturnType<typeof useClassDiagnostic>;
export function ClassProfileStatus({ diagnostic }: { diagnostic: DiagnosticController }) {
  const { colors } = useAppTheme();
  const { snapshot, busy, loading, error, pending } = diagnostic;
  const pendingSelection = pending?.action === "selectors" ? [pending.gameFormat, pending.netHeight != null ? `rede ${pending.netHeight.toFixed(2).replace(".", ",")} m` : ""].filter(Boolean).join(" · ") : "";
  const label = busy ? (diagnostic.operation === "evolution" ? "Consultando relatos…" : diagnostic.operation === "load" ? "Carregando perfil…" : "Salvando…") : loading ? "Carregando perfil…" : error ||
    (pending ? (snapshot?.status === "pending" ? "Relato salvo; interpretação pendente" : pendingSelection ? `Pendente: ${pendingSelection}` : "Alteração pendente") :
      snapshot?.status === "saved" ? "Perfil atualizado" :
      snapshot?.status === "interpreted" ? "Relato salvo" :
      snapshot?.status === "unchanged" ? "Alterações posteriores preservadas; nada a desfazer." :
      snapshot?.status === "insufficient_evidence" ? "Ainda faltam relatos concordantes de duas aulas." :
      snapshot?.status === "conflicting_evidence" ? "Os relatos divergem. Revise o perfil antes de avançar." : "");
  if (!label) return null;
  return <View style={{ gap: 2 }}>
    <Text accessibilityLiveRegion="polite" style={{ color: error ? colors.dangerText : colors.muted, fontSize: 12 }}>{label}</Text>
    {!busy && !loading && (error || pending) ? <Pressable accessibilityRole="button" onPress={() => void diagnostic.retry()} style={{ minHeight: 40, justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 12 }}>Tentar novamente</Text></Pressable> : null}
    {!busy && !pending && snapshot?.revisionId ? <Pressable accessibilityRole="button" onPress={() => void diagnostic.command({ action: "undo", revisionId: snapshot.revisionId! })} style={{ minHeight: 40, justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 12 }}>Desfazer</Text></Pressable> : null}
  </View>;
}

export function ClassProfileDetails({ visible, onClose, diagnostic, organizationId, classId }: {
  visible: boolean; onClose: () => void; diagnostic: DiagnosticController; organizationId: string; classId: string;
}) {
  const { colors } = useAppTheme();
  const [history, setHistory] = useState(false);
  const checked = useRef("");
  const checkKey = `${organizationId}:${classId}:${diagnostic.snapshot?.profile?.version}`;
  useEffect(() => {
    if (!visible) { checked.current = ""; return; }
    if (!diagnostic.snapshot?.profile || diagnostic.loading || diagnostic.busy || diagnostic.pending || diagnostic.error || checked.current === checkKey) return;
    checked.current = checkKey;
    void diagnostic.command({ action: "evolution" });
  }, [visible, checkKey, diagnostic]);
  const facts = Object.entries(diagnostic.snapshot?.profile?.profile.facts ?? {});
  return <ModalSheet visible={visible} onClose={onClose} position="center" overlayZIndex={9600} cardStyle={{ width: "100%", maxWidth: 620, maxHeight: "88%", backgroundColor: colors.background, borderRadius: radius.container, padding: spacing.md, gap: spacing.sm }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Perfil da turma</Text>
      <Button label="Fechar" variant="ghost" onPress={onClose} />
    </View>
    <ClassProfileStatus diagnostic={diagnostic} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm }}>
      {!facts.length ? <Text style={{ color: colors.muted }}>Conte como a turma joga e o que precisa desenvolver.</Text> : null}
      {facts.map(([key, fact]) => <View key={key} style={{ gap: 3, paddingBottom: spacing.sm, borderBottomWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{PROFILE_LABELS[key as ProfileKey]}</Text>
        <Text style={{ color: colors.text, fontSize: 14 }}>{fact.value}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{fact.origin === "legacy" ? "Ciclo anterior" : fact.origin === "evolution" ? "Evolução confirmada" : "Informado pelo professor"} · {new Date(fact.updatedAt).toLocaleDateString("pt-BR")}</Text>
        {history ? (fact.claims ?? [fact]).map((claim, index) => <OriginalReport key={`${claim.sourceId}:${index}`} fact={claim} organizationId={organizationId} classId={classId} />) : null}
      </View>)}
      {(diagnostic.snapshot?.suggestions ?? []).filter(item => item.base_version === diagnostic.snapshot?.profile?.version).map(item => <View key={item.id} style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>Evolução recente</Text>
        <Text style={{ color: colors.text }}>{item.candidate.summary}</Text>
        {item.candidate.evidence.map(evidence => <Text key={evidence.id} style={{ color: colors.muted, fontSize: 12 }}>{evidence.date} · {evidence.text}</Text>)}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label="Confirmar evolução" disabled={diagnostic.busy || !!diagnostic.pending} onPress={() => void diagnostic.command({ action: "accept", suggestionId: item.id })} />
          <Button label="Não aplicar" variant="ghost" disabled={diagnostic.busy || !!diagnostic.pending} onPress={() => void diagnostic.command({ action: "reject", suggestionId: item.id })} />
        </View>
      </View>)}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button label="Consultar evolução" variant="ghost" disabled={diagnostic.busy || diagnostic.loading || !!diagnostic.pending} onPress={() => void diagnostic.command({ action: "evolution" })} />
        <Button label={history ? "Ocultar histórico" : "Ver histórico"} variant="ghost" onPress={() => setHistory(!history)} />
      </View>
      {history ? (diagnostic.snapshot?.revisions ?? []).map(revision => <View key={revision.id} style={{ gap: 3, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>Versão {revision.version} · {new Date(revision.created_at).toLocaleString("pt-BR")}</Text>
        {revision.changed_keys.map(key => <Text key={key} style={{ color: colors.text, fontSize: 12 }}>{PROFILE_LABELS[key]}: {revision.after_profile.facts[key]?.value ?? "Removido"}</Text>)}
        <Button label="Desfazer esta alteração" variant="ghost" disabled={diagnostic.busy || !!diagnostic.pending || revision.origin === "undo"} onPress={() => void diagnostic.command({ action: "undo", revisionId: revision.id })} />
      </View>) : null}
    </ScrollView>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Para corrigir ou remover uma informação, escreva abaixo. Relatos ficam salvos ao enviar.</Text>
    <View style={{ backgroundColor: colors.inputBg, borderRadius: radius.internal, padding: 8 }}>
      <AssistantComposer compact voiceScope={{ organizationId, classId }} value={diagnostic.input} onChangeText={diagnostic.setInput} busy={diagnostic.busy || diagnostic.loading || !!diagnostic.pending} onSend={() => void diagnostic.send()} />
    </View>
  </ModalSheet>;
}
