#!/usr/bin/env node

/**
 * Idempotent fixtures for authenticated GoAtleta E2E checks against Supabase
 * Local only.
 *
 * Safety contract:
 * - requires the explicit --local flag;
 * - obtains local credentials from `supabase status -o env` without printing
 *   them or reading repository env files;
 * - refuses every API/DB URL except the standard loopback local endpoints;
 * - owns only fixed `e2e-local-*` records and Auth users marked as fixtures;
 * - never resets the database and never touches a remote Supabase project;
 * - stores generated test credentials only in the current user's temp folder.
 *
 * Usage (PowerShell):
 *   node scripts/seed-local-e2e.mjs --local
 *   node scripts/seed-local-e2e.mjs --local --verify
 *   node scripts/seed-local-e2e.mjs --local --cleanup
 */

import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const MANIFEST_PATH = join(tmpdir(), "GoAtleta-e2e-local.json");

const FIXTURE = Object.freeze({
  marker: "goatleta-local-e2e-v1",
  organization: {
    id: "e2e00000-0000-4000-8000-000000000001",
    name: "E2E Local - GoAtleta",
    timezone: "America/Sao_Paulo",
  },
  class: {
    id: "e2e-local-class-001",
    name: "Turma E2E Local",
  },
  classStaffId: "e2e00000-0000-4000-8000-000000000011",
  students: {
    regular: {
      id: "e2e-local-student-regular",
      name: "Ana Regular E2E",
    },
    delinquent: {
      id: "e2e-local-student-delinquent",
      name: "Bruno Inadimplente E2E",
    },
    inactive: {
      id: "e2e-local-student-inactive",
      name: "Carla Inativa E2E",
    },
  },
  accounts: {
    coord: {
      email: "coord.e2e.local@goatleta.test",
      displayName: "Coordenação E2E Local",
      fixtureRole: "coord",
    },
    professor: {
      email: "professor.e2e.local@goatleta.test",
      displayName: "Professor E2E Local",
      fixtureRole: "professor",
    },
  },
});

const allowedArgs = new Set(["--local", "--verify", "--cleanup", "--help"]);
const args = new Set(process.argv.slice(2));

for (const arg of args) {
  if (!allowedArgs.has(arg)) {
    fail(`Argumento desconhecido: ${arg}`);
  }
}

if (args.has("--help")) {
  console.log(
    [
      "Uso:",
      "  node scripts/seed-local-e2e.mjs --local",
      "  node scripts/seed-local-e2e.mjs --local --verify",
      "  node scripts/seed-local-e2e.mjs --local --cleanup",
      "",
      "O modo padrão cria/atualiza somente as fixtures locais e as verifica.",
      "--verify não altera as fixtures; usa o manifesto temporário existente.",
      "--cleanup remove apenas a organização e as contas marcadas desta fixture.",
    ].join("\n")
  );
  process.exit(0);
}

if (!args.has("--local")) {
  fail("Recusado: informe --local explicitamente.");
}

if (args.has("--verify") && args.has("--cleanup")) {
  fail("Use --verify ou --cleanup, nunca os dois juntos.");
}

