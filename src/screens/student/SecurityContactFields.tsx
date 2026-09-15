import { useState, type ComponentType } from "react";
import { Text, TextInput, View } from "react-native";
import { Button } from "../../ui/Button";
import { Pressable } from "../../ui/Pressable";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { useConfirmDialog } from "../../ui/confirm-dialog";
import { useAppTheme } from "../../ui/app-theme";
import type { useSecurityContactVerification } from "./useSecurityContactVerification";

type FieldProps = { label: string; value: string; onChangeText: (v: string) => void; placeholder: string;
  error: string | null; autoComplete?: "email" | "off" | "one-time-code"; returnKeyType?: "done";
  keyboardType?: "email-address" | "number-pad"; maxLength?: number; onSubmitEditing?: () => void };
export function SecurityContactFields({ model, Field, ErrorBalloon }: {
  model: ReturnType<typeof useSecurityContactVerification>; Field: ComponentType<FieldProps>;
  ErrorBalloon: ComponentType<{ message: string | null }>;
}) {
  const { colors } = useAppTheme();
  const { confirm } = useConfirmDialog();
  const [codeFocused, setCodeFocused] = useState(false);
  const m = model;
  return <View style={{ gap: 12, overflow: "visible" }}>
    {m.verified ? <View style={{ gap: 8, overflow: "visible" }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>E-mail alternativo</Text>
      <View style={{ minHeight: 50, paddingLeft: 14, paddingRight: 4, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondaryBg, flexDirection: "row", alignItems: "center", gap: 8, overflow: "visible" }}>
        <ErrorBalloon message={m.error} />
        <Text selectable style={{ color: colors.muted, fontSize: 15, flex: 1, minWidth: 0 }}>{m.draft}</Text>
        <View accessible accessibilityLabel="E-mail confirmado" accessibilityRole="image">
          <GoAtletaIcon name="success" size={20} color={colors.successText} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Remover e-mail alternativo" disabled={m.busy}
          onPress={() => { void confirm({ title: "Remover e-mail alternativo?", message: "O e-mail de acesso será mantido.", confirmLabel: "Remover", cancelLabel: "Cancelar", tone: "danger", onConfirm: () => m.run("remove") }); }}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", opacity: m.busy ? 0.55 : 1 }}>
          <GoAtletaIcon name="close" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View> : <Field label="E-mail alternativo" value={m.draft} placeholder="email@exemplo.com" autoComplete="email" keyboardType="email-address"
      error={!m.pending ? m.error : null} onChangeText={value => { if (!m.busy) { m.setDraft(value); m.setCode(""); m.setError(null); } }} />
    }
    {!m.status ? <Button label={m.busy ? "Carregando..." : "Tentar novamente"} disabled={m.busy} onPress={() => void m.load()} /> : null}
    {m.pending ? <>
      <View style={{ gap: 8, overflow: "visible" }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>Código de confirmação</Text>
        <View style={{ position: "relative", overflow: "visible", minHeight: 50 }}>
          <ErrorBalloon message={m.error} />
          <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", gap: 6 }}>
            {Array.from({ length: 8 }, (_, index) => <View key={index} testID={`security-code-cell-${index}`} style={{ flex: 1, minWidth: 0, maxWidth: 50, height: 50, borderRadius: 12, borderWidth: 1, borderColor: m.error ? colors.dangerBorder : codeFocused && index === Math.min(m.code.length, 7) ? colors.text : colors.border, backgroundColor: colors.inputBg, justifyContent: "center", alignItems: "center" }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>{m.code[index] ?? ""}</Text>
            </View>)}
          </View>
          <TextInput accessibilityLabel="Código de confirmação" value={m.code} autoComplete="one-time-code" keyboardType="number-pad" maxLength={32} returnKeyType="done" editable={!m.busy}
            onFocus={() => setCodeFocused(true)} onBlur={() => setCodeFocused(false)}
            onChangeText={m.completeCode}
            onSubmitEditing={() => { if (m.code.length === 8) void m.run("verify"); }}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 50, opacity: 0, borderRadius: 0 }} />
        </View>
      </View>
      <Button label="Confirmar e-mail" loading={m.busy} disabled={m.busy || m.code.length !== 8} onPress={() => void m.run("verify")} />
    </> : null}
    {m.status && !m.verified ? <Button variant={m.pending ? "ghost" : "secondary"}
      label={m.retrySeconds ? `Reenviar em ${m.retrySeconds}s` : m.pending ? "Reenviar código" : "Enviar código"}
      disabled={!m.canRequest} onPress={() => void m.run("request")} /> : null}
    {m.status?.email && !m.draft.trim() ? <Button variant="secondary" label="Remover e-mail" loading={m.busy} loadingLabel="Removendo…" disabled={m.busy} onPress={() => { void m.run("remove").catch(error => m.setError(error instanceof Error ? error.message : "Não foi possível remover.")); }} /> : null}
  </View>;
}
