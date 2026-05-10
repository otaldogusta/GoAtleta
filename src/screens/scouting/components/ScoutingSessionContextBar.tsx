import { Text, View } from "react-native";

import type { ScoutingSession } from "../../../core/scouting-session";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

const typeLabelMap: Record<ScoutingSession["type"], string> = {
  training: "Treino",
  friendly: "Amistoso",
  official_match: "Jogo oficial",
};

const statusLabelMap: Record<ScoutingSession["status"], string> = {
  draft: "Rascunho",
  in_progress: "Em andamento",
  completed: "Concluído",
  archived: "Arquivado",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));

export function ScoutingSessionContextBar({
  athletesCount,
  session,
  totalActions,
}: {
  athletesCount: number;
  session: ScoutingSession;
  totalActions: number;
}) {
  const { colors } = useAppTheme();

  const items = [
    { label: "Data", value: formatDate(session.date) },
    { label: "Tipo", value: typeLabelMap[session.type] },
    { label: "Status", value: statusLabelMap[session.status] },
    { label: "Atletas", value: `${athletesCount} avaliadas` },
    { label: "Ações", value: String(totalActions) },
  ];

  return (
    <View
      style={[
        getSectionCardStyle(colors, "neutral", { radius: 18, shadow: false }),
        { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 10, paddingHorizontal: 14 },
      ]}
    >
      {items.map((item) => (
        <View key={item.label} style={{ minWidth: 88, flexGrow: 1, gap: 2 }}>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{item.label}</Text>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}
