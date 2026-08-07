# GoAtleta agent rules & design system

## Delivery flow

- Use `http://localhost:8081` as the first UI/UX validation loop. Do not use a Vercel preview as the first place to decide whether an interface is correct.
- Keep changes local when the user asks for an "ajuste local". Commit, push, pull requests, previews, merges, promotions, and production deploys require the scope requested in the current task.
- Prefer a Vercel preview for remote validation. Never deploy or promote to production, merge a release-triggering change, or run a production release command without explicit user authorization in the current task.
- Before publishing, run checks proportional to the change. The normal baseline is focused tests, `npm run typecheck:app`, `npm run check:org-scope`, `git diff --check`, `npm run build`, and an authenticated smoke test of the affected flow on `localhost:8081`.
- Treat a successful build or preview as a validation gate, not as proof that production is complete. Report the deployment target, URL, status, commit, and any pending production gate.

## Production and data safety

- Never add, change, remove, print, or commit production secrets or environment-variable values. Any production environment change requires explicit authorization and an impact check.
- Preserve Supabase as the GoAtleta data and authorization source of truth. Vercel capabilities or plugin suggestions do not authorize replacing the existing architecture.
- Preserve authentication, organization/workspace isolation, and RLS boundaries. Run `npm run check:org-scope` whenever a change can affect scoped data or navigation.
- Do not expose private Google Drive content or metadata. Global academic knowledge may use only explicitly curated and sanitized projections.
- Preserve unrelated working-tree changes and local artifacts when staging, committing, or deploying.

---

## UI/UX & Design System Rules (Anti-Vibecoding Standard)

To preserve visual consistency, prevent regressions, and avoid arbitrary "vibecoding" additions, all user interfaces in GoAtleta MUST strictly adhere to the following rules:

### 1. Centered 440px Compact Block Layout
- **Standard Auth Container**: All authentication, onboarding, welcome, and recovery screens (`welcome`, `login`, `signup`, `reset-password`) MUST be centered vertically and horizontally inside a compact 440px maximum width block (`maxWidth: 440`, `width: "100%"`, `alignSelf: "center"`, `justifyContent: "center"`).

### 2. Minimalist Copy & Information Hierarchy
- **No AI Fluff / Bloat Text**: Keep subtitles, headers, and descriptions short, direct, and action-oriented. Avoid generic explanatory texts like *"Informe seu e-mail para solicitar um link de redefinição de senha..."*.
- **Single Source of Truth for Messages**: Do not duplicate error or warning explanations across headers and alert boxes. If an alert balloon or header subtitle states the error, do not repeat the exact same sentence inside another container.
- **Dynamic Button Text**: Incorporate live countdown timers directly into action buttons (e.g. `Reenviar em 2:53`) instead of cluttering the UI with separate timer blocks.

### 2. Form Inputs & Autofill Standard
- **Input Container Bounds**: Form input containers must have `minHeight: 50` (or `height: 50`), `borderRadius: 12`, `paddingHorizontal: 14`, and `backgroundColor` set to the theme input color (`#121c30` in dark mode, `colors.inputBg` in light mode).
- **Chrome Autofill & Selection Fix**: Always set `borderRadius: 0` (or `border-radius: 0px !important`) on the React Native `<TextInput>` / HTML `<input>` element inside the padded parent `<View>`. This prevents browser autofill highlights and selection arcs from clipping text 14px inside the container.
- **Theme-Aware Autofill CSS**: Web autofill `-webkit-box-shadow` MUST dynamically match the current theme (`#121c30` in dark mode, `colors.inputBg` in light mode) to eliminate dark rectangular bars in light mode inputs.

### 3. Floating Error Tooltip Balloons
- **Absolute Overlay Layer**: Error tooltip balloons MUST use `position: "absolute"` (`top: -38`, `zIndex: 20`, `pointerEvents: "none"` on web). They MUST float on top of the targeted input without adding height or pushing down the modal card layout.
- **Warning Icon & Triangle Tail**: Balloon badges MUST feature the red background (`colors.dangerSolidBg`), white text, an inline warning icon (`GoAtletaIcon name="warningCircle"`), and a downward-pointing triangle pointer (`borderTopColor: colors.dangerSolidBg`).
- **Auto-Dismiss on Typing**: Typing any character in a field MUST immediately clear active error balloon messages.
- **Overflow Visibility**: Modal card containers using floating balloons MUST set `overflow: "visible"` so balloons are never clipped by container boundaries.

### 4. Buttons & Interactive States
- **Dynamic Disabled Opacity**: Action buttons (e.g. `Entrar`, `Criar conta`, `Atualizar senha`) MUST remain disabled (`disabled={true}`) with dimmed opacity (0.55) until all required fields are filled and valid.
- **Micro-Animations & Shake**: Container cards MUST implement entrance spring animations (`enterAnim`) and horizontal shake animations (`shakeAnim`) when validation errors occur.
- **Text-Only Link Hovers**: Secondary links (e.g. `Criar conta`, `Esqueceu a senha?`) MUST illuminate with text color changes and underlines on hover without showing background fallback hover boxes (`suppressWebHoverFeedback`).
- **Circular Back Buttons**: Navigation back buttons in auth/modal views MUST be 38x38px circular buttons (`borderRadius: 19`) with hover illumination matching `ScreenHeader`.

### 5. Scrollbar & Layout Cleanliness
- **No Gutter Artifacts**: Use `scrollbar-gutter: auto` on `html, body` to prevent persistent vertical white lines or track gutter artifacts on the right edge of non-scrolling pages.
- **Subtle Scrollbars**: Scrollbar tracks MUST remain transparent (`background: transparent !important`) with thin 6px thumbs (`rgba(15, 23, 42, 0.16)` in light mode, `rgba(255, 255, 255, 0.16)` in dark mode).

### 6. Auth Routing & Link Safety
- **Direct Password Reset Interception**: Any web navigation with `type=recovery` or `error_code=otp_expired` MUST be intercepted immediately on boot and routed directly to `/reset-password` without landing on home screens or triggering login redirect loops.
- **Expired Recovery State**: Expired or invalid recovery links MUST display a clean expired state (title with red warning icon, concise subtitle, and a single `"Solicitar novo link"` button) without broken temporary session attempts.
