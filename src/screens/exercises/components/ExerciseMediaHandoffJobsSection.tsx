import * as Clipboard from "expo-clipboard";
import { Alert, Text, View } from "react-native";

import type { MediaGenerationHandoffJob } from "../../../media-generation/handoff/media-generation-handoff.types";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import {
  getExerciseMediaHandoffPayload,
  getExerciseMediaHandoffPrompt,
  listExerciseMediaHandoffJobsForReview,
} from "../exercise-media-handoff-actions";

type Props = {
  colors: ThemeColors;
  refreshToken?: number;
  onCancel?: (job: MediaGenerationHandoffJob) => void;
};

function labelForStatus(status: MediaGenerationHandoffJob["status"]) {
  switch (status) {
    case "pending_agent":
      return "Aguardando Higgsfield";
    case "processing":
      return "Em processamento";
    case "completed":
      return "Concluído";
    case "failed":
      return "Falhou";
    case "cancelled":
      return "Cancelado";
    default:
      return status;
  }
}

function statusTone(
  status: MediaGenerationHandoffJob["status"],
  colors: ThemeColors,
): { bg: string; text: string } {
  switch (status) {
    case "completed":
      return { bg: colors.successBg, text: colors.successText };
    case "failed":
    case "cancelled":
      return { bg: colors.dangerBg, text: colors.dangerText };
    case "processing":
      return { bg: colors.infoBg, text: colors.infoText };
    case "pending_agent":
    default:
      return { bg: colors.warningBg, text: colors.warningText };
  }
}

async function copyToClipboard(content: string, successMessage: string) {
  await Clipboard.setStringAsync(content);
  Alert.alert("Copiado", successMessage);
}

export function ExerciseMediaHandoffJobsSection({
  colors,
  refreshToken,
  onCancel,
}: Props) {
  void refreshToken;
  const jobs = listExerciseMediaHandoffJobsForReview();

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
          Pedidos para o agente
        </Text>
        <Text style={{ color: colors.muted }}>
          Gerações aguardando execução via Higgsfield MCP.
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
                      backgroundColor: tone.bg,
                    }}
                  >
                    <Text style={{ color: tone.text, fontWeight: "700", fontSize: 11 }}>
                      {labelForStatus(job.status)}
                    </Text>
                  </View>
                </View>

                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {job.request.kind === "exercise_video" ? "Vídeo" : "Imagem"} ·{" "}
                  {new Date(job.createdAt).toLocaleDateString("pt-BR")}
                </Text>

                {job.errorMessage ? (
                  <Text style={{ color: colors.dangerText, fontSize: 12 }}>
                    {job.errorMessage}
                  </Text>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Pressable
                  onPress={() => {
                    void copyToClipboard(
                      getExerciseMediaHandoffPrompt(job),
                      "Prompt copiado.",
                    );
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.secondaryText, fontWeight: "700", fontSize: 12 }}>
                    Copiar prompt
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    void copyToClipboard(
                      getExerciseMediaHandoffPayload(job),
                      "Payload copiado.",
                    );
                  }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.secondaryText, fontWeight: "700", fontSize: 12 }}>
                    Copiar payload
                  </Text>
                </Pressable>

                {job.status === "pending_agent" ? (
                  <Pressable
                    onPress={() => onCancel?.(job)}
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
              </View>
            </View>
          );
        })
      ) : (
        <Text style={{ color: colors.muted }}>Nenhum pedido aguardando agente.</Text>
      )}
    </View>
  );
}