function fail(message) {
  console.error(`E2E local: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseEnvOutput(output) {
  const parsed = {};
  for (const rawLine of String(output).split(/\r?\n/)) {
    const line = rawLine.trim();
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        throw new Error(`Saída inválida do Supabase CLI para ${match[1]}.`);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

function resolveSupabaseBinary() {
  const localBinary = join(
    REPO_ROOT,
    ".tools",
    "supabase",
    process.platform === "win32" ? "supabase.exe" : "supabase"
  );
  if (existsSync(localBinary)) return localBinary;
  return process.platform === "win32" ? "supabase.exe" : "supabase";
}

function loadLocalSupabaseStatus() {
  let output;
  try {
    output = execFileSync(resolveSupabaseBinary(), ["status", "-o", "env"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    throw new Error(
      "Não foi possível obter o status local. Confirme que o Supabase Local está ativo."
    );
  }

  const env = parseEnvOutput(output);
  const apiUrl = String(env.API_URL ?? "").replace(/\/$/, "");
  const dbUrl = String(env.DB_URL ?? "");
  const anonKey = String(env.ANON_KEY ?? "");
  const serviceRoleKey = String(env.SERVICE_ROLE_KEY ?? "");

  assert(apiUrl, "API_URL local ausente.");
  assert(dbUrl, "DB_URL local ausente.");
  assert(anonKey, "ANON_KEY local ausente.");
  assert(serviceRoleKey, "SERVICE_ROLE_KEY local ausente.");

  const allowedApiUrls = new Set([
    "http://127.0.0.1:54321",
    "http://localhost:54321",
  ]);
  assert(
    allowedApiUrls.has(apiUrl),
    "Recusado: API_URL não é o endpoint loopback local na porta 54321."
  );

  let parsedDbUrl;
  try {
    parsedDbUrl = new URL(dbUrl);
  } catch {
    throw new Error("DB_URL local inválida.");
  }
  assert(
    parsedDbUrl.protocol === "postgresql:" || parsedDbUrl.protocol === "postgres:",
    "Recusado: protocolo inesperado em DB_URL."
  );
  assert(
    parsedDbUrl.hostname === "127.0.0.1" || parsedDbUrl.hostname === "localhost",
    "Recusado: DB_URL não aponta para loopback."
  );
  assert(parsedDbUrl.port === "54322", "Recusado: DB_URL não usa a porta local 54322.");
  assert(parsedDbUrl.pathname === "/postgres", "Recusado: banco local inesperado.");

  return { apiUrl, anonKey, serviceRoleKey };
}

function safeErrorCode(payload) {
  if (!payload || typeof payload !== "object") return "sem_codigo";
  const value = payload.code ?? payload.error_code ?? payload.error;
  return typeof value === "string" && value.length <= 80 ? value : "sem_codigo";
}

function makeClient({ apiUrl, anonKey, serviceRoleKey }) {
  async function request(
    path,
    {
      method = "GET",
      accessToken = serviceRoleKey,
      apiKey = serviceRoleKey,
      body,
      headers = {},
      label = path,
    } = {}
  ) {
    const response = await fetch(new URL(path, apiUrl), {
      method,
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = raw;
      }
    }

    if (!response.ok) {
      throw new Error(
        `${label} falhou (HTTP ${response.status}, ${safeErrorCode(payload)}).`
      );
    }
    return payload;
  }

  return {
    service(path, options = {}) {
      return request(path, { ...options, label: options.label ?? "operação local" });
    },
    user(path, accessToken, options = {}) {
      return request(path, {
        ...options,
        accessToken,
        apiKey: anonKey,
        label: options.label ?? "operação autenticada local",
      });
    },
    auth(path, options = {}) {
      return request(path, {
        ...options,
        label: options.label ?? "operação de Auth local",
      });
    },
    signIn(email, password) {
      return request("/auth/v1/token?grant_type=password", {
        method: "POST",
        accessToken: anonKey,
        apiKey: anonKey,
        body: { email, password },
        label: "login da fixture",
      });
    },
  };
}

function encodeEq(value) {
  return encodeURIComponent(String(value));
}

function postgrestIn(values) {
  return `(${values.map((value) => `"${String(value).replaceAll('"', '\\"')}"`).join(",")})`;
}

async function getRows(client, table, query) {
  const result = await client.service(`/rest/v1/${table}?${query}`, {
    label: `leitura de ${table}`,
  });
  assert(Array.isArray(result), `Resposta inesperada ao ler ${table}.`);
  return result;
}

async function upsertRows(client, table, conflictColumns, rows) {
  return client.service(
    `/rest/v1/${table}?on_conflict=${encodeURIComponent(conflictColumns)}`,
    {
      method: "POST",
      body: rows,
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      label: `upsert de ${table}`,
    }
  );
}

async function deleteRows(client, table, query) {
  await client.service(`/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
    label: `remoção restrita de ${table}`,
  });
}

