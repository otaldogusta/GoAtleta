import { Image } from "expo-image";
import { Alert, Platform, Text, View, useWindowDimensions } from "react-native";

import type { ExerciseMediaAsset } from "../../../exercise-media/exercise-media.types";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";
import {
  getMockMediaMessage,
  isHttpMediaUri,
  isMockMediaUri,
  openExerciseMediaUri,
} from "../open-exercise-media-uri";

type Props = {
  asset: ExerciseMediaAsset;
  colors: ThemeColors;
  statusLabel?: string;
  actions?: React.ReactNode;
  compact?: boolean;
};

function mediaFrameHeight(compact?: boolean) {
  return compact ? 116 : 156;
}

function placeholderTone(colors: ThemeColors) {
  return {
    backgroundColor: colors.secondaryBg,
    borderColor: colors.border,
    textColor: colors.muted,
  };
}

async function handlePreviewOpen(asset: ExerciseMediaAsset) {
  const result = await openExerciseMediaUri(asset.uri);

  if (result.ok) {
    return;
  }

  if (result.reason === "mock_uri") {
    Alert.alert("Prévia simulada", getMockMediaMessage(asset.uri));
    return;
  }

  Alert.alert("Não foi possível abrir", "Não foi possível abrir a demonstração.");
}

export function ExerciseMediaPreviewCard({
  asset,
  colors,
  statusLabel,
  actions,
  compact,
}: Props) {
  const { width } = useWindowDimensions();
  const isCompactLayout = compact || (Platform.OS !== "web" && width < 430);
  const isMock = isMockMediaUri(asset.uri);
  const showImage = !isMock && asset.kind === "image" && isHttpMediaUri(asset.uri);
  const showVideoThumb = !isMock && asset.kind === "video" && isHttpMediaUri(asset.thumbnailUri ?? "");
  const frameStyle = placeholderTone(colors);
  const frameHeight = mediaFrameHeight(isCompactLayout);
  const showInlineLayout = width >= 720;
  const metaLabel = asset.kind === "video" ? "Vídeo" : asset.kind === "image" ? "Imagem" : asset.kind;

  return (
    <View
      style={{
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.inputBg,
        gap: 12,
      }}
    >
      <View
        style={{
          flexDirection: showInlineLayout ? "row" : "column",
          gap: 14,
        }}
      >
        <View
          style={{
            width: showInlineLayout ? 168 : "100%",
            height: frameHeight,
            borderRadius: 14,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: frameStyle.borderColor,
            backgroundColor: frameStyle.backgroundColor,
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {showImage ? (
            <Image
              source={{ uri: asset.uri }}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
          ) : null}

          {showVideoThumb ? (
            <>
              <Image
                source={{ uri: asset.thumbnailUri }}
                contentFit="cover"
                style={{ width: "100%", height: "100%" }}
              />
              <View
                style={{
                  position: "absolute",
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  backgroundColor: "rgba(15, 23, 42, 0.76)",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>Play</Text>
              </View>
            </>
          ) : null}

          {!showImage && !showVideoThumb ? (
            <View style={{ paddingHorizontal: 16, alignItems: "center", gap: 6 }}>
              <Text
                style={{
                  color: colors.text,
                  fontWeight: "700",
                  fontSize: 14,
                  textAlign: "center",
                }}
              >
                {isMock
                  ? "Prévia simulada"
                  : asset.kind === "video"
                    ? "Prévia de vídeo"
                    : "Prévia indisponível"}
              </Text>
              <Text
                style={{
                  color: frameStyle.textColor,
                  fontSize: 12,
                  textAlign: "center",
                }}
              >
                {isMock
                  ? "Vídeo real disponível quando o Higgsfield estiver configurado."
                  : asset.kind === "video"
                    ? "Miniatura ainda não disponível"
                    : "Não foi possível carregar a imagem"}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ flex: 1, gap: 10, justifyContent: "space-between" }}>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{asset.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {metaLabel} · {asset.source === "higgsfield" ? "Higgsfield" : asset.source}
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {statusLabel ? (
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor:
                      statusLabel === "Aprovado" ? "rgba(34, 197, 94, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  }}
                >
                  <Text
                    style={{
                      color: statusLabel === "Aprovado" ? colors.successBg : "#9a6700",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {statusLabel}
                  </Text>
                </View>
              ) : null}

              {isMock ? (
                <View
                  style={{
                    paddingVertical: 5,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                    Mock
                  </Text>
                </View>
              ) : null}
            </View>

            {isMock ? (
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Vídeo real disponível quando o Higgsfield estiver configurado.
              </Text>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              onPress={() => {
                void handlePreviewOpen(asset);
              }}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: colors.secondaryBg,
              }}
            >
              <Text style={{ color: colors.secondaryText, fontWeight: "700", fontSize: 12 }}>
                Prévia
              </Text>
            </Pressable>

            {actions}
          </View>
        </View>
      </View>
    </View>
  );
}
