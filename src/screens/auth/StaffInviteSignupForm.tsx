import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, TextInput, View } from "react-native";
import type { StaffSignupFields } from "../../api/staff-invite";
import { getProfileNameValidationError, normalizeProfileName } from "../../core/profile-name";
import { Button } from "../../ui/Button";
import { useAppTheme } from "../../ui/app-theme";

export function StaffInviteSignupForm({ busy, error, onChange, onSubmit }: {
  busy: boolean;
  error: string;
  onChange: () => void;
  onSubmit: (fields: StaffSignupFields) => Promise<void>;
}) {
  const { colors, mode } = useAppTheme();
  const inputBg = mode === "dark" ? "#121c30" : colors.inputBg;
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const enterAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enterAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [enterAnim]);
  useEffect(() => {
    if (!error) return;
    Animated.sequence([-6, 6, -4, 4, 0].map(toValue =>
      Animated.timing(shakeAnim, { toValue, duration: 45, useNativeDriver: true })
    )).start();
  }, [error, shakeAnim]);
  const valid = !getProfileNameValidationError(name) && password.trim().length >= 6 && password.length <= 128 && password === confirm;
  const submit = () => {
    if (valid && !busy) void onSubmit({ full_name: normalizeProfileName(name), password });
  };
  return <Animated.View style={[styles.form, { opacity: enterAnim, transform: [{ translateX: shakeAnim }] }]}>
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>Nome</Text>
      <View style={[styles.inputContainer, { backgroundColor: inputBg }]}>
        <TextInput accessibilityLabel="Nome" autoComplete="name" value={name} editable={!busy} maxLength={80}
          onChangeText={value => { setName(value); onChange(); }} style={[styles.input, { color: colors.text }]} />
      </View>
    </View>
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>Criar senha</Text>
      <View style={[styles.inputContainer, { backgroundColor: inputBg }]}>
        <TextInput accessibilityLabel="Criar senha" autoComplete="new-password" secureTextEntry autoCapitalize="none" value={password} editable={!busy} maxLength={128}
          placeholder="Pelo menos 6 caracteres" placeholderTextColor={colors.muted}
          onChangeText={value => { setPassword(value); onChange(); }} style={[styles.input, { color: colors.text }]} />
      </View>
    </View>
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>Confirmar senha</Text>
      <View style={[styles.inputContainer, { backgroundColor: inputBg }]}>
        <TextInput accessibilityLabel="Confirmar senha" autoComplete="new-password" secureTextEntry autoCapitalize="none" value={confirm} editable={!busy} maxLength={128}
          onSubmitEditing={submit} onChangeText={value => { setConfirm(value); onChange(); }} style={[styles.input, { color: colors.text }]} />
      </View>
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
    <Button label={busy ? "Concluindo..." : "Concluir e entrar"} disabled={!valid || busy} onPress={submit} />
  </Animated.View>;
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  inputContainer: { minHeight: 50, borderRadius: 12, paddingHorizontal: 14, justifyContent: "center" },
  input: { width: "100%", minHeight: 50, borderRadius: 0, fontSize: 16 },
});
