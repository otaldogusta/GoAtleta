import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenBackdrop } from "../../src/components/ui/ScreenBackdrop";
import {
  claimStudentRelationshipInvite,
  type StudentRelationshipInvitePreview,
  validateStudentRelationshipInvite,
} from "../../src/api/student-relationship-invite";
import { getInviteErrorCode } from "../../src/api/invite-errors";
import { useAuth } from "../../src/auth/auth";
import {
  clearPendingRelationshipInvite,
  requiresInviteEmailVerification,
  savePendingRelationshipInvite,
} from "../../src/auth/pending-invite";
import { useRole } from "../../src/auth/role";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { markRender, measureAsync } from "../../src/observability/perf";
import { radius, shadow, spacing } from "../../src/theme/tokens";
import { Button } from "../../src/ui/Button";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";

type InviteState = "checking" | "valid" | "invalid";

const relationshipLabel = (preview: StudentRelationshipInvitePreview) => {
  if (preview.relationship.label) return preview.relationship.label;
  if (preview.relationship.kind === "athlete") return "Atleta";
  if (preview.relationship.kind === "payer") return "Responsável financeiro";
  if (preview.relationship.kind === "viewer") return "Acompanhante";
  return "Responsável";
};

const inviteErrorMessage = (error: unknown) => {
  const code = getInviteErrorCode(error);
  if (code === "INVITE_EXPIRED") return "Este convite expirou. Peça um novo link à instituição.";
  if (code === "INVITE_REVOKED") return "Este convite foi cancelado pela instituição.";
  if (code === "INVITE_ALREADY_USED") return "Este convite já foi usado por outra conta.";
  if (code === "INVITE_EMAIL_MISMATCH") return "Entre com o e-mail que recebeu este convite.";
  if (code === "STUDENT_ALREADY_LINKED") return "Este atleta já possui uma conta vinculada.";
  if (code === "EMAIL_NOT_VERIFIED") return "Confirme seu e-mail antes de aceitar o convite.";
  if (code === "UNAUTHORIZED" || code === "MISSING_AUTH_TOKEN") {
    return "Sua sessão expirou. Entre novamente.";
  }
  return "Não foi possível validar este convite.";
};

