# Fix Rápido - Códigos Prontos para Aplicar

## Fix #1: Memory Leak em useNfcContinuousScan

**Arquivo:** `src/nfc/nfc-hooks.ts`

Replace `export function useNfcContinuousScan` com:

```typescript
export function useNfcContinuousScan(options: UseNfcContinuousScanOptions) {
  const [state, setState] = useState<NfcContinuousState>("idle");
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const busyRef = useRef(false);
  const loopStartedRef = useRef(false); // ← NOVO: Previne múltiplos loops
  const onTagRef = useRef(options.onTag);
  const onErrorRef = useRef(options.onError);
  const loopDelayMs = options.loopDelayMs ?? 90;

  useEffect(() => {
    onTagRef.current = options.onTag;
  }, [options.onTag]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const emitError = useCallback((error: unknown) => {
    if (shouldIgnoreContinuousScanError(error)) return;
    onErrorRef.current?.(error);
  }, []);

  const loop = useCallback(async () => {
    // ← NOVO: Evita múltiplas instâncias do loop
    if (loopStartedRef.current) return;
    loopStartedRef.current = true;

    try {
      while (runningRef.current) {
        if (pausedRef.current) {
          await wait(80);
          continue;
        }
        if (busyRef.current) {
          await wait(40);
          continue;
        }

        busyRef.current = true;
        try {
          const result = await readTagUid();
          if (!runningRef.current || pausedRef.current) continue;
          await onTagRef.current(result);
        } catch (error) {
          if (!runningRef.current) break;
          emitError(error);
        } finally {
          busyRef.current = false;
        }

        if (loopDelayMs > 0) {
          await wait(loopDelayMs);
        }
      }
    } finally {
      loopStartedRef.current = false; // ← NOVO: Reset para próximo start
    }
  }, [emitError, loopDelayMs]);

  const start = useCallback((_: string = "") => {
    if (runningRef.current) {
      pausedRef.current = false;
      setState("scanning");
      return;
    }
    runningRef.current = true;
    pausedRef.current = false;
    setState("scanning");
    void loop();
  }, [loop]);

  const pause = useCallback(async () => {
    if (!runningRef.current) return;
    pausedRef.current = true;
    setState("paused");
    await stopScan();
  }, []);

  const resume = useCallback(() => {
    if (!runningRef.current) {
      start();
      return;
    }
    pausedRef.current = false;
    setState("scanning");
  }, [start]);

  const stop = useCallback(async () => {
    runningRef.current = false;
    pausedRef.current = false;
    setState("idle");
    await stopScan();
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      pausedRef.current = false;
      loopStartedRef.current = false; // ← NOVO
      void stopScan();
    };
  }, []);

  return useMemo(
    () => ({
      state,
      isScanning: state === "scanning",
      start,
      pause,
      resume,
      stop,
    }),
    [pause, resume, start, state, stop]
  );
}
```

---

## Fix #2: Limpar Cache de Scans Antigos

**Arquivo:** `app/nfc-attendance.tsx` (adicionar após `const recentScanByUidRef = ...`)

```typescript
// Novo effect: Limpar cache de scans antigos a cada 5 minutos
useEffect(() => {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const entriesToDelete: string[] = [];
    
    recentScanByUidRef.current.forEach((timestamp, key) => {
      if (now - timestamp > 600_000) { // 10 minutos
        entriesToDelete.push(key);
      }
    });
    
    entriesToDelete.forEach(key => {
      recentScanByUidRef.current.delete(key);
    });
    
    if (entriesToDelete.length > 0) {
      console.log(`[NFC] Limpeza: removidos ${entiesToDelete.length} registros de cache`);
    }
  }, 300_000); // A cada 5 minutos
  
  return () => clearInterval(cleanupInterval);
}, []);
```

---

## Fix #3: Adicionar Idempotency Key na Checkin