async function assertFinalSchema(client) {
  const probes = [
    "/rest/v1/organizations?select=id,timezone&limit=0",
    "/rest/v1/students?select=id,membership_status,inactivation_reason,financial_status&limit=0",
    "/rest/v1/student_financial_statuses?select=student_id,status&limit=0",
    "/rest/v1/student_class_enrollments?select=id,status&limit=0",
  ];

  for (const path of probes) {
    await client.service(path, {
      label: "verificação do schema migrado",
    });
  }
}

async function listAuthUsers(client) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const payload = await client.auth(
      `/auth/v1/admin/users?page=${page}&per_page=1000`,
      { label: "listagem local de usuários Auth" }
    );
    const pageUsers = Array.isArray(payload?.users)
      ? payload.users
      : Array.isArray(payload)
        ? payload
        : [];
    users.push(...pageUsers);
    if (pageUsers.length < 1000) break;
    if (page === 100) {
      throw new Error("Listagem de usuários Auth excedeu o limite seguro.");
    }
  }
  return users;
}

function authFixtureMarker(user) {
  return user?.app_metadata?.e2e_fixture_marker;
}

function newLocalPassword() {
  return `${randomBytes(24).toString("base64url")}aA1!`;
}

async function ensureAuthAccounts(client) {
  const existingUsers = await listAuthUsers(client);
  const now = new Date().toISOString();
  const accounts = {};

  for (const [role, definition] of Object.entries(FIXTURE.accounts)) {
    const normalizedEmail = definition.email.toLowerCase();
    const matches = existingUsers.filter(
      (user) => String(user.email ?? "").toLowerCase() === normalizedEmail
    );
    assert(matches.length <= 1, `Há usuários Auth duplicados para a conta ${role}.`);

    const existing = matches[0] ?? null;
    if (existing) {
      assert(
        authFixtureMarker(existing) === FIXTURE.marker,
        `Colisão segura: a conta reservada ${role} existe sem o marcador E2E.`
      );
      assert(
        existing.app_metadata?.e2e_fixture_role === definition.fixtureRole,
        `Colisão segura: a conta reservada ${role} tem outro papel de fixture.`
      );
    }

    const password = newLocalPassword();
    const body = {
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: definition.displayName,
        name: definition.displayName,
      },
      app_metadata: {
        e2e_fixture_marker: FIXTURE.marker,
        e2e_fixture_role: definition.fixtureRole,
        email_verified_hybrid_at: now,
      },
    };

    const payload = existing
      ? await client.auth(`/auth/v1/admin/users/${encodeEq(existing.id)}`, {
          method: "PUT",
          body,
          label: `atualização da conta Auth ${role}`,
        })
      : await client.auth("/auth/v1/admin/users", {
          method: "POST",
          body,
          label: `criação da conta Auth ${role}`,
        });

    const user = payload?.user ?? payload;
    assert(user?.id, `Auth não retornou o ID da conta ${role}.`);
    accounts[role] = {
      userId: user.id,
      email: normalizedEmail,
      password,
    };
  }

  return accounts;
}

function writeCredentialManifest(accounts, state) {
  const manifest = {
    schemaVersion: 1,
    fixtureMarker: FIXTURE.marker,
    state,
    generatedAt: new Date().toISOString(),
    apiUrl: "http://127.0.0.1:54321",
    organizationId: FIXTURE.organization.id,
    classId: FIXTURE.class.id,
    studentIds: Object.fromEntries(
      Object.entries(FIXTURE.students).map(([key, value]) => [key, value.id])
    ),
    accounts,
  };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  try {
    chmodSync(MANIFEST_PATH, 0o600);
  } catch {
    // Windows ACLs are inherited from the current user's temp directory.
  }
}

