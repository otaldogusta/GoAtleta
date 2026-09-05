import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import type { StaffInviteResult, StaffSignupFields } from "../src/api/staff-invite";
import { refreshStaffSignupSession, resumeStaffSignup } from "../src/api/staff-invite";
import SignupScreen from "../src/screens/auth/SignupScreen";
import { markRender } from "../src/observability/perf";
import { useAuth } from "../src/auth/auth";
import { parseStaffInviteFragment, type StaffInviteProof } from "../src/auth/staff-invite-link";
import { clearPendingTrainerInvite, savePendingTrainerInvite } from "../src/auth/pending-invite";
import { useOrganization } from "../src/providers/OrganizationProvider";
import { Button } from "../src/ui/Button";
import { useAppTheme } from "../src/ui/app-theme";

// perf-check: ignore-measure - validation runs only after explicit acceptance, not on load.
export default function StaffInviteScreen() {
  markRender("screen.staff-invite.render.root");
  const { colors } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const resumeCode = typeof params.code === "string" && /^[A-Z0-9-]{4,128}$/i.test(params.code) ? params.code : "";
  const { session, loading, acceptStaffInvite, completeStaffInvite, signOut } = useAuth();
  const { setActiveOrganizationId } = useOrganization();
  const [proof, setProof] = useState<StaffInviteProof | null>(() =>
    Platform.OS === "web" && typeof window !== "undefined"
      ? parseStaffInviteFragment(window.location.hash) : null
  );
  const inFlight = useRef(false);
  const ready = true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<StaffInviteResult | null>(null);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Keep credentials only in memory, never in navigation history or analytics.
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, [router]);
  useEffect(() => {
    if (!ready || Platform.OS !== "web") return;
    // Run after React Navigation's initial URL synchronization: it can restore
    // the original fragment after the first mount effect cleaned history.
    const timer = setTimeout(() => {
      router.setParams({ "#": "" });
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }, 0);
    return () => clearTimeout(timer);
  }, [ready, router]);
  const accept = async () => {
    if ((!proof && !resumeCode) || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await savePendingTrainerInvite(proof?.code ?? resumeCode);
      // Preserve the old session if validation fails. Replace only after the
      // recipient is authenticated AND the organization accepted the claim.
      const result = proof ? await acceptStaffInvite(proof)
        : session ? await resumeStaffSignup(resumeCode, session) : null;
      if (!result) throw new Error("Entre com a conta convidada para continuar.");
      if (result.setup_required) {
        setSetup(result);
        return;
      }
      await setActiveOrganizationId(result.organization_id);
      await clearPendingTrainerInvite();
      setProof(null);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const complete = async (fields: StaffSignupFields) => {
    if ((!proof && !resumeCode) || !setup || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const activeSetup = await refreshStaffSignupSession(setup);
      // Preserve a rotated refresh token in memory if applying the membership
      // fails, so retrying never falls back to the expired temporary session.
      setSetup(activeSetup);
      const result = await completeStaffInvite(proof?.code ?? resumeCode, activeSetup, fields);
      await setActiveOrganizationId(result.organization_id);
      await clearPendingTrainerInvite();
      setSetup(null);
      setProof(null);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const login = async () => {
    if (!proof) return;
    const code = proof.code;
    await signOut();
    await savePendingTrainerInvite(code);
    router.replace({ pathname: "/login", params: { inviteCode: code } });
  };
  const invalid = ready && !proof && !resumeCode;
  if (setup) {
    return <SignupScreen completion={{
      email: setup.session.user.email ?? "",
      busy,
      error,
      onChange: () => setError(""),
      onSubmit: complete,
      onCancel: () => {
        setSetup(null);
        setProof(null);
        router.replace("/");
      },
    }} />;
  }
  return <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.block}>
      <Text style={[styles.title, { color: colors.text }]}>{invalid ? "Convite indisponível" : "Convite de funcionário"}</Text>
      <Text style={[styles.copy, { color: colors.muted }]}>
        {invalid ? "Abra novamente o link recebido por e-mail." : resumeCode
          ? "Continue o cadastro da conta convidada."
          : session
          ? `Você está conectado como ${session.user.email}. Continuar troca para a conta convidada.`
          : "Aceite para entrar com a conta que recebeu este convite."}
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.dangerText }}>{error}</Text> : null}
      {!invalid ? <Button label={busy ? "Validando convite..." : resumeCode ? "Continuar cadastro" : session ? "Trocar conta e aceitar" : "Aceitar e entrar"}
        disabled={!ready || loading || busy} onPress={() => void accept()} /> : null}
      {error && proof ? <Button label="Entrar com a conta convidada" variant="secondary" disabled={busy} onPress={() => void login()} /> : null}
      <Button label={session ? "Manter minha conta" : "Voltar"} variant="secondary" disabled={busy} onPress={() => router.replace("/")} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, justifyContent: "center", padding: 24 },
  block: { width: "100%", maxWidth: 440, alignSelf: "center", gap: 20 },
  title: { fontSize: 24, fontWeight: "800" },
  copy: { fontSize: 15, lineHeight: 23 },
});
