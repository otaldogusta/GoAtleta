# Fixes Prontos — GoAtleta

Código pronto pra copiar/colar. Cada fix está isolado e pode ser aplicado independentemente.

---

## Fix #1: Memory Leak em `recentScanByUidRef`

**Arquivo:** `app/nfc-attendance.tsx`

**Localizar:** Linha ~97 onde está `const recentScanByUidRef = ...`

**Adicionar após** (antes de `const shouldResumeAfterBindRef`):

```typescript
// Limpar cache de scans antigos a cada 5 minutos para evitar memory leak
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const entriesToDelete: string[] = [];
    
    recentScanByUidRef.current.forEach((timestamp, key) => {
      // Remover entradas com mais de 10 minutos de idade
      if (now - timestamp > 600_000) {
        entriesToDelete.push(key);
      }
    });
    
    if (entriesToDelete.length > 0) {
      entriesToDelete.forEach(key => recentScanByUidRef.current.delete(key));
      
      if (__DEV__) {
        console.log(
          `[NFC Cache] Limpeza: removidos ${entriesToDelete.length} registros, ` +
          `tamanho do cache agora: ${recentScanByUidRef.current.size}`
        );
      }
      
      logNfcEvent("cache_cleanup", {
        organizationId: activeOrganization?.id ?? "",
        removedCount: entriesToDelete.length,
        cacheSize: recentScanByUidRef.current.size,
      });
    }
  }, 300_000); // Limpar a cada 5 minutos
  
  return () => clearInterval(cleanupInterval);
}, [activeOrganization?.id]);
```

---

## Fix #2: Race Condition em `handleTagDetected`

**Arquivo:** `app/nfc-attendance.tsx`

**Localizar:** Função `handleTagDetected` (linha ~604)

**Replace entire function** com:

```typescript
const handleTagDetected = useCallback(
  async (result: { uid: string }) => {
    let alive = true; // Guard flag para detectar unmount
    
    const uid = result.uid;
    const orgId = activeOrganization?.id ?? "";
    if (!orgId) {
      setFeedback("Selecione uma organizacao ativa.");
      return;
    }
    
    void recordMetric("totalScans");
    logNfcEvent("tag_detected", { organizationId: orgId, tagUid: uid });
    setAdminRequiredUid("");

    try {
      const binding = await getBinding(orgId, uid);
      if (!alive) return; // Descarta se desmontou durante getBinding
      
      if (binding) {
        await registerCheckin({ studentId: binding.studentId, tagUid: uid });
        return;
      }

      if (!isAdmin) {
        void recordMetric("bindDenied");
        setAdminRequiredUid(uid);
        setFeedback("Somente admin pode vincular tags NFC.");
        showSaveToast({
          variant: "warning",
          message: "Tag sem vinculo. Solicite um admin para vincular.",
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return;
      }

      shouldResumeAfterBindRef.current = scanStateRef.current === "scanning";
      setPendingUid(uid);
      setBindingStudentId("");
      setBindSearch("");
      setShowBindModal(true);
      setFeedback(`Tag ${uid} sem vinculo. Selecione um aluno para vincular.`);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } finally {
      alive = false; // Marca desmontagem lógica
    }
  },
  [activeOrganization?.id, isAdmin, recordMetric, registerCheckin, showSaveToast]
);
```

---

## Fix #3: Cleanup em `searchSignalTimerRef`

**Arquivo:** `app/nfc-attendance.tsx`

**Localizar:** efeito que controla vibração (linha ~717)

**Replace entire effect** com:

```typescript
useEffect(() => {
  if (Platform.OS === "web") return;

  const shouldStop = scanState !== "scanning" || showBindModal || supportMessage;
  
  if (shouldStop) {
    // Garantir limpeza completa
    if (searchSignalTimerRef.current) {
      clearInterval(searchSignalTimerRef.current);
      searchSignalTimerRef.current = null;
    }
    Vibration.cancel();
    return;
  }

  // Limpar timer anterior se houver (evita duplicação)
  if (searchSignalTimerRef.current) {
    clearInterval(searchSignalTimerRef.current);
    searchSignalTimerRef.current = null;
  }

  // Iniciar novo timer
  Vibration.vibrate(SEARCH_SIGNAL_PATTERN, false);
  searchSignalTimerRef.current = setInterval(() => {
    Vibration.vibrate(SEARCH_SIGNAL_PATTERN, false);
  }, SEARCH_SIGNAL_INTERVAL_MS);

  return () => {
    if (searchSignalTimerRef.current) {
      clearInterval(searchSignalTimerRef.current);
      searchSignalTimerRef.current = null;
    }
    Vibration.cancel();
  };
}, [scanState, showBindModal, supportMessage]);
```

---

## Fix #4: Métrica `checkinsPending` Sincronizada

**Arquivo:** `app/nfc-attendance.tsx`

**Adicionar novo state** (após `const [metrics, setMetrics]...`):

```typescript
const [previousPendingCount, setPreviousPendingCount] = useState(0);
```

**Adicionar novo effect** (após o effect que carrega métricas iniciais):

```typescript
// Sincronizar métrica de pendências com estado real
useEffect(() => {
  const currentPendingCount = liveCheckins.filter(
    (c) => c.syncStatus === "pending"
  ).length;
  
  const orgId = activeOrganization?.id ?? "";
  if (!orgId) return;
  
  // Se diminuiu, decrementar métrica
  if (currentPendingCount < previousPendingCount) {
    const decreased = previousPendingCount - currentPendingCount;
    void recordMetric("checkinsPending", -decreased);
    
    if (__DEV__) {
      console.log(
        `[Metrics] Pendências: ${previousPendingCount} → ${currentPendingCount} (delta: -${decreased})`
      );
    }
  }
  
  setPreviousPendingCount(currentPendingCount);
}, [liveCheckins, previousPendingCount, activeOrganization?.id, recordMetric]);
```

