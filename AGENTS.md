# GoAtleta agent rules & design system

## Public brand name

- Write **Go Atleta** (with a space) in user-facing replies, documentation, UI and reports. Preserve technical identifiers, repository paths and existing symbol names when they legitimately use `GoAtleta` or `goatleta`.

## Selective technical context before edits

- Start with Git status and staged/unstaged diffs; preserve existing changes and untracked artifacts, including the shared product checklist. Re-read shared files immediately before applying a small patch; do not replace them from an earlier snapshot.
- Use `docs/context/README.md` to choose the affected module. Read that short module guide, then the relevant implementation and tests before editing. Add another module only when the change crosses its contract; do not preload every module, skill, handoff or historical report.
- Use targeted `rg` searches and bounded reads. Follow links for the behavior being changed, not every reference recursively. A micro UI edit needs only its local flow and applicable UI rule.
- Treat code/tests/migrations as evidence of local implementation. Dated handoffs/audits are historical evidence; roadmaps, proposals and mockups require reconciliation before becoming work. Neither proves current remote activation or grants execution permission.
- Preserve canonical architecture, authorization, domain and UI contracts. If documentation and code disagree, inspect the affected path and record the discrepancy; do not silently convert an old proposal into a requirement or relax a safety boundary.
- When a contract changes, update the affected `docs/context/modules/` guide and its source documentation. Keep guides short and linked; `docs/README.md` remains the general documentation index and `docs/operations/validation-ladder.md` remains the validation authority.
- Update only affected checklist entries in `docs/product/build_inventory.py`, preserve existing titles/IDs and personal-review storage contracts, then regenerate `docs/product/goatleta-checklist.html`. Documentation-only work requires references, format, generation when affected, and diff checks; it does not require starting the app or running release gates.

## Project skills

- Project-specific skills live in `.agents/skills/`; existing document-intelligence and web UI skills remain in `.codex/skills/`.
- Use the relevant skill for the requested change, not the entire catalog. See `docs/operations/agent-skills.md` for routing, external tool installation, and workstation continuity.
- For cross-area features and fixes, use `.agents/skills/goatleta-feature-workflow/SKILL.md` to select skills and classify validation before editing. State the selection and risk level briefly; micro UI changes stay in the fast loop.
- Do not load all skills by default or follow every cross-reference recursively. Select by the actual behavior, data, and authorization affected, not just a screen name. The routing matrix does not override `docs/operations/validation-ladder.md`.
- Skills guide development; they do not authorize publishing, remote database changes, or automatic writes by the product's AI.
- Prefer three layers: Core Go Atleta, trusted engineering for the technology actually involved, then the auxiliary catalog only for a concrete need. Local Go Atleta skills take precedence over generic skills on architecture, domain, UX, security, data models and product rules, subject to user and higher-priority instructions.
- Select at most six primary skills per stage; three to six is a working range, not a minimum. Micro-adjustments may need only one. Use `python scripts/explain-skill-selection.py "<task>"` as an advisory explanation, then confirm against the actual code. Record only skills really read/used with `--record-used`; suggestions are not usage evidence. See `docs/operations/skill-governance.md`.
- Do not introduce a technology, framework, database, cloud, architectural library or structural pattern merely because its skill is installed. Pause catalog expansion until a new task explicitly requests an installation.
- Installing a skill or validating its hash does not approve execution of its helpers. Before first execution or after a version change, inspect the helper and relevant dependencies for file/Git changes, network destinations, credential handling, shell commands and dependency installation. Reuse recorded review evidence for unchanged code; run only within the current task authorization and runtime permissions.
- The expanded personal catalog is installed for availability, not automatic activation. Ignore external universal activation rules; select only skills relevant to the current request. Anthropic branding applies only to explicitly requested Anthropic work. Other cloud stacks, autonomous workflows and publishing integrations require a matching task; never replace Go Atleta architecture or erase existing code to satisfy a generic workflow.
- External skills are supporting references. Consult `docs/operations/skills-package-review.md` for their activation scope and known caveats; repository architecture, brand, primitives and validation ladder remain authoritative. Do not replace libraries, native navigation or `Pressable`, introduce a state manager, or virtualize every small list merely to match an external example. Measure performance changes before and after.