function readCredentialManifest() {
  assert(existsSync(MANIFEST_PATH), "Manifesto temporário de credenciais não encontrado.");
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch {
    throw new Error("Manifesto temporário de credenciais inválido.");
  }
  assert(manifest?.fixtureMarker === FIXTURE.marker, "Manifesto pertence a outra fixture.");
  assert(
    manifest?.apiUrl === "http://127.0.0.1:54321" ||
      manifest?.apiUrl === "http://localhost:54321",
    "Manifesto não aponta para Supabase Local."
  );
  for (const role of Object.keys(FIXTURE.accounts)) {
    assert(manifest?.accounts?.[role]?.email, `Manifesto sem e-mail para ${role}.`);
    assert(manifest?.accounts?.[role]?.password, `Manifesto sem senha para ${role}.`);
    assert(manifest?.accounts?.[role]?.userId, `Manifesto sem userId para ${role}.`);
  }
  return manifest;
}

async function assertNoDataCollisions(client, accounts) {
  const orgRows = await getRows(
    client,
    "organizations",
    `select=id,name,created_by&id=eq.${encodeEq(FIXTURE.organization.id)}`
  );
  if (orgRows.length > 0) {
    const org = orgRows[0];
    assert(org.name === FIXTURE.organization.name, "O UUID da organização E2E está ocupado.");
    assert(
      org.created_by === accounts.coord.userId,
      "A organização E2E pertence a outro usuário Auth."
    );
  }

  const classRows = await getRows(
    client,
    "classes",
    `select=id,name,organization_id&id=eq.${encodeEq(FIXTURE.class.id)}`
  );
  if (classRows.length > 0) {
    assert(
      classRows[0].organization_id === FIXTURE.organization.id,
      "O ID da turma E2E está ocupado em outra organização."
    );
  }

  const studentIds = Object.values(FIXTURE.students).map((student) => student.id);
  const studentRows = await getRows(
    client,
    "students",
    `select=id,organization_id&id=in.${encodeURIComponent(postgrestIn(studentIds))}`
  );
  assert(
    studentRows.every((row) => row.organization_id === FIXTURE.organization.id),
    "Um ID de aluno E2E está ocupado em outra organização."
  );

}

function localDate(timeZone = FIXTURE.organization.timezone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return value.toISOString().slice(0, 10);
}

