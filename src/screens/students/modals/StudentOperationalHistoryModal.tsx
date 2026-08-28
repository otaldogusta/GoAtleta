import { ScrollView, Text, View } from "react-native";

import type { StudentOperationalEvent } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { Pressable } from "../../../ui/Pressable";
import {
  getStudentFinancialStatusLabel,
  getStudentMembershipStatusLabel,
} from "../application/student-operational-status";

type StudentOperationalHistoryModalProps = {
  visible: boolean;
  loading: boolean;
  events: StudentOperationalEvent[];
  errorMessage: string;
  colors: ThemeColors;
  onClose: () => void;
  onRetry: () => void;
};

export function StudentOperationalHistoryModal({
  visible,
  loading,
  events,
  errorMessage,
  colors,
  onClose,
  onRetry,
}: StudentOperationalHistoryModalProps) {
  return (
    <ModalSheet
      visible={visible}
      onClose={onClose}
      position="center"
      overlayZIndex={31000}
      backdropOpacity={0.68}
      cardStyle={{
        width: "100%",
        maxWidth: 520,
        maxHeight: "78%",
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        gap: 12,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}
        >
          Histórico do aluno
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar histórico"
          hitSlop={8}
          style={({ pressed, hovered }: any) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hovered ? colors.secondaryBg : colors.card,
            borderWidth: 1,
            borderColor: hovered ? colors.primaryBg : colors.border,
            opacity: pressed ? 0.76 : 1,
          })}
        >
          <GoAtletaIcon name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        style={{ width: "100%", minHeight: 0, flexShrink: 1 }}
        contentContainerStyle={{ paddingBottom: 4 }}
        showsVerticalScrollIndicator
      >
        {loading ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: colors.muted, fontSize: 13, paddingVertical: 12 }}
          >
            Carregando…
          </Text>
        ) : errorMessage ? (
          <View style={{ gap: 10, paddingVertical: 8 }}>
            <Text
              accessibilityRole="alert"
              style={{ color: colors.muted, fontSize: 13 }}
            >
              {errorMessage}
            </Text>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel="Tentar carregar o histórico novamente"
              style={({ pressed, hovered }: any) => ({
                minHeight: 44,
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                borderRadius: 11,
                borderWidth: 1,
                borderColor: hovered ? colors.primaryBg : colors.border,
                backgroundColor: hovered ? colors.secondaryBg : colors.card,
                paddingHorizontal: 12,
                opacity: pressed ? 0.76 : 1,
              })}
            >
              <GoAtletaIcon name="refresh" size={16} color={colors.text} />
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: "800" }}>
                Tentar novamente
              </Text>
            </Pressable>
          </View>
        ) : events.length > 0 ? (
          events.map((event, index) => {
            const statusLabel =
              event.kind === "membership"
                ? getStudentMembershipStatusLabel(event.status)
                : getStudentFinancialStatusLabel(event.status);
            const previousLabel = event.previousStatus
              ? event.kind === "membership"
                ? getStudentMembershipStatusLabel(event.previousStatus)
                : getStudentFinancialStatusLabel(event.previousStatus)
              : null;

            return (
              <View
                key={`${event.kind}-${event.id}`}
                style={{
                  paddingVertical: 11,
                  gap: 3,
                  borderBottomWidth: index < events.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
                  {event.kind === "membership" ? "Vínculo" : "Financeiro"}: {previousLabel ? `${previousLabel} → ` : ""}
                  {statusLabel}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {new Date(event.changedAt).toLocaleString("pt-BR")}
                  {event.source === "baseline" ? " · estado inicial" : ""}
                </Text>
                {event.reason ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {event.reason}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: 12 }}>
            Nenhuma alteração registrada.
          </Text>
        )}
      </ScrollView>
    </ModalSheet>
  );
}
