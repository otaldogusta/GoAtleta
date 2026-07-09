import { ScrollView, Text, useWindowDimensions, View } from "react-native";

import type { RecentSessionSummary } from "../../core/models";
import { buildRedeEsperancaJulyAlignment } from "../../core/pedagogy/rede-esperanca-july-2026-alignment";
import type { ThemeColors } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { Pressable } from "../../ui/Pressable";
import { getSectionCardStyle } from "../../ui/section-styles";

type Props = {
  colors: ThemeColors;
  recentSessions: RecentSessionSummary[];
  onReviewEvolution: () => void;
};

const formatSessionDate = (iso: string) => {
  const date = new Date(`${iso}T12:00:00`);
  const weekday = date
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "")
    .replace(/^./, (value) => value.toUpperCase());
  return `${weekday} · ${iso.slice(8, 10)}/${iso.slice(5, 7)} · 14:00`;
};

const stateLabel = {
  completed: "Realizado",
  adapted: "Plano adaptado pela IA",
  gate: "Plano adaptado pela IA",
  conditional: "Plano adaptado pela IA",
  upcoming: "Próximo",
} as const;

export function PeriodizationIntelligenceOverview({ colors, recentSessions, onReviewEvolution }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 900;
  const alignment = buildRedeEsperancaJulyAlignment(recentSessions);
  const visibleSessions = alignment.sessions.slice(0, 6);
  const completedSessions = visibleSessions.filter((session) => session.state === "completed");

  return (
    <View style={{ gap: 14 }}>
      <View style={getSectionCardStyle(colors, "neutral", { padding: 14, radius: 18 })}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
            {alignment.monthLabel}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <GoAtletaIcon name="checkmarkCircle" size={14} color={colors.successText} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>Realizado</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <GoAtletaIcon name="circle" size={10} color={colors.secondaryText} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>Próximo</Text>
            </View>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 9, paddingTop: 12, paddingBottom: 2 }}
        >
          {visibleSessions.map((session, index) => {
            const completed = session.state === "completed";
            const isGate = session.state === "gate";
            const conditional = session.state === "conditional";
            const accent = completed
              ? colors.successText
              : isGate
                ? colors.warningText
                : colors.primaryText;
            return (
              <View key={session.date} style={{ width: compact ? 242 : 158, gap: 7 }}>
                <View style={{ flexDirection: "row", alignItems: "center", minHeight: 28 }}>
                  <View
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: completed ? colors.successBg : colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: accent,
                    }}
                  >
                    <GoAtletaIcon
                      name={completed ? "checkmark" : isGate ? "lock" : "circle"}
                      size={completed ? 15 : 11}
                      color={accent}
                    />
                  </View>
                  {index < visibleSessions.length - 1 ? (
                    <View style={{ flex: 1, height: 2, backgroundColor: completed ? colors.successText : colors.border }} />
                  ) : null}
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{formatSessionDate(session.date)}</Text>
                <View
                  style={[
                    getSectionCardStyle(colors, "neutral", { padding: 10, radius: 14, shadow: false }),
                    { minHeight: 174, borderColor: isGate ? colors.warningText : colors.border },
                  ]}
                >
                  <Text style={{ color: accent, fontSize: 11, fontWeight: "700" }}>
                    {stateLabel[session.state]}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800", marginTop: 6 }}>
                    {session.plannedTitle}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 }}>
                    {session.plannedFocus}
                  </Text>

                  {typeof session.participantsCount === "number" ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                      <Text style={{ color: colors.successText, fontSize: 11, fontWeight: "700" }}>Realizado</Text>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 3 }}>
                        {session.participantsCount} participantes
                      </Text>
                      {typeof session.completedSequenceCount === "number" ? (
                        <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                          {session.completedSequenceCount} concluíram a sequência esperada
                        </Text>
                      ) : null}
                      {session.observation ? (
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 9 }}>
                          <GoAtletaIcon name="warning" size={13} color={colors.dangerText} />
                          <Text style={{ color: colors.muted, fontSize: 9, lineHeight: 13, flex: 1 }} numberOfLines={3}>
                            {session.observation}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {session.adjustments?.length ? (
                    <View style={{ marginTop: 12, gap: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Ajustes</Text>
                      {session.adjustments.map((adjustment) => (
                        <Text key={adjustment} style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                          · {adjustment}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  {conditional ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
                      <GoAtletaIcon name="info" size={14} color={colors.infoText} />
                      <Text style={{ color: colors.muted, fontSize: 10, flex: 1 }}>
                        Liberado apenas após o portão de prontidão.
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flexDirection: compact ? "column" : "row", gap: 14, alignItems: "stretch" }}>
        <View style={[getSectionCardStyle(colors, "info", { padding: 16, radius: 18 }), { flex: 0.9, gap: 12 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <GoAtletaIcon name="sparkles" size={19} color={colors.successText} />
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
              A IA está aprendendo com a sua turma
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            Usou {alignment.evidenceCount} relatórios recentes. Dados de participação, execução e comportamento estão sendo considerados.
          </Text>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.secondaryBg }}>
              <GoAtletaIcon name="members" size={18} color={colors.secondaryText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Participação</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                  {alignment.attendanceSequence.join(" → ")} participantes
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, backgroundColor: colors.secondaryBg }}>
              <GoAtletaIcon name="warningCircle" size={18} color={colors.warningText} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Comportamento</Text>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                  {alignment.attentionSummary}
                </Text>
              </View>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Revisar evolução da turma"
            onPress={onReviewEvolution}
            style={{
              marginTop: "auto",
              minHeight: 48,
              borderRadius: 16,
              backgroundColor: colors.primaryBg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              paddingHorizontal: 16,
            }}
          >
            <GoAtletaIcon name="sparkles" size={17} color={colors.primaryText} />
            <Text style={{ color: colors.primaryText, fontWeight: "800", fontSize: 14 }}>
              Revisar evolução da turma
            </Text>
            <GoAtletaIcon name="chevronForward" size={16} color={colors.primaryText} />
          </Pressable>
        </View>

        <View style={[getSectionCardStyle(colors, "neutral", { padding: 16, radius: 18 }), { flex: 1.15, gap: 14 }]}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Mapa de progressão pedagógica</Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: compact ? "wrap" : "nowrap" }}>
            {[
              { icon: "personSolid" as const, label: "1x1", detail: "Recepção direta sem segurar a bola", color: colors.successText },
              { icon: "lock" as const, label: "Portão de prontidão", detail: "Critérios técnicos e comportamentais", color: colors.warningText },
              { icon: "members" as const, label: "2x2", detail: "Mini jogo com decisão e cooperação", color: colors.successText },
            ].map((step, index) => (
              <View key={step.label} style={{ flexDirection: "row", alignItems: "center", flex: compact ? undefined : 1, minWidth: compact ? "100%" : 0 }}>
                <View style={{ flex: 1, alignItems: "center", gap: 7 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: step.color, backgroundColor: colors.secondaryBg }}>
                    <GoAtletaIcon name={step.icon} size={26} color={step.color} />
                  </View>
                  <Text style={{ color: step.color, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{step.label}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 15, textAlign: "center" }}>{step.detail}</Text>
                </View>
                {index < 2 && !compact ? <GoAtletaIcon name="arrowForward" size={18} color={colors.secondaryText} /> : null}
              </View>
            ))}
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Critérios para avançar</Text>
            {alignment.gateCriteria.map((criterion) => (
              <View key={criterion} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
                <GoAtletaIcon name="checkmarkCircle" size={14} color={colors.successText} />
                <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, flex: 1 }}>{criterion}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>
            Progredimos juntos. Avançamos apenas quando a turma demonstra prontidão.
          </Text>
        </View>
      </View>
    </View>
  );
}
