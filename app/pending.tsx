import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { InstitutionPlanPicker } from "../src/access/components/InstitutionPlanPicker";
import { getPreviewAccessOrganizations, getPreviewInstitutionAccessPlans, getPreviewInstitutionModalities, type InstitutionAccessPlan } from "../src/access/institution-access-plans";
import { getInviteErrorCode } from "../src/api/invite-errors";
import { requestAccessReview } from "../src/api/access-request";
import {
  listMyOrganizationAccessRequests,
  searchAccessRequestOrganizations,
  type AccessRequestOrganization,
  type OrganizationAccessRequest,
} from "../src/api/organization-access-requests";
import { claimStudentInvite } from "../src/api/student-invite";
import { resumeStaffSignup } from "../src/api/staff-invite";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { useAuth } from "../src/auth/auth";
import {
  clearPendingInvite,
  clearPendingTrainerInvite,
  getPendingInvite,
  getPendingTrainerInvite,
  requiresTrainerInviteEmailVerification,
  savePendingTrainerInvite,
  shouldReturnTrainerInviteToSignup,
} from "../src/auth/pending-invite";
import {
  getPendingInviteCopy,
  isTerminalPendingInviteIssue,
  resolvePendingRoleHome,
  resolvePendingInviteViewState,
  type PendingInviteIssue,
} from "../src/auth/pending-invite-view";
import { resolvePendingInviteEntry } from "../src/auth/pending-invite-entry";
import { useRole } from "../src/auth/role";
import { getStudentAccessPendingCopy } from "../src/auth/student-access-reconciliation";
import { markRender, measureAsync } from "../src/observability/perf";
import { radius, spacing } from "../src/theme/tokens";
import { AnchoredDropdown } from "../src/ui/AnchoredDropdown";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";
import { Button } from "../src/ui/Button";

// perf-check: ignore-inline-row-style - the capped five-item dropdown uses theme-dependent row colors and is not a virtualized list.

