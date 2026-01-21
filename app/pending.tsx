import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../src/auth/auth";
import { useRole } from "../src/auth/role";
import { claimTrainerInvite } from "../src/api/trainer-invite";
import { claimStudentInvite } from "../src/api/student-invite";
import { Pressable } from "../src/ui/Pressable";
import { useAppTheme } from "../src/ui/app-theme";

export default function PendingScreen() {
  const { colors } = useAppTheme();
  const { signOut } = useAuth();
  const { refresh } = useRole();
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState("");
  const [studentInviteInput, setStudentInviteInput] = useState("");
  const [studentMessage, setStudentMessage] = useState("");

  const extractStudentToken = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const match = trimmed.match(/invite\/([^/?#]+)/i);
    return match?.[1] ?? trimmed;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.text }}>
          Conta aguardando vinculo
        </Text>
        <Text style={{ color: colors.muted }}>
          Seu acesso ainda nao foi associado a uma turma. Peça para o treinador
          revisar o cadastro e vincular seu usuario.
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
            Convite de treinador
          </Text>
          <Text style={{ color: colors.muted }}>
            Se voce recebeu um codigo de convite, insira abaixo.
          </Text>
          <TextInput
            placeholder="Codigo de convite"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
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
          {message ? (
            <Text style={{ color: colors.muted }}>{message}</Text>
          ) : null}
          <Pressable
            onPress={async () => {
              if (!inviteCode.trim()) {
                setMessage("Informe o codigo de convite.");
                return;
              }
              setMessage("");
              try {
                await claimTrainerInvite(inviteCode.trim());
                await refresh();
                setMessage("Convite validado com sucesso.");
              } catch (error) {
                const detail = error instanceof Error ? error.message : "";
                setMessage(
                  detail.toLowerCase().includes("invite")
                    ? "Convite invalido ou expirado."
                    : "Nao foi possivel validar o convite."
                );
              }
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Validar convite
            </Text>
          </Pressable>
        </View>
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
            Convite de aluno
          </Text>
          <Text style={{ color: colors.muted }}>
            Cole o link do convite para vincular sua conta.
          </Text>
          <TextInput
            placeholder="Link ou token do convite"
            value={studentInviteInput}
            onChangeText={setStudentInviteInput}
            placeholderTextColor={colors.placeholder}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              padding: 10,
              borderRadius: 12,
              backgroundColor: colors.inputBg,
              color: colors.inputText,
            }}
          />
          {studentMessage ? (
            <Text style={{ color: colors.muted }}>{studentMessage}</Text>
          ) : null}
          <Pressable
            onPress={async () => {
              const token = extractStudentToken(studentInviteInput);
              if (!token) {
                setStudentMessage("Informe o convite.");
                return;
              }
              setStudentMessage("");
              try {
                await claimStudentInvite(token);
                await refresh();
                setStudentMessage("Convite vinculado com sucesso.");
              } catch (error) {
                const detail = error instanceof Error ? error.message : "";
                const lower = detail.toLowerCase();
                setStudentMessage(
                  lower.includes("expired")
                    ? "Convite expirado."
                    : lower.includes("used")
                    ? "Convite ja utilizado."
                    : "Nao foi possivel validar o convite."
                );
              }
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
            <Text style={{ color: colors.text, fontWeight: "700" }}>
              Vincular convite
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
