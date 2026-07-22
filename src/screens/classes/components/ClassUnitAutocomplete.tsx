import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

import { normalizeUnitKey } from "../../../core/unit-key";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";

const MAX_VISIBLE_UNITS = 6;

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
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInSelectionRef = useRef<string | null>(null);
  const suggestions = useMemo(
    () => filterExistingUnitOptions(units, value),
    [units, value]
  );
  const selectedKey = normalizeUnitKey(value);

  useEffect(
    () => () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    },
    []
  );

  const keepSuggestionsOpen = () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
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

  const handleOptionPressIn = (unit: string) => {
    pressInSelectionRef.current = normalizeUnitKey(unit);
    handleSelect(unit);
  };

  const handleOptionPress = (unit: string) => {
    const key = normalizeUnitKey(unit);
    if (pressInSelectionRef.current === key) {
      pressInSelectionRef.current = null;
      return;
    }
    handleSelect(unit);
  };

  return (
    <View style={{ position: "relative", zIndex: showSuggestions ? 5300 : 1, gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>Unidade</Text>
      <View style={{ position: "relative", zIndex: showSuggestions ? 5301 : 1 }}>
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
        {showSuggestions ? (
          <View
            accessibilityLabel="Sugestões de unidades existentes"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: 6,
              height: Math.min(214, Math.max(54, suggestions.length * 42 + 12)),
              padding: 6,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 14,
              backgroundColor: colors.card,
              overflow: "hidden",
              zIndex: 5301,
              elevation: 30,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 10 },
            }}
          >
            {suggestions.length ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={suggestions.length > 4}
              >
                {suggestions.map((unit) => {
                  const active = normalizeUnitKey(unit) === selectedKey;
                  return (
                    <Pressable
                      key={normalizeUnitKey(unit)}
                      accessibilityRole="button"
                      accessibilityLabel={`Usar unidade ${unit}`}
                      onPressIn={() => handleOptionPressIn(unit)}
                      onPress={() => handleOptionPress(unit)}
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
                })}
              </ScrollView>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
                Nenhuma correspondência. Você pode usar o nome digitado.
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}
