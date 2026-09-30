import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/auth";
import { createProfileRequestId } from "../../core/profile-request-id";
import { ProfileConflictError, requestClassProfile, type ProfileCommand, type ProfileSnapshot } from "../../api/class-pedagogical-profile";

type Pending = { input: string; command?: ProfileCommand };
const storageTails = new Map<string, Promise<void>>();
function persist(key: string, value: Pending) {
  const next = (storageTails.get(key) ?? Promise.resolve()).catch(() => undefined)
    .then(() => AsyncStorage.setItem(key, JSON.stringify(value)));
  storageTails.set(key, next);
  void next.finally(() => { if (storageTails.get(key) === next) storageTails.delete(key); }).catch(() => undefined);
  return next;
}
export function useClassDiagnostic(organizationId: string, classId: string) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const key = `class-diagnostic-draft:v1:${userId}:${organizationId}:${classId}`;
  const scope = useRef(key);
  useLayoutEffect(() => { scope.current = key; }, [key]);
  const [stateScope, setStateScope] = useState(key);
  const isScoped = stateScope === key;
  const generation = useRef(0);
  const lock = useRef(false);
  const pendingRef = useRef<ProfileCommand | undefined>(undefined);
  const inputRef = useRef("");
  const controllerRef = useRef<AbortController | null>(null);
  const [input, setInputState] = useState("");
  const [snapshot, setSnapshot] = useState<ProfileSnapshot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<ProfileCommand | undefined>();
  const [operation, setOperation] = useState<ProfileCommand["action"] | null>(null);

  const run = useCallback(async (command: ProfileCommand): Promise<boolean> => {
    if (lock.current || !userId || !organizationId || !classId || (pendingRef.current && command.action !== "load" && command.requestId !== pendingRef.current.requestId)) return false;
    const ownGeneration = generation.current;
    const isCurrent = () => ownGeneration === generation.current && scope.current === key;
    lock.current = true; setBusy(true); setOperation(command.action); setError("");
    const controller = new AbortController(); controllerRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 75000);
    try {
      if (command.action !== "load" && command.action !== "evolution") {
        pendingRef.current = command; setPending(command);
        await persist(key, { input: inputRef.current, command });
      }
      const result = await requestClassProfile(organizationId, classId, command, controller.signal);
      if (!isCurrent()) return false;
      setSnapshot(result);
      if (result.status !== "pending" && command.action !== "load" && command.action !== "evolution") {
        pendingRef.current = undefined; setPending(undefined);
        if (command.action === "send" && inputRef.current.trim() === command.content) { inputRef.current = ""; setInputState(""); }
        await persist(key, { input: inputRef.current }).catch(() => {
          if (isCurrent()) setError("Salvo no servidor; não foi possível limpar a pendência neste dispositivo.");
        });
      }
      return result.status !== "pending";
    } catch (cause) {
      if (isCurrent() && cause instanceof ProfileConflictError) {
        // A rejected compare-and-swap did not apply. Refresh, but require a new explicit choice.
        pendingRef.current = undefined; setPending(undefined);
        await persist(key, { input: inputRef.current }).catch(() => undefined);
        try { const fresh = await requestClassProfile(organizationId, classId, { action: "load" }); if (isCurrent()) setSnapshot(fresh); } catch { /* retain original failure */ }
      }
      if (isCurrent()) setError(cause instanceof Error ? cause.message : "Não foi possível salvar. Tente novamente.");
      return false;
    } finally {
      clearTimeout(timeout);
      if (isCurrent()) { lock.current = false; setBusy(false); setOperation(null); setLoading(false); }
    }
  }, [classId, key, organizationId, userId]);

  useEffect(() => {
    generation.current += 1;
    const ownGeneration = generation.current;
    inputRef.current = ""; pendingRef.current = undefined; lock.current = false;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled || generation.current !== ownGeneration) return;
      setSnapshot(null); setError(""); setLoading(true); setBusy(false); setInputState(""); setPending(undefined); setStateScope(key);
      await storageTails.get(key)?.catch(() => undefined);
      if (!userId || !organizationId || !classId) return;
      const saved = await AsyncStorage.getItem(key);
      if (cancelled || generation.current !== ownGeneration) return;
      if (saved) {
        const restored: Pending = JSON.parse(saved);
        if (!inputRef.current) { inputRef.current = restored.input ?? ""; setInputState(inputRef.current); }
        pendingRef.current = restored.command; setPending(restored.command);
      }
      // Loading must not clear a pending unsent operation.
      const result = await requestClassProfile(organizationId, classId, { action: "load" });
      if (!cancelled && generation.current === ownGeneration) {
        setSnapshot(result);
        const restoredCommand = pendingRef.current;
        if (restoredCommand?.requestId && (result.revisions.some(revision => revision.id === restoredCommand.requestId) ||
            result.messages.some(message => message.id === restoredCommand.requestId && message.status === "interpreted"))) {
          pendingRef.current = undefined; setPending(undefined);
          if (restoredCommand.action === "send" && inputRef.current.trim() === restoredCommand.content) { inputRef.current = ""; setInputState(""); }
          await persist(key, { input: inputRef.current });
          if (cancelled || generation.current !== ownGeneration) return;
        }
        const unfinished = result.messages.find(message => message.status === "pending" && message.author_id === userId);
        if (!pendingRef.current && unfinished) {
          const cmd: ProfileCommand = { action: "send", requestId: unfinished.id, content: unfinished.content };
          pendingRef.current = cmd; setPending(cmd);
        }
      }
    })().catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível carregar o perfil."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; generation.current += 1; controllerRef.current?.abort(); };
  }, [key, organizationId, classId, userId]);

  const setInput = useCallback((value: string) => {
    inputRef.current = value; setInputState(value);
    void persist(key, { input: value, command: pendingRef.current }).catch(() => { if (scope.current === key) setError("Não foi possível preservar o rascunho neste dispositivo."); });
  }, [key]);
  const command = (value: ProfileCommand) => run({ ...value, requestId: value.requestId ?? createProfileRequestId(), expectedVersion: snapshot?.profile?.version ?? 0 });
  const send = () => input.trim() && !pendingRef.current ? command({ action: "send", content: input.trim() }) : Promise.resolve(false);
  const messages = (isScoped ? snapshot?.messages ?? [] : []).flatMap(message => [
    { role: "user" as const, content: message.content },
    ...(message.reply || message.question ? [{ role: "assistant" as const, content: [message.reply, message.question].filter(Boolean).join("\n\n") }] : []),
  ]);
  return { input: isScoped ? input : "", setInput, snapshot: isScoped ? snapshot : null, messages,
    busy: isScoped && busy, loading: !isScoped || loading, error: isScoped ? error : "", pending: isScoped ? pending : undefined, operation, send, command,
    retry: () => pendingRef.current ? run(pendingRef.current) : run({ action: "load" }),
  };
}
