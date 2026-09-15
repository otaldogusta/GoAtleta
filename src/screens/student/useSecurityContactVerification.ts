import { useCallback, useEffect, useRef, useState } from "react";
import { securityContactVerification, type SecurityContactStatus } from "../../api/security-contact-verification";
import { getSecurityContactEmailValidationError, normalizeSecurityContactEmail } from "../../core/account-security";
import { useSaveToast } from "../../ui/save-toast";

/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect -- async identity guards and account resets are intentional hook synchronization. */

export function useSecurityContactVerification(userId: string | undefined, loginEmail: string | undefined) {
  const [status, setStatus] = useState<SecurityContactStatus | null>(null);
  const [draft, setDraft] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(userId);
  const lock = useRef(false);
  const lastAutoAttempt = useRef<string | null>(null);
  const { showSaveToast } = useSaveToast();
  active.current = userId;
  const load = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      const next = await securityContactVerification("status");
      if (active.current !== userId) return;
      setStatus(next);
      setDraft(next.pendingEmail ?? next.email ?? "");
    } catch (e) { if (active.current === userId) setError(e instanceof Error ? e.message : "Não foi possível carregar o e-mail."); }
    finally { if (active.current === userId) setBusy(false); }
  }, [userId]);
  useEffect(() => { setStatus(null); setDraft(""); setCode(""); void load(); }, [load]);
  const retrySeconds = Math.max(0, Math.ceil((Date.parse(status?.retryAt ?? "") - now) / 1000)) || 0;
  const waitingToResend = retrySeconds > 0;
  useEffect(() => {
    if (!waitingToResend) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitingToResend]);
  const email = normalizeSecurityContactEmail(draft);
  const pending = Boolean(email && status?.pendingEmail === email);
  const verified = Boolean(email && status?.email === email && status.verifiedAt);
  const run = async (action: "request" | "verify" | "remove", submittedCode = code) => {
    if (lock.current || busy || !status) return;
    const validation = getSecurityContactEmailValidationError(draft, loginEmail);
    if (action !== "remove" && (validation || !email)) { setError(validation || "Informe um e-mail."); return; }
    lock.current = true; setBusy(true); setError(null);
    const owner = userId;
    try {
      const next = await securityContactVerification(action, email, submittedCode);
      if (active.current !== owner) return;
      setStatus(next); setCode(""); setNow(Date.now());
      lastAutoAttempt.current = null;
      if (action === "verify" || action === "remove") {
        setDraft(next.email ?? "");
        showSaveToast({ message: action === "verify" ? "E-mail alternativo confirmado." : "E-mail alternativo removido." });
      }
    } catch (e) {
      if (action === "remove") throw e;
      if (active.current === owner) setError(e instanceof Error ? e.message : "Não foi possível confirmar o e-mail.");
    }
    finally { lock.current = false; if (active.current === owner) setBusy(false); }
  };
  const completeCode = (value: string) => {
    if (busy || lock.current) return;
    const next = value.replace(/\D/g, "").slice(0, 8);
    const attempt = `${email}:${next}`;
    if (next.length === 8 && lastAutoAttempt.current === attempt) return;
    setCode(next);
    setError(null);
    if (next.length !== 8) { lastAutoAttempt.current = null; return; }
    if (!pending) return;
    lastAutoAttempt.current = attempt;
    void run("verify", next);
  };
  return { draft, setDraft, code, setCode, completeCode, error, setError, busy, status, load, pending, verified, retrySeconds,
    canRequest: Boolean(status && email && !verified && !busy && !retrySeconds && !getSecurityContactEmailValidationError(draft, loginEmail)),
    run };
}
