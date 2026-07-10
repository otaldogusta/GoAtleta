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
    ],
    forbidden: ["memberOrgs[0]"],
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
];

aiChecks.forEach((check) => {
  const lacksRequired = check.required.some((value) => !check.content.includes(value));
  const hasForbidden = (check.forbidden ?? []).some((value) => check.content.includes(value));
  if (lacksRequired || hasForbidden) {
    missing.push({ name: check.name });
  }
});

if (missing.length > 0) {
  console.error("Org scope checks failed:");
  missing.forEach((item) => {
    console.error(`- ${item.name}`);
  });
  process.exit(1);
}

console.log("Org scope checks passed.");
