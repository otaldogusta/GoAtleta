# GoAtleta: AI Coding Agent Instructions

This is a React Native/Expo cross-platform fitness & volleyball coaching app using TypeScript, Supabase auth, SQLite local DB, and Sentry observability.

## Architecture Overview

**Layered structure:**
- **App layer** (`app/`): File-based routing with expo-router; auth gates; tab navigation
- **Screens** (`src/screens/`): Feature screens (coordination, classes, periodization, etc.)
- **UI layer** (`src/ui/`): Reusable components + context providers (dialogs, toasts, themes)
- **Auth layer** (`src/auth/`): Context-based Supabase auth + persistent sessions via AsyncStorage
- **Bootstrap** (`src/bootstrap/`): App initialization gate (DB setup, config loading)
- **Core domain** (`src/core/`): Volleyball/fitness domain logic (age bands, periodization, drills, session generation)
- **Data layer** (`src/db/`): SQLite local persistence + Supabase API client
- **API/Supabase** (`src/api/`): HTTP client for Supabase functions, assistant API, webhooks
- **Observability** (`src/observability/`): Sentry breadcrumbs & perf monitoring
- **Providers** (`src/providers/`): Global context (Organization, etc.)
- **Utils** (`src/utils/`): Helpers (date, CPF, WhatsApp formatting, text normalization)
- **NFC/Push** (`src/nfc/`, `src/push/`): Hardware integration (NFC attendance, push notifications)

**Data flow:** `AuthProvider` + `BootstrapProvider` wrap app → `BootstrapGate` blocks rendering until DB ready → routing handles auth state → screens use hooks to query local DB or Supabase.

## Critical Patterns

### Provider Chain & Context Hooks
Root layout (`app/_layout.tsx`) stacks providers in order: `RootErrorFallback` → `Sentry.init()` → `AuthProvider` (JWT/session from AsyncStorage) → `BootstrapProvider` (DB init, seed data) → `AppThemeProvider` (light/dark mode) → `ConfirmDialogProvider` + `ConfirmUndoProvider` (modals) → `SaveToastProvider` + `GuidanceProvider` (notifications) → `RoleProvider` (trainer/student/admin from org) → `OrganizationProvider` (org context + sync) → `CopilotProvider` (AI assistant integration) → `BiometricLockProvider` (local auth) → `PedagogicalConfigProvider` → `WhatsAppSettingsProvider` → `BootstrapGate` (blocks rendering until ready). Access with hooks like `useAuth()`, `useBootstrap()`, `useAppTheme()`, `useConfirmDialog()`, `useOptionalOrganization()`, `useRole()`. Never access context directly via `useContext()`—use dedicated hooks.

### Auth & Session Persistence
- Auth context: `signIn()`, `signUp()`, `resetPassword()`, `signOut()`
- Sessions persist to AsyncStorage (key: `auth-session`)
- Supabase token refresh: automatic on `AuthProvider` mount if cached session exists
- Public routes: `/welcome`, `/login`, `/signup`, `/reset-password`
- After login, redirect to `/` unless routing guards intervene

### Database
- **Local SQLite** (`src/db/sqlite.ts`): Use `db.execSync()` for schema creation; querying via `getAllAsync()`, `getFirstAsync()`
- **Models in core** (`src/core/models.ts`): TypeScript types for domain objects (ClassGroup, Student, SessionLog, etc.)
- **Seed data** (`src/db/seed.ts`): Called during bootstrap to populate defaults (drills, units, age bands)
- Always handle migrations explicitly; schema changes require new migrations

### Dialog & Confirmation UI
- `useConfirmDialog()`: Shows modal dialog with title, message, actions; returns promise
- `useConfirmUndo()`: Toast-based undo pattern for destructive actions
- Example: `const confirmed = await confirm({ title: "Delete?", ... })`

### Theme & Style
- `useAppTheme()`: Access `colors`, `mode` (light/dark), `spacing`
- `figma-colors.ts`: Auto-synced from Figma (run `npm run figma:colors` after Figma design updates)
- Platform-aware styling: Check `Platform.OS` for web-specific logic

### Theming: App-level theme provider in `_layout.tsx` uses `AppThemeProvider` which wraps all routes. Light/dark mode determined by system preference.

### Dropdown Pattern
Anchored dropdown (used in class and periodization screens):
- Open list below field, stays anchored as screen scrolls
- Only one dropdown open at a time
- Internal scroll, not page scroll
- See `src/ui/AnchoredDropdown.tsx` for implementation

## Key Files & Conventions

