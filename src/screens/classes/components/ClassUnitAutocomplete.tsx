import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";

import { normalizeUnitKey } from "../../../core/unit-key";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { useCollapsibleAnimation } from "../../../ui/use-collapsible";

const MAX_VISIBLE_UNITS = 6;

type Layout = { x: number; y: number; width: number; height: number };

export const buildExistingUnitOptions = (units: string[]) => {
  const labelsByKey = new Map<string, string>();

  units.forEach((unit) => {
    const label = unit.trim();
    const key = normalizeUnitKey(label);
    if (!key || key === normalizeUnitKey("Sem unidade") || labelsByKey.has(key)) return;
    labelsByKey.set(key, label);
  });

  return Array.from(labelsByKey.values()).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" })
  );
};

export const filterExistingUnitOptions = (units: string[], query: string) => {
  const normalizedQuery = normalizeUnitKey(query);
  const options = buildExistingUnitOptions(units);

  if (!normalizedQuery) return options.slice(0, MAX_VISIBLE_UNITS);

  return options
    .filter((unit) => normalizeUnitKey(unit).includes(normalizedQuery))
    .sort((a, b) => {
      const aStartsWith = normalizeUnitKey(a).startsWith(normalizedQuery);
      const bStartsWith = normalizeUnitKey(b).startsWith(normalizedQuery);
      if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
      return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
    })
    .slice(0, MAX_VISIBLE_UNITS);
};

type ClassUnitAutocompleteProps = {
  colors: ThemeColors;
  value: string;
  units: string[];
  onChangeText: (value: string) => void;
};

export function ClassUnitAutocomplete({
  colors,
  value,
  units,
  onChangeText,
}: ClassUnitAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState<Layout | null>(null);
  const triggerRef = useRef<View | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestions = useMemo(
    () => filterExistingUnitOptions(units, value),
    [units, value]
  );
  const selectedKey = normalizeUnitKey(value);
  const { animatedStyle, isVisible } = useCollapsibleAnimation(showSuggestions, {
    durationIn: 140,
    durationOut: 100,
    translateY: -4,
  });

  const measureTrigger = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setTriggerLayout({ x, y, width, height });
    });
  }, []);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    []
  );

  const keepSuggestionsOpen = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    measureTrigger();
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 800);
  };

  const handleSelect = (unit: string) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    onChangeText(unit);
    setShowSuggestions(false);
  };

  const suggestionsHeight = Math.min(214, Math.max(54, suggestions.length * 42 + 12));

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
      <View ref={triggerRef} collapsable={false} style={{ position: "relative" }}>
        <TextInput
          accessibilityLabel="Unidade"
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="Digite para buscar"
          value={value}
          onFocus={keepSuggestionsOpen}
          onBlur={handleBlur}
          onChangeText={(nextValue) => {
            onChangeText(nextValue);
            measureTrigger();
            setShowSuggestions(true);
          }}
          placeholderTextColor={colors.placeholder}
          style={{
            backgroundColor: colors.background,
            borderColor: showSuggestions ? colors.primaryBg : colors.border,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 10,
            paddingLeft: 10,
            paddingRight: 36,
            fontSize: 13,
            color: colors.text,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 11,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="search" size={15} color={colors.muted} />
        </View>
      </View>

      <AnchoredDropdown
        visible={isVisible}
        layout={triggerLayout}
        container={null}
        animationStyle={animatedStyle}
        zIndex={5301}
        maxHeight={suggestionsHeight}
        nestedScrollEnabled
        showVerticalScrollIndicator={suggestions.length > 4}
        onRequestClose={() => setShowSuggestions(false)}
        interactiveRefs={[triggerRef]}
        panelStyle={{ borderRadius: 14 }}
        scrollContentStyle={{ padding: 6, gap: 0, paddingBottom: 6 }}
      >
        <View accessibilityLabel="Sugestões de unidades existentes">
          {suggestions.length ? (
            suggestions.map((unit) => {
              const active = normalizeUnitKey(unit) === selectedKey;
              return (
                <Pressable
                  key={normalizeUnitKey(unit)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar unidade ${unit}`}
                  onPress={() => handleSelect(unit)}
                  style={{
                    minHeight: 42,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    backgroundColor: active ? colors.primaryBg : "transparent",
                  }}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: active ? colors.primaryText : colors.text,
                      fontSize: 13,
                      fontWeight: active ? "700" : "600",
                    }}
                  >
                    {unit}
                  </Text>
                  {active ? (
                    <GoAtletaIcon name="checkmark" size={15} color={colors.primaryText} />
                  ) : null}
                </Pressable>
              );
            })
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
              Nenhuma correspondência. Você pode usar o nome digitado.
            </Text>
          )}
        </View>
      </AnchoredDropdown>
    </View>
  );
}
