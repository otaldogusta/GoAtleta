const fs = require("fs");
const path = require("path");

const readProjectFile = (...segments) =>
  fs.readFileSync(path.join(__dirname, "..", ...segments), "utf8");

const reportsApi = readProjectFile("src", "api", "reports.ts");
const aiApi = readProjectFile("src", "api", "ai.ts");
const aiContext = readProjectFile("supabase", "functions", "_shared", "ai-context.ts");
const contextualInsight = readProjectFile(
  "src",
  "copilot",
  "hooks",
  "useContextualInsight.ts"
);
const aiMemory = readProjectFile("supabase", "functions", "_shared", "ai-memory.ts");
const planningCycles = readProjectFile("src", "db", "cycles.ts");
const workspaceAiMigration = readProjectFile(
  "supabase",
  "migrations",
  "20260710145948_add_workspace_ai_profiles_and_global_memory.sql"
);
const hierarchicalProfilesMigration = readProjectFile(
  "supabase",
  "migrations",
  "20260710160903_add_hierarchical_institutional_profiles.sql"
);
const legacyReadonlyMigration = readProjectFile(
  "supabase",
  "migrations",
  "20260710175839_make_organization_ai_profiles_read_only.sql"
);

const collectRuntimeFiles = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectRuntimeFiles(entryPath);
    return /\.(?:js|jsx|ts|tsx)$/.test(entry.name) ? [entryPath] : [];
  });

const projectRoot = path.join(__dirname, "..");
const legacyRuntimeReferences = ["app", "src", path.join("supabase", "functions")]
  .flatMap((directory) => collectRuntimeFiles(path.join(projectRoot, directory)))
  .filter((filePath) => fs.readFileSync(filePath, "utf8").includes("organization_ai_profiles"))
  .map((filePath) => path.relative(projectRoot, filePath).replaceAll("\\", "/"));

const checks = [
  {
    name: "pending attendance scope",
    endpoint: "v_admin_pending_attendance",
    required: "organization_id=eq.",
  },
  {
    name: "pending session logs scope",
    endpoint: "v_admin_pending_session_logs",
    required: "organization_id=eq.",
  },
  {
    name: "recent activity scope",
    endpoint: "v_admin_recent_activity",
    required: "organization_id=eq.",
  },
  {
    name: "runtime org guard",
    endpoint: "assertOrganizationId",
    required: "Missing organizationId",
  },
];

const missing = checks.filter(
  (check) => !reportsApi.includes(check.endpoint) || !reportsApi.includes(check.required)
);

const aiChecks = [
  {
    name: "assistant request workspace scope",
    content: aiApi,
    required: ["organizationId,", "Missing active workspace context"],
  },
  {
    name: "backend explicit workspace guard",
    content: aiContext,
    required: [
      "requireActiveWorkspaceId",
      ".from(\"institutional_profiles\")",
      '.eq("organization_id", organizationId)',
      '.eq("id", classId)',
      "Legacy institutional profile fallback used",
    ],
    forbidden: ["memberOrgs[0]", ".insert(", ".update(", ".delete("],
  },
  {
    name: "proactive insight workspace scope",
    content: contextualInsight,
    required: ["organizationId: workspaceId", "buildWorkspaceScopeKey"],
  },
  {
    name: "AI global and workspace memory separation",
    content: aiMemory,
    required: ["ai_user_global_facts", 'memory_scope: "user_global"', 'memory_scope: "workspace"'],
  },
  {
    name: "planning cycle workspace scope",
    content: planningCycles,
    required: ["organizationId = ?", "cycle.organizationId"],
  },
  {
    name: "workspace AI schema RLS",
    content: workspaceAiMigration,
    required: [
      "organization_ai_profiles",
      "ai_user_global_facts",
      "alter table public.organization_ai_profiles enable row level security",
      "alter table public.ai_user_global_facts enable row level security",
      "planning_cycles_class_workspace_fk",
      "private.workspace_scope_quarantine",
    ],
  },
  {
    name: "hierarchical institutional profile schema RLS",
    content: hierarchicalProfilesMigration,
    required: [
      "institutional_profiles",
      "scope_type in ('workspace', 'program', 'modality', 'class')",
      "institutional_profiles_one_active_scope_idx",
      "alter table public.institutional_profiles enable row level security",
      "public.is_org_member(organization_id)",
      "public.is_org_admin(organization_id)",
      "validate_institutional_profile_scope",
    ],
  },
  {
    name: "legacy institutional profile is read only",
    content: legacyReadonlyMigration,
    required: [
      "drop policy if exists organization_ai_profiles_insert_admin",
      "drop policy if exists organization_ai_profiles_update_admin",
      "drop policy if exists organization_ai_profiles_delete_admin",
      "revoke all privileges on table public.organization_ai_profiles",
      "from anon, authenticated, service_role",
      "grant select on table public.organization_ai_profiles",
      "to authenticated, service_role",
    ],
    forbidden: ["grant select, insert", "create policy organization_ai_profiles_insert_admin"],
  },
];

aiChecks.forEach((check) => {
  const lacksRequired = check.required.some((value) => !check.content.includes(value));
  const hasForbidden = (check.forbidden ?? []).some((value) => check.content.includes(value));
  if (lacksRequired || hasForbidden) {
    missing.push({ name: check.name });
  }
});

if (
  legacyRuntimeReferences.length !== 1 ||
  legacyRuntimeReferences[0] !== "supabase/functions/_shared/ai-context.ts"
) {
  missing.push({ name: "legacy institutional profile has a single read-only consumer" });
}

if (missing.length > 0) {
  console.error("Org scope checks failed:");
  missing.forEach((item) => {
    console.error(`- ${item.name}`);
  });
  process.exit(1);
}

console.log("Org scope checks passed.");
