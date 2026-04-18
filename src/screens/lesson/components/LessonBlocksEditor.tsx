import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import type { LessonBlock } from "../../../core/models";
import { useSingleAccordion } from "../../../ui/use-single-accordion";
import { LessonBlockCard } from "./LessonBlockCard";

type Props = {
  blocks: LessonBlock[];
  onChange: (blocks: LessonBlock[]) => void;
  maxHeight?: number;
};

export function LessonBlocksEditor({ blocks, onChange, maxHeight = 420 }: Props) {
  const {
    expandedKey: expandedBlockKey,
    setExpandedKey: setExpandedBlockKey,
    toggle: toggleExpandedBlock,
  } = useSingleAccordion(blocks[0]?.key ?? null, { switchDelayMs: 220 });

  useEffect(() => {
    if (expandedBlockKey === null) {
      return;
    }

    if (!blocks.some((block) => block.key === expandedBlockKey)) {
      setExpandedBlockKey(blocks[0]?.key ?? null);
    }
  }, [blocks, expandedBlockKey]);

  return (
    <ScrollView style={{ maxHeight }} contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator>
      {blocks.map((block, index) => (
        <View key={block.key}>
          <LessonBlockCard
            block={block}
            onChange={(nextBlock) =>
              onChange(
                blocks.map((item, itemIndex) =>
                  itemIndex === index ? nextBlock : item
                )
              )
            }
            showTitle
            activitiesMaxHeight={220}
            isExpanded={expandedBlockKey === block.key}
            onToggleExpanded={() => toggleExpandedBlock(block.key)}
          />
        </View>
      ))}
    </ScrollView>
  );
}
