import { useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { createStudentRelationshipInvite } from "../../api/student-relationship-invite";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";

export function useGuardianAthleteInvite(organizationId: string, studentId: string) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const lock = useRef(false);
  const create = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await createStudentRelationshipInvite({ organizationId, studentId, invitedEmail: email.trim(),
        relationshipKind: "athlete", invitedVia: "link", issuer: "guardian" });
      setUrl(result.inviteUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível criar o convite."); }
    finally { lock.current = false; setBusy(false); }
  };
  return { email, url, busy, error, copied, create,
    changeEmail: (value: string) => { setEmail(value); setError(""); },
    copy: () => Clipboard.setStringAsync(url).then(() => setCopied(true)).catch(() => setError("Não foi possível copiar. Tente novamente.")),
  };
}

export function GuardianAthleteInvite({ organizationId, studentId }: { organizationId: string; studentId: string }) {
  const state = useGuardianAthleteInvite(organizationId, studentId);
  return <GuardianAthleteInviteView state={state} />;
}

export function GuardianAthleteInviteView({ state }: { state: ReturnType<typeof useGuardianAthleteInvite> }) {
  const { colors } = useAppTheme();
  const { email, url, busy, error, copied, create, changeEmail, copy } = state;
  return <View style={{ gap: 12 }}>
    <Text style={{ color: colors.text, fontWeight: "700" }}>Convidar atleta</Text>
    <View style={{ minHeight: 50, borderRadius: 12, paddingHorizontal: 14, backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }}>
      <TextInput accessibilityLabel="E-mail do atleta" placeholder="E-mail do atleta" placeholderTextColor={colors.placeholder}
        value={email} editable={!busy && !url} onChangeText={changeEmail}
        keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        style={{ minHeight: 50, borderRadius: 0, color: colors.inputText }} />
    </View>
    {url ? <>
      <Text style={{ color: colors.muted }}>Convite criado para este atleta. Envie o link ao destinatário.</Text>
      <Button label={copied ? "Link copiado" : "Copiar convite"} onPress={() => { void copy(); }} />
    </> : <Button label="Criar convite" loading={busy} loadingLabel="Criando convite…"
      disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())} onPress={() => void create()} />}
    {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
  </View>;
}