**Arquivo:** `src/data/attendance-checkins.ts` (alterar `createCheckinWithFallback`)

```typescript
// Importar na parte de cima:
import * as Crypto from 'expo-crypto';

// Modificar função (pseudocódigo, ajuste ao seu código real):
export async function createCheckinWithFallback({
  organizationId,
  classId,
  studentId,
  tagUid,
}: {
  organizationId: string;
  classId: string | null;
  studentId: string;
  tagUid: string;
}): Promise<{ checkin: Checkin; status: CheckinDeliveryStatus }> {
  // ← NOVO: Gerar idempotency key baseada em dados únicos
  const idempotencyKey = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${organizationId}:${studentId}:${tagUid}:${new Date().toISOString().split('T')[0]}`
  );

  try {
    const result = await createCheckin(
      {
        organizationId,
        classId,
        studentId,
        tagUid,
      },
      {
        // ← NOVO: Passar idempotency key no header
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      }
    );
    return { checkin: result, status: 'synced' };
  } catch (error) {
    // ... resto do código de fallback offline
  }
}
```

---

## Fix #4: Ajustar DUPLICATE_WINDOW_MS

**Arquivo:** `app/nfc-attendance.tsx` (linha ~36)

```typescript
// ANTES:
const DUPLICATE_WINDOW_MS = 20_000; // 20 segundos é muito generoso

// DEPOIS:
const DUPLICATE_WINDOW_MS = 5_000; // 5 segundos é mais realista
```

---

## Fix #5: TypeScript Strictness

**Arquivo:** `tsconfig.json` (modificar `compilerOptions`)

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "useDefineForClassFields": true,
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

---

## Fix #6: ESLint Rules Mais Rigorosas

**Arquivo:** `eslint.config.js`

```javascript
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

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

---

## Fix #7: Validação de Environment Variables

**Arquivo:** Criar `src/bootstrap/validate-env.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url('SUPABASE_URL deve ser uma URL válida'),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'SUPABASE_ANON_KEY muito curta'),
  EXPO_PUBLIC_WHATSAPP_DEFAULT_TEXT: z.enum(['true', 'false', 'default', 'disabled']).default('true'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment variables:\n${errors.join('\n')}`);
  }
  
  console.log('[BOOTSTRAP] Environment variables validated');
  return result.data;
}
```

**Depois, chamar no entry point (ex: `app/_layout.tsx`):**

```typescript
import { validateEnv } from '@/src/bootstrap/validate-env';

export default function RootLayout() {
  useEffect(() => {
    validateEnv(); // Valida na startup
  }, []);
  
  // ... resto do layout
}
```

---

## Fix #8: Dockerfile para Web Build

**Arquivo:** Criar `Dockerfile` (na raiz do projeto)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Build web version
RUN npm run build

# Stage 2: Serve
FROM node:20-alpine

WORKDIR /app

# Usar simple-http-server ou similar
RUN npm install -g serve

# Copy built app
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
```

**Arquivo:** Criar `.dockerignore`

```
node_modules
.expo
.git
dist
*.log
.env
.env.local
```

---

## Fix #9: GitHub Actions CI

**Arquivo:** Criar `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run type checker
        run: npm run typecheck:core
      
      - name: Run tests
        run: npm run test:core
      
      - name: Build web
        run: npm run build
```

---

## Teste os Fixes

Ordem recomendada:

1. **Fix #1 + #2** → `npm start` no app, test NFC
2. **Fix #5 + #6** → `npm run typecheck:core && npm run lint`
3. **Fix #7** → Startup do app (validação)
4. **Fix #8 + #9** → Build docker e CI/CD

---

## Verificação Pós-Fix

```bash
# Lint
npm run lint

# Type check
npm run typecheck:core

# Tests
npm run test:core

# Build
npm run build

# Docker build (se aplicado Fix #8)
docker build -t goatleta:latest .
```

Done. Let me know if you need anything else!
