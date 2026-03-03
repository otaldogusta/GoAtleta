# ⚡ SECURITY FIXES - EXECUTION PLAN WITH CODE

**Status:** Ready to implement
**Estimated Time:** 6-8 hours (2 devs working in parallel)
**Testing Required:** Before next production deployment

---

## Quick Priority Ranking

🔴 **FIX TODAY (BLOCKING)** → 2 hours
- CRITICAL-1: JSON.parse crash loops
- CRITICAL-3: Edge function DoS vectors

🟠 **FIX THIS WEEK (BLOCKING)** → 4 hours
- CRITICAL-2: Number coercion issues
- CRITICAL-4: Sync race condition
- HIGH-8: Token theft (AsyncStorage)

🟡 **FIX BEFORE SCALE** → 2+ hours
- HIGH-6: Memory leak
- Others: Error handling, rate limiting

---

## FIX #1: JSON.parse Crash Protection [CRITICAL]

**Time:** 30 min
**Files:** 6 locations
**Severity:** 🔴 App crash on corrupted data

### Step 1: Create Safety Wrapper

Create file: `src/utils/safe-json.ts`

```typescript
/**
 * Safe JSON parsing with fallback
 * Returns null on parse error instead of throwing
 */
export function safeJsonParse<T = unknown>(
  text: string | null | undefined,
  fallback: T | null = null
): T | null {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    // Log but don't crash
    console.warn("[safeJsonParse] Failed to parse:", error);
    return fallback;
  }
}

/**
 * Variant for AsyncStorage that also handles null gracefully
 */
export async function safeAsyncJsonParse<T = unknown>(
  storageKey: string,
  storage: typeof AsyncStorage,
  fallback: T | null = null
): Promise<T | null> {
  try {
    const raw = await storage.getItem(storageKey);
    return safeJsonParse(raw, fallback);
  } catch (error) {
    console.warn("[safeAsyncJsonParse] Storage access failed:", error);
    return fallback;
  }
}
```

### Step 2: Fix Each Location

**File 1: [src/ui/use-persisted-state.ts](src/ui/use-persisted-state.ts)**

```typescript
// ❌ OLD
const raw = await AsyncStorage.getItem(key);
setState(JSON.parse(raw) as T);

// ✅ NEW
import { safeAsyncJsonParse } from "../utils/safe-json";

const parsed = await safeAsyncJsonParse<T>(key, AsyncStorage, initialValue);
if (parsed !== null) {
  setState(parsed);
}
```

**File 2: [src/notificationsInbox.ts](src/notificationsInbox.ts)**

```typescript
// ❌ OLD
const raw = await AsyncStorage.getItem(STORAGE_KEY);
const parsed = JSON.parse(raw) as AppNotification[];

// ✅ NEW
import { safeAsyncJsonParse } from "./utils/safe-json";

const parsed = await safeAsyncJsonParse<AppNotification[]>(
  STORAGE_KEY,
  AsyncStorage,
  []  // Default to empty array
);
```

**File 3: [src/nfc/metrics.ts](src/nfc/metrics.ts)**

```typescript
// ❌ OLD
const raw = await AsyncStorage.getItem(buildStorageKey(organizationId));
const parsed = JSON.parse(raw) as Partial<NfcMetrics>;

// ✅ NEW
const parsed = await safeAsyncJsonParse<Partial<NfcMetrics>>(
  buildStorageKey(organizationId),
  AsyncStorage,
  {}  // Default to empty object
);
```

**File 4: [src/dev/profile-preview.ts](src/dev/profile-preview.ts)**

```typescript
// ❌ OLD
const current = await AsyncStorage.getItem(PREVIEW_KEY);
const preview = JSON.parse(current ?? "null");

// ✅ NEW
const preview = await safeAsyncJsonParse(PREVIEW_KEY, AsyncStorage, null);
```

**File 5-6: [src/db/seed.ts](src/db/seed.ts) - Line 295, 303**

