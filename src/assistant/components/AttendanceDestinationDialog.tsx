import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { listAdminPendingAttendance, type AdminPendingAttendance } from "../../api/reports";
import { attendanceDestinations } from "../attendance-destinations";
import { ModalSheet } from "../../ui/ModalSheet";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { radius, spacing } from "../../theme/tokens";

export function AttendanceDestinationDialog({ text, organizationId, onClose, onOpen }: {
  text: string; organizationId: string; onClose: () => void; onOpen: (item: AdminPendingAttendance) => void;
}) {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<AdminPendingAttendance[]>([]);
  const [selected, setSelected] = useState<AdminPendingAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void listAdminPendingAttendance({ organizationId }).then(rows => {
      if (!active) return;
      const options = attendanceDestinations(text, rows, organizationId);
      setItems(options);
      if (options.length === 1) setSelected(options[0]);
    }).catch(() => { if (active) setError("Não foi possível consultar as chamadas. Feche e tente novamente."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, text]);
  return <ModalSheet visible onClose={onClose} position="center" overlayZIndex={30000} cardStyle={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>Abrir chamada pendente?</Text>
    <Text style={{ color: colors.muted }}>Escolha a turma. Sua conversa fica salva no histórico.</Text>
    {loading ? <Text style={{ color: colors.muted }}>Consultando pendências...</Text> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
    {!loading && !error && !items.length ? <Text style={{ color: colors.muted }}>Não há chamadas pendentes disponíveis.</Text> : null}
    <ScrollView style={styles.list}>
      {items.map(item => <Pressable key={`${item.classId}:${item.targetDate}`} accessibilityRole="radio" accessibilityState={{ checked: selected === item }} onPress={() => setSelected(item)} style={[styles.item, { borderColor: selected === item ? colors.text : colors.border, backgroundColor: selected === item ? colors.secondaryBg : colors.card }]}>
        <Text style={[styles.label, { color: colors.text }]}>{item.className}</Text>
        <Text style={{ color: colors.muted }}>{item.unit} · {item.targetDate.split("-").reverse().join("/")}</Text>
      </Pressable>)}
    </ScrollView>
    <View style={styles.actions}><Button label="Cancelar" variant="secondary" onPress={onClose} /><Button label="Abrir" disabled={!selected || loading} onPress={() => { if (selected) onOpen(selected); }} /></View>
  </ModalSheet>;
}
const styles = StyleSheet.create({ card: { width: "100%", maxWidth: 440, maxHeight: "85%", borderWidth: 1, borderRadius: radius.container, padding: spacing.lg, gap: spacing.md }, title: { fontSize: 18, fontWeight: "700" }, list: { maxHeight: 320 }, item: { padding: spacing.sm, borderWidth: 1, borderRadius: radius.internal, marginBottom: spacing.xs, gap: spacing.xs }, label: { fontWeight: "600" }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm } });
