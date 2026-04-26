import { Text, View } from "react-native";

import type {
  CourtGymRelationship,
  SessionEnvironment,
  WeeklyPhysicalEmphasis,
} from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  colors: ThemeColors;
  environment: SessionEnvironment;
  weeklyPhysicalEmphasis?: WeeklyPhysicalEmphasis;
  courtGymRelationship?: CourtGymRelationship;
  transferTarget?: string;
  durationMin?: number;
};

const environmentLabelMap: Record<SessionEnvironment, string> = {
  quadra: "Quadra",
  academia: "Academia",
  mista: "Mista",
  preventiva: "Preventiva",
};

const weeklyPhysicalEmphasisLabelMap: Record<WeeklyPhysicalEmphasis, string> = {
  forca_base: "Força base",
  potencia_atletica: "Potência atlética",
  resistencia_especifica: "Resistência específica",
  velocidade_reatividade: "Velocidade e reatividade",
  prevencao_recuperacao: "Prevenção e recuperação",
  manutencao: "Manutenção",
};

const courtGymRelationshipLabelMap: Record<CourtGymRelationship, string> = {
  quadra_dominante: "Quadra dominante",
  complementar_equilibrado: "Academia complementa a quadra",
  academia_prioritaria: "Academia com prioridade na semana",
  separado_sem_transferencia: "Academia e quadra sem ponte explícita",
  integrado_transferencia_direta: "Academia sustenta a quadra",
};

const resolveExpectedLoadLabel = (params: {
  environment: SessionEnvironment;
  weeklyPhysicalEmphasis?: WeeklyPhysicalEmphasis;
  courtGymRelationship?: CourtGymRelationship;
}) => {
  if (params.courtGymRelationship === "academia_prioritaria") return "Alta";
  if (
    params.weeklyPhysicalEmphasis === "prevencao_recuperacao" ||
    params.weeklyPhysicalEmphasis === "manutencao" ||
    params.environment === "preventiva"
  ) {
    return "Leve";
  }
  if (params.environment === "mista" || params.courtGymRelationship === "quadra_dominante") {
    return "Moderada";
  }
  return "Moderada";
};

const buildWeeklyFunctionLabel = (params: {
  courtGymRelationship?: CourtGymRelationship;
  transferTarget: string;
}) => {
  const transferTarget = params.transferTarget || "ações da quadra";

  switch (params.courtGymRelationship) {
    case "integrado_transferencia_direta":
      return `Sustentar ${transferTarget}`;
    case "academia_prioritaria":
      return `Desenvolver ${transferTarget} como prioridade física`;
    case "complementar_equilibrado":
      return `Complementar a quadra com foco em ${transferTarget}`;
    case "quadra_dominante":
      return `Apoiar a quadra com foco em ${transferTarget}`;
    case "separado_sem_transferencia":
      return "Sustentar a semana física sem ponte explícita";
    default:
      return `Sustentar ${transferTarget}`;
  }
};

const MetaItem = ({
  colors,
  label,
  value,
}: {
  colors: ThemeColors;
  label: string;
  value: string;
}) => (
  <View
    style={{
      flex: 1,
      minWidth: 130,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    }}
  >
    <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
    <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{value}</Text>
  </View>
);

export function SessionContextHeader({
  colors,
  environment,
  weeklyPhysicalEmphasis,
  courtGymRelationship,
  transferTarget,
  durationMin,
}: Props) {
  const emphasisLabel = weeklyPhysicalEmphasis
    ? weeklyPhysicalEmphasisLabelMap[weeklyPhysicalEmphasis]
    : "Não definido";
  const relationshipLabel = courtGymRelationship
    ? courtGymRelationshipLabelMap[courtGymRelationship]
    : "Não definida";
  const normalizedTransferTarget = String(transferTarget ?? "").trim() || "Não definida";
  const sessionTitle =
    environment === "academia"
      ? `Academia — ${emphasisLabel}`
      : environment === "mista"
        ? `Sessão mista — ${emphasisLabel}`
        : `${environmentLabelMap[environment]} — ${emphasisLabel}`;
  const weeklyFunctionLabel = buildWeeklyFunctionLabel({
    courtGymRelationship,
    transferTarget: normalizedTransferTarget === "Não definida" ? "ações da quadra" : normalizedTransferTarget,
  });
  const expectedLoadLabel = resolveExpectedLoadLabel({
    environment,
    weeklyPhysicalEmphasis,
    courtGymRelationship,
  });
  const durationLabel =
    typeof durationMin === "number" && durationMin > 0 ? `${durationMin} min` : "Não definida";

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
          {sessionTitle}
        </Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          Função na semana: {weeklyFunctionLabel}
        </Text>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <MetaItem colors={colors} label="Ambiente" value={environmentLabelMap[environment]} />
        <MetaItem colors={colors} label="Carga esperada" value={expectedLoadLabel} />
        <MetaItem colors={colors} label="Duração" value={durationLabel} />
        <MetaItem colors={colors} label="Relação com a semana" value={relationshipLabel} />
      </View>

      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Transferência para a quadra</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
          {normalizedTransferTarget}
        </Text>
      </View>

      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Foco físico</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          {emphasisLabel}
        </Text>
      </View>

      <Text style={{ color: colors.muted, fontSize: 11 }}>
        Contexto integrado da sessão
      </Text>
    </View>
  );
}