async function seedDatabase(client, accounts) {
  const stableCreatedAt = "2026-01-15T12:00:00.000Z";
  const now = new Date().toISOString();

  await upsertRows(client, "trainers", "user_id", [
    { user_id: accounts.coord.userId, created_at: stableCreatedAt },
    { user_id: accounts.professor.userId, created_at: stableCreatedAt },
  ]);

  await upsertRows(client, "organizations", "id", [
    {
      id: FIXTURE.organization.id,
      name: FIXTURE.organization.name,
      created_by: accounts.coord.userId,
      created_at: stableCreatedAt,
      timezone: FIXTURE.organization.timezone,
    },
  ]);

  await upsertRows(client, "organization_members", "organization_id,user_id", [
    {
      organization_id: FIXTURE.organization.id,
      user_id: accounts.coord.userId,
      role_level: 50,
      created_at: stableCreatedAt,
    },
    {
      organization_id: FIXTURE.organization.id,
      user_id: accounts.professor.userId,
      role_level: 10,
      created_at: stableCreatedAt,
    },
  ]);

  await upsertRows(
    client,
    "organization_member_permissions",
    "organization_id,user_id,permission_key",
    [
      {
        organization_id: FIXTURE.organization.id,
        user_id: accounts.professor.userId,
        permission_key: "reports",
        is_allowed: true,
        updated_at: now,
        updated_by: accounts.coord.userId,
      },
      {
        organization_id: FIXTURE.organization.id,
        user_id: accounts.professor.userId,
        permission_key: "financial",
        is_allowed: false,
        updated_at: now,
        updated_by: accounts.coord.userId,
      },
      {
        organization_id: FIXTURE.organization.id,
        user_id: accounts.professor.userId,
        permission_key: "org_members",
        is_allowed: false,
        updated_at: now,
        updated_by: accounts.coord.userId,
      },
    ]
  );

  await upsertRows(client, "classes", "id", [
    {
      id: FIXTURE.class.id,
      name: FIXTURE.class.name,
      unit: "Unidade E2E Local",
      unit_id: null,
      training_space: "Quadra E2E",
      color_key: "green",
      modality: "voleibol",
      ageband: "14-17",
      gender: "misto",
      starttime: "18:00",
      end_time: "19:00",
      duration: 60,
      days: [0, 1, 2, 3, 4, 5, 6],
      daysperweek: 7,
      goal: "Validação operacional local",
      equipment: "quadra, bolas e cones",
      level: 1,
      mv_level: "MV1",
      cycle_start_date: null,
      cycle_length_weeks: null,
      acwr_low: 0.8,
      acwr_high: 1.3,
      createdat: stableCreatedAt,
      created_at: stableCreatedAt,
      updated_at: now,
      owner_id: accounts.professor.userId,
      organization_id: FIXTURE.organization.id,
    },
  ]);

  await upsertRows(client, "class_staff", "class_id,user_id", [
    {
      id: FIXTURE.classStaffId,
      organization_id: FIXTURE.organization.id,
      class_id: FIXTURE.class.id,
      user_id: accounts.professor.userId,
      staff_role: "head",
      created_at: stableCreatedAt,
    },
  ]);

  const students = [
    {
      id: FIXTURE.students.regular.id,
      name: FIXTURE.students.regular.name,
      age: 15,
      birthdate: "2011-03-12",
      membership_status: "active",
      inactivated_at: null,
      inactivated_by: null,
      inactivation_reason: null,
    },
    {
      id: FIXTURE.students.delinquent.id,
      name: FIXTURE.students.delinquent.name,
      age: 16,
      birthdate: "2010-05-21",
      membership_status: "active",
      inactivated_at: null,
      inactivated_by: null,
      inactivation_reason: null,
    },
    {
      id: FIXTURE.students.inactive.id,
      name: FIXTURE.students.inactive.name,
      age: 15,
      birthdate: "2011-01-08",
      membership_status: "inactive",
      inactivated_at: "2026-08-01T12:00:00.000Z",
      inactivated_by: accounts.coord.userId,
      inactivation_reason: "Inativação de validação E2E local",
    },
  ].map((student) => ({
    ...student,
    classid: FIXTURE.class.id,
    organization_id: FIXTURE.organization.id,
    owner_id: accounts.professor.userId,
    student_user_id: null,
    login_email: null,
    phone: "",
    createdat: stableCreatedAt,
    financial_status: "unknown",
    health_issue: false,
    health_issue_notes: null,
    medication_use: false,
    medication_notes: null,
    health_observations: null,
    position_primary: "indefinido",
    position_secondary: "indefinido",
    athlete_objective: "base",
    learning_style: "misto",
    external_id: null,
    rg: null,
    rg_normalized: null,
    is_experimental: false,
    source_pre_registration_id: null,
    ra: null,
    ra_start_year: null,
    college_course: null,
  }));

  await upsertRows(client, "students", "id", students);

  await upsertRows(client, "student_class_enrollments", "id", [
    {
      id: "e2e-local-enrollment-regular",
      organization_id: FIXTURE.organization.id,
      student_id: FIXTURE.students.regular.id,
      class_id: FIXTURE.class.id,
      modality: "voleibol",
      status: "active",
      created_at: stableCreatedAt,
      updated_at: now,
    },
    {
      id: "e2e-local-enrollment-delinquent",
      organization_id: FIXTURE.organization.id,
      student_id: FIXTURE.students.delinquent.id,
      class_id: FIXTURE.class.id,
      modality: "voleibol",
      status: "active",
      created_at: stableCreatedAt,
      updated_at: now,
    },
    {
      id: "e2e-local-enrollment-inactive",
      organization_id: FIXTURE.organization.id,
      student_id: FIXTURE.students.inactive.id,
      class_id: FIXTURE.class.id,
      modality: "voleibol",
      status: "active",
      created_at: stableCreatedAt,
      updated_at: now,
    },
  ]);

  const today = localDate();
  const olderDate = shiftIsoDate(today, -7);
  const recentDate = shiftIsoDate(today, -2);
  const attendanceRows = [
    ["older-regular", FIXTURE.students.regular.id, olderDate, "presente", "", 0],
    ["older-delinquent", FIXTURE.students.delinquent.id, olderDate, "faltou", "Ausência E2E", 0],
    ["older-inactive", FIXTURE.students.inactive.id, olderDate, "presente", "Histórico preservado", 1],
    ["recent-regular", FIXTURE.students.regular.id, recentDate, "presente", "", 0],
    ["recent-delinquent", FIXTURE.students.delinquent.id, recentDate, "presente", "", 0],
    ["recent-inactive", FIXTURE.students.inactive.id, recentDate, "faltou", "Histórico de inativo", 0],
  ].map(([slot, studentId, date, status, note, painScore]) => ({
    id: `e2e-local-attendance-${slot}`,
    classid: FIXTURE.class.id,
    studentid: studentId,
    date,
    status,
    note,
    pain_score: painScore,
    createdat: `${date}T21:00:00.000Z`,
    owner_id: accounts.professor.userId,
    organization_id: FIXTURE.organization.id,
    created_by: accounts.professor.userId,
  }));

  await upsertRows(client, "attendance_logs", "id", attendanceRows);

  await upsertRows(client, "session_logs", "id", [
    {
      id: "e2e-local-session-001",
      client_id: "e2e-local-session-client-001",
      classid: FIXTURE.class.id,
      organization_id: FIXTURE.organization.id,
      rpe: 5,
      technique: "boa",
      attendance: 67,
      activity: "Fundamentos e jogo reduzido E2E",
      conclusion: "Sessão histórica criada para resumo e exportação local.",
      participants_count: 2,
      photos: null,
      pain_score: 1,
      createdat: `${recentDate}T21:30:00.000Z`,
      owner_id: accounts.professor.userId,
      created_by: accounts.professor.userId,
    },
  ]);

  const coordSession = await client.signIn(
    accounts.coord.email,
    accounts.coord.password
  );
  assert(coordSession?.access_token, "Login da coordenação não retornou sessão.");

  const financialStatuses = [
    [FIXTURE.students.regular.id, "regular"],
    [FIXTURE.students.delinquent.id, "delinquent"],
    [FIXTURE.students.inactive.id, "exempt"],
  ];
  for (const [studentId, status] of financialStatuses) {
    await client.user(
      "/rest/v1/rpc/set_student_financial_status",
      coordSession.access_token,
      {
        method: "POST",
        body: {
          p_org_id: FIXTURE.organization.id,
          p_student_id: studentId,
          p_status: status,
        },
        label: "configuração financeira autenticada",
      }
    );
  }
}

