import { Ionicons } from "@expo/vector-icons";
import { ImageBackground, Text, View } from "react-native";

import { useAppTheme } from "../../ui/app-theme";
import { getCatalogActivityThumbnailSource } from "./activity-catalog-media";
import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem;
  badge: string;
  size?: "card" | "detail";
  footerLabel?: string;
};

export function ActivityCatalogThumbnail({
  item,
  badge,
  size = "card",
  footerLabel,
}: Props) {
  const { colors } = useAppTheme();
  const isDetail = size === "detail";
  const resolvedFooterLabel = footerLabel ?? item.familyLabel;
  return (
    <ImageBackground
      testID="activity-catalog-thumbnail"
      source={getCatalogActivityThumbnailSource(item)}
      resizeMode="cover"
      imageStyle={{ borderRadius: isDetail ? 18 : 14 }}
      style={[
        {
          width: "100%",
          borderRadius: isDetail ? 18 : 14,
          overflow: "hidden",
          backgroundColor: colors.secondaryBg,
        },
        isDetail ? { height: 240 } : { aspectRatio: 16 / 9 },
      ]}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "space-between",
          padding: isDetail ? 14 : 10,
          backgroundColor: "rgba(5, 12, 25, 0.26)",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <View
            style={{
              paddingHorizontal: 9,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: "rgba(5, 12, 25, 0.68)",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>
              {badge}
            </Text>
          </View>
          <View
            style={{
              height: isDetail ? 44 : 34,
              width: isDetail ? 44 : 34,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(5, 12, 25, 0.70)",
            }}
          >
            <Ionicons name="play" size={isDetail ? 22 : 17} color="#FFFFFF" />
          </View>
        </View>
        {isDetail ? null : (
          <Text
            numberOfLines={1}
            style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}
          >
            {resolvedFooterLabel}
          </Text>
        )}
      </View>
    </ImageBackground>
  );
}
