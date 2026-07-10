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
    required: ["requireActiveWorkspaceId"],
    forbidden: ["memberOrgs[0]"],
  },
  {
    name: "proactive insight workspace scope",
    content: contextualInsight,
    required: ["organizationId: workspaceId", "buildWorkspaceScopeKey"],
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
