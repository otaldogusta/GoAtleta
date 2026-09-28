import { StyleSheet, Text, View } from "react-native";

import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";
import type { AssistantTrainingDraft } from "../training-draft";

type Props = {
  draft: AssistantTrainingDraft;
  className?: string;
  onApply: () => void;
};

const formatItems = (items: string[]) => items.length ? items.join(" · ") : "Sem itens";

export function AssistantTrainingDraftCard({ draft, className, onApply }: Props) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.muted }]}>Rascunho para revisão</Text>
          <Text style={[styles.title, { color: colors.text }]}>{draft.title}</Text>
          {className ? <Text style={[styles.className, { color: colors.muted }]}>{className}</Text> : null}
        </View>
      </View>
      <DraftBlock label="Aquecimento" time={draft.warmupTime} items={draft.warmup} />
      <DraftBlock label="Parte principal" time={draft.mainTime} items={draft.main} />
      <DraftBlock label="Volta à calma" time={draft.cooldownTime} items={draft.cooldown} />
      <Button label="Aplicar ao planejamento" onPress={onApply} />
      <Text style={[styles.note, { color: colors.muted }]}>O plano será aberto no editor para você revisar antes de salvar.</Text>
    </View>
  );
}

function DraftBlock({ label, time, items }: { label: string; time: string; items: string[] }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.block, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.blockTitle, { color: colors.text }]}>{label}{time ? ` · ${time}` : ""}</Text>
      <Text style={[styles.items, { color: colors.text }]}>{formatItems(items)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: "100%", maxWidth: 720, alignSelf: "center", borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  headingCopy: { flex: 1, minWidth: 0, gap: 2 },
  eyebrow: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  title: { fontSize: 18, lineHeight: 23, fontWeight: "800" },
  className: { fontSize: 13 },
  block: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  blockTitle: { fontSize: 13, fontWeight: "700" },
  items: { fontSize: 13, lineHeight: 19 },
  note: { fontSize: 12, lineHeight: 17, textAlign: "center" },
});
