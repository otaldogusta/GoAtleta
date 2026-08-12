import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getInviteErrorCode } from "../src/api/invite-errors";
import { requestAccessReview } from "../src/api/access-request";
import { claimStudentInvite } from "../src/api/student-invite";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { useAuth } from "../src/auth/auth";
import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
} from "../src/auth/pending-invite";
import { useRole } from "../src/auth/role";
import { markRender, measureAsync } from "../src/observability/perf";
import { radius, spacing } from "../src/theme/tokens";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { Button } from "../src/ui/Button";

function PulseRadarBadge({ approved }: { approved?: boolean }) {
  const { colors } = useAppTheme();
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (approved) {
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: Platform.OS !== "web",
      }).start();
      return;
    }

    const animation = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: Platform.OS !== "web",
      })
    );
    animation.start();
    return () => animation.stop();
  }, [approved, pulseAnim, successAnim]);

  const ring1Scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });

  const ring1Opacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.45, 0.2, 0],
  });

  const ring2Scale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.1],
  });

  const ring2Opacity = pulseAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.1, 0],
  });

  const successScale = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const successRippleScale = successAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  const successRippleOpacity = successAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.7, 0.3, 0],
  });

  const checkIconScale = successAnim.interpolate({
    inputRange: [0, 0.6, 1],
    outputRange: [0, 1.3, 1],
  });

  if (approved) {
    return (
      <View style={{ width: 100, height: 100, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={{
            position: "absolute",
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#86efac",
            opacity: successRippleOpacity,
            transform: [{ scale: successRippleScale }],
          }}
        />
        <Animated.View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#dcfce7",
            borderWidth: 1.5,
            borderColor: "#86efac",
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: successScale }],
          }}
        >
          <Animated.View style={{ transform: [{ scale: checkIconScale }] }}>
            <GoAtletaIcon name="checkmarkCircle" size={32} color="#166534" />
          </Animated.View>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={{ width: 100, height: 100, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primaryBg,
          opacity: ring2Opacity,
          transform: [{ scale: ring2Scale }],
        }}
      />
      <Animated.View
        style={{
          position: "absolute",
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primaryBg,
          opacity: ring1Opacity,
          transform: [{ scale: ring1Scale }],
        }}
      />
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.card,
          borderWidth: 1.5,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <GoAtletaIcon name="personSolid" size={28} color={colors.primaryBg} />
      </View>
    </View>
  );
}