```typescript
// ❌ OLD
return JSON.parse(stored) as T;

// ✅ NEW
import { safeJsonParse } from "../utils/safe-json";

const parsed = safeJsonParse<T>(stored, null);
if (!parsed) {
  throw new Error(`Failed to parse stored data for key: ${key}`);
}
return parsed;
```

### Testing

```bash
# Simulate corrupted storage
adb shell "sqlite3 /data/com.atleta/databases/RKStorage.db UPDATE shared_prefs SET value='{broken' WHERE name='persist-state'"

# App should:
# 1. NOT crash
# 2. Log warning
# 3. Fall back to initial state
```

---

## FIX #2: Edge Function Input Validation [CRITICAL]

**Time:** 1 hour
**Files:** 5 functions
**Severity:** 🔴 DoS attacks on infrastructure

### Create Validation Utility

File: `supabase/functions/_shared/input-validation.ts`

```typescript
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function validateStringField(
  value: unknown,
  options: {
    maxLength?: number;
    minLength?: number;
    pattern?: RegExp;
    trim?: boolean;
  } = {}
): ValidationResult<string> {
  const { maxLength = 1000, minLength = 0, pattern, trim: shouldTrim } = options;

  let str = String(value ?? "").trim();
  if (shouldTrim === false) {
    str = String(value ?? "");
  }

  if (str.length < minLength) {
    return { ok: false, error: `Too short (min ${minLength})` };
  }

  if (str.length > maxLength) {
    return { ok: false, error: `Too long (max ${maxLength})` };
  }

  if (pattern && !pattern.test(str)) {
    return { ok: false, error: "Invalid format" };
  }

  return { ok: true, data: str };
}

export function validateArrayLength(
  value: unknown,
  options: {
    maxLength?: number;
    minLength?: number;
  } = {}
): ValidationResult<unknown[]> {
  const { maxLength = 1000, minLength = 0 } = options;
  const arr = Array.isArray(value) ? value : [];

  if (arr.length < minLength) {
    return { ok: false, error: `Too few items (min ${minLength})` };
  }

  if (arr.length > maxLength) {
    return { ok: false, error: `Too many items (max ${maxLength})` };
  }

  return { ok: true, data: arr };
}

export function validateNumber(
  value: unknown,
  options: { min?: number; max?: number } = {}
): ValidationResult<number> {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    return { ok: false, error: "Invalid number" };
  }

  if (options.min !== undefined && num < options.min) {
    return { ok: false, error: `Too small (min ${options.min})` };
  }

  if (options.max !== undefined && num > options.max) {
    return { ok: false, error: `Too large (max ${options.max})` };
  }

  return { ok: true, data: num };
}
```

### Fix students-import Function

**File:** `supabase/functions/students-import/index.ts` (Line 262-266)

```typescript
import { validateStringField, validateArrayLength } from "../_shared/input-validation.ts";
import { jsonResponse } from "../_shared/response.ts";

export async function handler(req: Request, ctx: any) {
  // ... JWT verification ...

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // ✅ VALIDATION
  const orgValidation = validateStringField(payload.organizationId, {
    minLength: 1,
    maxLength: 128,
  });
  if (!orgValidation.ok) {
    return jsonResponse({ error: `Invalid organization: ${orgValidation.error}` }, 400);
  }

  const rowsValidation = validateArrayLength(payload.rows, {
    maxLength: 500,  // Max 500 rows per request
    minLength: 1,
  });
  if (!rowsValidation.ok) {
    return jsonResponse({ error: `Invalid rows: ${rowsValidation.error}` }, 400);
  }

  const organizationId = orgValidation.data;
  const rowsInput = rowsValidation.data;

  // Validate each row
  const rows = [];
  for (const row of rowsInput) {
    if (typeof row !== "object" || !row) continue;

    const nameValidation = validateStringField(
      (row as any).name,
      { maxLength: 255 }
    );
    if (!nameValidation.ok) continue;

    rows.push({
      name: nameValidation.data,
      email: String((row as any).email ?? ""),
      // ... other fields
    });
  }

  if (rows.length === 0) {
    return jsonResponse({ error: "No valid rows to import" }, 400);
  }

  // ✅ Proceed with import
  // ... rest of logic
}
```

