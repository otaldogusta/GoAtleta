import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";

import { normalizeUnitKey } from "../../../core/unit-key";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";

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
  label?: string;
  placeholder?: string;
  showValueAsBadge?: boolean;
};

export function ClassUnitAutocomplete({
  colors,
  value,
  units,
  onChangeText,
  label = "Unidade",
  placeholder = "Digite para buscar",
  showValueAsBadge = false,
}: ClassUnitAutocompleteProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isEditing, setIsEditing] = useState(() => !value.trim());
  const [triggerLayout, setTriggerLayout] = useState<Layout | null>(null);
  const triggerRef = useRef<View | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestions = useMemo(
    () => filterExistingUnitOptions(units, value),
    [units, value]
  );
  const selectedKey = normalizeUnitKey(value);
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
    setIsEditing(false);
    setShowSuggestions(false);
  };

  const typedValue = value.trim();
  const hasExactMatch = suggestions.some(
    (unit) => normalizeUnitKey(unit) === normalizeUnitKey(typedValue)
  );

  const suggestionsHeight = Math.min(214, Math.max(54, suggestions.length * 42 + 12));

  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <View ref={triggerRef} collapsable={false} onLayout={measureTrigger} style={{ position: "relative" }}>
        {showValueAsBadge && typedValue && !isEditing ? (
          <View style={{ minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.inputBg, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0, minHeight: 34, borderRadius: 9, backgroundColor: colors.secondaryBg, paddingLeft: 11, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 12, fontWeight: "700" }}>{typedValue}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${label.toLocaleLowerCase("pt-BR")} ${typedValue}`} onPress={() => { onChangeText(""); setIsEditing(true); setShowSuggestions(true); }} style={{ width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" }}>
                <GoAtletaIcon name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <TextInput
              accessibilityLabel={label}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder={placeholder}
              value={value}
              onFocus={keepSuggestionsOpen}
              onBlur={handleBlur}
              onChangeText={(nextValue) => {
                setIsEditing(true);
                onChangeText(nextValue);
                measureTrigger();
                setShowSuggestions(true);
              }}
              placeholderTextColor={colors.placeholder}
              style={{
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                minHeight: 50,
                paddingVertical: 10,
                paddingLeft: 10,
                paddingRight: 36,
                fontSize: 13,
                color: colors.text,
                ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null),
              }}
            />
            <View pointerEvents="none" style={{ position: "absolute", right: 11, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <GoAtletaIcon name="search" size={15} color={colors.muted} />
            </View>
          </>
        )}
      </View>

      <AnchoredDropdown
        visible={showSuggestions}
        layout={triggerLayout}
        container={null}
        animationStyle={{ opacity: triggerLayout ? 1 : 0 }}
        zIndex={5301}
        maxHeight={suggestionsHeight}
        nestedScrollEnabled
        portalToBodyOnWeb
        fitContent
        showVerticalScrollIndicator={suggestions.length > 4}
        onRequestClose={() => setShowSuggestions(false)}
        interactiveRefs={[triggerRef]}
        panelStyle={{ borderRadius: 14 }}
        scrollContentStyle={{ padding: 6, gap: 0, paddingBottom: 6 }}
      >
        <View accessibilityLabel={label === "Unidade" ? "Sugestões de unidades existentes" : `Sugestões existentes para ${label.toLocaleLowerCase("pt-BR")}`}>
          {suggestions.length ? (
            <>
              {suggestions.map((unit) => {
              const active = normalizeUnitKey(unit) === selectedKey;
              return (
                <Pressable
                  key={normalizeUnitKey(unit)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar ${label.toLocaleLowerCase("pt-BR")} ${unit}`}
                  accessibilityState={{ selected: active }}
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
                </Pressable>
              );
              })}
              {showValueAsBadge && typedValue && !hasExactMatch ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Cadastrar ${label.toLocaleLowerCase("pt-BR")} ${typedValue}`}
                  onPress={() => handleSelect(typedValue)}
                  style={{
                    minHeight: 42,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: colors.secondaryBg,
                  }}
                >
                  <GoAtletaIcon name="add" size={16} color={colors.text} />
                  <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }}>
                    Cadastrar “{typedValue}”
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            showValueAsBadge && typedValue ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cadastrar ${label.toLocaleLowerCase("pt-BR")} ${typedValue}`}
                onPress={() => handleSelect(typedValue)}
                style={{ minHeight: 42, paddingHorizontal: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.secondaryBg }}
              >
                <GoAtletaIcon name="add" size={16} color={colors.text} />
                <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" }}>Cadastrar “{typedValue}”</Text>
              </Pressable>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12, padding: 10 }}>
                Nenhuma correspondência.
              </Text>
            )
          )}
        </View>
      </AnchoredDropdown>
    </View>
  );
}