**Modificar** `handleSyncNow` para NOT incrementar "checkinsPending" (já sincroniza via effect acima):

Na seção do `handleSyncNow`, **remover** a linha:
```typescript
void recordMetric("checkinsPending");
```

E **adicionar** no lugar:
```typescript
// Não incrementa aqui — a métrica é sincronizada pelo effect acima
```

---

## Fix #5: NFC Loop Re-init Protection

**Arquivo:** `src/nfc/nfc-hooks.ts`

**Localizar:** Função `useNfcContinuousScan` (linha ~46)

**Adicionar nova ref** no início da função:

```typescript
const loopStartedRef = useRef(false);
```

**Modificar a função `loop`** (encontrar `const loop = useCallback(async () => {`):

**Replace:**
```typescript
const loop = useCallback(async () => {
  while (runningRef.current) {
```

**Com:**
```typescript
const loop = useCallback(async () => {
  if (loopStartedRef.current) {
    // Previne múltiplas instâncias do loop paralelas
    if (__DEV__) {
      console.warn("[NFC] Loop já está rodando, ignorando nova inicialização");
    }
    return;
  }
  loopStartedRef.current = true;
  
  try {
    while (runningRef.current) {
```

**E adicionar `finally` no final da função `loop`:**

```typescript
  } finally {
    loopStartedRef.current = false;
  }
}, [emitError, loopDelayMs]);
```

**Modificar o cleanup** do useEffect final (encontrar o `useEffect(() => { return () => {`):

**Add `loopStartedRef` reset:**
```typescript
useEffect(() => {
  return () => {
    runningRef.current = false;
    pausedRef.current = false;
    loopStartedRef.current = false; // ← Add this line
    void stopScan();
  };
}, []);
```

---

## Fix #6: Sync Timeout Guard

**Arquivo:** `app/nfc-attendance.tsx`

**Adicionar nova ref** (perto de outras refs, ~95):

```typescript
const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Modificar função `handleSyncNow`** (linha ~441):

**Replace:**
```typescript
const handleSyncNow = useCallback(
  async (origin: "manual" | "auto" | "mount" = "manual") => {
    if (syncBusyRef.current) return;
    syncBusyRef.current = true;
    void recordMetric("syncRuns");
    try {
      const result = await syncNow();
```

**Com:**
```typescript
const handleSyncNow = useCallback(
  async (origin: "manual" | "auto" | "mount" = "manual") => {
    if (syncBusyRef.current) return;
    syncBusyRef.current = true;
    void recordMetric("syncRuns");
    
    // Timeout guard: força reset após 30s se trava
    syncTimeoutRef.current = setTimeout(() => {
      if (syncBusyRef.current) {
        logNfcError("Sync timeout - force reset", {
          organizationId: activeOrganization?.id ?? "",
          origin,
          screen: "nfc-attendance",
        });
        syncBusyRef.current = false;
      }
    }, 30_000);
    
    try {
      const result = await syncNow();
```

**E adicionar cleanup no `finally`:**

```typescript
    } finally {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      syncBusyRef.current = false;
    }
```

**Adicionar cleanup** no useEffect final (perto de onde limpa `syncDebounceRef`):

```typescript
useEffect(() => {
  return () => {
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = null;
    }
    if (searchSignalTimerRef.current) {
      clearInterval(searchSignalTimerRef.current);
      searchSignalTimerRef.current = null;
    }
    Vibration.cancel();
  };
}, []);
```

---

## Teste os Fixes

**Passo 1:** Aplicar todos os 6 fixes

**Passo 2:** Build e testar
```bash
npm run lint
npm run typecheck:core
npm start
```

**Passo 3:** Teste manual

1. **Fix #1 (Memory):** 
   - Ativar NFC leitor
   - Registrar 100+ presenças
   - Verificar RAM (devtools) não sobe infinitamente

2. **Fix #2 (Race):**
   - Ativar leitor
   - Aproximar tag
   - Antes de modal fechar, aproximar MESMA tag
   - Verificar que ignora (warning) não registra 2x

3. **Fix #3 (Vibração):**
   - Ativar leitor (começa vibração)
   - Aproximar tag (abre modal)
   - Modal fecha → vibração **PARA** (antes continuava)
   - ✅ Confirmado se para

4. **Fix #4 (Métricas):**
   - Com internet
   - Sem internet → registra, métrica pending sobe
   - Volta online → pendências sincronizam
   - Métrica volta ao normal

5. **Fix #5 (Loop):**
   - Verificar logs: NOT haver "Loop já está rodando"
   - Se houver = bug ainda existe

6. **Fix #6 (Timeout):**
   - Force um delay artificial na Supabase (network throttle)
   - Clique "Sincronizar"
   - Se demora >30s, vê mensagem de timeout
   - Botão libera pra novo sync

---

## Deploy Seguro

**Ordem recomendada:**

1. Aplicar todos 6 fixes
2. `npm run release:check:core` (lint + typecheck + testes)
3. Testar em Dev Client (Android) por 2-3 horas
4. `eas update --channel preview --auto`
5. QA testa por 1 dia
6. `eas update --channel production --auto`

---

## Rollback

Se der problema após deploy:

```bash
# Voltar pra versão anterior
eas update:promote --channel=main-production --to-channel=production
```

Done. Let me know if you need anything else!
