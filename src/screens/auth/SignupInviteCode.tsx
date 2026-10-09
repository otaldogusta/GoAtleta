import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Text, TextInput, View } from "react-native";
import { validateTrainerInvite } from "../../api/trainer-invite";
import { normalizeInviteCodeInput } from "../../auth/invite-code-input";
import { Pressable } from "../../ui/Pressable";
import { useAppTheme } from "../../ui/app-theme";
import { GoAtletaIcon } from "../../ui/icon-registry";

export function SignupInviteCode({ code, disabled, onChange, onVerified, onRemove }: {
  code: string;
  disabled: boolean;
  onChange: (code: string) => void;
  onVerified: (code: string) => void;
  onRemove: () => void;
}) {
  const { colors, mode } = useAppTheme();
  const [status, setStatus] = useState<"idle" | "checking" | "valid" | "error">("idle");
  const [error, setError] = useState("");
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
    if (disabled || !code.trim()) return;
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
  }, [code, disabled, onVerified, checkAnim, shake]);

  return <View style={{ gap: 8, position: "relative", zIndex: error ? 50 : 1, overflow: "visible" }}>
    <Animated.View style={{ flexDirection: "row", alignItems: "center", minHeight: 50, borderRadius: 12,
      paddingHorizontal: 14, borderWidth: 1,
      borderColor: error ? colors.dangerSolidBg : mode === "light" ? "rgba(15, 23, 42, 0.08)" : "rgba(255, 255, 255, 0.08)",
      overflow: "visible", zIndex: 1, transform: [{ translateX: shake }],
      backgroundColor: mode === "dark" ? "#121c30" : colors.inputBg }}>
      {error ? (
        <View accessibilityRole="alert" pointerEvents="none"
          style={{ position: "absolute", top: -38, left: 0, zIndex: 60, maxWidth: "100%" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6,
            backgroundColor: colors.dangerSolidBg, borderRadius: 8,
            paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start",
            ...(Platform.OS === "web"
              ? { boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.24)" } as any
              : { shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 6,
                  shadowOffset: { width: 0, height: 3 }, elevation: 6 }) }}>
            <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
            <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>{error}</Text>
          </View>
          <View style={{ width: 0, height: 0, marginLeft: 14, borderLeftWidth: 6,
            borderRightWidth: 6, borderTopWidth: 6, borderLeftColor: "transparent",
            borderRightColor: "transparent", borderTopColor: colors.dangerSolidBg }} />
        </View>
      ) : null}
      <TextInput accessibilityLabel="Código de convite" placeholder="Código de convite"
        placeholderTextColor={colors.placeholder} value={code} editable={!disabled}
        autoCapitalize="characters" autoCorrect={false} maxLength={4096}
        onChangeText={(value) => {
          const normalized = normalizeInviteCodeInput(value);
          if (normalized === code) return;
          generation.current += 1;
          setStatus("idle");
          setError("");
          onChange(normalized);
        }}
        style={{ flex: 1, minWidth: 0, padding: 0, borderWidth: 0, borderRadius: 0, fontSize: 15,
          color: colors.inputText, backgroundColor: "transparent",
          ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}) }} />
      <View style={{ width: 30, alignItems: "center", justifyContent: "center" }}>
        {status === "valid" ? (
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
