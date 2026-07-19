import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getInviteErrorCode } from "../src/api/invite-errors";
import { claimStudentInvite } from "../src/api/student-invite";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { requestAccessReview } from "../src/api/access-request";
import { useAuth } from "../src/auth/auth";
import {
    clearPendingInvite,
    clearPendingTrainerInvite,
    getPendingInvite,
    getPendingTrainerInvite,
} from "../src/auth/pending-invite";
import { useRole } from "../src/auth/role";
import { ResponsivePage } from "../src/components/ui/ResponsivePage";
import { ScreenLoadingState } from "../src/components/ui/ScreenLoadingState";
import { markRender, measureAsync } from "../src/observability/perf";
import { radius, spacing } from "../src/theme/tokens";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";
import { GoAtletaIcon } from "../src/ui/icon-registry";

export default function PendingScreen() {
  markRender("screen.pending.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { loading: roleLoading, refresh, role } = useRole();
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [storedToken, setStoredToken] = useState("");
  const [storedTrainerCode, setStoredTrainerCode] = useState("");
  const [storedInvitesLoading, setStoredInvitesLoading] = useState(true);
  const [coordinatorEmail, setCoordinatorEmail] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const autoClaimedRef = useRef(false);

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

  const handleAccessRequest = async () => {
    const normalizedEmail = coordinatorEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setRequestMessage("Informe o e-mail da coordenação.");
      return;
    }
    if (requestBusy) return;
    setRequestBusy(true);
    setRequestMessage("");
    try {
      await requestAccessReview(normalizedEmail);
      setRequestMessage(
        "Solicitação enviada. A coordenação receberá o aviso no app e por push, quando habilitado."
      );
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a solicitação."
      );
    } finally {
      setRequestBusy(false);
    }
  };

  const handleBackToLogin = async () => {
    await signOut();
    router.replace("/login");
  };

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
      setStoredInvitesLoading(false);
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
    // The stored values are claimed once per mount; including the handlers would
    // recreate this effect whenever transient invite state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, role, router]);

  if (
    roleLoading ||
    storedInvitesLoading ||
    ((role === "trainer" || role === "student") && !storedToken && !storedTrainerCode)
  ) {
    return <ScreenLoadingState />;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingVertical: spacing.xxl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <ResponsivePage
            variant="content"
            gap={spacing.lg}
            style={{ width: "100%", maxWidth: 720 }}
          >
            <Pressable
              onPress={() => void handleBackToLogin()}
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xs,
                paddingVertical: spacing.xs,
              }}
            >
              <GoAtletaIcon name="chevronBack" size={16} color={colors.muted} />
              <Text style={{ color: colors.muted, fontWeight: "600" }}>
                Voltar para entrar
              </Text>
            </Pressable>

            <View style={{ alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <GoAtletaIcon name="personSolid" size={24} color={colors.primaryBg} />
              </View>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 26,
                  fontWeight: "800",
                  textAlign: "center",
                }}
              >
                Acesso aguardando liberação
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 15,
                  lineHeight: 22,
                  textAlign: "center",
                  maxWidth: 520,
                }}
              >
                Sua conta foi criada, mas ainda não está vinculada a uma organização.
              </Text>
            </View>

            <View
              style={{
                padding: spacing.lg,
                borderRadius: radius.container,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                gap: spacing.lg,
              }}
            >
              {storedToken || storedTrainerCode ? (
                <View style={{ gap: spacing.sm }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <GoAtletaIcon name="link" size={18} color={colors.text} />
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                      Convite encontrado
                    </Text>
                  </View>
                    <Text style={{ color: colors.muted, lineHeight: 20 }}>
                      Encontramos um convite e estamos validando o vínculo automaticamente.
                    </Text>
                    {message ? <Text style={{ color: colors.muted }}>{message}</Text> : null}
                    <Pressable
                      onPress={() =>
                        storedToken ? handleStoredInvite() : handleStoredTrainerInvite()
                      }
                      disabled={inviteBusy}
                      style={{
                        minHeight: 46,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.internal,
                        backgroundColor: colors.primaryBg,
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: inviteBusy ? 0.65 : 1,
                      }}
                    >
                      <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                        {inviteBusy ? "Validando convite..." : "Tentar novamente"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={clearStoredInvite}
                      style={{ alignSelf: "center", padding: spacing.xs }}
                    >
                      <Text style={{ color: colors.muted, fontWeight: "600" }}>
                        Descartar este convite
                      </Text>
                    </Pressable>
                </View>
              ) : (
                <>
                  <View style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <GoAtletaIcon name="members" size={18} color={colors.text} />
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>
                    Solicitar acesso
                  </Text>
                </View>
                <Text style={{ color: colors.muted, lineHeight: 20 }}>
                  Informe o e-mail da coordenação responsável. Você está conectado como{" "}
                  <Text style={{ color: colors.text, fontWeight: "600" }}>
                    {session?.user?.email ?? "e-mail não informado"}
                  </Text>
                  .
                </Text>
                <TextInput
                  placeholder="E-mail da coordenação responsável"
                  value={coordinatorEmail}
                  onChangeText={setCoordinatorEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholderTextColor={colors.placeholder}
                  style={{
                    minHeight: 46,
                    borderWidth: 1,
                    borderColor: colors.border,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.internal,
                    backgroundColor: colors.inputBg,
                    color: colors.inputText,
                  }}
                />
                {requestMessage ? (
                  <Text style={{ color: colors.muted, lineHeight: 20 }}>{requestMessage}</Text>
                ) : null}
                <Pressable
                  onPress={() => void handleAccessRequest()}
                  disabled={requestBusy}
                  style={{
                    minHeight: 46,
                    paddingHorizontal: spacing.md,
                    borderRadius: radius.internal,
                    backgroundColor: colors.primaryBg,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: requestBusy ? 0.65 : 1,
                  }}
                >
                  <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
                    {requestBusy ? "Enviando solicitação..." : "Solicitar acesso"}
                  </Text>
                </Pressable>
              </View>

                  <View style={{ height: 1, backgroundColor: colors.border }} />

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.sm,
                    }}
                  >
                    <GoAtletaIcon name="link" size={18} color={colors.muted} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: colors.text, fontWeight: "700" }}>
                        Recebeu um convite?
                      </Text>
                      <Text style={{ color: colors.muted, lineHeight: 20 }}>
                        Abra o link recebido por e-mail ou mensagem. O vínculo será aplicado
                        automaticamente; não é necessário colar o link nesta tela.
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              <Pressable
                onPress={async () => {
                  if (busy) return;
                  setBusy(true);
                  await refresh();
                  setBusy(false);
                }}
                disabled={busy}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xs,
                  padding: spacing.xs,
                  opacity: busy ? 0.65 : 1,
                }}
              >
                <GoAtletaIcon name="refresh" size={16} color={colors.muted} />
                <Text style={{ color: colors.muted, fontWeight: "600" }}>
                  {busy ? "Verificando..." : "Verificar acesso novamente"}
                </Text>
              </Pressable>
              <View style={{ width: 1, height: 18, backgroundColor: colors.border }} />
              <Pressable
                onPress={() => void handleBackToLogin()}
                style={{ padding: spacing.xs }}
              >
                <Text style={{ color: colors.muted, fontWeight: "600" }}>
                  Entrar com outra conta
                </Text>
              </Pressable>
            </View>
          </ResponsivePage>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
