import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { claimStudentInvite } from "../src/api/student-invite";
import {
  clearPendingInvite,
  getPendingInvite,
} from "../src/auth/pending-invite";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

export default function PendingScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const { refresh } = useRole();
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [message, setMessage] = useState("");
  const [storedToken, setStoredToken] = useState("");
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
      await refresh();
      setMessage("Convite de treinador validado com sucesso.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "";
      const lower = detail.toLowerCase();
      if (type === "student") {
        setMessage(
          lower.includes("expired")
            ? "Convite expirado."
            : lower.includes("used")
            ? "Convite já utilizado."
            : "Não foi possível validar o convite."
        );
        return;
      }
      setMessage(
        lower.includes("invite")
          ? "Convite inválido ou expirado."
          : "Não foi possível validar o convite."
      );
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
      const detail = error instanceof Error ? error.message : "";
      const lower = detail.toLowerCase();
      setMessage(
        lower.includes("expired")
          ? "Convite expirado."
          : lower.includes("used")
          ? "Convite ja utilizado. Peca um novo link."
          : "Nao foi possivel validar o convite."
      );
    } finally {
      setInviteBusy(false);
    }
  };

  const clearStoredInvite = async () => {
    await clearPendingInvite();
    setStoredToken("");
    setMessage("");
    autoClaimedRef.current = false;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getPendingInvite();
      if (!alive || !token) return;
      setStoredToken(token);
      if (autoClaimedRef.current) return;
      autoClaimedRef.current = true;
      await handleStoredInvite(token);
    })();
    return () => {
      alive = false;
    };
  }, [refresh]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          Conta aguardando vínculo
        </Text>
        <Text style={{ color: colors.muted }}>
          Seu acesso ainda não foi associado a uma turma. Peça para o treinador
          revisar o cadastro e vincular seu usuário.
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
          {storedToken ? (
            <>
              <Text style={{ color: colors.muted }}>
                Convite detectado. Validando automaticamente.
              </Text>
              {message ? (
                <Text style={{ color: colors.muted }}>{message}</Text>
              ) : null}
              <Pressable
                onPress={() => handleStoredInvite()}
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
                Cole o link do convite (aluno) ou o codigo do convite (treinador).
              </Text>
              <TextInput
                placeholder="Link ou codigo do convite"
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
              {message ? (
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
            </>
          )}
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