### Fix Other Functions

Apply same pattern to:
- `kb_ingest` → validate `query`, `maxResults`, `studies`
- `send-push` → validate `title`, `body`, `data`
- `claim-trainer-invite` → validate inputs
- `create-student-invite` → validate inputs

**Effort per function:** 15 min

---

## FIX #3: Number Coercion Safety [CRITICAL]

**Time:** 45 min
**Files:** 11 locations
**Severity:** 🔴 Logic bypass / metric corruption

### Create Validation Helper

File: `src/utils/safe-number.ts`

```typescript
/**
 * Safe number parsing with validation
 * Returns null if result is not finite (NaN, Infinity)
 */
export function safeNumber(
  value: unknown,
  defaultValue: number = 0
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    console.warn(`[safeNumber] Got non-finite: ${value}`);
    return defaultValue;
  }
  return num;
}

/**
 * Constrain number to min/max range
 */
export function constrainNumber(
  value: number,
  min: number = -Infinity,
  max: number = Infinity
): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Combined: parse + validate + constrain
 */
export function parseNumber(
  value: unknown,
  options: {
    defaultValue?: number;
    min?: number;
    max?: number;
  } = {}
): number {
  const { defaultValue = 0, min, max } = options;
  const num = safeNumber(value, defaultValue);
  return constrainNumber(num, min, max);
}
```

### Fix [src/nfc/metrics.ts](src/nfc/metrics.ts#L71)

```typescript
// ❌ OLD
[key]: Math.max(0, Number(current[key]) + delta),

// ✅ NEW
import { parseNumber } from "../utils/safe-number";

[key]: parseNumber(current[key], { defaultValue: 0, min: 0 }) + delta,
```

### Fix [src/regulation/clause-engine.ts](src/regulation/clause-engine.ts#L88)

```typescript
// ❌ OLD
const value = Number(clausesByKey.get(key));

// ✅ NEW
import { safeNumber } from "../utils/safe-number";

const value = safeNumber(clausesByKey.get(key), 0);

// Later, before using value
if (!Number.isFinite(value)) {
  logError("Invalid clause value");
  return false;
}
```

### Other Locations (11 total)

Grep for `Number(` and add `safeNumber()` wrapper:
```bash
grep -r "Number(" src/ | grep -v "Number.isFinite\|Number.isNaN"
```

For each match:
```typescript
// BEFORE: Number(someVar)
// AFTER:  safeNumber(someVar, defaultValue)
```

---

## FIX #4: Sync Race Condition [CRITICAL]

**Time:** 2 hours
**File:** [src/core/smart-sync.ts](src/core/smart-sync.ts)
**Severity:** 🔴 Data corruption

### Root Cause

```typescript
// ❌ VULNERABLE
private inFlightSync: Promise<...> | null = null;

syncNow() {
  if (this.inFlightSync) return;  // ❌ Not blocking, just skips
  this.inFlightSync = this.flushPendingWrites();
  // Meanwhile: syncTimer fires → calls flushPendingWrites() again
}
```

### Fix: Use Async Queue

