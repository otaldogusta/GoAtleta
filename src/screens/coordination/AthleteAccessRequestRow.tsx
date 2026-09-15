import { useState } from "react";
import { familyCandidateSchedule } from "../../core/family-candidate-schedule";
import { Text, View } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { ModalSheet } from "../../ui/ModalSheet";
import type { OrganizationAccessRequest } from "../../api/organization-access-requests";
import { Button } from "../../ui/Button";
import { PositionPicker } from "../../ui/PositionPicker";
import { useAppTheme } from "../../ui/app-theme";
import { useAthleteAccessReview } from "./useAthleteAccessReview";
import { spacing, radius } from "../../theme/tokens";
import { suggestFamilyAthlete } from "../../core/family-access-suggestion";

export function AthleteAccessRequestRow({ request, onRefresh, createKey }: {
  request: OrganizationAccessRequest; onRefresh: () => void | Promise<void>; createKey: () => string;
}) {
  const state = useAthleteAccessReview(request.id, onRefresh);
  return <AthleteAccessRequestView request={request} state={state} createKey={createKey} />;
}

export function AthleteAccessRequestView({ request, state, createKey }: {
  request: OrganizationAccessRequest; state: ReturnType<typeof useAthleteAccessReview>; createKey: () => string;
}) {
  const { colors } = useAppTheme();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);
  const [draftStudentIds, setDraftStudentIds] = useState<string[]>([]);
  const suggestion = dismissedSuggestion ? null : suggestFamilyAthlete(request.requestedStudentName, state.candidates ?? []);
  const identity = (large = false) => <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
      <Text numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={request.requesterName} style={{ flexShrink: 1, minWidth: 0, color: colors.text, fontWeight: "700", fontSize: large ? 18 : 14 }}>{request.requesterName}</Text>
      <View style={{ flexShrink: 0, borderRadius: radius.internal, paddingHorizontal: spacing.xs, paddingVertical: 3, backgroundColor: colors.successBg }}>
        <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "600" }}>{request.requestKind === "guardian" ? "Responsável" : "Atleta"}</Text>
      </View>
    </View>
    <Text numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={request.requesterEmail} style={{ color: colors.muted, fontSize: 12 }}>{request.requesterEmail}</Text>
  </View>;
  const openDetails = () => { setDetailsOpen(true); if (state.candidates === null && !state.busy) void state.load(); };
  const selectedDraft = state.candidates?.find(candidate => candidate.id === draftStudentIds[0]);
  return <View style={{ padding: spacing.md, gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border }}>
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Conferir vínculo de ${request.requesterName}`} onPress={openDetails} style={{ flexDirection: "row", gap: spacing.sm, flexGrow: 1, flexBasis: 240, minWidth: 0, padding: spacing.xs, borderRadius: radius.internal }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.successText, fontWeight: "800" }}>{request.requesterName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        {identity()}
        {request.requestedStudentName ? <Text style={{ color: colors.muted, fontSize: 12 }}>Atleta: {request.requestedStudentName}{request.requestedRelationshipLabel ? ` · ${request.requestedRelationshipLabel}` : ""}</Text> : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        <Button label="Recusar" variant="danger" disabled={state.busy} loading={state.action === "rejected"}
          loadingLabel="Recusando…" onPress={() => void state.review("rejected", createKey)} />
        <Button label="Aprovar vínculo" disabled={!state.studentIds.length || state.busy} loading={state.action === "approved"}
          loadingLabel="Aprovando…" onPress={() => void state.review("approved", createKey)} />
      </View>
    </View>
    <ModalSheet visible={detailsOpen} onClose={() => setDetailsOpen(false)} position="center" cardStyle={{ width: "100%", maxWidth: 440, padding: spacing.md, gap: spacing.md, backgroundColor: colors.card, borderRadius: radius.container }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
        {identity(true)}
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhes do vínculo" onPress={() => setDetailsOpen(false)} style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.muted, fontSize: 24 }}>×</Text></Pressable>
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, gap: spacing.xs }}>
        <Text style={{ color: colors.text, lineHeight: 21 }}>{request.requestKind === "guardian"
          ? `Solicita acompanhar ${request.requestedStudentName || "um atleta"}${request.requestedRelationshipLabel ? ` como ${request.requestedRelationshipLabel.toLocaleLowerCase("pt-BR")}` : ""}.`
          : `Solicita acesso ao próprio cadastro${request.requestedStudentName ? `: ${request.requestedStudentName}` : ""}.`}</Text>
      </View>
      {!suggestion ? <Text style={{ color: colors.text, fontWeight: "600" }}>Qual cadastro corresponde a esse atleta?</Text> : null}
    {state.candidates !== null ? <>
      {suggestion ? <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
            <Text numberOfLines={1} ellipsizeMode="tail" accessibilityLabel={suggestion.name} style={{ color: colors.text, fontWeight: "700" }}>{suggestion.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{familyCandidateSchedule(suggestion)}</Text>
          </View>
          <Button label="Não corresponde" variant="ghost" disabled={state.busy} onPress={() => { setDismissedSuggestion(true); setDraftStudentIds([]); state.setStudentIds([]); }} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{request.requestKind === "guardian" ? "Sugestão pelo nome · vínculo familiar a confirmar." : "Sugestão pelo nome · identidade a confirmar."}</Text>
      </View> : state.candidates.length ? <View pointerEvents={state.busy ? "none" : "auto"}>
        <PositionPicker value={draftStudentIds} onChange={setDraftStudentIds} maxSelections={1}
          searchLabel="Selecionar atleta da instituição"
          options={state.candidates.map((student) => ({ value: student.id, label: `${student.name} · ${familyCandidateSchedule(student)}` }))} />
      </View> : <Text style={{ color: colors.muted }}>Nenhum cadastro disponível. Cadastre o atleta na instituição e atualize esta lista.</Text>}
    </> : null}
      {state.action === "loading" ? <Text style={{ color: colors.muted }}>Buscando cadastros…</Text> : null}
      {state.error ? <><Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{state.error}</Text><Button label="Tentar novamente" variant="ghost" disabled={state.busy} onPress={() => void state.load()} /></> : null}
      <Button label="Usar este cadastro" disabled={(!suggestion && !selectedDraft) || state.busy} onPress={() => { const candidate = suggestion ?? selectedDraft; if (!candidate) return; state.setStudentIds([candidate.id]); setDetailsOpen(false); }} />
    </ModalSheet>
    {state.error && !detailsOpen ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{state.error}</Text> : null}
  </View>;
}
