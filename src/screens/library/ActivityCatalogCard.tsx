import { Text, View } from "react-native";

import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import {
  ageStageLabels,
  complexityLabels,
  formatLabels,
  phaseLabels,
  skillLabels,
} from "./activity-catalog-labels";
import type { ActivityCatalogListItem } from "./activity-catalog-view-model";

type Props = {
  item: ActivityCatalogListItem;
  onPress: (item: ActivityCatalogListItem) => void;
};

function Chip({ label }: { label: string }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
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
  const taxonomy = variant.taxonomy;
  return (
    <Pressable
      testID={`activity-catalog-card-${item.id}`}
      onPress={() => onPress(item)}
      style={{
        padding: 12,
        borderRadius: 8,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: 8,
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
          {item.familyTitle}
        </Text>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
          {variant.name}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          {item.purpose}
        </Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        <Chip label={skillLabels[taxonomy.skill]} />
        <Chip label={complexityLabels[taxonomy.complexity]} />
        <Chip label={phaseLabels[taxonomy.recommendedPhase]} />
        <Chip label={formatLabels[taxonomy.format]} />
        {taxonomy.ageRange.slice(0, 2).map((ageStage) => (
          <Chip key={ageStage} label={ageStageLabels[ageStage]} />
        ))}
      </View>
      <Text style={{ color: colors.text, fontSize: 12 }}>
        {variant.setup}
      </Text>
    </Pressable>
  );
}