Replace in [src/core/smart-sync.ts](src/core/smart-sync.ts#L100):

```typescript
class SmartSyncService {
  private syncQueue: (() => Promise<void>)[] = [];
  private syncRunning = false;

  private async processSyncQueue() {
    if (this.syncRunning || this.syncQueue.length === 0) return;

    this.syncRunning = true;
    try {
      while (this.syncQueue.length > 0) {
        const task = this.syncQueue.shift();
        if (task) {
          await task();
        }
      }
    } finally {
      this.syncRunning = false;
    }
  }

  async syncNow() {
    // Enqueue sync task
    this.syncQueue.push(async () => {
      this.status.syncing = true;
      try {
        const result = await this.flushPendingWrites();
        this.status.lastSyncAt = Date.now();
        this.status.lastFlushedCount = result.flushed;
      } catch (error) {
        this.status.lastError = String(error);
      } finally {
        this.status.syncing = false;
        this.notifyListeners();
      }
    });

    await this.processSyncQueue();
  }
}
```

### Testing

```typescript
// Test: Multiple rapid syncNow() calls
smartSync.syncNow();
smartSync.syncNow();
smartSync.syncNow();

// Should queue all 3, execute sequentially (not parallel)
// Check: only 1 "flushed" event occurs per unique pending_writes id
```

---

## FIX #5: Token Security [HIGH]

**Time:** 3 hours
**Files:** [src/auth/session.ts](src/auth/session.ts), [src/auth/auth.tsx](src/auth/auth.tsx)
**Severity:** 🟠 Token theft from device

### Step 1: Install Expo SecureStore

```bash
npx expo install expo-secure-store
```

### Step 2: Create Secure Session Manager

File: `src/auth/secure-session.ts`

```typescript
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user?: any;
};

const SECURE_KEY = "secure:auth-session";

/**
 * Store session securely using platform native storage
 * - iOS: Keychain
 * - Android: EncryptedSharedPreferences (API 21+)
 */
export async function saveSecureSession(session: AuthSession): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("[saveSecureSession] Failed:", error);
    // Fallback: Don't crash, but warn
    throw new Error("Failed to save secure session");
  }
}

export async function loadSecureSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SECURE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch (error) {
    console.warn("[loadSecureSession] Failed to load:", error);
    return null;
  }
}

export async function clearSecureSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch (error) {
    console.warn("[clearSecureSession] Failed:", error);
  }
}

/**
 * Get valid access token, refresh if needed
 */
export async function getValidAccessToken(): Promise<string | null> {
  const session = await loadSecureSession();
  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;

  // Token still valid (5 min buffer)
  if (expiresAt > now + 300) {
    return session.access_token;
  }

  // Try refresh
  if (session.refresh_token) {
    try {
      const refreshed = await refreshAccessToken(session.refresh_token);
      if (refreshed) {
        await saveSecureSession(refreshed);
        return refreshed.access_token;
      }
    } catch (error) {
      console.warn("[getValidAccessToken] Refresh failed:", error);
    }
  }

  return null;
}
```

### Step 3: Update Auth Provider

Replace imports in [src/auth/auth.tsx](src/auth/auth.tsx):

```typescript
// ❌ OLD
import { loadSession, saveSession } from "./session";

// ✅ NEW
import {
  loadSecureSession,
  saveSecureSession,
  clearSecureSession,
} from "./secure-session";

export function AuthProvider({ children, initialSession }: Props) {
  const [session, setSession] = useState<AuthSession | null>(initialSession ?? null);

  useEffect(() => {
    if (initialSession !== undefined) {
      setLoading(false);
      return;
    }

    (async () => {
      const stored = await loadSecureSession();  // ✅ Secure load
      if (!alive) return;
      setSession(stored);
      setLoading(false);
    })();

    return () => { alive = false; };
  }, []);

  const signOut = useCallback(async () => {
    setSession(null);
    await clearSecureSession();  // ✅ Secure clear
    clearAiCache();
    clearSentryUser();
    router.replace("/welcome");
  }, [router]);

  // When saving session
  const consumeAuthUrl = useCallback(async (url: string) => {
    const session = parseAuthSession(url);
    if (session) {
      await saveSecureSession(session);  // ✅ Secure save
      setSession(session);
    }
  }, []);

  // ... rest
}
```

### Step 4: Test on All Platforms

```bash
# iOS
npx expo start --ios

# Android
npx expo start --android

# Verify tokens stored securely:
# iOS: Check Keychain via Xcode
# Android: Check EncryptedSharedPreferences via adb
adb shell "sqlite3 ~/.../shared_prefs.db" # Should fail or show encrypted
```

---

## FIX #6: NFC Memory Leak [HIGH]

**Time:** 30 min
**File:** [src/nfc/nfc-hooks.ts](src/nfc/nfc-hooks.ts#L100-115)
**Severity:** 🟠 Crash after 8-12h

Add yield points in loop:

```typescript
// In nfc-hooks.ts, in the loop() function:

const loop = useCallback(async () => {
  let iterationCount = 0;

  if (loopStartedRef.current) return;
  loopStartedRef.current = true;

  try {
    while (runningRef.current) {
      if (loopStateRef.current.status !== "scanning") {
        await wait(80);
        continue;
      }

      // ... scan logic

      // ✅ YIELD periodically to allow GC
      iterationCount++;
      if (iterationCount % 100 === 0) {
        await wait(0);  // Yield to event loop
      }
    }
  } finally {
    loopStartedRef.current = false;
  }
}, [dispatch, emitError, loopDelayMs]);
```

This allows the JavaScript engine to run garbage collection between iterations.

---

## FIX #7: useEffect Cleanup [HIGH]

**Time:** 20 min
**File:** [src/nfc/nfc-hooks.ts](src/nfc/nfc-hooks.ts#L220)

```typescript
// ❌ OLD
useEffect(() => {
  return () => {
    runningRef.current = false;
    loopStartedRef.current = false;
  };
}, []);  // No dependencies!

// ✅ NEW
useEffect(() => {
  return () => {
    runningRef.current = false;
    loopStartedRef.current = false;
    void stopScan();  // Cleanup NFC hardware
  };
}, [options.onTag, options.onError, options.onDuplicateTag]);
```

---

## Testing Checklist

After implementing all fixes:

```bash
# 1. TypeScript compilation
npm run lint

# 2. Unit tests
npm test

# 3. NFC stress test (8h)
npm run validate:nfc-stress

# 4. Simulate corrupted data
adb shell "sqlite3 /data/.../RKStorage.db" UPDATE shared_prefs...

# 5. Memory monitoring
adb shell dumpsys meminfo com.atleta | grep "TOTAL"  # Should stay <200MB

# 6. Crash analytics
# Check Sentry: error count should be 0

# 7. Sync validation
# Check database: no duplicate pending_writes records
```

---

## Commit Strategy

Recommend 3 commits:

**Commit 1: Input validation + JSON safety**
```
fix: add critical input validation and JSON parsing safety

- Add safe-json.ts utility wrapper
- Add input-validation.ts for edge functions
- Fix JSON.parse in 6 storage locations
- Validate array/string lengths in 5 functions
```

**Commit 2: Number safety + NFC fixes**
```
fix: harden number coercion and NFC memory management

- Add safe-number.ts with validation
- Fix 11 number conversion sites
- Add yield points in NFC loop (every 100 iterations)
- Fix useEffect cleanup in NFC hooks
```

**Commit 3: Sync race + auth security**
```
fix: fix sync race condition and migrate tokens to secure storage

- Refactor SmartSync to use async queue (no race)
- Migrate auth tokens to expo-secure-store
- Remove plaintext tokens from AsyncStorage
- Add server-side token revocation hook prep
```

Each commit should:
- Pass TypeScript (`npm run lint`)
- Pass tests (`npm test`)
- Can be deployed independently if needed

---

## Post-Fix Validation

After deploying fixes:

1. **Monitor Sentry** for 24h
   - Crash rate should drop to 0%
   - JSON parse errors should disappear
   - Sync errors should reduce

2. **Performance metrics**
   - Memory usage stable <200MB
   - No memory growth over 8h session
   - NFC scan response time <100ms

3. **Sync validation**
   - Check `pending_writes` table: no duplicates
   - Check `pending_writes_dead` for unusual errors
   - Check sync completion rate >99%

4. **Security validation**
   - Try token theft via adb: should fail (encrypted)
   - Try large payload to edge functions: should return 400
   - Try corrupted AsyncStorage: should recover gracefully

---

**Estimated Team Effort:** 6-8 hours (2 devs)
**Blocking Issues:** All 5 CRITICAL + 3 HIGH must fix before scaling
**Safe to Deploy After:** All fixes implemented + 24h validation passing

