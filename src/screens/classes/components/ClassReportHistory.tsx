import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from "react-native";
import { radius, spacing } from "../../../theme/tokens";
import { AnchoredDropdown } from "../../../ui/AnchoredDropdown";
import type { ThemeColors } from "../../../ui/app-theme";
import { GoAtletaIcon } from "../../../ui/icon-registry";
import { Pressable } from "../../../ui/Pressable";
import { REPORT_MONTHS, filterReportHistory, type ReportHistoryEntry } from "../application/report-history";

type Props = {
  colors: ThemeColors;
  inputBackground: string;
  compact: boolean;
  className: string;
  active: boolean;
  entries: ReportHistoryEntry[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onOpenReport: (date: string) => void;
  onClose: () => void;
};

const PAGE_SIZE = 30;
type Picker = "year" | "month";
type AnchorLayout = { x: number; y: number; width: number; height: number };

export function ClassReportHistory({ colors, inputBackground, compact, className, active, entries, loading, error, onRetry, onOpenReport, onClose }: Props) {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState("all");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [layout, setLayout] = useState<AnchorLayout | null>(null);
  const yearRef = useRef<View>(null);
  const monthRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const scrollOffset = useRef(0);
  const years = useMemo(() => [...new Set([String(new Date().getFullYear()), ...entries.map(entry => entry.dateKey.slice(0, 4))])].sort().reverse(), [entries]);
  const filtered = useMemo(() => filterReportHistory(entries, year, month, query), [entries, year, month, query]);
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const groups = useMemo(() => {
    const result: { key: string; label: string; entries: ReportHistoryEntry[] }[] = [];
    visible.forEach(entry => {
      let group = result[result.length - 1];
      if (!group || group.key !== entry.monthKey) {
        group = { key: entry.monthKey, label: entry.monthLabel, entries: [] };
        result.push(group);
      }
      group.entries.push(entry);
    });
    return result;
  }, [visible]);

  const resetList = () => {
    setVisibleCount(PAGE_SIZE);
    scrollOffset.current = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    if (!active) return;
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: scrollOffset.current, animated: false });
      if (Platform.OS === "web" && selectedDate && typeof document !== "undefined") {
        document.getElementById(`history-report-${selectedDate}`)?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [active, selectedDate]);

  const reset = () => { setYear("all"); setMonth("all"); setQuery(""); resetList(); };
  const changeQuery = (value: string) => { setQuery(value); resetList(); };
  const openReport = (dateKey: string) => {
    setSelectedDate(dateKey);
    setPicker(null);
    onOpenReport(dateKey);
  };
  const togglePicker = (next: Picker) => {
    if (picker === next) { setPicker(null); return; }
    (next === "year" ? yearRef : monthRef).current?.measureInWindow((x, y, width, height) => {
      setLayout({ x, y, width, height }); setPicker(next);
    });
  };
  const options = picker === "year"
    ? [{ value: "all", label: "Todos os anos" }, ...years.map(value => ({ value, label: value }))]
    : [{ value: "all", label: "Todos os meses" }, ...REPORT_MONTHS.map((label, index) => ({ value: String(index + 1).padStart(2, "0"), label }))];
  const fieldStyle = [styles.field, { backgroundColor: inputBackground, borderColor: colors.border }];

  return <View style={styles.root}>
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {!compact && <GoAtletaIcon name="time" size={20} color={colors.muted} />}
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.title, compact && styles.compactTitle, { color: colors.text }]}>Histórico de relatórios</Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{className}</Text>
      </View>
      <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar histórico" style={[styles.close, { borderColor: colors.border }]}>
        <GoAtletaIcon name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
    <View style={[styles.filters, compact && styles.compactFilters]}>
      <View ref={yearRef} collapsable={false} style={styles.year}>
        <Pressable onPress={() => togglePicker("year")} accessibilityRole="button" accessibilityLabel={`Ano: ${year === "all" ? "Todos os anos" : year}`} accessibilityState={{ expanded: picker === "year" }} style={fieldStyle}>
          <Text numberOfLines={1} style={[styles.fieldText, { color: colors.text }]}>{year === "all" ? "Todos os anos" : year}</Text>
          <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
        </Pressable>
      </View>
      <View ref={monthRef} collapsable={false} style={styles.month}>
        <Pressable onPress={() => togglePicker("month")} accessibilityRole="button" accessibilityLabel={`Mês: ${month === "all" ? "Todos os meses" : REPORT_MONTHS[Number(month) - 1]}`} accessibilityState={{ expanded: picker === "month" }} style={fieldStyle}>
          <Text numberOfLines={1} style={[styles.fieldText, { color: colors.text }]}>{month === "all" ? "Todos os meses" : REPORT_MONTHS[Number(month) - 1]}</Text>
          <GoAtletaIcon name="chevronDown" size={14} color={colors.muted} />
        </Pressable>
      </View>
      <View style={[fieldStyle, styles.search, compact && styles.compactSearch]}>
        <GoAtletaIcon name="search" size={17} color={colors.muted} />
        <TextInput value={query} onChangeText={changeQuery} onFocus={() => setPicker(null)} accessibilityLabel="Buscar no relato" placeholder="Buscar no relato" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.inputText }]} />
        {query ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => changeQuery("")} style={styles.clear}>
          <GoAtletaIcon name="close" size={16} color={colors.muted} />
        </Pressable> : null}
      </View>
    </View>
    <AnchoredDropdown visible={active && picker !== null} layout={layout} container={{ x: 0, y: 0 }} animationStyle={{}} zIndex={6000} maxHeight={280} nestedScrollEnabled fitContent density="menu" preferredWidth={picker === "year" ? 180 : 210} interactiveRefs={[yearRef, monthRef]} onRequestClose={() => setPicker(null)}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: option.value === (picker === "year" ? year : month) }}
        onPress={() => { if (picker === "year") setYear(option.value); else setMonth(option.value); setPicker(null); resetList(); }} style={styles.option}>
        <Text style={[styles.fieldText, { color: colors.text }]}>{option.label}</Text>
        {option.value === (picker === "year" ? year : month) && <GoAtletaIcon name="checkmark" size={16} color={colors.text} />}
      </Pressable>)}
    </AnchoredDropdown>
    <ScrollView ref={scrollRef} testID="report-history-list" style={[styles.list, Platform.OS === "web" ? { scrollbarWidth: "thin", scrollbarColor: `${colors.borderStrong} transparent` } as ViewStyle : null]} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator scrollEventThrottle={32}
      onScroll={event => { if (active) scrollOffset.current = event.nativeEvent.contentOffset.y; }} onScrollBeginDrag={() => setPicker(null)}>
      {error ? <View style={styles.empty} accessibilityLiveRegion="polite">
        <GoAtletaIcon name="cloudOffline" size={28} color={colors.muted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Não foi possível carregar o histórico.</Text>
        <Pressable accessibilityRole="button" onPress={onRetry} style={styles.link}><Text style={[styles.linkText, { color: colors.text }]}>Tentar novamente</Text></Pressable>
      </View> : loading && !entries.length ? <View style={styles.empty} accessibilityLiveRegion="polite">
        <ActivityIndicator color={colors.primaryBg} />
        <Text style={[styles.meta, { color: colors.muted }]}>Carregando relatórios…</Text>
      </View> : !filtered.length ? <View style={styles.empty} accessibilityLiveRegion="polite">
        <GoAtletaIcon name="document" size={28} color={colors.muted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{entries.length ? "Nenhum relatório neste filtro." : "Nenhum relatório registrado."}</Text>
        {entries.length > 0 && <Pressable accessibilityRole="button" onPress={reset} style={styles.link}><Text style={[styles.linkText, { color: colors.text }]}>Limpar filtros</Text></Pressable>}
      </View> : groups.map(group => <View key={group.key} style={styles.group}>
        <Text accessibilityRole="header" style={[styles.groupTitle, { color: colors.muted }]}>{group.label}</Text>
        {group.entries.map(entry => <View key={entry.dateKey} style={[styles.rowDivider, { borderBottomColor: colors.border }]}>
          <Pressable nativeID={`history-report-${entry.dateKey}`} accessibilityRole="button" accessibilityLabel={`Abrir relatório de ${entry.dateLabel}: ${entry.title}`} onPress={() => openReport(entry.dateKey)} style={styles.row}>
            <View style={styles.date}>
              <Text style={[styles.day, { color: colors.text }]}>{entry.day}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{entry.weekday}</Text>
            </View>
            <View style={styles.copy}>
              <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.text }]}>{entry.title}</Text>
              {entry.preview ? <Text numberOfLines={1} style={[styles.preview, { color: colors.muted }]}>{entry.preview}</Text> : null}
            </View>
            <GoAtletaIcon name="chevronRight" size={16} color={colors.muted} />
          </Pressable>
        </View>)}
      </View>)}
      {!error && visibleCount < filtered.length && <Pressable accessibilityRole="button" onPress={() => setVisibleCount(value => value + PAGE_SIZE)} style={styles.link}><Text style={[styles.linkText, { color: colors.text }]}>Mostrar mais relatórios</Text></Pressable>}
    </ScrollView>
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <Text accessibilityLiveRegion="polite" style={[styles.meta, { color: colors.muted }]}>{error ? "Histórico indisponível" : loading ? "Carregando…" : `${filtered.length} ${filtered.length === 1 ? "relatório" : "relatórios"}`}</Text>
      <Text style={[styles.meta, { color: colors.muted }]}>Mais recentes primeiro</Text>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderBottomWidth: 1 },
  heading: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
  compactTitle: { fontSize: 20, lineHeight: 26 },
  meta: { fontSize: 12, lineHeight: 18 },
  close: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  filters: { flexDirection: "row", gap: spacing.xs, padding: spacing.lg },
  compactFilters: { flexWrap: "wrap", padding: spacing.md },
  year: { width: 140 },
  month: { flex: 1, minWidth: 145 },
  field: { flexDirection: "row", alignItems: "center", gap: spacing.xs, minHeight: 50, borderRadius: radius.internal, paddingHorizontal: 14, borderWidth: 1 },
  fieldText: { flex: 1, fontSize: 14 },
  search: { flex: 1.4, minWidth: 160 },
  compactSearch: { flexBasis: "100%" },
  input: { flex: 1, minWidth: 0, fontSize: 14, padding: 0, borderRadius: 0, height: 48 },
  clear: { width: 32, height: 40, alignItems: "center", justifyContent: "center" },
  option: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.internal },
  list: { flex: 1, minHeight: 0 },
  listContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.lg },
  group: { marginBottom: spacing.lg },
  groupTitle: { fontSize: 12, fontWeight: "600", paddingHorizontal: spacing.xs, marginBottom: spacing.xs },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 3 },
  row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.sm, borderRadius: radius.internal },
  date: { width: 34, alignItems: "center", gap: 2 },
  day: { fontSize: 20, lineHeight: 24, fontWeight: "600" },
  copy: { flex: 1, minWidth: 0, gap: 6 },
  rowTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  preview: { fontSize: 12, lineHeight: 18 },
  empty: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingVertical: 48, paddingHorizontal: spacing.md },
  emptyTitle: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  link: { minHeight: 44, paddingHorizontal: spacing.sm, alignItems: "center", justifyContent: "center", alignSelf: "center", borderRadius: radius.internal },
  linkText: { fontSize: 12, fontWeight: "600", textDecorationLine: "underline" },
  footer: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs, padding: spacing.lg, borderTopWidth: 1 },
});
