import { Image, Text, View } from "react-native";

import type { Exercise } from "../../../core/models";
import type { ThemeColors } from "../../../ui/app-theme";
import { Pressable } from "../../../ui/Pressable";

type Props = {
  colors: ThemeColors;
  items: Exercise[];
  emptyMessage: string;
  getThumbnail: (url: string) => string;
  onOpen: (url: string) => void;
  onShare: (url: string, title: string) => void;
  onEdit: (item: Exercise) => void;
  onDelete: (item: Exercise) => void;
};

function ActionButton({
  colors,
  label,
  onPress,
  danger = false,
}: {
  colors: ThemeColors;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: danger ? colors.dangerBg : colors.secondaryBg,
        borderWidth: danger ? 1 : 0,
        borderColor: danger ? colors.dangerBorder : "transparent",
      }}
    >
      <Text
        style={{
          color: danger ? colors.dangerText : colors.secondaryText,
          fontWeight: "700",
          fontSize: 12,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ExerciseListSection({
  colors,
  items,
  emptyMessage,
  getThumbnail,
  onOpen,
  onShare,
  onEdit,
  onDelete,
}: Props) {
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
          Biblioteca de exercícios
        </Text>
        <Text style={{ color: colors.muted }}>
          Links e vídeos cadastrados manualmente para consulta rápida.
        </Text>
      </View>

      {items.length ? (
        items.map((item) => {
          const thumbnail = getThumbnail(item.videoUrl);
          return (
            <View
              key={item.id}
              style={{
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.inputBg,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", gap: 12 }}>
                {thumbnail ? (
                  <Image
                    source={{ uri: thumbnail }}
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 14,
                      backgroundColor: colors.thumbFallback,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: 84,
                      height: 84,
                      borderRadius: 14,
                      backgroundColor: colors.thumbFallback,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 11 }}>
                      VÍDEO
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
                    {item.title}
                  </Text>
                  {item.source ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      Fonte: {item.source}
                    </Text>
                  ) : null}
                  {item.notes ? (
                    <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={3}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <ActionButton
                  colors={colors}
                  label="Abrir"
                  onPress={() => onOpen(item.videoUrl)}
                />
                <ActionButton
                  colors={colors}
                  label="Compartilhar"
                  onPress={() => onShare(item.videoUrl, item.title)}
                />
                <ActionButton
                  colors={colors}
                  label="Editar"
                  onPress={() => onEdit(item)}
                />
                <ActionButton
                  colors={colors}
                  label="Excluir"
                  onPress={() => onDelete(item)}
                  danger
                />
              </View>
            </View>
          );
        })
      ) : (
        <Text style={{ color: colors.muted }}>{emptyMessage}</Text>
      )}
    </View>
  );
}