function PulseRadarBadge({ approved, blocked }: { approved?: boolean; blocked?: boolean }) {
  const { colors } = useAppTheme();
  const [pulseAnim] = useState(() => new Animated.Value(0));
  const [successAnim] = useState(() => new Animated.Value(0));

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

export default function PendingScreen() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  markRender("screen.pending.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, signOut, resendSignupCode, loading: authLoading } = useAuth();
  const { refresh, role, loading: roleLoading, studentAccessResolution } = useRole();
  const [inviteBusy, setInviteBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteIssue, setInviteIssue] = useState<PendingInviteIssue>(null);
  const [storedToken, setStoredToken] = useState("");
  const [storedTrainerCode, setStoredTrainerCode] = useState("");
  const [accessApproved, setAccessApproved] = useState(false);
  const [inviteEntryOpen, setInviteEntryOpen] = useState(false);
  const [inviteEntry, setInviteEntry] = useState("");
  const [inviteEntryError, setInviteEntryError] = useState("");
  const [organizationQuery, setOrganizationQuery] = useState("");
  const [organizations, setOrganizations] = useState<AccessRequestOrganization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<AccessRequestOrganization | null>(null);
  const [organizationPickerOpen, setOrganizationPickerOpen] = useState(false);
  const [organizationCatalogLoading, setOrganizationCatalogLoading] = useState(false);
  const [organizationTriggerLayout, setOrganizationTriggerLayout] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [planPickerOpen, setPlanPickerOpen] = useState(false);
  const [accessRequest, setAccessRequest] = useState<OrganizationAccessRequest | null>(null);
  const [accessRequestBusy, setAccessRequestBusy] = useState(false);
  const autoClaimedRef = useRef(false);
  const organizationTriggerRef = useRef<View>(null);
  const [textAnim] = useState(() => new Animated.Value(0));
  const [inviteEntryAnim] = useState(() => new Animated.Value(0));
  const [inviteShakeAnim] = useState(() => new Animated.Value(0));
  const resolvedRoleHome = resolvePendingRoleHome(role);

  const loadAccessRequest = useCallback(async () => {
    if (!session) return;
    try {
      const requests = await listMyOrganizationAccessRequests();
      setAccessRequest(requests.find((item) => item.status === "pending") ?? requests[0] ?? null);
    } catch {
      // Invite-only deployments can continue to use the existing fallback.
    }
  }, [session]);

  useEffect(() => {
    // The async request reconciles React state with the remote access record.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccessRequest();
  }, [loadAccessRequest]);

  useEffect(() => {
    if (!session || accessRequest?.status === "pending") return;
    const timer = setTimeout(async () => {
      setOrganizationCatalogLoading(true);
      try {
        const remoteOrganizations = await searchAccessRequestOrganizations(organizationQuery);
        setOrganizations(
          remoteOrganizations.length || !__DEV__
            ? remoteOrganizations
            : getPreviewAccessOrganizations(organizationQuery)
        );
      } catch {
        setOrganizations(__DEV__ ? getPreviewAccessOrganizations(organizationQuery) : []);
      } finally {
        setOrganizationCatalogLoading(false);
      }
    }, 240);
    return () => clearTimeout(timer);
  }, [accessRequest?.status, organizationQuery, session]);

  const submitAccessRequest = async (plan?: InstitutionAccessPlan) => {
    if (!selectedOrganization || accessRequestBusy) return;
    setAccessRequestBusy(true);
    setMessage("");
    try {
      await requestAccessReview({ organizationId: selectedOrganization.id, requestedProduct: plan?.product ?? "goatleta" });
      await loadAccessRequest();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar a solicitação.");
    } finally {
      setAccessRequestBusy(false);
    }
  };

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

  const handleStoredTrainerInvite = useCallback(async (codeOverride?: string) => {
    const code = (codeOverride ?? storedTrainerCode).trim();
    if (!code || inviteBusy) return;
    setInviteBusy(true);
    setInviteIssue(null);
    setMessage("");
    try {
      if (session?.user.app_metadata?.staff_invite_setup_required === true) {
        await resumeStaffSignup(code, session);
        router.replace({ pathname: "/staff-invite", params: { code } });
        return;
      }
      await claimTrainerInvite(code);
      setAccessApproved(true);
      await clearPendingTrainerInvite();
      await refresh();
      router.replace("/");
    } catch (error) {
      const errorCode = getInviteErrorCode(error);
      if (errorCode === "STAFF_SETUP_REQUIRED") {
        router.replace({ pathname: "/staff-invite", params: { code } });
        return;
      }
      const parsed = parseInviteError(error);
      setInviteIssue(parsed.issue);
      setMessage(parsed.message);
      if (["INVITE_INVALID", "INVITE_EXPIRED", "INVITE_REVOKED", "INVITE_ALREADY_USED", "INVITE_LIMIT_REACHED"].includes(errorCode)) {
        await clearPendingTrainerInvite();
        setStoredTrainerCode("");
      }
    } finally {
      setInviteBusy(false);
    }
  }, [storedTrainerCode, inviteBusy, session, router, refresh]);

  const handleStoredInvite = useCallback(async (tokenOverride?: string) => {
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
  }, [storedToken, inviteBusy, refresh, router]);

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

  const handleInviteEntry = async () => {
    const resolved = resolvePendingInviteEntry(inviteEntry);
    if (!resolved) {
      setInviteEntryError("Link ou código inválido.");
      inviteShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(inviteShakeAnim, { toValue: -7, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 7, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: -5, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 5, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== "web" }),
      ]).start();
      return;
    }
    setInviteEntryError("");
    if (resolved.kind === "route") {
      router.push(resolved.href as Parameters<typeof router.push>[0]);
      return;
    }
    setInviteBusy(true);
    try {
      if (session?.user.app_metadata?.staff_invite_setup_required === true) {
        await resumeStaffSignup(resolved.code, session);
        await savePendingTrainerInvite(resolved.code);
        setStoredTrainerCode(resolved.code);
        router.replace({ pathname: "/staff-invite", params: { code: resolved.code } });
        return;
      }
      await claimTrainerInvite(resolved.code);
      setAccessApproved(true);
      await clearPendingTrainerInvite();
      await refresh();
      router.replace("/");
    } catch (error) {
      if (getInviteErrorCode(error) === "STAFF_SETUP_REQUIRED") {
        await savePendingTrainerInvite(resolved.code);
        setStoredTrainerCode(resolved.code);
        router.replace({ pathname: "/staff-invite", params: { code: resolved.code } });
        return;
      }
      const parsed = parseInviteError(error);
      setInviteEntryError(parsed.message);
      inviteShakeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(inviteShakeAnim, { toValue: -7, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 7, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: -5, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 5, duration: 45, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(inviteShakeAnim, { toValue: 0, duration: 45, useNativeDriver: Platform.OS !== "web" }),
      ]).start();
    } finally {
      setInviteBusy(false);
    }
  };

  const openInviteEntry = () => {
    setInviteEntryError("");
    setInviteEntryOpen(true);
    inviteEntryAnim.setValue(0);
    Animated.spring(inviteEntryAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  };

  const closeInviteEntry = () => {
    setInviteEntryError("");
    Animated.timing(inviteEntryAnim, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start(() => {
      setInviteEntryOpen(false);
      setInviteEntry("");
    });
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
  }, [authLoading, handleStoredInvite, handleStoredTrainerInvite, resolvedRoleHome, router, session]);

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
  const pendingCopy = accessRequest?.status === "pending"
    ? {
        title: "Solicitação enviada",
        subtitle: `A ${accessRequest.organizationName ?? "instituição"} revisará seu acesso.`,
      }
    : studentAccessCopy
    ? { ...studentAccessCopy, subtitle: message || studentAccessCopy.subtitle }
    : {
        ...getPendingInviteCopy(pendingViewState),
        title: "Encontre sua instituição",
        subtitle: "Solicite o vínculo para acessar o ambiente da sua equipe.",
      };
  const hasTerminalInviteIssue = isTerminalPendingInviteIssue(pendingViewState);
  const compactContentWidth = Math.min(Math.max(viewportWidth - spacing.lg * 2, 0), 440);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          scrollEnabled={!(planPickerOpen && selectedOrganization)}
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
              width: compactContentWidth,
              alignSelf: "center",
              alignItems: "center",
              gap: spacing.lg,
            }}
          >
            {!(planPickerOpen && selectedOrganization) ? <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ir para início"
                onPress={() => {
                  const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/student/")
                    ? returnTo
                    : "/student/home";
                  router.replace(safeReturnTo);
                }}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  alignSelf: "flex-start",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.secondaryBg,
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <GoAtletaIcon name="chevronBack" size={19} color={colors.text} />
              </Pressable>
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
            </> : null}

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
                  width: compactContentWidth,
                  alignSelf: "center",
                  borderRadius: radius.container,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  padding: spacing.md,
                  gap: spacing.md,
                }}
              >
                {accessRequest?.status === "pending" ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <GoAtletaIcon name="checkmarkCircle" size={22} color={colors.primaryBg} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>
                          {accessRequest.organizationName}
                        </Text>
                        <Text style={{ color: colors.muted, fontSize: 13 }}>
                          GoAtleta · Aguardando aprovação
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                      Você será avisado assim que a coordenação revisar a solicitação.
                    </Text>
                    <Pressable onPress={() => void loadAccessRequest()} style={{ alignSelf: "flex-start", paddingVertical: 6 }} suppressWebHoverFeedback>
                      <Text style={{ color: colors.primaryBg, fontSize: 13, fontWeight: "700" }}>
                        Atualizar status
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  planPickerOpen && selectedOrganization ? (
                    <InstitutionPlanPicker
                      institutionName={selectedOrganization.name}
                      athleteName={String(session?.user.user_metadata?.full_name ?? session?.user.email?.split("@")[0] ?? "Atleta")}
                      plans={getPreviewInstitutionAccessPlans(selectedOrganization.name)}
                      contentHeight={Math.max(360, viewportHeight - spacing.xl * 2 - spacing.md * 2)}
                      busy={accessRequestBusy}
                      onBack={() => {
                        setPlanPickerOpen(false);
                        setSelectedOrganization(null);
                        setOrganizationQuery("");
                        setOrganizationPickerOpen(true);
                      }}
                      onSubmit={(plan) => void submitAccessRequest(plan)}
                    />
                  ) : <View style={{ gap: spacing.sm }}>
                    <View ref={organizationTriggerRef} collapsable={false}>
                      <View style={{ minHeight: 50, borderRadius: 12, borderWidth: 1, borderColor: organizationPickerOpen ? colors.primaryBg : colors.border, backgroundColor: colors.inputBg, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <GoAtletaIcon name="search" size={18} color={colors.muted} />
                        <TextInput
                        accessibilityLabel="Buscar instituição"
                        placeholder="Buscar instituição"
                        placeholderTextColor={colors.placeholder}
                          value={organizationQuery}
                          onFocus={() => {
                            setOrganizationPickerOpen(true);
                            organizationTriggerRef.current?.measureInWindow((x, y, width, height) => {
                              setOrganizationTriggerLayout({ x, y, width, height });
                            });
                          }}
                        onChangeText={(value) => {
                          setOrganizationQuery(value);
                          setSelectedOrganization(null);
                          setOrganizationPickerOpen(true);
                          setMessage("");
                        }}
                        style={[{ flex: 1, minHeight: 50, color: colors.inputText, borderRadius: 0, paddingVertical: 0 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as never) : null]}
                        />
                        <GoAtletaIcon name={organizationPickerOpen ? "chevronUp" : "chevronDown"} size={17} color={colors.muted} />
                      </View>
                    </View>
                    <AnchoredDropdown
                      visible={organizationPickerOpen}
                      layout={organizationTriggerLayout}
                      container={null}
                      animationStyle={{ opacity: 1 }}
                      zIndex={6200}
                      maxHeight={260}
                      nestedScrollEnabled
                      density="menu"
                      fitContent
                      interactiveRefs={[organizationTriggerRef]}
                      onRequestClose={() => setOrganizationPickerOpen(false)}
                    >
                      {organizationCatalogLoading ? <Text style={{ color: colors.muted, fontSize: 13, padding: spacing.sm }}>Carregando instituições...</Text> : null}
                      {!organizationCatalogLoading && organizations.length === 0 ? <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19, padding: spacing.sm }}>Nenhuma instituição encontrada.</Text> : null}
                      {!organizationCatalogLoading ? organizations.slice(0, 5).map((organization) => {
                        const modalityLabel = getPreviewInstitutionModalities(organization.name).join(" · ");
                        return (
                          <Pressable
                            key={organization.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Selecionar ${organization.name}`}
                            onPress={() => {
                              setSelectedOrganization(organization);
                              setOrganizationQuery(organization.name);
                              setOrganizationPickerOpen(false);
                              setPlanPickerOpen(true);
                            }}
                            style={{ minHeight: 54, borderRadius: radius.internal, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 }}
                          >
                            <GoAtletaIcon name="organization" size={18} color={colors.muted} />
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{organization.name}</Text>
                              {modalityLabel ? <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{modalityLabel}</Text> : null}
                            </View>
                            <GoAtletaIcon name="chevronForward" size={17} color={colors.muted} />
                          </Pressable>
                        );
                      }) : null}
                    </AnchoredDropdown>
                    {message ? <Text accessibilityRole="alert" style={{ color: colors.dangerText, fontSize: 13 }}>{message}</Text> : null}
                  </View>
                )}

                {!(planPickerOpen && selectedOrganization) ? <>
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                  {!inviteEntryOpen ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Inserir link ou código do convite"
                    onPress={openInviteEntry}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.sm }}
                    suppressWebHoverFeedback
                  >
                    <GoAtletaIcon name="link" size={18} color={colors.primaryBg} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Recebeu um convite?</Text>
                      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Toque para colar o link ou informar o código recebido.</Text>
                    </View>
                    <GoAtletaIcon name="chevronForward" size={18} color={colors.muted} />
                  </Pressable>
                ) : (
                  <Animated.View style={{ gap: spacing.sm, opacity: inviteEntryAnim, transform: [{ translateY: inviteEntryAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { translateX: inviteShakeAnim }] }}>
                    <View style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <GoAtletaIcon name="link" size={18} color={colors.primaryBg} />
                      <Text style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" }}>Inserir convite</Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Fechar convite"
                        onPress={closeInviteEntry}
                        style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" }}
                        suppressWebHoverFeedback
                      >
                        <GoAtletaIcon name="close" size={18} color={colors.muted} />
                      </Pressable>
                    </View>
                    <View style={{ position: "relative", overflow: "visible" }}>
                      {inviteEntryError ? (
                        <View
                          accessibilityRole="alert"
                          pointerEvents="none"
                          style={{ position: "absolute", top: -38, left: 0, zIndex: 20, minHeight: 32, borderRadius: 10, backgroundColor: colors.dangerSolidBg, paddingHorizontal: 12, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 7 }}
                        >
                          <GoAtletaIcon name="warningCircle" size={16} color={colors.dangerSolidText} />
                          <Text style={{ color: colors.dangerSolidText, fontSize: 13, fontWeight: "700" }}>{inviteEntryError}</Text>
                          <View style={{ position: "absolute", bottom: -7, left: 18, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 7, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: colors.dangerSolidBg }} />
                        </View>
                      ) : null}
                      <View
                      style={{
                        minHeight: 50,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: inviteEntryError ? colors.dangerBorder : colors.border,
                        backgroundColor: colors.inputBg,
                        paddingHorizontal: 14,
                        justifyContent: "center",
                      }}
                      >
                        <TextInput
                        autoFocus
                        accessibilityLabel="Link ou código do convite"
                        placeholder="Cole o link ou código"
                        placeholderTextColor={colors.placeholder}
                        value={inviteEntry}
                        onChangeText={(value) => {
                          setInviteEntry(value);
                          setInviteEntryError("");
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        onSubmitEditing={() => void handleInviteEntry()}
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
                    </View>
                    <Button
                      label={inviteBusy ? "Validando convite..." : "Continuar com convite"}
                      disabled={!inviteEntry.trim() || inviteBusy}
                      onPress={() => void handleInviteEntry()}
                    />
                  </Animated.View>
                  )}
                </> : null}
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
