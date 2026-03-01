# Análise de Melhorias - GoAtleta

**Data da análise:** 2026-02-17  
**Estatísticas:**
- ~8,571 arquivos TypeScript/TSX
- 94.4% TypeScript, 1.4% JavaScript, 3.8% PL/pgSQL
- Projeto Expo/React Native com backend Supabase

---

## 🔴 CRÍTICO - Problemas que impactam performance/segurança

### 1. **Vazamento de Memória em NFC - useNfcContinuousScan**
**Arquivo:** `src/nfc/nfc-hooks.ts`  
**Gravidade:** Alto  
**Problema:**
- `runningRef`, `pausedRef`, `busyRef` usam `useRef` mas nunca resetam entre renders
- Loop contínuo em `useNfcContinuousScan` pode causar múltiplas instâncias se o componente remount
- Não há debounce para multiplos calls rápidos para `loop()`

**Solução:**
```typescript
// Adicionar lógica para evitar múltiplos loops paralelos
const loopStartedRef = useRef(false);

const loop = useCallback(async () => {
  if (loopStartedRef.current) return; // Previne múltiplas instâncias
  loopStartedRef.current = true;
  try {
    // ... código do loop
  } finally {
    loopStartedRef.current = false;
  }
}, [...]);
```

### 2. **Memory Leak em NFC Attendance Screen**
**Arquivo:** `app/nfc-attendance.tsx` (1,200+ linhas)  
**Gravidade:** Alto  
**Problema:**
- `recentScanByUidRef.current` cresce infinitamente sem limpeza
- Múltiplos `useEffect` sem lógica de cleanup adequada
- `searchSignalTimerRef` pode ficar ativo mesmo após unmount em casos edge

**Solução:**
```typescript
// Limpar cache após 10 minutos de inatividade
useEffect(() => {
  const interval = setInterval(() => {
    const now = Date.now();
    const entries = Array.from(recentScanByUidRef.current.entries());
    entries.forEach(([key, timestamp]) => {
      if (now - timestamp > 600_000) { // 10 min
        recentScanByUidRef.current.delete(key);
      }
    });
  }, 60_000);
  return () => clearInterval(interval);
}, []);
```

### 3. **Sem Tratamento de Network Offline**
**Arquivo:** `src/data/attendance-checkins.ts` (indireto via `nfc-attendance.tsx`)  
**Gravidade:** Alto  
**Problema:**
- App pode criar duplicatas se cair internet entre leitura NFC e sync
- Sem deduplicação no backend (apenas client-side via `isDuplicateRead`)
- Caso de uso: NFC lê, tela recarrega, app tenta criar checkin novamente

**Solução:**
- Implementar idempotency key na chamada API (use `tagUid + timestamp + studentId`)
- Backend deve retornar erro `409 Conflict` ao invés de criar duplicata
- Persistir idempotency key localmente antes de enviar

### 4. **Sem Validação de Rate Limit NFC**
**Arquivo:** `app/nfc-attendance.tsx`  
**Gravidade:** Médio  
**Problema:**
- `loopDelayMs: 120` permite até 8 tags/seg, mas sem controle global
- Se dois alunos aproximarem ao mesmo tempo, pode gerar race condition
- `DUPLICATE_WINDOW_MS = 20_000` é muito generoso (pode bloquear checkin legítimo)

**Solução:**
```typescript
const DUPLICATE_WINDOW_MS = 5_000; // Reduzir para 5 seg
const MAX_SCANS_PER_MINUTE = 40; // Adicionar limite global
```

---

## 🟡 ALTO - Problemas técnicos relevantes

### 5. **Code Split de `nfc-attendance.tsx` (1,200+ linhas)**
**Arquivo:** `app/nfc-attendance.tsx`  
**Gravidade:** Alto (code quality)  
**Problema:**
- Arquivo muito grande = difícil manutenção, lento para ler
- Lógica de binding, métricas, sync tudo junto
- Reutilização de componentes interna (buttons, cards) sem abstração

**Solução:**
```
app/nfc-attendance/
├── index.tsx (componente raiz, ~400 linhas)
├── ScannerSection.tsx (~200 linhas)
├── BindingModal.tsx (~250 linhas)
├── CheckinsList.tsx (~150 linhas)
├── Bindingslist.tsx (~100 linhas)
└── useScannerLogic.ts (~300 linhas)
```

### 6. **TypeScript: Faltam Type Strictness**
**Arquivo:** `tsconfig.json`  
**Gravidade:** Médio  
**Problema:**
- `"strict": true` ✓ (bom), mas faltam:
  - `"noImplicitAny": true` ✓ (provavelmente já ativo)
  - `"exactOptionalPropertyTypes": true` ✗ (não configurado)
  - `"noUncheckedIndexedAccess": true` ✗ (não configurado)

**Solução:**
```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "useDefineForClassFields": true
  }
}
```

### 7. **Falta de Error Boundary**
**Arquivo:** `app/nfc-attendance.tsx`  
**Gravidade:** Médio  
**Problema:**
- Sem Error Boundary: crash em NFC scanner pode derrubar toda a tela
- Sem fallback se dados não carregam
- Try-catch em `handleTagDetected` não cobre cenários de race condition