| Component | File | Usage |
|-----------|------|-------|
| Root Layout & Provider Chain | `app/_layout.tsx` | All providers stacked in order; error boundary; Sentry init |
| Auth Context & Hooks | `src/auth/auth.tsx` | `useAuth()` hook; JWT handling; Supabase API calls (no SDK) |
| Session Persistence | `src/auth/session.ts` | AsyncStorage cache; token refresh logic |
| Bootstrap Gate | `src/bootstrap/BootstrapProvider.tsx` | Blocks rendering until DB ready; `useBootstrap()` hook |
| Domain Models | `src/core/models.ts` | TypeScript types: ClassGroup, SessionLog, StudentProfile, etc. |
| SQLite Schema | `src/db/sqlite.ts` | `initDb()` → `execSync()` for schema; querying via `getAllAsync()` |
| Session Generation | `src/core/sessionGenerator.ts` | Auto-generate training plans by age band |
| Periodization | `src/core/periodization.ts` | Training cycles, blocks, weekly planning |
| Pedagogical Dimensions | `src/core/pedagogical-dimensions.ts` | Training methodology logic (technical, physical, etc.) |
| Confirm Dialog | `src/ui/confirm-dialog.tsx` | Modal pattern; `useConfirmDialog()` returns Promise<boolean> |
| Theme/Colors | `src/ui/app-theme.tsx` | `useAppTheme()` → { colors, mode, spacing } |
| Anchored Dropdown | `src/ui/AnchoredDropdown.tsx` | Fixed list, internal scroll, stays anchored on page scroll |
| Sentry Setup | `src/observability/sentry.ts` | User tagging, base tags (platform, version, channel) |
| Perf Monitoring | `src/observability/perf.ts` | `markRender()`, `measureAsync()` for breadcrumbs |
| Organization Provider | `src/providers/OrganizationProvider.tsx` | Global org context; `useOptionalOrganization()` |
| Role Detection | `src/auth/role.tsx` | `useRole()` → "trainer" \| "student" \| "admin" |
| Copilot Provider | `src/copilot/CopilotProvider.tsx` | AI assistant integration; signals, context, actions |
| Home Screen | `app/index.tsx` | Auth-gated redirect; waits for role + org loading |
| Example Screen | `src/screens/coordination/OrgMembersPanel.tsx` | Panels for coordination dashboard (audit, radar, consistency) |
| AI Integration | `src/api/ai.ts` | Edge function calls; assistant memory; executive summary |

## Developer Workflows

### Starting Development
```bash
npm install                # Install deps + apply patches
npm start                  # Start Expo dev server
npx expo start --android   # Run on Android emulator
npx expo start --ios       # Run on iOS simulator
npx expo start --web       # Run on web (dev)
```

### Common Tasks
- **Sync Figma colors** → Run `npm run figma:colors` after design updates
- **Add new route** → Create `.tsx` file in `app/` directory; expo-router auto-discovers
- **Update yoga-layout patch** → Run `npx patch-package yoga-layout`, commit patch
- **Lint & type check** → `npm run lint`
- **Import training data** → `node scripts/import-training-plans.js` with CSV

### Build & Release Commands
- `npm run build` — Export web build (outputs to `dist/`)
- `npm test` — Run Jest tests (perf-hygiene pass)
- `npm run typecheck:core` + `npm run typecheck:app` — Separate type checking
- `npm run release:check` — Pre-release validation (lint + org scope check)
- `npm run release:check:core` — Full core validation (encoding, JWT, tests, org scope)
- `npm run update:preview` → `npm run update:promote` — EAS update workflow (staging → production)
- `npm run update:production` — Direct production publish if promote unavailable
- `eas build --platform android/ios --profile production` — Native builds (via EAS)

### Web-Specific Gotchas
- `yoga-layout@3.2.1` patched to remove `import.meta.url` (ESM issue on Metro)
- Patch auto-applied on `npm install` via postinstall hook
- If web build fails, regenerate patch: `npx patch-package yoga-layout`
- Hash-based routing for password reset: `#type=recovery&access_token=...`

### Common Pitfalls & Environment Issues

**yoga-layout ESM Bug (CRITICAL for Web):**
- **Issue:** `yoga-layout@3.2.1` has `import.meta.url` → "Cannot use import.meta outside a module" on web
- **Fix:** Patch via `patch-package` (auto-applied on `npm install`)
- **Patch file:** `patches/yoga-layout+3.2.1.patch`
- **If patch fails:** `rm -rf node_modules && npm install` then `npx patch-package yoga-layout`
- **Validation checklist:** Clean install, `npm run web` works, web build in production

**NFC Architecture (Production-Critical):**
- **Memory Leak:** `recentScanByUidRef` unbounded → 450MB+ after 8h
  - **Fix:** GC cleanup every 60s with 10min TTL per entry (LIVE)
- **Race Condition:** Remount spawns parallel loop instances → duplicate scans
  - **Fix:** `loopStartedRef` guard prevents re-entry (LIVE)
- **PII Exposure:** Sentry `sendDefaultPii: true` violated GDPR
  - **Fix:** `beforeSend` masking hook in Sentry init (LIVE)
- See [NFC_ARCHITECTURE_AND_FIXES.md](NFC_ARCHITECTURE_AND_FIXES.md) for 15 issues + 8 fixes

