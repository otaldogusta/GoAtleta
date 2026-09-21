import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import type {
  ClassStaffSubstitution,
  ClassStaffTenure,
  ClassTransitionSummary,
} from "../../../api/class-staff-history";
import type { OrgMember } from "../../../api/members";
import { useAppTheme } from "../../../ui/app-theme";
import { DateInput } from "../../../ui/DateInput";
import { GoAtletaIcon } from "../../../ui/icon-registry";

type Props = {
  loading: boolean;
  tenures: ClassStaffTenure[];
  substitutions: ClassStaffSubstitution[];
  summaries: ClassTransitionSummary[];
  candidates: OrgMember[];
  onSchedule: (input: {
    absentTenureId: string;
    replacementUserId: string;
    startsOn: string;
    endsOn: string;
    reason: string;
    notes: string;
  }) => Promise<void>;
  onReturn: (substitutionId: string) => Promise<void>;
  onCancel: (substitutionId: string, reason: string) => Promise<void>;
  onReviseSummary: (summaryId: string, revisedSummary: string, reason: string) => Promise<void>;
  onCorrectDates: (tenureId: string, startsOn: string, endsOn: string | null, reason: string) => Promise<void>;
};

const formatDate = (value: string | null) => {
  if (!value) return "atual";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const roleLabel = (role: ClassStaffTenure["staffRole"]) =>
  role === "head" ? "Responsável" : role === "assistant" ? "Auxiliar" : "Estagiário(a)";

export function ClassStaffHistoryPanel({
  loading,
  tenures,
  substitutions,
  summaries,
  candidates,
  onSchedule,
  onReturn,
  onCancel,
  onReviseSummary,
  onCorrectDates,
}: Props) {
  const { colors } = useAppTheme();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [absentTenureId, setAbsentTenureId] = useState("");
  const [replacementUserId, setReplacementUserId] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [summaryReason, setSummaryReason] = useState("");
  const [correctingTenureId, setCorrectingTenureId] = useState<string | null>(null);
  const [correctedStart, setCorrectedStart] = useState("");
  const [correctedEnd, setCorrectedEnd] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");

  const activeTenures = useMemo(
    () => tenures.filter((tenure) => !tenure.endsOn && tenure.status !== "cancelled"),
    [tenures]
  );
  const activeSubstitutions = useMemo(
    () => substitutions.filter((item) => item.status === "active" || item.status === "scheduled"),
    [substitutions]
  );

  const submit = async () => {
    if (!absentTenureId || !replacementUserId || !startsOn || !endsOn || reason.trim().length < 3) {
      setError("Escolha titular, substituto, período e motivo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSchedule({ absentTenureId, replacementUserId, startsOn, endsOn, reason, notes });
      setShowForm(false);
      setReplacementUserId("");
      setEndsOn("");
      setReason("");
      setNotes("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível programar a substituição.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 18, gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={{ minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Histórico da equipe</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {activeSubstitutions.length ? `${activeSubstitutions.length} substituição(ões) em andamento ou agendada(s)` : "Vínculos, substituições e transições auditáveis"}
          </Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primaryBg} /> : <GoAtletaIcon name={expanded ? "chevronUp" : "chevronDown"} size={18} color={colors.muted} />}
      </Pressable>

      {expanded ? (
        <View style={{ gap: 12 }}>
          {activeSubstitutions.map((substitution) => (
            <View key={substitution.id} style={{ padding: 12, borderRadius: 12, backgroundColor: colors.warningBg, borderWidth: 1, borderColor: colors.warningBorder, gap: 6 }}>
              <Text style={{ color: colors.warningText, fontSize: 13, fontWeight: "800" }}>
                {substitution.status === "scheduled" ? "Substituição agendada" : "Substituição ativa"}
              </Text>
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {substitution.replacementName} · {formatDate(substitution.startsOn)} a {formatDate(substitution.endsOn)}
              </Text>
              {substitution.reason ? <Text style={{ color: colors.muted, fontSize: 12 }}>{substitution.reason}</Text> : null}
              {substitution.status === "active" ? (
                <Pressable accessibilityRole="button" onPress={() => void onReturn(substitution.id)} style={{ alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Registrar retorno</Text>
                </Pressable>
              ) : null}
              {substitution.status === "scheduled" ? (
                <Pressable accessibilityRole="button" onPress={() => void onCancel(substitution.id, "Cancelada pela coordenação")} style={{ alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.dangerText, fontSize: 12, fontWeight: "700" }}>Cancelar substituição</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          {activeTenures.map((tenure) => (
            <View key={tenure.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{tenure.displayName}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {roleLabel(tenure.staffRole)}{tenure.status === "away" ? " · Afastado" : ""} · desde {formatDate(tenure.startsOn)}{tenure.datePrecision === "estimated" ? " (estimado)" : ""}
                </Text>
              </View>
            </View>
          ))}

          {!showForm ? (
            <Pressable accessibilityRole="button" onPress={() => { setAbsentTenureId(activeTenures.find((item) => item.staffRole === "head")?.id ?? activeTenures[0]?.id ?? ""); setShowForm(true); }} style={{ minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Programar substituição</Text>
            </Pressable>
          ) : (
            <View style={{ gap: 10, paddingTop: 4 }}>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Nova substituição</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Titular afastado</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {activeTenures.map((tenure) => (
                  <Pressable key={tenure.id} onPress={() => setAbsentTenureId(tenure.id)} style={{ paddingVertical: 7, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: absentTenureId === tenure.id ? colors.primaryBg : colors.border, backgroundColor: absentTenureId === tenure.id ? colors.card : colors.inputBg }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{tenure.displayName}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Substituto</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {candidates.filter((candidate) => !activeTenures.some((tenure) => tenure.userId === candidate.userId)).map((candidate) => (
                  <Pressable key={candidate.userId} onPress={() => setReplacementUserId(candidate.userId)} style={{ paddingVertical: 7, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: replacementUserId === candidate.userId ? colors.primaryBg : colors.border, backgroundColor: replacementUserId === candidate.userId ? colors.card : colors.inputBg }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{candidate.displayName}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><DateInput accessibilityLabel="Início da substituição" value={startsOn} onChange={setStartsOn} placeholder="DD/MM/AAAA" /></View>
                <View style={{ flex: 1 }}><DateInput accessibilityLabel="Fim da substituição" value={endsOn} onChange={setEndsOn} placeholder="DD/MM/AAAA" /></View>
              </View>
              <TextInput accessibilityLabel="Motivo da substituição" value={reason} onChangeText={(value) => { setReason(value); setError(""); }} placeholder="Motivo" placeholderTextColor={colors.muted} style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }} />
              <TextInput accessibilityLabel="Observação da substituição" value={notes} onChangeText={setNotes} placeholder="Observação (opcional)" placeholderTextColor={colors.muted} style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }} />
              {error ? <Text style={{ color: colors.dangerText, fontSize: 12 }}>{error}</Text> : null}
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 8 }}>
                <Pressable onPress={() => setShowForm(false)} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 12 }}><Text style={{ color: colors.muted, fontWeight: "700" }}>Cancelar</Text></Pressable>
                <Pressable disabled={saving} onPress={() => void submit()} style={{ minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderRadius: 10, backgroundColor: colors.primaryBg, opacity: saving ? 0.55 : 1 }}><Text style={{ color: colors.primaryText, fontWeight: "800" }}>{saving ? "Salvando..." : "Programar"}</Text></Pressable>
              </View>
            </View>
          )}

          {summaries.slice(0, 3).map((summary) => (
            <View key={summary.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, gap: 6 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>Resumo de transição</Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{summary.currentSummary}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{summary.evidenceCount} evidência(s) autoral(is) · confiança {Math.round(summary.confidence * 100)}%</Text>
              {editingSummaryId === summary.id ? (
                <View style={{ gap: 8 }}>
                  <TextInput multiline value={summaryDraft} onChangeText={setSummaryDraft} accessibilityLabel="Texto corrigido do resumo" style={{ minHeight: 90, borderRadius: 12, padding: 12, color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border, textAlignVertical: "top" }} />
                  <TextInput value={summaryReason} onChangeText={setSummaryReason} accessibilityLabel="Motivo da correção do resumo" placeholder="Motivo da correção" placeholderTextColor={colors.muted} style={{ minHeight: 48, borderRadius: 12, paddingHorizontal: 14, color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }} />
                  <Pressable onPress={() => void onReviseSummary(summary.id, summaryDraft, summaryReason).then(() => setEditingSummaryId(null))} style={{ alignSelf: "flex-end", minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.primaryBg }}><Text style={{ color: colors.primaryText, fontWeight: "800" }}>Salvar revisão</Text></Pressable>
                </View>
              ) : (
                <Pressable onPress={() => { setEditingSummaryId(summary.id); setSummaryDraft(summary.currentSummary); setSummaryReason(""); }} style={{ alignSelf: "flex-start", paddingVertical: 5 }}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textDecorationLine: "underline" }}>Corrigir resumo</Text></Pressable>
              )}
            </View>
          ))}

          {tenures.filter((tenure) => tenure.endsOn).slice(0, 8).map((tenure) => (
            <View key={tenure.id} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{tenure.displayName} · {roleLabel(tenure.staffRole)}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{formatDate(tenure.startsOn)} a {formatDate(tenure.endsOn)}</Text>
              {tenure.datePrecision === "estimated" && correctingTenureId !== tenure.id ? (
                <Pressable onPress={() => { setCorrectingTenureId(tenure.id); setCorrectedStart(tenure.startsOn); setCorrectedEnd(tenure.endsOn ?? ""); setCorrectionReason(""); }} style={{ alignSelf: "flex-start", paddingVertical: 5 }}><Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>Corrigir período estimado</Text></Pressable>
              ) : null}
              {correctingTenureId === tenure.id ? (
                <View style={{ gap: 8, marginTop: 8 }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}><DateInput accessibilityLabel="Início corrigido" value={correctedStart} onChange={setCorrectedStart} placeholder="DD/MM/AAAA" /></View>
                    <View style={{ flex: 1 }}><DateInput accessibilityLabel="Fim corrigido" value={correctedEnd} onChange={setCorrectedEnd} placeholder="DD/MM/AAAA" /></View>
                  </View>
                  <TextInput value={correctionReason} onChangeText={setCorrectionReason} placeholder="Motivo da correção" placeholderTextColor={colors.muted} style={{ minHeight: 44, borderRadius: 10, paddingHorizontal: 12, color: colors.text, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }} />
                  <Pressable onPress={() => void onCorrectDates(tenure.id, correctedStart, correctedEnd || null, correctionReason).then(() => setCorrectingTenureId(null))} style={{ alignSelf: "flex-end", minHeight: 38, justifyContent: "center", paddingHorizontal: 11, borderRadius: 9, backgroundColor: colors.primaryBg }}><Text style={{ color: colors.primaryText, fontSize: 12, fontWeight: "800" }}>Salvar datas</Text></Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
