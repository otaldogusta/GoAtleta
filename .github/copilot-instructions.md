# GoAtleta: AI Coding Agent Instructions

This is a React Native/Expo cross-platform fitness & volleyball coaching app using TypeScript, Supabase auth, SQLite local DB, and Sentry observability.

## Architecture Overview

**Layered structure:**
- **App layer** (`app/`): File-based routing with expo-router; auth gates; tab navigation
- **UI layer** (`src/ui/`): Reusable components + context providers (dialogs, toasts, themes)
- **Auth layer** (`src/auth/`): Context-based Supabase auth + persistent sessions via AsyncStorage
- **Bootstrap** (`src/bootstrap/`): App initialization gate (DB setup, config loading)
- **Core domain** (`src/core/`): Volleyball/fitness domain logic (age bands, periodization, drills, session generation)
- **Data layer** (`src/db/`): SQLite local persistence + Supabase API client
- **Observability** (`src/observability/`): Sentry breadcrumbs & perf monitoring

**Data flow:** `AuthProvider` + `BootstrapProvider` wrap app → `BootstrapGate` blocks rendering until DB ready → routing handles auth state → screens use hooks to query local DB or Supabase.

## Critical Patterns

### Provider Chain & Context Hooks
Root layout (`app/_layout.tsx`) stacks providers in order: `AuthProvider` → `BootstrapProvider` → theme/dialog/toast providers. Access with hooks like `useAuth()`, `useBootstrap()`, `useAppTheme()`. Never access context directly via `useContext()`—use dedicated hooks.

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
| Auth flow | `src/auth/auth.tsx` | Context provider + hooks |
| Session storage | `src/auth/session.ts` | Supabase JWT persistence |
| DB init & queries | `src/db/sqlite.ts` | Local DB schema + helpers |
| Domain types | `src/core/models.ts` | TypeScript types for domain |
| Age bands, drills | `src/core/{age-band,volleyballDrills}.ts` | Volleyball-specific logic |
| Session generation | `src/core/sessionGenerator.ts` | Auto-generate training plans |
| Periodization | `src/core/periodization.ts` | Training cycles & templates |
| Routing | `app/_layout.tsx` | Auth guards + provider chain |
| Tab navigation | `app/(tabs)/_layout.tsx` | Bottom tab bar structure |
| UI component lib | `src/ui/{Button,Card,ModalSheet}.tsx` | Reusable UI building blocks |
| Sentry setup | `src/observability/sentry.ts` | Error tracking & user tagging |

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

### Web-Specific Gotchas
- `yoga-layout@3.2.1` patched to remove `import.meta.url` (ESM issue on Metro)
- Patch auto-applied on `npm install` via postinstall hook
- If web build fails, regenerate patch: `npx patch-package yoga-layout`
- Hash-based routing for password reset: `#type=recovery&access_token=...`

### Testing
- Jest configured in `jest.config.js`
- Tests go in `src/core/__tests__/` (domain logic tests)
- Run tests during development as needed

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
