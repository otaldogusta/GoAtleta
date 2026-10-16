import { memo } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useAppTheme } from "../../ui/app-theme";
import { radius, spacing } from "../../theme/tokens";
import type { CourtVisualPayload } from "../../core/visual-court";
import type { CourtLibraryFilter, CourtLibraryItem, CourtLibraryLocation } from "./court-library";
import { CourtEditorScene } from "./CourtEditorScene";

const Preview = memo(function Preview({ payload, compact = false }: { payload: CourtVisualPayload; compact?: boolean }) {
  return <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.preview, compact ? { width: 50, height: 36 } : null]}><CourtEditorScene payload={payload} stepIndex={0} landscape /></View>;
});

type Props = {
  items: CourtLibraryItem[]; groups: CourtLibraryLocation[]; filter: CourtLibraryFilter;
  query: string; favorites: boolean; onlyLesson: boolean; lessonDate?: string; disabled: boolean;
  onQuery: (value: string) => void; onFilter: (value: CourtLibraryFilter) => void;
  onFavorites: () => void; onLesson: () => void; onClear: () => void;
  onOpen: (item: CourtLibraryItem) => void; onMenu: (id: string) => void;
  menuId: string | null; registerMenu: (id: string, node: View | null) => void;
  compact?: boolean;
};

