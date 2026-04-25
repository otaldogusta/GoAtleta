import { Text, View } from "react-native";

import type { ResistanceExercisePrescription, ResistanceTrainingPlan } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  resistancePlan: ResistanceTrainingPlan;
  durationMin?: number;
  colors: ThemeColors;
};

const formatExerciseLine = (exercise: Partial<ResistanceExercisePrescription>) => {
  const sets = typeof exercise.sets === "number" && Number.isFinite(exercise.sets) ? exercise.sets : "-";
  const reps = String(exercise.reps ?? "-").trim() || "-";
  const rest = String(exercise.rest ?? "").trim() || "intervalo não definido";
  return `${sets} × ${reps} • ${rest}`;
};

export function SessionResistanceBlock({ resistancePlan, durationMin, colors }: Props) {
  const headerLabel = String(resistancePlan.label ?? "").trim() || resistancePlan.primaryGoal;
  const transferTarget = String(resistancePlan.transferTarget ?? "").trim();
  const resolvedDuration =
    typeof durationMin === "number" && durationMin > 0
      ? durationMin
      : resistancePlan.estimatedDurationMin;
  const exercises = Array.isArray(resistancePlan.exercises) ? resistancePlan.exercises : [];

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 18,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
          Sessão resistida
        </Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>
          {headerLabel}
        </Text>
        {transferTarget ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Transferência: {transferTarget}
          </Text>
        ) : null}
        {resolvedDuration > 0 ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Duração prevista: {resolvedDuration} min
          </Text>
        ) : null}
      </View>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            paddingHorizontal: 12,
            paddingVertical: 8,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ flex: 1.3, color: colors.text, fontSize: 11, fontWeight: "700" }}>
            Exercício
          </Text>
          <Text style={{ flex: 1, color: colors.text, fontSize: 11, fontWeight: "700" }}>
            Prescrição
          </Text>
        </View>

        {exercises.length ? (
          exercises.map((exercise, index) => {
            const name = String(exercise.name ?? "").trim() || `Exercício ${index + 1}`;
            const notes = String(exercise.notes ?? "").trim();
            const cadence = String(exercise.cadence ?? "").trim();
            const exerciseTransferTarget = String(exercise.transferTarget ?? "").trim();

            return (
              <View
                key={`${name}-${index}`}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  gap: 4,
                }}
              >
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Text style={{ flex: 1.3, color: colors.text, fontSize: 13, fontWeight: "600" }}>
                    {name}
                  </Text>
                  <Text style={{ flex: 1, color: colors.muted, fontSize: 12 }}>
                    {formatExerciseLine(exercise)}
                  </Text>
                </View>
                {cadence ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Cadência: {cadence}
                  </Text>
                ) : null}
                {exerciseTransferTarget ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Transferência do exercício: {exerciseTransferTarget}
                  </Text>
                ) : null}
                {notes ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Notas: {notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Nenhum exercício definido para esta sessão.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
