import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  getActivityCatalogCardChips,
  getActivityCatalogSecondaryMeta,
  type ActivityCatalogListItem,
} from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem;
  onPress: (item: ActivityCatalogListItem) => void;
};

function Chip({ label, testID }: { label: string; testID: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: colors.secondaryBg,
      }}
    >
      <Text style={{ color: colors.secondaryText, fontSize: 11, fontWeight: "700" }}>
        {label}
      </Text>
    </View>
  );
}

export function ActivityCatalogCard({ item, onPress }: Props) {
  const { colors } = useAppTheme();
  const { variant } = item;
  const chips = getActivityCatalogCardChips(item);
  const secondaryMeta = getActivityCatalogSecondaryMeta(item);
  return (
    <Pressable
      testID={`activity-catalog-card-${item.id}`}
      onPress={() => onPress(item)}
      style={{
        padding: 14,
        borderRadius: 16,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 9,
      }}
    >
      <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 5 }}>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            {item.familyLabel}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}
          >
            {variant.name}
          </Text>
          <Text
            numberOfLines={2}
            style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}
          >
            {item.purpose}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {chips.map((chip) => (
          <Chip
            key={chip}
            label={chip}
            testID={`activity-catalog-card-chip-${item.id}`}
          />
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
        {secondaryMeta}
      </Text>
    </Pressable>
  );
}