function expectRowIds(rows, expectedIds, label) {
  assert(Array.isArray(rows), `Resposta inesperada ao verificar ${label}.`);
  const actual = new Set(rows.map((row) => row.id ?? row.student_id));
  assert(actual.size === expectedIds.length, `Quantidade inesperada em ${label}.`);
  for (const id of expectedIds) {
    assert(actual.has(id), `Registro ausente em ${label}.`);
  }
}

async function verifyFixtures(client, accounts) {
  const sessions = {};
  for (const [role, account] of Object.entries(accounts)) {
    const session = await client.signIn(account.email, account.password);
    assert(session?.access_token, `Login sem sessão para ${role}.`);
    sessions[role] = session;
  }

  const expectedStudentIds = Object.values(FIXTURE.students).map(
    (student) => student.id
  );

  const coordIsTrainer = await client.user(
    "/rest/v1/rpc/is_trainer",
    sessions.coord.access_token,
    { method: "POST", body: {}, label: "papel da coordenação" }
  );
  assert(coordIsTrainer === true, "Coordenação não foi reconhecida como trainer.");

  const coordOrganizations = await client.user(
    "/rest/v1/rpc/get_my_organizations",
    sessions.coord.access_token,
    { method: "POST", body: {}, label: "organizações da coordenação" }
  );
  assert(
    Array.isArray(coordOrganizations) &&
      coordOrganizations.some(
        (organization) =>
          organization.id === FIXTURE.organization.id &&
          organization.role_level === 50 &&
          organization.timezone === FIXTURE.organization.timezone
      ),
    "Organização E2E ausente para a coordenação."
  );

  const coordStudents = await client.user(
    `/rest/v1/students?select=id,membership_status&organization_id=eq.${encodeEq(FIXTURE.organization.id)}`,
    sessions.coord.access_token,
    { label: "alunos visíveis à coordenação" }
  );
  expectRowIds(coordStudents, expectedStudentIds, "alunos da coordenação");
  assert(
    coordStudents.find((student) => student.id === FIXTURE.students.inactive.id)
      ?.membership_status === "inactive",
    "Aluno inativo não está no estado esperado."
  );

  const coordFinancial = await client.user(
    `/rest/v1/student_financial_statuses?select=student_id,status&organization_id=eq.${encodeEq(FIXTURE.organization.id)}`,
    sessions.coord.access_token,
    { label: "financeiro visível à coordenação" }
  );
  expectRowIds(coordFinancial, expectedStudentIds, "financeiro da coordenação");
  const financialByStudent = new Map(
    coordFinancial.map((row) => [row.student_id, row.status])
  );
  assert(
    financialByStudent.get(FIXTURE.students.regular.id) === "regular" &&
      financialByStudent.get(FIXTURE.students.delinquent.id) === "delinquent" &&
      financialByStudent.get(FIXTURE.students.inactive.id) === "exempt",
    "Estados financeiros E2E inesperados."
  );

  const professorIsTrainer = await client.user(
    "/rest/v1/rpc/is_trainer",
    sessions.professor.access_token,
    { method: "POST", body: {}, label: "papel do professor" }
  );
  assert(professorIsTrainer === true, "Professor não foi reconhecido como trainer.");

  const professorClasses = await client.user(
    `/rest/v1/classes?select=id&organization_id=eq.${encodeEq(FIXTURE.organization.id)}&id=eq.${encodeEq(FIXTURE.class.id)}`,
    sessions.professor.access_token,
    { label: "turma visível ao professor" }
  );
  expectRowIds(professorClasses, [FIXTURE.class.id], "turma do professor");

  const professorStudents = await client.user(
    `/rest/v1/students?select=id&organization_id=eq.${encodeEq(FIXTURE.organization.id)}`,
    sessions.professor.access_token,
    { label: "alunos visíveis ao professor" }
  );
  expectRowIds(professorStudents, expectedStudentIds, "alunos do professor");

  const professorFinancial = await client.user(
    `/rest/v1/student_financial_statuses?select=student_id&organization_id=eq.${encodeEq(FIXTURE.organization.id)}`,
    sessions.professor.access_token,
    { label: "isolamento financeiro do professor" }
  );
  assert(
    Array.isArray(professorFinancial) && professorFinancial.length === 0,
    "Professor recebeu acesso financeiro que deveria estar bloqueado."
  );

  const attendance = await client.user(
    `/rest/v1/attendance_logs?select=id&organization_id=eq.${encodeEq(FIXTURE.organization.id)}&classid=eq.${encodeEq(FIXTURE.class.id)}&id=like.e2e-local-attendance-*`,
    sessions.professor.access_token,
    { label: "chamadas históricas" }
  );
  expectRowIds(
    attendance,
    [
      "e2e-local-attendance-older-regular",
      "e2e-local-attendance-older-delinquent",
      "e2e-local-attendance-older-inactive",
      "e2e-local-attendance-recent-regular",
      "e2e-local-attendance-recent-delinquent",
      "e2e-local-attendance-recent-inactive",
    ],
    "chamadas históricas"
  );

  const sessionLogs = await client.user(
    `/rest/v1/session_logs?select=id&organization_id=eq.${encodeEq(FIXTURE.organization.id)}&classid=eq.${encodeEq(FIXTURE.class.id)}&id=eq.e2e-local-session-001`,
    sessions.professor.access_token,
    { label: "relatório histórico" }
  );
  expectRowIds(sessionLogs, ["e2e-local-session-001"], "relatório histórico");

}

