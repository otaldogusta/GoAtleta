import { Text, View } from "react-native";

import type { ResistanceExercisePrescription, ResistanceTrainingPlan } from "../../../core/models";
import { radius } from "../../../theme/tokens";
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
  return `${sets} séries · ${reps} reps · ${rest}`;
};

const categoryLabelMap = {
  empurrar: "Empurrar",
  puxar: "Puxar",
  membros_inferiores: "Membros inferiores",
  potencia: "Potência",
  preventivo: "Prevenção",
  core: "Core",
} as const;

const Chip = ({
  colors,
  label,
}: {
  colors: ThemeColors;
  label: string;
}) => (
  <View
    style={{
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: radius.full,
      backgroundColor: colors.backgroundSubtle,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    }}
  >
    <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}>{label}</Text>
  </View>
);

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
        borderRadius: radius.container,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "900" }}>
          Sessão resistida
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: "800" }}>
          {headerLabel}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip colors={colors} label={headerLabel} />
          {transferTarget ? <Chip colors={colors} label="Transferência direta" /> : null}
        </View>
        {transferTarget ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Impacto principal na quadra: {transferTarget}
          </Text>
        ) : null}
        {resolvedDuration > 0 ? (
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
            Duração prevista: {resolvedDuration} min
          </Text>
        ) : null}
      </View>

      <View
        style={{
          gap: 10,
        }}
      >
        {exercises.length ? (
          exercises.map((exercise, index) => {
            const name = String(exercise.name ?? "").trim() || `Exercício ${index + 1}`;
            const notes = String(exercise.notes ?? "").trim();
            const cadence = String(exercise.cadence ?? "").trim();
            const exerciseTransferTarget =
              String(exercise.transferTarget ?? "").trim() || transferTarget;
            const categoryLabel =
              categoryLabelMap[exercise.category as keyof typeof categoryLabelMap] ?? "Exercício";

            return (
              <View
                key={`${name}-${index}`}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: radius.card,
                  borderWidth: 1,
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.backgroundSubtle,
                  gap: 8,
                }}
              >
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "900" }}>
                    {name}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Chip colors={colors} label={categoryLabel} />
                    {exerciseTransferTarget ? <Chip colors={colors} label="Impacto na quadra" /> : null}
                  </View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "800" }}>
                    {formatExerciseLine(exercise)}
                  </Text>
                </View>
                {cadence ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Cadência: {cadence}
                  </Text>
                ) : null}
                {exerciseTransferTarget ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: radius.internal,
                      backgroundColor: colors.surface,
                      gap: 3,
                    }}
                  >
                    <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: "800" }}>Impacto na quadra</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>
                      {exerciseTransferTarget}
                    </Text>
                  </View>
                ) : null}
                {notes ? (
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                    Observação: {notes}
                  </Text>
                ) : null}
              </View>
            );
          })
        ) : (
          <View style={{ paddingHorizontal: 12, paddingVertical: 12 }}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Nenhum exercício definido para esta sessão.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