**Solução:**
- Criar `NfcErrorBoundary.tsx` 
- Usar React's `<ErrorBoundary>` (ou expo equivalent)

### 8. **Métricas Locais não Persistem**
**Arquivo:** `app/nfc-attendance.tsx` → `src/nfc/metrics.ts`  
**Gravidade:** Médio  
**Problema:**
- Métricas são carregadas ao montar, mas se app fecha abruptamente, dados podem ficar inconsistentes
- `incrementNfcMetric` tenta escrever no DB, mas falhas são silenciosas
- Sem fallback local

**Solução:**
- Usar AsyncStorage como fallback
- Sincronizar periodicamente com DB
- Implementar queue local de pendências

---

## 🟢 MÉDIO - Oportunidades de otimização

### 9. **Performance: Re-renders Desnecessários**
**Arquivo:** `app/nfc-attendance.tsx`  
**Gravidade:** Médio  
**Problema:**
- `studentsById`, `classesById`, `bindingsByStudentId` são recalculadas a cada render
- Mesmo com `useMemo`, o array de dependências é grande
- Estado `feedback` causa re-render de tudo

**Solução:**
```typescript
// Usar useCallback com estabilidade
const onFeedbackChange = useCallback((msg: string) => setFeedback(msg), []);

// Extrair subs-componentes para evitar re-render cascata
const FeedbackSection = memo(({ feedback }: Props) => ...);
```

### 10. **Configuração de ESLint Muito Permissiva**
**Arquivo:** `eslint.config.js`  
**Gravidade:** Médio  
**Problema:**
- Apenas `ignores: ['dist/*']` 
- Sem regras adicionais para NFC, performance, security
- `// eslint-disable-next-line` em `nfc.ts:20` sem justificação

**Solução:**
```javascript
module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'node_modules/*'],
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-floating-promises': 'error',
      'react-native/no-inline-styles': 'warn',
    },
  },
]);
```

### 11. **Sem Testes para NFC Core**
**Arquivo:** `src/nfc/` (sem `__tests__`)  
**Gravidade:** Médio  
**Problema:**
- `nfc.ts`, `nfc-hooks.ts` não têm testes
- Lógica crítica de dupliação e synchronization não validada
- Jest config existe mas está subutilizado

**Solução:**
```
src/nfc/__tests__/
├── nfc.test.ts
├── nfc-hooks.test.ts
├── metrics.test.ts
└── fixtures/
```

### 12. **Docker + CI/CD Ausente**
**Arquivo:** N/A  
**Gravidade:** Médio  
**Problema:**
- Sem Dockerfile para backend (Supabase Edge Functions?)
- Sem `.github/workflows` configurado
- Build web manual (`npm run build`)

**Solução:**
```dockerfile
# Dockerfile para web build
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🟢 BAIXO - Melhorias adicionais

### 13. **Documentação Falta Detalhes**
**Arquivo:** `README.md`, docs/  
**Gravidade:** Baixo  
**Problema:**
- NFC setup não explicado
- Webpack/Metro patches não documentados
- Supabase migrations faltam schema comentado

**Solução:**
- `docs/NFC_SETUP.md` com imagens
- `docs/ARCHITECTURE.md` (data flow, componentes-chave)

### 14. **Sem Observability/Logging Centralizad**
**Arquivo:** `src/nfc/telemetry.ts` (existe mas minimalista)  
**Gravidade:** Baixo  
**Problema:**
- Apenas `logNfcEvent` e `logNfcError`
- Sem contexto de usuário/organização em logs
- Sem aggregation em tempo real

**Solução:**
- Integrar com Sentry ou DataDog
- Adicionar breadcrumbs para seguir fluxo do usuário

### 15. **Validação de Env Vars em Runtime**
**Arquivo:** `.env.example`  
**Gravidade:** Baixo  
**Problema:**
- Sem validação de vars de ambiente na startup
- `EXPO_PUBLIC_*` pode estar undefined sem aviso

**Solução:**
```typescript
// src/bootstrap/validate-env.ts
const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export function validateEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid env: ${result.error.message}`);
  }
}
```

---

## 📋 Priorização Sugerida

| Prioridade | Item | Esforço | Impacto |
|-----------|------|--------|--------|
| 🔴 P0 | Memory leak NFC refs (#1, #2) | 4h | Muito Alto |
| 🔴 P0 | Idempotency keys (#3) | 6h | Muito Alto |
| 🟡 P1 | Split `nfc-attendance.tsx` (#5) | 8h | Alto |
| 🟡 P1 | TypeScript strictness (#6) | 4h | Alto |
| 🟡 P2 | Error Boundary (#7) | 3h | Médio |
| 🟡 P2 | Rate limiting (#4) | 2h | Médio |
| 🟢 P3 | Docker + CI/CD (#12) | 6h | Médio |
| 🟢 P3 | ESLint rules (#10) | 2h | Médio |

---

## Próximos Passos

1. **Semana 1:** Corrigir memory leaks (#1, #2) e adicionar idempotency (#3)
2. **Semana 2:** Split de componentes (#5) e testes (#11)
3. **Semana 3:** Docker setup (#12) e observability (#14)

Let me know if you have any other questions!
