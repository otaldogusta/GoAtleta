import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
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
import { requiresInviteEmailVerification } from "../../src/auth/pending-invite";
import { useRole } from "../../src/auth/role";
import { navigateBackOrReplace } from "../../src/navigation/safe-router";
import { markRender, measureAsync } from "../../src/observability/perf";
import { radius, shadow, spacing } from "../../src/theme/tokens";
import { Button } from "../../src/ui/Button";
import { Pressable } from "../../src/ui/Pressable";
import { useAppTheme } from "../../src/ui/app-theme";
import { GoAtletaIcon } from "../../src/ui/icon-registry";
import { useResponsiveLayout } from "../../src/ui/use-responsive-layout";

type AuthStep = "choice" | "login" | "signup" | "verify";
type InviteState = "checking" | "valid" | "invalid";

const normalizeOtp = (value: string) => value.replace(/[^0-9]/g, "").slice(0, 6);
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

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
  const { colors, mode } = useAppTheme();
  const responsive = useResponsiveLayout("content");
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string | string[] }>();
  const tokenValue = Array.isArray(token) ? token[0] : token;
  const {
    session,
    signIn,
    signUp,
    signOut,
    resendSignupCode,
    verifySignupCode,
    refreshUser,
  } = useAuth();
  const { refresh: refreshRole } = useRole();
  const [inviteState, setInviteState] = useState<InviteState>("checking");
  const [preview, setPreview] = useState<StudentRelationshipInvitePreview | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [enterAnim] = useState(() => new Animated.Value(0));
  const [shakeAnim] = useState(() => new Animated.Value(0));
  const verificationSentForRef = useRef<string | null>(null);
  const claimInFlightRef = useRef(false);

  const useNativeDriver = Platform.OS !== "web";
  const solidInputBg = mode === "dark" ? "#121c30" : colors.inputBg;
  const normalizedSessionEmail = String(session?.user?.email ?? "").trim().toLowerCase();
  const sessionNeedsVerification = requiresInviteEmailVerification(session?.user);
  const canSubmitAuth = useMemo(() => {
    if (!validEmail(email) || password.length < 6) return false;
    return authStep !== "signup" || confirmPassword === password;
  }, [authStep, confirmPassword, email, password]);

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
      .then((result) => {
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
    if (!session) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (!active) return;
      if (normalizedSessionEmail && !email) setEmail(normalizedSessionEmail);
      if (sessionNeedsVerification) setAuthStep("verify");
    });
    if (!sessionNeedsVerification) {
      return () => {
        active = false;
      };
    }
    if (
      !normalizedSessionEmail ||
      verificationSentForRef.current === normalizedSessionEmail
    ) {
      return () => {
        active = false;
      };
    }
    verificationSentForRef.current = normalizedSessionEmail;
    void resendSignupCode(normalizedSessionEmail, `family-invite/${tokenValue ?? ""}`)
      .then(() => setMessage("Enviamos um código para confirmar seu e-mail."))
      .catch(() => setMessage("Não foi possível enviar o código. Tente reenviar."));
    return () => {
      active = false;
    };
  }, [email, normalizedSessionEmail, resendSignupCode, session, sessionNeedsVerification, tokenValue]);

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

  const handleLogin = async () => {
    if (!canSubmitAuth || busy) {
      setMessage("Preencha e-mail e senha para continuar.");
      runShake();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await signIn(email.trim().toLowerCase(), password);
      setMessage("Conta confirmada. Revise o convite e continue.");
    } catch {
      setMessage("E-mail ou senha incorretos.");
      runShake();
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    if (!canSubmitAuth || busy) {
      setMessage("Use um e-mail válido e senhas iguais com pelo menos 6 caracteres.");
      runShake();
      return;
    }
    setBusy(true);
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const createdSession = await signUp(
        normalizedEmail,
        password,
        `family-invite/${tokenValue ?? ""}`,
        "",
      );
      if (!createdSession) {
        setAuthStep("login");
        setMessage("Conta criada. Entre para continuar.");
        return;
      }
      try {
        await resendSignupCode(
          normalizedEmail,
          `family-invite/${tokenValue ?? ""}`,
        );
        verificationSentForRef.current = normalizedEmail;
        setMessage("Enviamos um código para confirmar seu e-mail.");
      } catch {
        setMessage("Conta criada. Toque em Reenviar código.");
      }
      setAuthStep("verify");
    } catch (error) {
      const detail = error instanceof Error ? error.message.toLowerCase() : "";
      if (detail.includes("already registered")) {
        setAuthStep("login");
        setMessage("Este e-mail já possui conta. Entre para continuar.");
      } else {
        setMessage("Não foi possível criar a conta agora.");
      }
      runShake();
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    const verificationEmail = (normalizedSessionEmail || email).trim();
    if (!verificationEmail || otp.length !== 6 || busy) {
      setMessage("Digite o código de 6 dígitos recebido no e-mail.");
      runShake();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await verifySignupCode(verificationEmail, otp);
      await refreshUser();
    } catch (error) {
      const detail = error instanceof Error ? error.message.toLowerCase() : "";
      setMessage(
        detail.includes("expired")
          ? "Código expirado. Reenvie e tente novamente."
          : "Código inválido. Confira e tente novamente.",
      );
      runShake();
      setBusy(false);
      return;
    }
    setBusy(false);
    await claimAndEnter();
  };

  const handleResend = async () => {
    const verificationEmail = (normalizedSessionEmail || email).trim();
    if (!verificationEmail || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await resendSignupCode(
        verificationEmail,
        `family-invite/${tokenValue ?? ""}`,
      );
      setMessage("Código reenviado.");
    } catch {
      setMessage("Não foi possível reenviar o código agora.");
    } finally {
      setBusy(false);
    }
  };

  const handleOtherAccount = async () => {
    await signOut();
    setAuthStep("choice");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setOtp("");
    setMessage("");
  };

  const handleBack = () => {
    navigateBackOrReplace({ router, fallback: session ? "/" : "/welcome" });
  };

  const inputShell = {
    minHeight: 50,
    borderRadius: radius.internal,
    paddingHorizontal: 14,
    backgroundColor: solidInputBg,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row" as const,
    alignItems: "center" as const,
  };
  const inputText = {
    flex: 1,
    minHeight: 48,
    color: colors.inputText,
    fontSize: responsive.density.bodyFontSize,
    borderRadius: 0,
    paddingVertical: 0,
    ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}),
  } as any;

  const renderAuth = () => {
    if (session && !sessionNeedsVerification) {
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

    if (authStep === "choice") {
      return (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.muted, lineHeight: 20 }}>
            Use o mesmo e-mail que recebeu este convite.
          </Text>
          <Button label="Criar conta" onPress={() => setAuthStep("signup")} />
          <Button
            label="Já tenho conta"
            variant="outline"
            onPress={() => setAuthStep("login")}
          />
        </View>
      );
    }

    if (authStep === "verify") {
      return (
        <View style={{ gap: spacing.md }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: responsive.density.sectionTitleFontSize }}>
              Confirmar e-mail
            </Text>
            <Text style={{ color: colors.muted }}>
              Digite o código enviado para {normalizedSessionEmail || email}.
            </Text>
          </View>
          <View style={inputShell}>
            <TextInput
              value={otp}
              onChangeText={(value) => {
                setOtp(normalizeOtp(value));
                setMessage("");
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              placeholder="Código de 6 dígitos"
              placeholderTextColor={colors.placeholder}
              maxLength={6}
              style={[inputText, { letterSpacing: 6, textAlign: "center" }]}
              onSubmitEditing={() => void handleVerify()}
            />
          </View>
          <Button
            label="Confirmar e continuar"
            loading={busy}
            loadingLabel="Confirmando..."
            disabled={otp.length !== 6}
            onPress={() => void handleVerify()}
          />
          <Pressable suppressWebHoverFeedback onPress={() => void handleResend()}>
            <Text style={{ color: colors.primaryBg, fontWeight: "700", textAlign: "center" }}>
              Reenviar código
            </Text>
          </Pressable>
        </View>
      );
    }

    const isSignup = authStep === "signup";
    return (
      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: "800", fontSize: responsive.density.sectionTitleFontSize }}>
          {isSignup ? "Criar conta" : "Entrar"}
        </Text>
        <View style={inputShell}>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setMessage("");
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
            placeholder="E-mail"
            placeholderTextColor={colors.placeholder}
            style={inputText}
          />
        </View>
        <View style={inputShell}>
          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setMessage("");
            }}
            secureTextEntry={!showPassword}
            textContentType={isSignup ? "newPassword" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder="Senha"
            placeholderTextColor={colors.placeholder}
            style={inputText}
          />
          <Pressable
            accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
            onPress={() => setShowPassword((current) => !current)}
            style={{ padding: spacing.xs }}
          >
            <GoAtletaIcon
              name={showPassword ? "eyeOff" : "view"}
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>
        {isSignup ? (
          <View style={inputShell}>
            <TextInput
              value={confirmPassword}
              onChangeText={(value) => {
                setConfirmPassword(value);
                setMessage("");
              }}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="Confirmar senha"
              placeholderTextColor={colors.placeholder}
              style={inputText}
              onSubmitEditing={() => void handleSignup()}
            />
          </View>
        ) : null}
        <Button
          label={isSignup ? "Criar conta" : "Entrar"}
          loading={busy}
          loadingLabel={isSignup ? "Criando..." : "Entrando..."}
          disabled={!canSubmitAuth}
          onPress={() => void (isSignup ? handleSignup() : handleLogin())}
        />
        <Pressable
          suppressWebHoverFeedback
          onPress={() => {
            setAuthStep(isSignup ? "login" : "signup");
            setMessage("");
          }}
        >
          <Text style={{ color: colors.primaryBg, fontWeight: "700", textAlign: "center" }}>
            {isSignup ? "Já tenho conta" : "Criar uma conta"}
          </Text>
        </Pressable>
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
                  {renderAuth()}
                </>
              )}
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
