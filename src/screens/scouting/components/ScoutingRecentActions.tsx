import { Text, View } from "react-native";

import { formatScoutingActionTypeLabel, formatScoutingSkillLabel } from "../scouting-action-labels";
import type { ScoutingAction } from "../../../core/scouting-action";
import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { getSectionCardStyle } from "../../../ui/section-styles";

export function ScoutingRecentActions({
  actions,
  isDesktop,
  onUndo,
}: {
  actions: ScoutingAction[];
  isDesktop: boolean;
  onUndo: (id: string) => void;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[getSectionCardStyle(colors, "neutral", { radius: 18, padding: 16, shadow: false }), { gap: 10 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>Últimas ações</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Use desfazer para corrigir toques errados.</Text>
      </View>

      {!actions.length ? (
        <Text style={{ color: colors.muted, fontSize: 13 }}>Nenhuma ação registrada ainda.</Text>
      ) : (
        actions.slice(0, 8).map((action, index) => (
          <View
            key={action.id}
            style={[
              getSectionCardStyle(colors, "neutral", { radius: 14, shadow: false, padding: 12 }),
              { gap: 4 },
            ]}
          >
            <View
              style={{
                flexDirection: isDesktop ? "row" : "column",
                justifyContent: "space-between",
                alignItems: isDesktop ? "center" : "flex-start",
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {String(index + 1).padStart(2, "0")}
                </Text>
                <Text style={{ color: colors.text, fontWeight: "800" }}>{action.athleteName || "Equipe"}</Text>
                <Text style={{ color: colors.muted }}>{formatScoutingSkillLabel(action.skill)}</Text>
                <TimelineBadge
                  label={action.label || formatScoutingActionTypeLabel(action.skill, action.actionType)}
                  quality={action.quality}
                />
                {action.videoLabel ? (
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    Vídeo · {action.videoLabel}
                  </Text>
                ) : null}
                <Text style={{ color: colors.muted }}>{phaseLabel(action.gamePhase)}</Text>
              </View>
              <Pressable
                onPress={() => onUndo(action.id)}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Desfazer</Text>
              </Pressable>
            </View>
            {action.notes ? <Text style={{ color: colors.muted, fontSize: 11 }}>{action.notes}</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

function TimelineBadge({
  label,
  quality,
}: {
  label: string;
  quality: string;
}) {
  const { colors } = useAppTheme();
  const palette =
    quality === "error"
      ? { bg: colors.dangerBg, text: colors.dangerText }
      : quality === "low"
        ? { bg: colors.warningBg, text: colors.warningText }
        : quality === "medium"
          ? { bg: colors.infoBg, text: colors.infoText }
          : { bg: colors.successBg, text: colors.successText };
  return (
    <View
      style={{
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: palette.bg,
      }}
    >
      <Text style={{ color: palette.text, fontWeight: "700", fontSize: 11 }}>{label}</Text>
    </View>
  );
}

const phaseLabel = (phase?: string) =>
  ({
    serve: "Saque",
    sideout: "Side-out",
    transition: "Transição",
    freeball: "Freeball",
    out_of_system: "Pressão",
  } as Record<string, string>)[phase ?? ""] ?? "Sem fase";
