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

export function SessionContextHeader({
  colors,
  environment,
  weeklyPhysicalEmphasis,
  courtGymRelationship,
  transferTarget,
}: Props) {
  const emphasisLabel = weeklyPhysicalEmphasis
    ? weeklyPhysicalEmphasisLabelMap[weeklyPhysicalEmphasis]
    : "Não definido";
  const relationshipLabel = courtGymRelationship
    ? courtGymRelationshipLabelMap[courtGymRelationship]
    : "Não definida";
  const normalizedTransferTarget = String(transferTarget ?? "").trim() || "Não definida";

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.secondaryBg,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 10,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
        Contexto integrado da sessão
      </Text>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Ambiente</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          {environmentLabelMap[environment]}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Foco físico</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          {emphasisLabel}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Relação com a semana</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          {relationshipLabel}
        </Text>
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Transferência</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
          {normalizedTransferTarget}
        </Text>
      </View>
    </View>
  );
}
