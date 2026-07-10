import { Modal, Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useEffect, useState } from "react";

import type { RecentSessionSummary } from "../../core/models";
import {
  buildRedeEsperancaJulyAlignment,
  type JulyAlignmentSession,
} from "../../core/pedagogy/rede-esperanca-july-2026-alignment";
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
  adapted: "Plano ajustado",
  gate: "Plano ajustado",
  conditional: "Plano ajustado",
  upcoming: "Próximo",
} as const;

export function PeriodizationIntelligenceOverview({ colors, recentSessions, onReviewEvolution }: Props) {
  const { width, height } = useWindowDimensions();
  const [selectedSession, setSelectedSession] = useState<JulyAlignmentSession | null>(null);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const [isCloseFocused, setIsCloseFocused] = useState(false);
  const compact = width < 900;
  const alignment = buildRedeEsperancaJulyAlignment(recentSessions);
  const visibleSessions = alignment.sessions.slice(0, 6);
  const detailBodyHeight = selectedSession
    ? selectedSession.state === "gate" || selectedSession.state === "conditional"
      ? Math.min(360, height * 0.44)
      : selectedSession.adjustments?.length
        ? 190
        : 230
    : 230;
  const closeDetails = () => {
    setIsCloseHovered(false);
    setIsCloseFocused(false);
    setSelectedSession(null);
  };

  useEffect(() => {
    if (!selectedSession || Platform.OS !== "web" || typeof document === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsCloseHovered(false);
      setIsCloseFocused(false);
      setSelectedSession(null);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedSession]);

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
                : colors.infoText;
            return (
              <View
                key={session.date}
                style={{ width: compact ? 242 : 158, gap: 7, opacity: completed ? 0.62 : 1 }}
              >
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
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir detalhes da aula de ${formatSessionDate(session.date)}`}
                  accessibilityHint="Mostra todas as informações desta aula."
                  onPress={() => setSelectedSession(session)}
                  style={[
                    getSectionCardStyle(colors, "neutral", { padding: 10, radius: 14, shadow: false }),
                    { height: 238, borderColor: isGate ? colors.warningText : colors.border },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={{ color: accent, fontSize: 11, lineHeight: 14, fontWeight: "700", flexShrink: 0 }}
                  >
                    {stateLabel[session.state]}
                  </Text>
                  <View style={{ height: 34, marginTop: 6, flexShrink: 0 }}>
                    <Text numberOfLines={2} style={{ color: colors.text, fontSize: 12, lineHeight: 17, fontWeight: "800" }}>
                      {session.plannedTitle}
                    </Text>
                  </View>
                  <View style={{ height: 30, marginTop: 5, flexShrink: 0 }}>
                    <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                      {session.plannedFocus}
                    </Text>
                  </View>

                  {typeof session.participantsCount === "number" ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8, paddingTop: 8 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                        {session.participantsCount} participantes
                      </Text>
                      {typeof session.completedSequenceCount === "number" ? (
                        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                          {session.completedSequenceCount} concluíram a sequência esperada
                        </Text>
                      ) : null}
                      {session.observation ? (
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 9 }}>
                          <GoAtletaIcon name="warning" size={13} color={colors.dangerText} />
                          <Text style={{ color: colors.muted, fontSize: 9, lineHeight: 13, flex: 1 }} numberOfLines={2}>
                            {session.observation}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {session.adjustments?.length ? (
                    <View
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        marginTop: 8,
                        paddingTop: 8,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Ajustes</Text>
                      <Text numberOfLines={3} style={{ color: colors.muted, fontSize: 10, lineHeight: 14 }}>
                        {session.adjustments.map((adjustment) => `· ${adjustment}`).join("\n")}
                      </Text>
                    </View>
                  ) : null}

                  {conditional ? (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                        marginTop: 8,
                        paddingTop: 8,
                      }}
                    >
                      <GoAtletaIcon name="info" size={14} color={colors.infoText} />
                      <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 10, flex: 1 }}>
                        Liberado apenas após o portão de prontidão.
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
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
              Evolução recente
            </Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {alignment.evidenceCount} relatórios recentes considerados com dados de participação, execução e comportamento.
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
              <View key={criterion.id} style={{ flexDirection: "row", gap: 7, alignItems: "flex-start" }}>
                <GoAtletaIcon
                  name={criterion.isMet ? "checkbox" : "square"}
                  size={14}
                  color={criterion.isMet ? colors.successText : colors.secondaryText}
                />
                <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, flex: 1 }}>
                  {criterion.label}
                </Text>
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, textAlign: "center" }}>
            Progredimos juntos. Avançamos apenas quando a turma demonstra prontidão.
          </Text>
        </View>
      </View>

      {selectedSession ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={closeDetails}
        >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(2, 6, 23, 0.78)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar detalhes da aula"
            onPress={closeDetails}
            suppressWebHoverFeedback
            style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View
            style={[
              getSectionCardStyle(colors, "neutral", { padding: 18, radius: 18 }),
              {
                width: "100%",
                maxWidth: 560,
                maxHeight: "84%",
                gap: 0,
                overflow: "hidden",
                backgroundColor: colors.inputBg,
              },
            ]}
          >
            {selectedSession ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.infoText, fontSize: 12, fontWeight: "800" }}>
                      {stateLabel[selectedSession.state]}
                    </Text>
                    <Text style={{ color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800", marginTop: 5 }}>
                      {selectedSession.plannedTitle}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
                      {formatSessionDate(selectedSession.date)}
                    </Text>
                  </View>
                   <Pressable
                     accessibilityRole="button"
                     accessibilityLabel="Fechar"
                     onPress={closeDetails}
                     onHoverIn={() => setIsCloseHovered(true)}
                     onHoverOut={() => setIsCloseHovered(false)}
                     onFocus={() => setIsCloseFocused(true)}
                     onBlur={() => setIsCloseFocused(false)}
                     suppressWebHoverFeedback
                     style={{
                       width: 36,
                       height: 36,
                       borderRadius: 18,
                       alignItems: "center",
                       justifyContent: "center",
                       backgroundColor: isCloseHovered || isCloseFocused ? colors.border : colors.secondaryBg,
                     }}
                   >
                    <GoAtletaIcon name="close" size={20} color={colors.text} />
                  </Pressable>
                </View>
                <ScrollView
                  style={{ marginTop: 16, height: detailBodyHeight }}
                  contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
                >
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Foco planejado</Text>
                    <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 4 }}>
                      {selectedSession.plannedFocus}
                    </Text>
                  </View>
                  {typeof selectedSession.participantsCount === "number" ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }}>
                      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>
                        {selectedSession.participantsCount} participantes
                      </Text>
                      {typeof selectedSession.completedSequenceCount === "number" ? (
                        <Text style={{ color: colors.text, fontSize: 13, marginTop: 5 }}>
                          {selectedSession.completedSequenceCount} concluíram a sequência esperada.
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  {selectedSession.observation ? (
                    <View>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Observação do relatório</Text>
                      <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                        {selectedSession.observation}
                      </Text>
                    </View>
                  ) : null}
                  {selectedSession.adjustments?.length ? (
                    <View>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>Ajustes recomendados</Text>
                      {selectedSession.adjustments.map((adjustment) => (
                        <View key={adjustment} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7, marginTop: 7 }}>
                          <GoAtletaIcon name="checkmarkCircle" size={15} color={colors.successText} />
                          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 }}>{adjustment}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {selectedSession.state === "gate" || selectedSession.state === "conditional" ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 7 }}>
                      <Text style={{ color: colors.warningText, fontSize: 11, fontWeight: "800" }}>Portão de prontidão</Text>
                      {alignment.gateCriteria.map((criterion) => (
                        <View key={criterion.id} style={{ flexDirection: "row", alignItems: "flex-start", gap: 7 }}>
                          <GoAtletaIcon
                            name={criterion.isMet ? "checkbox" : "square"}
                            size={15}
                            color={criterion.isMet ? colors.successText : colors.secondaryText}
                          />
                          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 18, flex: 1 }}>
                            {criterion.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
        </Modal>
      ) : null}
    </View>
  );
}
