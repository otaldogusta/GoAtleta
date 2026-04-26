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
      borderRadius: 999,
      backgroundColor: colors.secondaryBg,
      borderWidth: 1,
      borderColor: colors.border,
    }}
  >
    <Text style={{ color: colors.text, fontSize: 11, fontWeight: "700" }}>{label}</Text>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Chip colors={colors} label={headerLabel} />
          {transferTarget ? <Chip colors={colors} label="Transferência direta" /> : null}
        </View>
        {transferTarget ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Impacto principal na quadra: {transferTarget}
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
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  gap: 8,
                }}
              >
                <View style={{ gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                    {name}
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <Chip colors={colors} label={categoryLabel} />
                    {exerciseTransferTarget ? <Chip colors={colors} label="Impacto na quadra" /> : null}
                  </View>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>
                    {formatExerciseLine(exercise)}
                  </Text>
                </View>
                {cadence ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Cadência: {cadence}
                  </Text>
                ) : null}
                {exerciseTransferTarget ? (
                  <View
                    style={{
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      gap: 3,
                    }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 11 }}>Impacto na quadra</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                      {exerciseTransferTarget}
                    </Text>
                  </View>
                ) : null}
                {notes ? (
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    Observação: {notes}
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
