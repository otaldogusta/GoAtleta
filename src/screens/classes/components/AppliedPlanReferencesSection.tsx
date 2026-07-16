import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Pressable } from "../../../ui/Pressable";
import { useAppTheme } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import {
  buildAppliedPlanReferencesPresentation,
  type AppliedPlanReferenceInput,
} from "./applied-plan-references-presentation";

type AppliedPlanReferencesSectionProps = {
  references?: readonly AppliedPlanReferenceInput[] | null;
};

export function AppliedPlanReferencesSection({
  references,
}: AppliedPlanReferencesSectionProps) {
  const { colors } = useAppTheme();
  const presentation = useMemo(
    () => buildAppliedPlanReferencesPresentation(references),
    [references]
  );
  const [sectionOpen, setSectionOpen] = useState(false);
  const [expandedReferenceId, setExpandedReferenceId] = useState<string | null>(null);
  const activeExpandedReferenceId = presentation.items.some(
    (reference) => reference.id === expandedReferenceId
  )
    ? expandedReferenceId
    : null;

  if (!presentation.items.length) return null;

  return (
    <View style={styles.wrapper}>
      {presentation.planningSource ? (
        <View
          style={[
            styles.planningSource,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <GoAtletaIcon name="calendar" size={18} color={colors.muted} />
          <View style={styles.sectionHeaderCopy}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Fonte do planejamento
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.planningSourceTitle, { color: colors.text }]}
            >
              {presentation.planningSource.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.sectionSummary, { color: colors.muted }]}
            >
              {[
                presentation.planningSource.periodLabel,
                presentation.planningSource.originLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
      ) : null}
      <View
        style={[
          styles.container,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
      <Pressable
        onPress={() => {
          setSectionOpen((current) => !current);
          if (sectionOpen) setExpandedReferenceId(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${sectionOpen ? "Recolher" : "Expandir"} referências aplicadas`}
        accessibilityState={{ expanded: sectionOpen }}
        style={({ pressed }) => [
          styles.sectionHeader,
          { opacity: pressed ? 0.78 : 1 },
        ]}
      >
        <GoAtletaIcon name="document" size={18} color={colors.muted} />
        <View style={styles.sectionHeaderCopy}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Referências aplicadas
          </Text>
          <Text style={[styles.sectionSummary, { color: colors.muted }]}>
            {presentation.countLabel}
          </Text>
        </View>
        <GoAtletaIcon
          name={sectionOpen ? "chevronUp" : "chevronDown"}
          size={16}
          color={colors.muted}
        />
      </Pressable>

      {sectionOpen ? (
        <View style={[styles.references, { borderTopColor: colors.border }]}>
          {presentation.items.map((reference, index) => {
            const expanded = activeExpandedReferenceId === reference.id;
            return (
              <View
                key={reference.id}
                style={[
                  styles.reference,
                  index > 0 ? { borderTopColor: colors.border, borderTopWidth: 1 } : null,
                ]}
              >
                <Pressable
                  onPress={() =>
                    setExpandedReferenceId((current) =>
                      current === reference.id ? null : reference.id
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${expanded ? "Recolher" : "Expandir"} referência ${reference.title}`}
                  accessibilityState={{ expanded }}
                  style={({ pressed }) => [
                    styles.referenceHeader,
                    { opacity: pressed ? 0.78 : 1 },
                  ]}
                >
                  <View style={styles.referenceHeaderCopy}>
                    <Text
                      numberOfLines={2}
                      style={[styles.referenceTitle, { color: colors.text }]}
                    >
                      {reference.title}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[styles.referenceOrigin, { color: colors.muted }]}
                    >
                      {reference.originLabel}
                    </Text>
                  </View>
                  <GoAtletaIcon
                    name={expanded ? "chevronUp" : "chevronDown"}
                    size={14}
                    color={colors.muted}
                  />
                </Pressable>

                {expanded ? (
                  <View style={styles.referenceDetails}>
                    <Text style={[styles.referenceMetadata, { color: colors.muted }]}>
                      {[
                        reference.scopeLabel,
                        reference.materialTypeLabel,
                        reference.evidenceLevelLabel,
                        reference.sourceDateLabel,
                        reference.confidenceLabel,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                    {reference.sourceLocation ? (
                      <Detail
                        label="Local no documento"
                        value={reference.sourceLocation}
                        colors={colors}
                      />
                    ) : null}
                    <Detail
                      label="Trecho utilizado"
                      value={reference.excerpt || "Trecho não registrado."}
                      colors={colors}
                    />
                    <Detail
                      label="Como influenciou o plano"
                      value={reference.influence || "Influência não registrada."}
                      colors={colors}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
      </View>
    </View>
  );
}

function Detail({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>["colors"];
}) {
  return (
    <View style={styles.detail}>
      <Text style={[styles.detailLabel, { color: colors.text }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.muted }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  planningSource: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 11,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  planningSourceTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  container: {
    borderWidth: 1,
    borderRadius: 11,
    overflow: "hidden",
  },
  sectionHeader: {
    minHeight: 76,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sectionHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  sectionSummary: {
    fontSize: 11,
    lineHeight: 16,
  },
  references: {
    borderTopWidth: 1,
  },
  reference: {
    marginHorizontal: 12,
  },
  referenceHeader: {
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  referenceHeaderCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  referenceTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
  },
  referenceOrigin: {
    fontSize: 10,
    lineHeight: 14,
  },
  referenceDetails: {
    paddingBottom: 12,
    gap: 9,
  },
  referenceMetadata: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
  },
  detail: {
    gap: 3,
  },
  detailLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
  },
  detailValue: {
    fontSize: 11,
    lineHeight: 16,
  },
});
