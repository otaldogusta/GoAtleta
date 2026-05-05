import { Text, View } from "react-native";

import type { ResistanceExercisePrescription, ResistanceTrainingPlan } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";

type Props = {
  resistancePlan: ResistanceTrainingPlan;
  durationMin?: number;
  colors: ThemeColors;
};

const formatSets = (exercise: Partial<ResistanceExercisePrescription>) => {
  const sets = typeof exercise.sets === "number" && Number.isFinite(exercise.sets) ? exercise.sets : "-";
  return String(sets);
};

const formatReps = (exercise: Partial<ResistanceExercisePrescription>) => {
  const reps = String(exercise.reps ?? "-").trim() || "-";
  return reps;
};

const formatRest = (exercise: Partial<ResistanceExercisePrescription>) =>
  String(exercise.rest ?? "").trim() || "-";

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
            Transferência para quadra: {transferTarget}
          </Text>
        ) : null}
        {resolvedDuration > 0 ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            {resolvedDuration} min
          </Text>
        ) : null}
      </View>

      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        {exercises.length ? (
          <>
            <View
              style={{
                flexDirection: "row",
                backgroundColor: colors.secondaryBg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ flex: 1.6, padding: 10, color: colors.text, fontSize: 12, fontWeight: "800" }}>
                Atividade
              </Text>
              <Text style={{ width: 70, padding: 10, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                Séries
              </Text>
              <Text style={{ width: 96, padding: 10, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                Repet.
              </Text>
              <Text style={{ width: 88, padding: 10, color: colors.text, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
                Interv.
              </Text>
            </View>
            {exercises.map((exercise, index) => {
              const name = String(exercise.name ?? "").trim() || `Exercício ${index + 1}`;
              return (
              <View
                key={`${name}-${index}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: index === exercises.length - 1 ? 0 : 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={{ flex: 1.6, padding: 10, color: colors.text, fontSize: 13, fontWeight: "700" }}>
                  {name}
                </Text>
                <Text style={{ width: 70, padding: 10, color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "center" }}>
                  {formatSets(exercise)}
                </Text>
                <Text style={{ width: 96, padding: 10, color: colors.text, fontSize: 13, textAlign: "center" }}>
                  {formatReps(exercise)}
                </Text>
                <Text style={{ width: 88, padding: 10, color: colors.text, fontSize: 13, textAlign: "center" }}>
                  {formatRest(exercise)}
                </Text>
              </View>
              );
            })}
          </>
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