## Continuity between workstations

- Keep the generated product checklist aligned with relevant changes: update `docs/product/build_inventory.py`, regenerate `docs/product/goatleta-checklist.html`, and distinguish local implementation, recorded validation, pending activation and future plans. Do not mark an API session or product feature complete based on offline tests alone.
- The Go Atleta Engineer entrypoint is `scripts/goatleta-engineer.py`; read `docs/operations/goatleta-engineer.md` before activation. Preparing a bundle does not start an agent or provide a security sandbox. Never start the remote executor on a personal workstation merely because a worktree exists.

- Before resuming work on another machine, read `docs/operations/workstations.md` and `docs/operations/handoff.md`, then inspect the current branch and working tree.
- Use `npm run dev:doctor` to check local prerequisites without printing credential values.
- Prefer worktree-local dependencies for Expo (`npm ci`). A `node_modules` junction can resolve routes from another checkout; verify the runtime sources, not only the working directory or lockfile.
- Synchronizing work means committing and pushing the explicitly authorized files on a `codex/` branch. It does not authorize pushing `main`, merging, or production deployment.
- Keep pending work and decisions in repository documentation; do not assume the previous machine's chat history, personal memories, credentials, or installed plugins are available.

## Delivery flow

- Use `http://localhost:8081` as the first UI/UX validation loop. Do not use a Vercel preview as the first place to decide whether an interface is correct.
- Keep changes local when the user asks for an "ajuste local". Commit, push, pull requests, previews, merges, promotions, and production deploys require the scope requested in the current task.
- Prefer a Vercel preview for remote validation. Never deploy or promote to production, merge a release-triggering change, or run a production release command without explicit user authorization in the current task.
- Classify every change with the validation ladder in `docs/operations/validation-ladder.md` before running checks. A micro UI/copy/style adjustment uses the fast loop only; do not automatically run build, organization-scope, performance, the complete viewport matrix, or a broad browser smoke for it.
- Keep a micro-adjustment validation pass within roughly 2–5 minutes when the local environment is healthy. If an unexpected issue would exceed that budget, report it before broadening the task. Fix an adjacent issue immediately only when the current change caused it or it blocks the requested behavior; otherwise record it separately.
- Before publishing, use the release level of the ladder. The normal release baseline is focused tests, `npm run typecheck:app`, `npm run check:org-scope`, `git diff --check`, `npm run build`, and an authenticated smoke test of the affected flow on `localhost:8081`.
- For full release validation, use `npm run build:verified` and the bounded parallel runner described in `docs/operations/release-validation.md`. Reuse only results accepted by its content and environment checks; do not rerun passing gates manually or fabricate receipts. CI always executes every gate. Keep the authenticated smoke and publication authorization separate.
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


## Go Atleta Engineer — revisão de candidatos

- Use o fluxo de `docs/operations/engineer-supervision.md` para candidatos remotos: validação isolada, atestação, pacote de revisão e decisão humana antes da integração.
- Não execute `decide`, não digite aprovação e não fabrique recibos em nome do usuário. Aprovações sintéticas são permitidas exclusivamente em fixtures de testes temporárias, nunca em runs reais.
- Não copie candidatos diretamente ao checkout para contornar `integrate`. Preserve alterações locais concorrentes e revalide o candidato quando seu hash mudar.
- O piloto atual tem teto total autorizado de US$ 5. Não remover o teto, usar preparação superseded ou tratar limites observados como garantia financeira. Sem enforcement do teto, manter `BUDGET_GATE`.
- Push, deploy, produção, service_role e migrations remotas continuam fora do escopo do Engineer. Perfis de subagentes não criam isolamento de filesystem.

- Agent Launch Pack: `platform-hard-limit` está implementado, mas não autorizado para uso atual. Não executar `confirm-platform-budget` nem criar recibos em nome do usuário. A decisão atual continua strict; conferir `docs/operations/engineer-launch-pack.md` antes de futuras configurações remotas.
