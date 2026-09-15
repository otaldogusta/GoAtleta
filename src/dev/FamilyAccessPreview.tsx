import { useState } from "react";
import { InstitutionPlanPicker } from "../access/components/InstitutionPlanPicker";
import { getPreviewInstitutionAccessPlans } from "../access/institution-access-plans";
import { ScrollView, Text, View } from "react-native";
import { FamilyAccessIntentFields } from "../screens/family/FamilyAccessIntentFields";
import { FamilyInviteIdentitySummary } from "../screens/family/FamilyInviteIdentitySummary";
import { GuardianAthleteInviteView } from "../screens/family/GuardianAthleteInvite";
import { AthleteAccessRequestView } from "../screens/coordination/AthleteAccessRequestRow";
import { Button } from "../ui/Button";
import { AnimatedFieldDetails } from "../ui/AnimatedFieldDetails";
import { PositionPicker } from "../ui/PositionPicker";
import { useAppTheme } from "../ui/app-theme";
import { spacing, radius } from "../theme/tokens";
import type { FamilyAccessIntent } from "../api/family-access-request";
import type { OrganizationAccessRequest } from "../api/organization-access-requests";

const request: OrganizationAccessRequest = {
  id: "fixture", organizationId: "fixture", requesterUserId: "fixture", requesterName: "Mariana Ribeiro",
  requesterEmail: "mariana@example.com", requestKind: "guardian", requestedStudentName: "Lucas Ribeiro",
  requestedRelationshipLabel: "Mãe", status: "pending", requestedAt: "2026-09-14", reviewedAt: null,
  reviewedBy: null, reviewRoleLevel: null, requestedProduct: "goatleta", paymentStatus: "not_started",
};

export function FamilyAccessPreview() {
  const { colors, mode, toggleMode } = useAppTheme();
  const [step, setStep] = useState("Entrada");
  const [kind, setKind] = useState<FamilyAccessIntent | null>("guardian");
  const [name, setName] = useState("Lucas Ribeiro");
  const [label, setLabel] = useState("Mãe");
  const [ids, setIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState("lucas@example.com");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [child, setChild] = useState("Lucas Ribeiro");
  const [organizationIds, setOrganizationIds] = useState<string[]>([]);
  const [requested, setRequested] = useState(false);
  const [entryPath, setEntryPath] = useState<"existing" | "enroll" | null>(null);
  const [planName, setPlanName] = useState("");
  const institutionName = "Rede Esportes Pinhais";
  return <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: "center" }}>
    <View style={{ width: "100%", maxWidth: step === "Coordenação" ? 940 : 440, alignSelf: "center", gap: spacing.md }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>PRÉVIA LOCAL · DADOS FICTÍCIOS · SEM GRAVAÇÃO</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {["Entrada", "Coordenação", "Responsável", "Atleta"].map((item) => <Button key={item} label={item} variant={item === step ? "primary" : "outline"} onPress={() => { setStep(item); setError(""); }} />)}
        <Button label={mode === "dark" ? "Tema claro" : "Tema escuro"} variant="ghost" onPress={toggleMode} />
      </View>
      <AnimatedFieldDetails key={`${step}:${entryPath}:${requested}`} open animateOnMount>
      <View style={{ borderRadius: radius.container, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: "visible" }}>
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {!(step === "Entrada" && organizationIds.length && entryPath === "enroll" && !requested) ? <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800" }}>{step === "Entrada" ? requested ? entryPath === "enroll" ? "Inscrição simulada" : "Solicitação enviada" : "Encontre sua instituição" : step === "Coordenação" ? "Acessos pendentes" : step === "Atleta" ? "Convite do Go Atleta" : "Meus vínculos"}</Text> : null}
          {step === "Entrada" && requested ? <>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{institutionName}</Text>
            <Text style={{ color: colors.muted }}>{entryPath === "enroll" ? `Inscrição demonstrativa · ${planName}` : "Aguardando aprovação"}</Text>
            <Button label="Voltar à pesquisa" variant="ghost" onPress={() => { setRequested(false); setOrganizationIds([]); setEntryPath(null); }} />
          </> : step === "Entrada" && organizationIds.length && entryPath === "enroll" ? <>
            <InstitutionPlanPicker institutionName={institutionName} athleteName={name} plans={getPreviewInstitutionAccessPlans(institutionName)}
              contentHeight={580} busy={false} onBack={() => setEntryPath(null)} onSubmit={(plan) => { setPlanName(plan.name); setRequested(true); }} />
          </> : step === "Entrada" ? <>
            <FamilyAccessIntentFields kind={kind} studentName={name} relationshipLabel={label} onKind={setKind} onStudentName={setName} onRelationshipLabel={setLabel} />
            <PositionPicker value={organizationIds} onChange={setOrganizationIds} maxSelections={1} searchLabel="Buscar instituição"
              options={[{ value: "example", label: institutionName }]} />
            {organizationIds.length ? <>
              <Button label="Quero me inscrever" disabled={!kind || !name.trim() || (kind === "guardian" && !label.trim())} onPress={() => { setEntryPath("enroll"); setError(""); }} />
              <Button label="Já tenho cadastro · solicitar acesso" variant="outline" disabled={!kind || !name.trim() || (kind === "guardian" && !label.trim())} onPress={() => { setEntryPath("existing"); setRequested(true); setError(""); }} />
            </> : null}
            <Button label="Recebeu um convite?" variant="ghost" onPress={() => setError("O link abre a confirmação de identidade do destinatário.")} />
          </> : step === "Responsável" ? <>
            <View style={{ flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" }}>
              {["Lucas Ribeiro", "Lia Ribeiro"].map((value) => <Button key={value} label={value} variant={value === child ? "primary" : "outline"} onPress={() => { setChild(value); setUrl(""); }} />)}
            </View>
            <Text style={{ color: colors.text }}>{child}</Text>
            <Text style={{ color: colors.muted }}>Instituto Exemplo · Responsável</Text>
            <GuardianAthleteInviteView state={{ email, url, busy: false, error: "", copied: false, changeEmail: setEmail,
              create: async () => { setUrl("fixture-only"); }, copy: async () => { setError("Prévia: nenhum convite real foi copiado."); } }} />
          </> : step === "Atleta" ? <>
            <FamilyInviteIdentitySummary organizationName="Instituto Exemplo" studentName="Lucas Ribeiro" relationship="Atleta" />
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <Text style={{ color: colors.muted }}>Conta que receberá o acesso</Text>
            <Text style={{ color: colors.text }}>lucas@example.com</Text>
            <Button label="Aceitar convite" onPress={() => setError("Prévia: aceitação autenticada ainda não validada no ambiente local completo.")} />
          </> : <Text style={{ color: colors.muted }}>Atletas e responsáveis · 1</Text>}
        </View>
        {step === "Coordenação" ? <AthleteAccessRequestView request={request} createKey={() => "fixture"}
          state={{ candidates: loaded ? [{ id: "lucas", name: "Lucas Ribeiro", class_name: "Vôlei", class_days: [1, 3], class_start_time: "14:00" }] : null,
            studentIds: ids, setStudentIds: setIds, busy: false, action: null, error,
            load: async () => { setLoaded(true); }, review: async () => { setError("Prévia: nenhuma solicitação real foi alterada."); } }} /> : null}
      </View>
      </AnimatedFieldDetails>
      {error && step !== "Coordenação" ? <Text accessibilityRole="alert" style={{ color: colors.muted }}>{error}</Text> : null}
    </View>
  </ScrollView>;
}
