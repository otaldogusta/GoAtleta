import { useState } from "react";
import { Alert, Text, TextInput, View } from "react-native";

import { getHiggsfieldProviderRuntimeState } from "../../../media-generation/providers/higgsfield/higgsfield-provider-factory";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import { generateExerciseMediaDraft } from "../exercise-media-generation-actions";

type Props = {
  colors: ThemeColors;
  onGenerated?: () => void;
};

const CONTEXT_OPTIONS = [
  { label: "Vôlei", modality: "volei", sport: "volei" },
  { label: "Treino resistido", modality: "treino_resistido", sport: "treino_resistido" },
  { label: "Funcional", modality: "funcional", sport: "funcional" },
  { label: "Outro", modality: "outro", sport: "outro" },
] as const;

export function ExerciseMediaGenerateCard({ colors, onGenerated }: Props) {
  const [exerciseName, setExerciseName] = useState("");
  const [mediaType, setMediaType] = useState<"video" | "image">("video");
  const [contextValue, setContextValue] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const selectedContext =
    CONTEXT_OPTIONS.find((option) => option.modality === contextValue) ?? null;
  const providerState = getHiggsfieldProviderRuntimeState();

  const handleGenerate = async () => {
    setSubmitting(true);
    try {
      const result = await generateExerciseMediaDraft({
        exerciseName,
        mediaType,
        modality: selectedContext?.modality,
        sport: selectedContext?.sport,
        tags: selectedContext ? [selectedContext.label] : undefined,
      });

      if (!result.ok) {
        Alert.alert("Não foi possível gerar", result.message);
        return;
      }

      setExerciseName("");
      setMediaType("video");
      setContextValue("");
      Alert.alert(result.handoffJob ? "Pedido criado" : "Rascunho criado", result.message);
      onGenerated?.();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
        gap: 12,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text }}>
          Gerar rascunho
        </Text>
        <Text style={{ color: colors.muted }}>
          Crie uma demonstração para revisar.
        </Text>
        <View
          style={{
            alignSelf: "flex-start",
            marginTop: 4,
            paddingVertical: 5,
            paddingHorizontal: 10,
            borderRadius: 999,
            backgroundColor: colors.secondaryBg,
          }}
        >
          <Text style={{ color: colors.secondaryText, fontWeight: "700", fontSize: 12 }}>
            {providerState.headline}
          </Text>
        </View>
        {providerState.detail ? (
          <Text style={{ color: colors.muted, fontSize: 12 }}>{providerState.detail}</Text>
        ) : null}
      </View>

      <TextInput
        placeholder="Nome do exercício"
        placeholderTextColor={colors.placeholder}
        value={exerciseName}
        onChangeText={setExerciseName}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          color: colors.inputText,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      />

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "600" }}>Tipo de mídia</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "Vídeo", value: "video" as const },
            { label: "Imagem", value: "image" as const },
          ].map((option) => {
            const active = mediaType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setMediaType(option.value)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: active ? colors.primaryBg : colors.border,
                  backgroundColor: active ? colors.primaryBg : colors.secondaryBg,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.primaryText : colors.secondaryText,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontWeight: "600" }}>Contexto</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {CONTEXT_OPTIONS.map((option) => {
            const active = contextValue === option.modality;
            return (
              <Pressable
                key={option.modality}
                onPress={() => setContextValue(active ? "" : option.modality)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: active ? colors.infoBg : colors.border,
                  backgroundColor: active ? colors.infoBg : colors.secondaryBg,
                }}
              >
                <Text
                  style={{
                    color: active ? colors.infoText : colors.secondaryText,
                    fontWeight: "700",
                    fontSize: 12,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        onPress={() => {
          void handleGenerate();
        }}
        style={{
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          backgroundColor:
            exerciseName.trim() && !submitting ? colors.primaryBg : colors.primaryDisabledBg,
        }}
      >
        <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
          {submitting ? "Gerando..." : "Gerar rascunho"}
        </Text>
      </Pressable>
    </View>
  );
}
