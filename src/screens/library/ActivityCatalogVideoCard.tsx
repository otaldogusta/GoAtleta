import { Text, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { ActivityCatalogThumbnail } from "./ActivityCatalogThumbnail";
import {
  getCatalogActivityPrimaryBadge,
  type ActivityCatalogListItem,
} from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem;
  onView: (item: ActivityCatalogListItem) => void;
  onAddToLesson: (item: ActivityCatalogListItem) => void;
};

export function ActivityCatalogVideoCard({ item, onView, onAddToLesson }: Props) {
  const { colors } = useAppTheme();
  const badge = getCatalogActivityPrimaryBadge(item);
  return (
    <View
      testID={`activity-catalog-video-card-${item.id}`}
      style={{
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Pressable onPress={() => onView(item)} testID={`activity-catalog-card-${item.id}`}>
        <ActivityCatalogThumbnail item={item} badge={badge} />
      </Pressable>
      <View style={{ gap: 8, padding: 14 }}>
        <View style={{ gap: 3 }}>
          <Text
            numberOfLines={2}
            style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}
          >
            {item.variant.name}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>
            {item.familyLabel}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            testID={`activity-catalog-view-${item.id}`}
            onPress={() => onView(item)}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.secondaryBg,
            }}
          >
            <Text style={{ color: colors.secondaryText, fontSize: 13, fontWeight: "900" }}>
              Ver atividade
            </Text>
          </Pressable>
          <Pressable
            testID={`activity-catalog-add-${item.id}`}
            onPress={() => onAddToLesson(item)}
            style={{
              height: 38,
              width: 42,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primaryBg,
            }}
          >
            <GoAtletaIcon name="add" size={22} color={colors.primaryText} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
