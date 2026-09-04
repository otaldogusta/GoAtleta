import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getInviteErrorCode } from "../src/api/invite-errors";
import { claimStudentInvite } from "../src/api/student-invite";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { useAuth } from "../src/auth/auth";
import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
  requiresTrainerInviteEmailVerification,
  shouldReturnTrainerInviteToSignup,
} from "../src/auth/pending-invite";
import {
  getPendingInviteCopy,
  isTerminalPendingInviteIssue,
  resolvePendingRoleHome,
  resolvePendingInviteViewState,
  type PendingInviteIssue,
} from "../src/auth/pending-invite-view";
import { useRole } from "../src/auth/role";
import { getStudentAccessPendingCopy } from "../src/auth/student-access-reconciliation";
import { markRender, measureAsync } from "../src/observability/perf";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { radius, spacing } from "../src/theme/tokens";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { Button } from "../src/ui/Button";

function PulseRadarBadge({ approved, blocked }: { approved?: boolean; blocked?: boolean }) {
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

  if (blocked) {
    return (
      <View style={{ width: 100, height: 100, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: colors.dangerBg,
            borderWidth: 1.5,
            borderColor: colors.dangerBorder,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <GoAtletaIcon name="warningCircle" size={30} color={colors.dangerText} />
        </View>
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
  const { session, signOut, resendSignupCode, loading: authLoading } = useAuth();
  const { refresh, role, loading: roleLoading, studentAccessResolution } = useRole();
  const { createOrganization } = useOrganization();
  const [inviteBusy, setInviteBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteIssue, setInviteIssue] = useState<PendingInviteIssue>(null);
  const [storedToken, setStoredToken] = useState("");
  const [storedTrainerCode, setStoredTrainerCode] = useState("");
  const [accessApproved, setAccessApproved] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationBusy, setOrganizationBusy] = useState(false);
  const [organizationMessage, setOrganizationMessage] = useState("");
  const autoClaimedRef = useRef(false);
  const textAnim = useRef(new Animated.Value(0)).current;
  const resolvedRoleHome = resolvePendingRoleHome(role);

  useEffect(() => {
    if (accessApproved) {
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }).start();

      const timer = setTimeout(() => {
        router.replace(resolvedRoleHome ?? "/prof/home");
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [accessApproved, resolvedRoleHome, router, textAnim]);

  const parseInviteError = (error: unknown) => {
    const code = getInviteErrorCode(error);
    if (code === "INVITE_EXPIRED") {
      return { message: "Solicite um novo convite à organização.", issue: "expired" as const };
    }
    if (code === "INVITE_ALREADY_USED" || code === "INVITE_LIMIT_REACHED") {
      return { message: "Entre com a conta que já aceitou o convite ou solicite outro.", issue: "already_used" as const };
    }
    if (code === "INVITE_REVOKED") {
      return { message: "Solicite um novo convite à organização.", issue: "revoked" as const };
    }
    if (code === "INVITE_INVALID") {
      return { message: "O link informado não é válido.", issue: "failed" as const };
    }
    if (code === "STUDENT_ALREADY_LINKED") {
      return { message: "Seu acesso já está vinculado.", issue: "already_used" as const };
    }
    if (code === "UNAUTHORIZED" || code === "MISSING_AUTH_TOKEN") {
      return { message: "Sessão expirada. Entre novamente.", issue: "failed" as const };
    }
    if (code === "EMAIL_NOT_VERIFIED") {
      return { message: "Confirme seu e-mail para aplicar o convite.", issue: "failed" as const };
    }
    if (code === "INVITE_EMAIL_MISMATCH") {
      return { message: "Entre com o e-mail que recebeu o convite.", issue: "failed" as const };
    }
    if (code === "FORBIDDEN" || code === "ORG_FORBIDDEN") {
      return { message: "Sem permissão para validar o convite.", issue: "failed" as const };
    }
    return { message: "Tente novamente ou solicite outro convite.", issue: "failed" as const };
  };

  const handleStoredTrainerInvite = async (codeOverride?: string) => {
    const code = (codeOverride ?? storedTrainerCode).trim();
    if (!code || inviteBusy) return;
    setInviteBusy(true);
    setInviteIssue(null);
    setMessage("");
    try {
      if (session?.user.app_metadata?.staff_invite_setup_required === true) {
        router.replace({ pathname: "/staff-invite", params: { code } });
        return;
      }
      await claimTrainerInvite(code);
      setAccessApproved(true);
      await clearPendingTrainerInvite();
      await refresh();
      router.replace("/");
    } catch (error) {
      if (getInviteErrorCode(error) === "STAFF_SETUP_REQUIRED") {
        router.replace({ pathname: "/staff-invite", params: { code } });
        return;
      }
      const parsed = parseInviteError(error);
      setInviteIssue(parsed.issue);
      setMessage(parsed.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleStoredInvite = async (tokenOverride?: string) => {
    const tokenValue = (tokenOverride ?? storedToken).trim();
    if (!tokenValue || inviteBusy) return;
    setInviteBusy(true);
    setInviteIssue(null);
    setMessage("");
    try {
      await claimStudentInvite(tokenValue);
      setAccessApproved(true);
      await clearPendingInvite();
      await refresh();
      router.replace("/student/home");
    } catch (error) {
      const parsed = parseInviteError(error);
      setInviteIssue(parsed.issue);
      setMessage(parsed.message);
    } finally {
      setInviteBusy(false);
    }
  };

  const clearStoredInvite = async () => {
    await Promise.all([clearPendingInvite(), clearPendingTrainerInvite()]);
    setStoredToken("");
    setStoredTrainerCode("");
    setInviteIssue(null);
    setMessage("");
    autoClaimedRef.current = false;
  };

  const handleBackToLogin = async () => {
    await signOut();
    router.replace("/login");
  };

  const handleCreateOrganization = async () => {
    const name = organizationName.trim();
    if (name.length < 3 || organizationBusy) return;
    setOrganizationBusy(true);
    setOrganizationMessage("");
    try {
      await createOrganization(name);
      await refresh();
      router.replace("/coord/dashboard");
    } catch {
      setOrganizationMessage("Não foi possível criar a instituição. Tente novamente.");
    } finally {
      setOrganizationBusy(false);
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
      if (
        shouldReturnTrainerInviteToSignup({
          authLoading,
          hasSession: Boolean(session),
          trainerCode,
        })
      ) {
        router.replace({
          pathname: "/signup",
          params: { inviteCode: trainerCode },
        });
        return;
      }
      if (authLoading) return;
      if (!token && !trainerCode) {
        if (resolvedRoleHome) {
          router.replace(resolvedRoleHome);
        }
        return;
      }
      if (session && requiresTrainerInviteEmailVerification(session.user)) {
        const email = encodeURIComponent(session.user.email ?? "");
        router.replace(`/verify-email?email=${email}`);
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
  }, [authLoading, refresh, resolvedRoleHome, router, session]);

  if (resolvedRoleHome && !storedToken && !storedTrainerCode) {
    return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const pendingViewState = resolvePendingInviteViewState({
    accessApproved,
    inviteBusy,
    issue: inviteIssue,
    hasStoredInvite: Boolean(storedToken || storedTrainerCode),
  });
  const studentAccessCopy = pendingViewState === "waiting"
    ? getStudentAccessPendingCopy(studentAccessResolution) : null;
  const pendingCopy = studentAccessCopy
    ? { ...studentAccessCopy, subtitle: message || studentAccessCopy.subtitle }
    : getPendingInviteCopy(pendingViewState);
  const hasTerminalInviteIssue = isTerminalPendingInviteIssue(pendingViewState);

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
            <PulseRadarBadge approved={accessApproved} blocked={hasTerminalInviteIssue} />

            <Animated.View style={{ alignItems: "center", gap: spacing.xs, transform: [{ translateY: textAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -8, 0] }) }] }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                {pendingCopy.title}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  lineHeight: 21,
                  textAlign: "center",
                }}
              >
                {pendingCopy.subtitle}
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
                {!hasTerminalInviteIssue ? (
                  <Button
                    label={inviteBusy ? "Validando convite..." : "Validar convite agora"}
                    onPress={() =>
                      storedToken ? handleStoredInvite() : handleStoredTrainerInvite()
                    }
                    disabled={inviteBusy}
                  />
                ) : null}
                <Pressable onPress={clearStoredInvite} style={{ padding: spacing.xs }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
                    Descartar convite
                  </Text>
                </Pressable>
              </View>
            )}

            {studentAccessCopy ? (
              <Button
                label={verificationBusy ? "Enviando..." : roleLoading ? "Verificando..." : studentAccessCopy.action}
                disabled={roleLoading || verificationBusy}
                onPress={async () => {
                  if (studentAccessResolution === "verification_required") {
                    setVerificationBusy(true);
                    setMessage("");
                    try {
                      const email = session?.user.email ?? "";
                      await resendSignupCode(email, "verify-email");
                      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
                    } catch {
                      setMessage("Não foi possível enviar o código. Tente novamente.");
                    } finally {
                      setVerificationBusy(false);
                    }
                  } else {
                    void refresh();
                  }
                }}
              />
            ) : null}

            {pendingViewState === "waiting" && !studentAccessCopy ? (
              <View
                style={{
                  width: "100%",
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.md,
                }}
              >
                <View style={{ gap: 4 }}>
                  <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                    Quero gerenciar uma instituição
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                    Crie seu espaço de coordenação. A assinatura comercial será configurada separadamente.
                  </Text>
                </View>
                <View
                  style={{
                    minHeight: 50,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                  }}
                >
                  <TextInput
                    accessibilityLabel="Nome da instituição"
                    placeholder="Nome da instituição"
                    placeholderTextColor={colors.placeholder}
                    value={organizationName}
                    onChangeText={(value) => {
                      setOrganizationName(value);
                      setOrganizationMessage("");
                    }}
                    autoCapitalize="words"
                    style={[
                      {
                        minHeight: 50,
                        color: colors.inputText,
                        backgroundColor: "transparent",
                        borderWidth: 0,
                        borderRadius: 0,
                        paddingVertical: 0,
                      },
                      Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null,
                    ]}
                  />
                </View>
                {organizationMessage ? (
                  <Text accessibilityRole="alert" style={{ color: colors.dangerText, fontSize: 13 }}>
                    {organizationMessage}
                  </Text>
                ) : null}
                <Button
                  label="Criar instituição"
                  loading={organizationBusy}
                  loadingLabel="Criando instituição..."
                  disabled={organizationName.trim().length < 3}
                  onPress={() => void handleCreateOrganization()}
                />

                <View style={{ height: 1, backgroundColor: colors.border }} />

                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}>
                  <GoAtletaIcon name="link" size={18} color={colors.primaryBg} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>
                      Sou atleta ou responsável
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                      Abra o link enviado pela instituição. Você não precisa conhecer o e-mail de nenhum coordenador.
                    </Text>
                  </View>
                </View>
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