async function cleanupFixtures(client) {
  const users = await listAuthUsers(client);
  const fixtureUsers = [];

  for (const [role, definition] of Object.entries(FIXTURE.accounts)) {
    const matching = users.filter(
      (user) => String(user.email ?? "").toLowerCase() === definition.email
    );
    assert(matching.length <= 1, `Usuários Auth duplicados para ${role}.`);
    if (matching.length === 1) {
      const user = matching[0];
      assert(
        authFixtureMarker(user) === FIXTURE.marker &&
          user.app_metadata?.e2e_fixture_role === definition.fixtureRole,
        `Recusado: a conta reservada ${role} não pertence à fixture.`
      );
      fixtureUsers.push(user);
    }
  }

  const orgRows = await getRows(
    client,
    "organizations",
    `select=id,name,created_by&id=eq.${encodeEq(FIXTURE.organization.id)}`
  );
  if (orgRows.length > 0) {
    const coord = fixtureUsers.find(
      (user) => user.app_metadata?.e2e_fixture_role === "coord"
    );
    assert(orgRows[0].name === FIXTURE.organization.name, "UUID da organização não pertence à fixture.");
    assert(coord && orgRows[0].created_by === coord.id, "Organização E2E tem outro criador.");
    await deleteRows(client, "organizations", `id=eq.${encodeEq(FIXTURE.organization.id)}`);
  }

  for (const user of fixtureUsers) {
    await client.auth(`/auth/v1/admin/users/${encodeEq(user.id)}`, {
      method: "DELETE",
      label: "remoção de conta Auth marcada como fixture",
    });
  }

  if (existsSync(MANIFEST_PATH)) unlinkSync(MANIFEST_PATH);
}

async function main() {
  const localStatus = loadLocalSupabaseStatus();
  const client = makeClient(localStatus);
  await assertFinalSchema(client);

  if (args.has("--cleanup")) {
    await cleanupFixtures(client);
    console.log("Fixture E2E local removida com escopo restrito.");
    return;
  }

  if (args.has("--verify")) {
    const manifest = readCredentialManifest();
    await verifyFixtures(client, manifest.accounts);
    console.log("Fixture E2E local verificada.");
    console.log(`Credenciais permanecem somente em: ${MANIFEST_PATH}`);
    return;
  }

  const accounts = await ensureAuthAccounts(client);
  writeCredentialManifest(accounts, "credentials-created");
  await assertNoDataCollisions(client, accounts);
  await seedDatabase(client, accounts);
  await verifyFixtures(client, accounts);
  writeCredentialManifest(accounts, "ready");

  console.log("Fixture E2E local criada e verificada.");
  console.log(`Credenciais foram gravadas somente em: ${MANIFEST_PATH}`);
  console.log(`Organização: ${FIXTURE.organization.id}`);
  console.log(`Turma: ${FIXTURE.class.id}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "falha inesperada";
  fail(message);
});
