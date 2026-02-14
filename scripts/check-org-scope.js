const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "src", "api", "reports.ts");
const content = fs.readFileSync(target, "utf8");

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
  (check) => !content.includes(check.endpoint) || !content.includes(check.required)
);

if (missing.length > 0) {
  console.error("Org scope checks failed:");
  missing.forEach((item) => {
    console.error(`- ${item.name}`);
  });
  process.exit(1);
}

console.log("Org scope checks passed.");