export function CourtLibraryBrowser(props: Props) {
  const { colors } = useAppTheme();
  const compact = props.compact ?? false;
  const filtered = Boolean(props.query || props.favorites || props.onlyLesson);
  return <View style={styles.browser}>
    <View style={[styles.search, compact ? { minHeight: 34 } : null, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <GoAtletaIcon name="search" size={17} color={colors.muted} />
      <TextInput accessibilityLabel="Buscar na biblioteca" placeholder="Buscar jogadas" placeholderTextColor={colors.muted} value={props.query} onChangeText={props.onQuery} style={{ flex: 1, minHeight: compact ? 32 : 44, color: colors.text, fontSize: compact ? 12 : 14, borderRadius: 0 }} />
    </View>
    {props.filter !== "trash" ? <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: 2 }}>
        {([['all', 'Tudo'], ['local', 'Rascunhos'], ['team', 'Na turma'], ['template', 'Modelos']] as const).map(([id, label]) => <Pressable suppressWebHoverFeedback={compact} key={id} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: props.filter === id }} onPress={() => props.onFilter(id)} style={({ hovered, pressed }) => [styles.filter, compact ? { minHeight: 34, borderRadius: 999, overflow: "hidden" } : null, { backgroundColor: props.filter === id ? colors.secondaryBg : compact && (hovered || pressed) ? colors.inputBg : "transparent" }]}><Text style={{ color: props.filter === id ? colors.text : colors.muted, fontSize: 12, fontWeight: compact ? props.filter === id ? "500" : "400" : props.filter === id ? "700" : "500" }}>{label}</Text></Pressable>)}
        {props.lessonDate ? <Pressable suppressWebHoverFeedback={compact} accessibilityRole="button" accessibilityLabel="Somente esta aula" accessibilityState={{ selected: props.onlyLesson }} onPress={props.onLesson} style={({ hovered, pressed }) => [styles.filter, compact ? { minHeight: 34, borderRadius: 999, overflow: "hidden" } : null, { backgroundColor: props.onlyLesson ? colors.secondaryBg : compact && (hovered || pressed) ? colors.inputBg : "transparent" }]}><Text style={{ color: props.onlyLesson ? colors.text : colors.muted, fontSize: 12, fontWeight: compact ? props.onlyLesson ? "500" : "400" : props.onlyLesson ? "700" : "500" }}>Esta aula</Text></Pressable> : null}
      </ScrollView>
      <Pressable suppressWebHoverFeedback={compact} accessibilityRole="button" accessibilityLabel="Somente favoritos" accessibilityState={{ selected: props.favorites }} onPress={props.onFavorites} style={({ hovered, pressed }) => [styles.more, compact ? { width: 34, height: 34, borderRadius: 999, overflow: "hidden", backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" } : null]}><GoAtletaIcon name="star" size={18} color={props.favorites ? colors.primaryBg : colors.muted} /></Pressable>
    </View> : null}
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: spacing.sm }}>
      {props.groups.map(group => {
        const items = props.items.filter(item => item.location === group);
        if (!items.length) return null;
        const label = group === "local" ? "Rascunhos" : group === "team" ? "Jogadas da turma" : group === "template" ? "Modelos" : "Lixeira deste dispositivo";
        return <View key={group} style={{ marginTop: spacing.sm }}>
          <Text style={{ color: colors.muted, fontSize: 12, paddingVertical: spacing.sm }}>{label}</Text>
          {items.map(item => {
            const count = item.payload.timeline.steps.length;
            const date = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "";
            const detail = `${count} ${count === 1 ? "etapa" : "etapas"}${item.draft ? " · Alterações pendentes" : date ? ` · ${date}` : ""}`;
            return <View key={item.id} style={[styles.itemRow, { borderBottomColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${group === "trash" ? "Opções de" : "Abrir"} ${item.title}`} accessibilityState={{ selected: item.current }} disabled={props.disabled} onPress={() => props.onOpen(item)} style={({ hovered, pressed }) => [styles.item, compact ? { minHeight: 60 } : null, { backgroundColor: item.current ? colors.secondaryBg : hovered || pressed ? colors.inputBg : "transparent", opacity: props.disabled ? 0.55 : 1 }]}>
                <Preview payload={item.payload} compact={compact} />
                <View style={{ flex: 1, minWidth: 0 }}><Text numberOfLines={1} style={{ color: colors.text, fontSize: compact ? 12 : 14, fontWeight: "600" }}>{item.title}</Text><Text numberOfLines={1} style={{ color: colors.muted, fontSize: compact ? 11 : 12, marginTop: 3 }}>{detail}</Text></View>
                {item.current ? <Text style={{ color: colors.primaryBg, fontSize: compact ? 11 : 12, fontWeight: "600" }}>Editando</Text> : null}
              </Pressable>
              {item.document ? <View ref={node => props.registerMenu(item.id, node)} collapsable={false}><Pressable suppressWebHoverFeedback={compact} accessibilityRole="button" accessibilityLabel={`Opções de ${item.title}`} accessibilityState={{ expanded: props.menuId === item.id }} disabled={props.disabled} onPress={() => props.onMenu(item.id)} style={({ hovered, pressed }) => [styles.more, compact ? { width: 34, height: 34, borderRadius: 999, overflow: "hidden", backgroundColor: hovered || pressed ? colors.secondaryBg : "transparent" } : null]}><GoAtletaIcon name="ellipsisHorizontal" size={19} color={colors.muted} /></Pressable></View> : null}
            </View>;
          })}
        </View>;
      })}
      {!props.items.length ? <View style={{ paddingVertical: spacing.lg, gap: spacing.sm, alignItems: "center" }}><Text style={{ color: colors.muted, fontSize: 14 }}>{filtered ? "Nenhuma jogada encontrada." : props.filter === "trash" ? "A lixeira está vazia." : "Nenhuma jogada nesta seção."}</Text>{filtered ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar filtros da biblioteca" onPress={props.onClear} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.text, fontSize: 14 }}>Limpar filtros</Text></Pressable> : null}</View> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  browser: { flex: 1, minHeight: 0, gap: spacing.xs },
  search: { minHeight: 44, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.sm, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  filters: { flexDirection: "row", alignItems: "center" },
  filter: { minHeight: 44, paddingHorizontal: spacing.xs, borderRadius: radius.md, justifyContent: "center" },
  preview: { width: 60, height: 42, overflow: "hidden", borderRadius: radius.sm },
  itemRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1 },
  item: { flex: 1, minHeight: 72, padding: spacing.xs, borderRadius: radius.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  more: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
});
