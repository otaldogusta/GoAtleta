import { useMemo } from "react";
import { Alert, Text, View } from "react-native";

import type { MediaGenerationJob } from "../../../media-generation/queue/media-generation-job.types";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { getMockMediaMessage, openExerciseMediaUri } from "../open-exercise-media-uri";
import { listExerciseMediaGenerationJobsForReview } from "../exercise-media-generation-job-actions";

type Props = {
  colors: ThemeColors;
  refreshToken?: number;
  onChanged?: () => void;
  onCancel: (job: MediaGenerationJob) => void;
  onRetry: (job: MediaGenerationJob) => void;
};

function formatSimpleDate(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toLocaleDateString("pt-BR");
}

function labelForKind(kind: string) {
  if (kind === "exercise_video") return "Vídeo";
  if (kind === "exercise_image") return "Imagem";
  if (kind === "coach_avatar") return "Avatar";
  if (kind === "marketing_card") return "Card";
  return kind;
}

function labelForStatus(status: MediaGenerationJob["status"]) {
  switch (status) {
    case "queued":
      return "Na fila";
    case "processing":
      return "Gerando...";
    case "completed":
      return "Rascunho";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function statusTone(
  status: MediaGenerationJob["status"],
  colors: ThemeColors,
): { backgroundColor: string; textColor: string } {
  switch (status) {
    case "completed":
      return { backgroundColor: colors.successBg, textColor: colors.successText };
    case "failed":
    case "cancelled":
      return { backgroundColor: colors.dangerBg, textColor: colors.dangerText };
    case "processing":
      return { backgroundColor: colors.infoBg, textColor: colors.infoText };
    case "queued":
    default:
      return { backgroundColor: colors.warningBg, textColor: colors.warningText };
  }
}

async function openDraft(job: MediaGenerationJob) {
  const uri =
    job.result?.asset && "uri" in job.result.asset && typeof job.result.asset.uri === "string"
      ? job.result.asset.uri
      : "";

  if (!uri) {
    Alert.alert("Rascunho indisponível", "Não foi possível abrir a demonstração.");
    return;
  }

  const result = await openExerciseMediaUri(uri);
  if (result.ok) {
    return;
  }

  if (result.reason === "mock_uri") {
    Alert.alert("Prévia simulada", getMockMediaMessage(uri));
    return;
  }

  {
    Alert.alert("Falha ao abrir", "Não foi possível abrir a demonstração.");
  }
}

export function ExerciseMediaGenerationJobsSection({
  colors,
  refreshToken,
  onChanged: _onChanged,
  onCancel,
  onRetry,
}: Props) {
  const jobs = useMemo(
    () => listExerciseMediaGenerationJobsForReview(),
    [refreshToken],
  );

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 14,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Gerações recentes
        </Text>
        <Text style={{ color: colors.muted }}>
          Últimos rascunhos solicitados.
        </Text>
      </View>

      {jobs.length ? (
        jobs.map((job) => {
          const tone = statusTone(job.status, colors);
          const title =
            job.request.exerciseName ??
            job.request.title ??
            job.request.exerciseKey ??
            "Demonstração";
          const dateLabel = formatSimpleDate(job.updatedAt || job.createdAt) || "sem data";
          const canViewDraft =
            job.status === "completed" &&
            job.result?.asset &&
            "uri" in job.result.asset &&
            typeof job.result.asset.uri === "string";

          return (
            <View
              key={job.id}
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                gap: 10,
              }}
            >
              <View style={{ gap: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 15,
                      fontWeight: "700",
                      color: colors.text,
                    }}
                  >
                    {title}
                  </Text>
                  <View
                    style={{
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      borderRadius: 999,
                      backgroundColor: tone.backgroundColor,
                    }}
                  >
                    <Text
                      style={{
                        color: tone.textColor,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {labelForStatus(job.status)}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {labelForKind(job.request.kind)} · {dateLabel}
                </Text>

                {job.status === "failed" && job.errorMessage ? (
                  <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                    Falhou ao gerar: {job.errorMessage}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {job.status === "queued" ? (
                  <Pressable
                    onPress={() => onCancel(job)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.dangerBg,
                      borderWidth: 1,
                      borderColor: colors.dangerBorder,
                    }}
                  >
                    <Text style={{ color: colors.dangerText, fontWeight: "700", fontSize: 12 }}>
                      Cancelar
                    </Text>
                  </Pressable>
                ) : null}

                {canViewDraft ? (
                  <Pressable
                    onPress={() => {
                      void openDraft(job);
                    }}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.secondaryBg,
                    }}
                  >
                    <Text
                      style={{ color: colors.secondaryText, fontWeight: "700", fontSize: 12 }}
                    >
                      Prévia
                    </Text>
                  </Pressable>
                ) : null}

                {job.status === "failed" ? (
                  <Pressable
                    onPress={() => onRetry(job)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: colors.primaryBg,
                    }}
                  >
                    <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 12 }}>
                      Tentar novamente
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      ) : (
        <Text style={{ color: colors.muted }}>Nenhuma geração recente.</Text>
      )}
    </View>
  );
}