**Session & Auth:**
- Sessions persist to AsyncStorage (key: `auth-session`)
- Token refresh automatic on `AuthProvider` mount
- Supabase JWT must be present on 8+ edge functions (guard against public abuse)
- OAuth/deep-link parsing: Hash-based for password reset (`#type=recovery&access_token=...`)

**Database Migrations:**
- Schema changes require new explicit migrations
- Applied manually in Supabase SQL Editor
- Schema reload: `select pg_notify('pgrst', 'reload schema');`
- Scouting module requires `supabase/migrations/2026010601_create_scouting_logs.sql`

**Environment Variables:**
- Loaded from `app.config.js` and environment (prefix: `EXPO_PUBLIC_*`)
- Required: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_SENTRY_DSN`
- Optional: `EXPO_PUBLIC_ENABLE_SOCIAL_LOGIN`, `EXPO_PUBLIC_ENABLE_MANUAL_LINKING`
- See [src/api/config.ts](src/api/config.ts) for loading logic

**Performance & Memory:**
- All new screens in `app/*` + `src/screens/*` must include:
  - `markRender("screen.<feature>.render.root")` in component body
  - `measureAsync("screen.<feature>.load.<target>", ...)` for async loads
- Inline styles in list rows violate perf guardrails (use `useMemo`)
- `FlatList` required for large lists with proper windowing (`initialNumToRender`, `windowSize`)
- Memory baseline: <200MB sustained (red line >300MB)

**Web-Specific Gotchas (Additional):**
- Back button not native on web → implement in screen logic
- Deep-linking uses hash fragments (not traditional URL params on SPA)
- Browser history may corrupt if state shape is undefined/null (guard in `safeReplaceHistoryUrl`)
- Responsive layout needed for desktop (check `WebSidebar` pattern)

### Testing
- Jest configured in `jest.config.js`
- Tests go in `src/core/__tests__/` (domain logic tests)
- Run tests during development as needed

## Quick Reference: Developer Workflow

**Starting a feature:**
1. Define types in `src/core/models.ts`
2. Add DB schema to `src/db/sqlite.ts` if needed (with migration)
3. Write domain logic in `src/core/*.ts`, tests in `src/core/__tests__/*.test.ts`
4. Create UI screens in `app/` or `src/screens/`
5. Use hooks from provider chain (`useAuth`, `useBootstrap`, `useAppTheme`, etc.)
6. Add Sentry breadcrumbs for observability
7. Include perf markers in new screens (`markRender`, `measureAsync`)

**Before merge/release:**
- `npm run lint` — Check code style
- `npm run typecheck:core && npm run typecheck:app` — Validate types
- `npm run test:core` — Run domain tests
- `npm run check:perf-hygiene` — Verify render/load markers
- `npm run release:check` — Final pre-release gate

**Deployment:**
- `npm run update:preview` → validate in preview channel
- `npm run update:promote` → promote to production (or `npm run update:production`)
- Check Sentry for real-time errors post-deploy

## Integration Points & External Dependencies

**Supabase** (Auth & API):
- Endpoint & key in `src/api/config.ts` (loads from env vars)
- Custom auth fetch in `src/auth/auth.tsx` (POST to Supabase endpoints)
- No official SDK; manual HTTP calls for auth operations

**Sentry** (Error tracking):
- Initialized in root layout with DSN
- Call `Sentry.captureException(err)` for errors outside try-catch
- Set user context via `setSentryUser()`, `clearSentryUser()` in `src/observability/sentry.ts`
- Breadcrumb logging for navigation via `logNavigation(pathname)` in `src/observability/breadcrumbs.ts`

**Expo modules** (Platform APIs):
- Notifications, calendar, clipboard, file system, document picker, PDF export, etc.
- Platform-specific configs in `app.config.js` and `eas.json`

## Code Style & Patterns

- **TypeScript strict mode** enabled; avoid `any`
- **Functional components** only; hooks for state/effects
- **Named exports** for components and utilities
- **No prop drilling**: Use context for global state (auth, theme, app config)
- **Error handling**: Wrap async operations in try-catch; log via Sentry if critical
- **Platform checks**: `Platform.OS === "web"` for conditional behavior (e.g., back button)
- **Filenames**: kebab-case for files (e.g., `confirm-dialog.tsx`, `use-persisted-state.ts`)

## When Adding Features

1. **Define TypeScript types** in `src/core/models.ts` first
2. **Add DB schema** to `src/db/sqlite.ts` if needed
3. **Create domain logic** in `src/core/` (separate from UI)
4. **Build UI screens** in `app/` using `src/ui/` component library
5. **Handle side effects** via providers in root layout if global (auth, bootstrap)
6. **Use context** for page-level state (e.g., selected class ID in `ClassContextHeader`)
7. **Test domain logic** in `src/core/__tests__/`
8. **Monitor with Sentry** for production errors

## Git & Patch Management

- **patch-package** used for `yoga-layout` ESM fix
- When updating patched dependency: Run `npx patch-package yoga-layout`, commit `patches/` folder
- Always test after patch updates: `npm install && npm run web`
- Checklist in README.md for patch validation
