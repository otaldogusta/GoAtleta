import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from "react-native";

import { radius, spacing } from "../../../theme/tokens";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { ModalSheet } from "../../../ui/ModalSheet";
import { OperationalText as Text } from "../../../ui/OperationalText";
import { Pressable } from "../../../ui/Pressable";

export type HomeSearchEntry = {
  id: string;
  title: string;
  section: string;
  keywords?: string;
  description?: string;
};

type HomeSearchModalProps = {
  visible: boolean;
  onClose: () => void;
  entries: readonly HomeSearchEntry[];
  onSelect: (entry: HomeSearchEntry) => void;
  colors: ThemeColors;
  loading?: boolean;
  partialFailure?: boolean;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function HomeSearchModal({
  visible,
  onClose,
  entries,
  onSelect,
  colors,
  loading = false,
  partialFailure = false,
}: HomeSearchModalProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);
  const resultsRef = useRef<ScrollView>(null);
  const { height } = useWindowDimensions();
  const terms = normalize(query);

  useEffect(() => {
    resultsRef.current?.scrollTo({ y: 0, animated: false });
  }, [query]);

  const index = useMemo(() => entries.map(entry => ({
    entry,
    title: normalize(entry.title),
    searchable: normalize([entry.title, entry.section, entry.description, entry.keywords].filter(Boolean).join(" ")),
  })), [entries]);

  const groups = useMemo(() => {
    const tokens = terms.split(/\s+/);
    const filtered = terms
      ? index.filter(({ searchable }) => tokens.every(token => searchable.includes(token)))
        .sort((a, b) => Number(b.title.startsWith(terms)) - Number(a.title.startsWith(terms)))
        .map(({ entry }) => entry)
      : entries.slice(0, 6);
    const grouped = new Map<string, HomeSearchEntry[]>();
    for (const entry of filtered) {
      const group = grouped.get(entry.section);
      if (group) group.push(entry);
      else grouped.set(entry.section, [entry]);
    }
    return [...grouped];
  }, [entries, index, terms]);

  const close = useCallback(() => {
    setQuery("");
    onClose();
  }, [onClose]);

  function select(entry: HomeSearchEntry) {
    setQuery("");
    onSelect(entry);
  }

  return (
    <ModalSheet
      visible={visible}
      onClose={close}
      dialogLabel="Pesquisar no Go Atleta"
      position="center"
      cardStyle={[
        styles.card,
        { height: Math.min(height * 0.76, 480), backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.header}>
        <View testID="home-search-field" style={[styles.field, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <GoAtletaIcon name="search" size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            autoFocus={Platform.OS !== "web"}
            autoCorrect={false}
            autoCapitalize="none"
            accessibilityLabel="Pesquisar no app"
            placeholder="Pesquisar no app"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
            style={[styles.input, { color: colors.text }]}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar busca"
              onPress={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              style={styles.iconButton}
            >
              <GoAtletaIcon name="closeCircle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar busca" onPress={close} style={styles.iconButton}>
          <GoAtletaIcon name="close" size={19} color={colors.text} />
        </Pressable>
      </View>

      <ScrollView
        ref={resultsRef}
        testID="home-search-results"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        showsVerticalScrollIndicator
        style={styles.scroll}
        contentContainerStyle={styles.results}
      >
        {loading ? (
          <View style={styles.feedback} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={[styles.description, { color: colors.muted }]}>Carregando resultados…</Text>
          </View>
        ) : null}
        {partialFailure ? (
          <Text accessibilityLiveRegion="polite" style={[styles.feedbackCopy, { color: colors.muted }]}>
            Alguns resultados estão indisponíveis.
          </Text>
        ) : null}
        {groups.length === 0 ? (!loading && (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <Text style={[styles.resultTitle, { color: colors.text }]}>{terms ? "Nenhum resultado" : "Sem sugestões"}</Text>
            {terms ? <Text style={{ color: colors.muted }}>Tente outro nome ou termo.</Text> : null}
          </View>
        )) : (
          groups.map(([section, group]) => (
            <View key={section} style={styles.section}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.muted }]}>{section}</Text>
              {group.map(entry => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  accessibilityLabel={entry.title}
                  accessibilityHint={entry.description}
                  onPress={() => select(entry)}
                  style={({ hovered, pressed }) => [
                    styles.result,
                    { backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" },
                  ]}
                >
                  <View style={styles.resultCopy}>
                    <Text style={[styles.resultTitle, { color: colors.text }]}>{entry.title}</Text>
                    {entry.description ? (
                      <Text numberOfLines={2} style={[styles.description, { color: colors.muted }]}>{entry.description}</Text>
                    ) : null}
                  </View>
                  <GoAtletaIcon name="arrowForward" size={15} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 540, maxHeight: "100%", padding: spacing.sm, borderWidth: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  field: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: radius.internal,
  },
  input: { flex: 1, minWidth: 0, minHeight: 48, padding: 0, borderRadius: 0, fontSize: 15 },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.internal },
  scroll: { flex: 1, minHeight: 0 },
  results: { paddingTop: spacing.xs, gap: spacing.xs },
  feedback: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  feedbackCopy: { fontSize: 12, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  section: { gap: 2 },
  sectionTitle: { fontSize: 12, fontWeight: "700", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  result: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.internal,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  resultCopy: { flex: 1, minWidth: 0 },
  resultTitle: { fontSize: 14, fontWeight: "700" },
  description: { fontSize: 12, marginTop: 2 },
  empty: { padding: spacing.lg, alignItems: "center", gap: spacing.xs },
});
