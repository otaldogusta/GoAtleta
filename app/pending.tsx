import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
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
import { markRender, measureAsync } from "../src/observability/perf";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

export default function PendingScreen() {
  markRender("screen.pending.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { refresh } = useRole();
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [message, setMessage] = useState("");
  const [storedToken, setStoredToken] = useState("");
  const [storedTrainerCode, setStoredTrainerCode] = useState("");
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [coordinatorEmail, setCoordinatorEmail] = useState("");
  const [requestBusy, setRequestBusy] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const autoClaimedRef = useRef(false);

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value
    );

  const extractStudentToken = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const inviteMatch = trimmed.match(/invite\/([0-9a-f-]{36})/i);
    if (inviteMatch?.[1]) return inviteMatch[1];
    const tokenMatch = trimmed.match(/[?&]token=([0-9a-f-]{36})/i);
    if (tokenMatch?.[1]) return tokenMatch[1];
    if (isUuid(trimmed)) return trimmed;
    return "";
  };

  const getInviteType = (value: string) => {
    if (!value.trim()) return "unknown" as const;
    const token = extractStudentToken(value);
    if (token) return "student" as const;
    return "trainer" as const;
  };

  const inviteHint = (() => {
    if (!inviteInput.trim()) {
      return "Cole o link do convite do aluno ou o código do treinador.";
    }
    const type = getInviteType(inviteInput);
    if (type === "student") return "Convite de aluno identificado.";
    if (type === "trainer") return "Convite de treinador identificado.";
    return "Cole o link completo ou o código do convite.";
  })();

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

  const handleInvite = async () => {
    if (inviteBusy) return;
    const type = getInviteType(inviteInput);
    const trimmed = inviteInput.trim();
    if (!trimmed) {
      setMessage("Informe o convite.");
      return;
    }
    setInviteBusy(true);
    setMessage("");
    try {
      if (type === "student") {
        const token = extractStudentToken(trimmed);
        if (!token) {
          setMessage("Não foi possível ler o link do convite.");
          return;
        }
        await claimStudentInvite(token);
        await refresh();
        setMessage("Convite de aluno vinculado com sucesso.");
        return;
      }
      await claimTrainerInvite(trimmed);
      await clearPendingTrainerInvite();
      await refresh();
      router.replace("/");
    } catch (error) {
      if (type === "student") {
        setMessage(parseInviteError(error));
        return;
      }
      const code = getInviteErrorCode(error);
      setMessage(
        code === "INVITE_INVALID" || code === "INVITE_EXPIRED" || code === "INVITE_REVOKED"
          ? "Convite inválido ou expirado."
          : "Não foi possível validar o convite."
      );
    } finally {
      setInviteBusy(false);
    }
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
      router.replace("/");
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
      router.replace("/");
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
      if (!token && !trainerCode) return;
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
  }, [refresh]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          Acesso pendente
        </Text>
        <Text style={{ color: colors.muted }}>
          Sua conta ainda não possui organização e função ativas.
        </Text>
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Convite de acesso
          </Text>
          { storedToken || storedTrainerCode ? (
            <>
              <Text style={{ color: colors.muted }}>
                Convite detectado. Estamos validando seu acesso automaticamente.
              </Text>
              { message ? (
                <Text style={{ color: colors.muted }}>{message}</Text>
              ) : null}
              <Pressable
                onPress={() =>
                  storedToken
                    ? handleStoredInvite()
                    : handleStoredTrainerInvite()
                }
                disabled={inviteBusy}
                style={{
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.secondaryBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {inviteBusy ? "Validando..." : "Tentar novamente"}
                </Text>
              </Pressable>
              <Pressable
                onPress={clearStoredInvite}
                style={{
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: colors.inputBg,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Usar outro convite
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={{ color: colors.muted }}>
                Se recebeu um convite, abra o link novamente ou informe o código.
                O vínculo e a função serão aplicados automaticamente.
              </Text>
              { !showInviteInput ? (
                <Pressable
                  onPress={() => setShowInviteInput(true)}
                  style={{
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: colors.secondaryBg,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    Tenho um convite
                  </Text>
                </Pressable>
              ) : (
                <>
                  <TextInput
                    placeholder="Link ou código do convite"
                    value={inviteInput}
                    onChangeText={setInviteInput}
                    autoCapitalize="none"
                    placeholderTextColor={colors.placeholder}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      padding: 10,
                      borderRadius: 12,
                      backgroundColor: colors.inputBg,
                      color: colors.inputText,
                    }}
                  />
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {inviteHint}
                  </Text>
                  { message ? (
                    <Text style={{ color: colors.muted }}>{message}</Text>
                  ) : null}
                  <Pressable
                    onPress={handleInvite}
                    disabled={inviteBusy}
                    style={{
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: colors.secondaryBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      {inviteBusy ? "Validando..." : "Validar convite"}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowInviteInput(false)}
                    style={{
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: colors.inputBg,
                      borderWidth: 1,
                      borderColor: colors.border,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: colors.text, fontWeight: "700" }}>
                      Cancelar
                    </Text>
                  </Pressable>
                </>
              )}
            </>
          )}
        </View>
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>
            Entrou sem convite?
          </Text>
          <Text style={{ color: colors.muted }}>
            Seu acesso: {session?.user?.email ?? "e-mail não informado"}. Informe
            abaixo o e-mail da coordenação responsável para enviar a solicitação.
          </Text>
          <TextInput
            placeholder="E-mail da coordenação"
            value={coordinatorEmail}
            onChangeText={setCoordinatorEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
            }}
          />
          {requestMessage ? (
            <Text style={{ color: colors.muted }}>{requestMessage}</Text>
          ) : null}
          <Pressable
            onPress={() => void handleAccessRequest()}
            disabled={requestBusy}
            style={{
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: colors.primaryBg,
              alignItems: "center",
              opacity: requestBusy ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
              {requestBusy ? "Enviando..." : "Solicitar liberação"}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={async () => {
            if (busy) return;
            setBusy(true);
            await refresh();
            setBusy(false);
          }}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.primaryBg,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.primaryText, fontWeight: "700" }}>
            {busy ? "Verificando..." : "Recarregar status"}
          </Text>
        </Pressable>
        <Pressable
          onPress={async () => {
            await signOut();
          }}
          style={{
            paddingVertical: 10,
            borderRadius: 12,
            backgroundColor: colors.secondaryBg,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontWeight: "700" }}>Sair</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
