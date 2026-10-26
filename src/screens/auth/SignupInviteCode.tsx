import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, TextInput, View } from "react-native";
import { validateTrainerInvite } from "../../api/trainer-invite";
import { getPastedStaffInviteProof, getInviteEmailSuggestion, normalizeInviteCodeInput } from "../../auth/invite-code-input";
import type { StaffInviteProof } from "../../auth/staff-invite-link";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";
import { AuthFieldError } from "../../ui/AuthFieldError";

export function SignupInviteCode({ code, disabled, submissionError = "", onChange, onVerified, onRemove }: {
  code: string;
  disabled: boolean;
  submissionError?: string;
  onChange: (code: string, emailSuggestion?: string, proof?: StaffInviteProof | null) => void;
  onVerified: (code: string) => void;
  onRemove: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "error">("idle");
  const [validationError, setError] = useState("");
  const error = submissionError || validationError;
  const [input, setInput] = useState({ code, disabled });
  if (input.code !== code || input.disabled !== disabled) {
    setInput({ code, disabled });
    setStatus("idle");
    setError("");
  }
  const generation = useRef(0);
  const [shake] = useState(() => new Animated.Value(0));
  const [checkAnim] = useState(() => new Animated.Value(0));
  const reducedMotion = useRef(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) reducedMotion.current = value;
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (value) => {
      reducedMotion.current = value;
      if (value) { checkAnim.stopAnimation(); checkAnim.setValue(1); }
    });
    return () => { active = false; subscription.remove(); };
  }, [checkAnim]);

  useEffect(() => {
    const request = ++generation.current;
    checkAnim.stopAnimation();
    checkAnim.setValue(0);
    if (disabled || submissionError || !code.trim()) return;
    const timer = setTimeout(async () => {
      if (request !== generation.current) return;
      setStatus("checking");
      try {
        await validateTrainerInvite(code);
        if (request !== generation.current) return;
        setStatus("valid");
        onVerified(code.trim().toUpperCase());
        if (reducedMotion.current) checkAnim.setValue(1);
        else Animated.spring(checkAnim, {
          toValue: 1, speed: 24, bounciness: 6, useNativeDriver: true,
        }).start();
      } catch (cause) {
        if (request !== generation.current) return;
        setError(cause instanceof Error ? cause.message : "Não foi possível verificar. Tente novamente.");
        setStatus("error");
        if (!reducedMotion.current) Animated.sequence([8, -8, 5, -5, 0].map((toValue) =>
          Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true }))).start();
      }
    }, 700);
    return () => { clearTimeout(timer); generation.current += 1; };
  }, [code, disabled, submissionError, onVerified, checkAnim, shake]);

  return <View style={{ gap: 8, position: "relative", zIndex: error ? 50 : 1, overflow: "visible" }}>
    <Animated.View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, borderRadius: 12,
      paddingHorizontal: 14, borderWidth: 1,
      borderColor: error ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
      overflow: "visible", zIndex: 1, transform: [{ translateX: shake }],
      backgroundColor: mode === "dark" ? "#121c30" : colors.inputBg }}>
      <AuthFieldError message={error} />
      <TextInput accessibilityLabel="Código de convite" placeholder="Código de convite"
        placeholderTextColor={colors.placeholder} value={code} editable={!disabled && (Boolean(submissionError) || status !== "valid")}
        autoCapitalize="characters" autoCorrect={false} maxLength={4096}
        onChangeText={(value) => {
          if (disabled || (!submissionError && status === "valid")) return;
          const normalized = normalizeInviteCodeInput(value);
          if (normalized === code) return;
          generation.current += 1;
          setStatus("idle");
          setError("");
          onChange(normalized, getInviteEmailSuggestion(value), getPastedStaffInviteProof(value));
        }}
        style={{ flex: 1, minWidth: 0, padding: 0, borderWidth: 0, borderRadius: 0, fontSize: 15,
          color: !error && status === "valid" ? colors.muted : colors.inputText, backgroundColor: "transparent",
          ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }} />
      <View style={{ width: 30, alignItems: "center", justifyContent: "center" }}>
        {!error && status === "valid" ? (
          <Animated.View accessibilityLabel="Código verificado" accessibilityLiveRegion="polite"
            style={{ opacity: checkAnim, transform: [{ scale: checkAnim.interpolate({
              inputRange: [0, 1], outputRange: [0.65, 1],
            }) }] }}>
            <GoAtletaIcon name="checkmarkCircle" size={18} color={colors.primaryBg} />
          </Animated.View>
        ) : status === "checking" ? (
          <ActivityIndicator accessibilityLabel="Verificando código" size="small" color={colors.muted} />
        ) : null}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Continuar sem convite" disabled={disabled}
        suppressWebHoverFeedback onPress={() => { generation.current += 1; onRemove(); }}
        style={{ minHeight: 40, width: 28, alignItems: "center", justifyContent: "center", marginRight: -6 }}>
        {({ hovered }: any) => <GoAtletaIcon name="close" size={16} color={hovered ? colors.text : colors.muted} />}
      </Pressable>
    </Animated.View>
  </View>;
}