export default function StudentRelationshipInviteScreen() {
  markRender("screen.studentRelationshipInvite.render.main");
  const { colors } = useAppTheme();
  const responsive = useResponsiveLayout("content");
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const { session, signOut, resendSignupCode, refreshUser } = useAuth();
  const { refresh: refreshRole } = useRole();
  const [inviteState, setInviteState] = useState<InviteState>("checking");
  const [preview, setPreview] = useState<StudentRelationshipInvitePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const verificationRedirectStartedRef = useRef(false);
  const claimInFlightRef = useRef(false);

  const useNativeDriver = Platform.OS !== "web";
  const normalizedSessionEmail = String(session?.user?.email ?? "").trim().toLowerCase();
  const sessionNeedsVerification = requiresInviteEmailVerification(session?.user);

  const runShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver }),
    ]).start();
  }, [shakeAnim, useNativeDriver]);

  useEffect(() => {
    Animated.spring(enterAnim, {
      toValue: 1,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
      useNativeDriver,
    }).start();
  }, [enterAnim, useNativeDriver]);

  useEffect(() => {
    let active = true;
    if (!tokenValue) {
      Promise.resolve().then(() => {
        setInviteState("invalid");
        setMessage("Convite inválido. Peça um novo link à instituição.");
      });
      return () => {
        active = false;
      };
    }

    void measureAsync(
      "screen.studentRelationshipInvite.load.validation",
      () => validateStudentRelationshipInvite(tokenValue),
    )
      .then(async (result) => {
        if (!active) return;
        await savePendingRelationshipInvite(tokenValue);
        if (!active) return;
        setPreview(result.preview);
        setInviteState("valid");
        setMessage("");
      })
      .catch((error) => {
        if (!active) return;
        setInviteState("invalid");
        setMessage(inviteErrorMessage(error));
      });

    return () => {
      active = false;
    };
  }, [tokenValue]);

  useEffect(() => {
    if (
      !session ||
      !sessionNeedsVerification ||
      !normalizedSessionEmail ||
      inviteState !== "valid" ||
      verificationRedirectStartedRef.current
    ) {
      return;
    }

    verificationRedirectStartedRef.current = true;
    let active = true;
    void (async () => {
      let deliveryFailed = false;
      try {
        await resendSignupCode(normalizedSessionEmail, "verify-email");
      } catch {
        deliveryFailed = true;
      }
      if (!active) return;
      router.replace({
        pathname: "/verify-email",
        params: {
          email: normalizedSessionEmail,
          delivery: deliveryFailed ? "failed" : undefined,
        },
      });
    })();

    return () => {
      active = false;
      verificationRedirectStartedRef.current = false;
    };
  }, [inviteState, normalizedSessionEmail, resendSignupCode, router, session, sessionNeedsVerification]);

  const claimAndEnter = useCallback(async () => {
    if (!tokenValue || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      const receipt = await measureAsync(
        "screen.studentRelationshipInvite.action.claim",
        () => claimStudentRelationshipInvite(tokenValue),
      );
      await clearPendingRelationshipInvite().catch(() => undefined);
      await Promise.all([refreshUser(), refreshRole()]);
      router.replace(
        receipt.relationshipKind === "athlete" ? "/student/home" : "/family/home",
      );
    } catch (error) {
      setMessage(inviteErrorMessage(error));
      runShake();
    } finally {
      claimInFlightRef.current = false;
      setBusy(false);
    }
  }, [refreshRole, refreshUser, router, runShake, tokenValue]);

  const handleOtherAccount = async () => {
    await signOut();
    setMessage("");
  };

  const handleBack = () => {
    navigateBackOrReplace({ router, fallback: session ? "/" : "/welcome" });
  };

  const renderAccessAction = () => {
    if (session && sessionNeedsVerification) {
      return (
        <View style={{ gap: spacing.xs, alignItems: "center" }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>
            Abrindo a confirmação de e-mail...
          </Text>
        </View>
      );
    }

    if (session) {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.muted, fontSize: responsive.density.metadataFontSize }}>
              Conta que receberá o acesso
            </Text>
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              {normalizedSessionEmail}
            </Text>
          </View>
          <Button
            label="Aceitar convite"
            loading={busy}
            loadingLabel="Vinculando..."
            onPress={() => void claimAndEnter()}
          />
          <Pressable suppressWebHoverFeedback onPress={() => void handleOtherAccount()}>
            <Text style={{ color: colors.primaryBg, fontWeight: "700", textAlign: "center" }}>
              Usar outra conta
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Use o mesmo e-mail que recebeu este convite.
        </Text>
        <Button label="Criar conta" onPress={() => router.push("/signup")} />
        <Button
          label="Já tenho conta"
          variant="outline"
          onPress={() => router.push("/login")}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenBackdrop />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: responsive.gutter,
            paddingVertical: spacing.xl,
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              maxWidth: 440,
              alignSelf: "center",
              gap: spacing.md,
              opacity: enterAnim,
              transform: [
                { translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
                { translateX: shakeAnim },
              ],
            }}
          >
            <Pressable
              accessibilityLabel="Voltar"
              onPress={handleBack}
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.secondaryBg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GoAtletaIcon name="chevronBack" size={21} color={colors.text} />
            </Pressable>

            <View style={{ gap: spacing.xs }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: responsive.density.pageTitleFontSize,
                  lineHeight: responsive.density.pageTitleLineHeight,
                  fontWeight: "900",
                }}
              >
                Convite do Go Atleta
              </Text>
              <Text style={{ color: colors.muted, lineHeight: 20 }}>
                Confirme o vínculo antes de acessar o portal.
              </Text>
            </View>

            <View
              style={{
                borderRadius: radius.container,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
                padding: responsive.density.cardPadding,
                gap: spacing.md,
                ...shadow.card,
              }}
            >
              {inviteState === "checking" ? (
                <Text style={{ color: colors.muted }}>Verificando convite...</Text>
              ) : inviteState === "invalid" || !preview ? (
                <View style={{ gap: spacing.md, alignItems: "center" }}>
                  <GoAtletaIcon name="warningCircle" size={30} color={colors.dangerText} />
                  <Text style={{ color: colors.text, fontWeight: "800", textAlign: "center" }}>
                    Convite indisponível
                  </Text>
                  <Text style={{ color: colors.muted, textAlign: "center", lineHeight: 20 }}>
                    {message}
                  </Text>
                  <Button label="Voltar" variant="outline" onPress={handleBack} />
                </View>
              ) : (
                <>
                  <View style={{ gap: spacing.xs }}>
                    <Text style={{ color: colors.muted, fontSize: responsive.density.metadataFontSize }}>
                      {preview.organization.name}
                    </Text>
                    <Text style={{ color: colors.text, fontWeight: "900", fontSize: responsive.density.sectionTitleFontSize }}>
                      {preview.student.name}
                    </Text>
                    <Text style={{ color: colors.muted }}>
                      Acesso como {relationshipLabel(preview)}
                    </Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: colors.border }} />
                  {message ? (
                    <View
                      style={{
                        borderRadius: radius.internal,
                        borderWidth: 1,
                        borderColor: colors.warningBorder,
                        backgroundColor: colors.warningBg,
                        padding: spacing.sm,
                        flexDirection: "row",
                        alignItems: "flex-start",
                        gap: spacing.xs,
                      }}
                    >
                      <GoAtletaIcon name="info" size={18} color={colors.warningText} />
                      <Text style={{ color: colors.warningText, flex: 1, lineHeight: 19 }}>
                        {message}
                      </Text>
                    </View>
                  ) : null}
                  {renderAccessAction()}
                </>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