export default function PendingScreen() {
  markRender("screen.pending.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { refresh, role } = useRole();
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storedToken, setStoredToken] = useState("");
  const [storedTrainerCode, setStoredTrainerCode] = useState("");
  const [accessApproved, setAccessApproved] = useState(false);
  const [coordinatorEmail, setCoordinatorEmail] = useState("");
  const [accessRequestBusy, setAccessRequestBusy] = useState(false);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [coordinatorEmailError, setCoordinatorEmailError] = useState(false);
  const autoClaimedRef = useRef(false);
  const textAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (role === "trainer" || role === "student" || accessApproved) {
      setAccessApproved(true);
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();

      const timer = setTimeout(() => {
        router.replace(role === "student" ? "/student/home" : "/prof/home");
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [accessApproved, role, router, textAnim]);

  const parseInviteError = (error: unknown) => {
    const code = getInviteErrorCode(error);
    if (code === "INVITE_EXPIRED") return "Convite expirado.";
    if (code === "INVITE_ALREADY_USED") return "Convite já utilizado. Peça um novo link.";
    if (code === "INVITE_INVALID" || code === "INVITE_REVOKED") return "Convite inválido.";
    if (code === "STUDENT_ALREADY_LINKED") return "Seu acesso já está vinculado.";
    if (code === "UNAUTHORIZED" || code === "MISSING_AUTH_TOKEN") return "Sessão expirada. Entre novamente.";
    if (code === "FORBIDDEN" || code === "ORG_FORBIDDEN") return "Sem permissão para validar o convite.";
    return "Não foi possível validar o convite.";
  };

  const handleStoredTrainerInvite = async (codeOverride?: string) => {
    const code = (codeOverride ?? storedTrainerCode).trim();
    if (!code || inviteBusy) return;
    setInviteBusy(true);
    setMessage("");
    try {
      await claimTrainerInvite(code);
      await clearPendingTrainerInvite();
      await refresh();
      router.replace("/prof/home");
    } catch (error) {
      setMessage(parseInviteError(error));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleStoredInvite = async (tokenOverride?: string) => {
    const tokenValue = (tokenOverride ?? storedToken).trim();
    if (!tokenValue || inviteBusy) return;
    setInviteBusy(true);
    setMessage("");
    try {
      await claimStudentInvite(tokenValue);
      await clearPendingInvite();
      await refresh();
      router.replace("/student/home");
    } catch (error) {
      setMessage(parseInviteError(error));
    } finally {
      setInviteBusy(false);
    }
  };

  const clearStoredInvite = async () => {
    await Promise.all([clearPendingInvite(), clearPendingTrainerInvite()]);
    setStoredToken("");
    setStoredTrainerCode("");
    setMessage("");
    autoClaimedRef.current = false;
  };

  const handleBackToLogin = async () => {
    await signOut();
    router.replace("/login");
  };

  const handleAccessRequest = async () => {
    const email = coordinatorEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setCoordinatorEmailError(true);
      return;
    }
    if (accessRequestBusy) return;
    setAccessRequestBusy(true);
    setMessage("");
    try {
      await requestAccessReview(email);
      setAccessRequestSent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a solicitação.");
    } finally {
      setAccessRequestBusy(false);
    }
  };

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      void refresh({ silent: true });
    }, 12000);
    return () => clearInterval(interval);
  }, [refresh, session]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [token, trainerCode] = await measureAsync(
        "screen.pending.load.storedInvites",
        () => Promise.all([getPendingInvite(), getPendingTrainerInvite()])
      );
      if (!alive) return;
      setStoredToken(token);
      setStoredTrainerCode(trainerCode);
      if (autoClaimedRef.current) return;
      if (!token && !trainerCode) {
        if (role === "trainer" || role === "student") {
          router.replace("/");
        }
        return;
      }
      autoClaimedRef.current = true;
      if (token) {
        await handleStoredInvite(token);
      } else {
        await handleStoredTrainerInvite(trainerCode);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refresh, role, router]);

  if ((role === "trainer" || role === "student") && !storedToken && !storedTrainerCode) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            width: "100%",
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            <PulseRadarBadge approved={accessApproved} />

            <Animated.View style={{ alignItems: "center", gap: spacing.xs, transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -8, 0] }) }] }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {accessApproved ? "Acesso liberado!" : "Aguardando liberação"}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  lineHeight: 21,
                  textAlign: "center",
                }}
              >
                {accessApproved
                  ? "Sua conta foi aprovada pela coordenação. Redirecionando..."
                  : "Sua conta foi criada com sucesso. Quando a coordenação aprovar seu acesso ou você acessar um link de convite, a liberação será automática."}
              </Text>
            </Animated.View>

            {Boolean(storedToken || storedTrainerCode) && (
              <View
                style={{
                  width: "100%",
                  padding: spacing.md,
                  borderRadius: radius.container,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: spacing.sm,
                  alignItems: "center",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <GoAtletaIcon name="link" size={16} color={colors.primaryBg} />
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
                    Convite encontrado
                  </Text>
                </View>
                {Boolean(message) && (
                  <Text style={{ color: colors.dangerSolidBg, fontSize: 13, textAlign: "center" }}>
                    {message}
                  </Text>
                )}
                <Button
                  label={inviteBusy ? "Validando convite..." : "Validar convite agora"}
                  onPress={() =>
                    storedToken ? handleStoredInvite() : handleStoredTrainerInvite()
                  }
                  disabled={inviteBusy}
                />
                <Pressable onPress={clearStoredInvite} style={{ padding: spacing.xs }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                    Descartar convite
                  </Text>
                </Pressable>
              </View>
            )}

            {!storedToken && !storedTrainerCode ? (
              <View
                style={{
                  width: "100%",
                  padding: spacing.md,
                  borderRadius: radius.container,
                  backgroundColor: colors.card,
                  borderWidth: 1,
                  borderColor: colors.border,
                  gap: spacing.sm,
                  overflow: "visible",
                }}
              >
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                  Solicitar acesso
                </Text>
                {accessRequestSent ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                    <GoAtletaIcon name="checkmarkCircle" size={18} color={colors.successText} />
                    <Text style={{ color: colors.successText, fontSize: 13, flex: 1 }}>
                      Solicitação enviada. A coordenação já pode revisar seu acesso.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={{ position: "relative", overflow: "visible" }}>
                      {coordinatorEmailError ? (
                        <View
                          accessibilityRole="alert"
                          pointerEvents="none"
                          style={{
                            position: "absolute",
                            top: -38,
                            left: 0,
                            zIndex: 20,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            borderRadius: 8,
                            backgroundColor: colors.dangerSolidBg,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                          }}
                        >
                          <GoAtletaIcon name="warningCircle" size={14} color={colors.dangerSolidText} />
                          <Text style={{ color: colors.dangerSolidText, fontSize: 12, fontWeight: "700" }}>
                            Digite o e-mail da coordenação
                          </Text>
                        </View>
                      ) : null}
                      <View
                        style={{
                          minHeight: 50,
                          borderRadius: 12,
                          borderWidth: coordinatorEmailError ? 2 : 1,
                          borderColor: coordinatorEmailError ? colors.dangerSolidBg : colors.border,
                          paddingHorizontal: 14,
                          backgroundColor: colors.inputBg,
                          justifyContent: "center",
                        }}
                      >
                        <TextInput
                          value={coordinatorEmail}
                          onChangeText={(value) => {
                            setCoordinatorEmail(value);
                            if (coordinatorEmailError) setCoordinatorEmailError(false);
                          }}
                          autoCapitalize="none"
                          keyboardType="email-address"
                          placeholder="coordenacao@organizacao.com"
                          placeholderTextColor={colors.placeholder}
                          style={{ color: colors.inputText, borderRadius: 0, paddingVertical: 12 }}
                        />
                      </View>
                    </View>
                    {Boolean(message) ? (
                      <Text style={{ color: colors.dangerText, fontSize: 12 }}>{message}</Text>
                    ) : null}
                    <Button
                      label={accessRequestBusy ? "Enviando..." : "Enviar solicitação"}
                      onPress={handleAccessRequest}
                      disabled={accessRequestBusy || !coordinatorEmail.trim()}
                    />
                  </>
                )}
              </View>
            ) : null}

            <View style={{ width: "100%", gap: spacing.sm, marginTop: spacing.xs }}>
              <Pressable
                onPress={() => void handleBackToLogin()}
                style={{ alignSelf: "center", paddingVertical: spacing.xs }}
                suppressWebHoverFeedback
              >
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
                  Entrar com outra conta
                </Text>
              </Pressable>

              {__DEV__ && !accessApproved && (
                <Pressable
                  onPress={() => setAccessApproved(true)}
                  style={{
                    alignSelf: "center",
                    marginTop: spacing.xs,
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  suppressWebHoverFeedback
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>
                    🧪 Dev: Simular liberação de acesso
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
