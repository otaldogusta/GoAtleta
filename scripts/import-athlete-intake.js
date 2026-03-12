/* eslint-disable no-console */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const opts = {
    help: false,
    upsert: false,
    createStudents: false,
    classId: "",
    classIdFeminino: "",
    classIdMasculino: "",
    organizationId: "",
    supabaseUrl:
      process.env.SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL ||
      "",
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      "",
  };
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--upsert") {
      opts.upsert = true;
      continue;
    }
    if (arg === "--create-students") {
      opts.createStudents = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--class-id") {
      opts.classId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg === "--class-id-feminino") {
      opts.classIdFeminino = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg === "--class-id-masculino") {
      opts.classIdMasculino = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg === "--organization-id") {
      opts.organizationId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg === "--supabase-url") {
      opts.supabaseUrl = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg === "--service-role-key") {
      opts.serviceRoleKey = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new Error(`Flag desconhecida: ${arg}`);
    }
    positional.push(arg);
  }

  return { opts, positional };
}

const { opts, positional } = parseArgs(process.argv.slice(2));
const inputPath = positional[0];
if (opts.help) {
  console.log(
    "Uso: node scripts/import-athlete-intake.js <caminho-do-csv> [outputDir] [--upsert --create-students --class-id <id> | --class-id-feminino <id> --class-id-masculino <id> --organization-id <id>]"
  );
  process.exit(0);
}

if (!inputPath) {
  console.error(
    "Uso: node scripts/import-athlete-intake.js <caminho-do-csv> [outputDir] [--upsert --create-students --class-id <id> | --class-id-feminino <id> --class-id-masculino <id> --organization-id <id>]"
  );
  process.exit(1);
}

const outputDirArg = positional[1];
const outputDir = outputDirArg
  ? path.resolve(outputDirArg)
  : path.resolve(process.cwd(), "data", "imports");

function toKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(raw, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];
    if (inQuotes) {
      if (char === '"' && raw[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function detectDelimiter(raw) {
  const firstLine =
    raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || "";
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ";" : ",";
}

function findValue(row, tokens) {
  for (const [header, value] of Object.entries(row)) {
    const key = toKey(header);
    if (tokens.some((token) => key.includes(token))) return String(value ?? "").trim();
  }
  return "";
}

function findRaValue(row) {
  for (const [header, value] of Object.entries(row)) {
    const key = toKey(header);
    const tokens = key.split(/[^a-z0-9]+/g).filter(Boolean);
    if (tokens.includes("ra")) return String(value ?? "").trim();
    if (key.includes("registro academico")) return String(value ?? "").trim();
  }
  return "";
}

function yesNo(value) {
  return toKey(value) === "sim";
}

function toIsoDate(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

function splitModalities(value) {
  return String(value ?? "")
    .split(/;|,|\//g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasVolleyball(modalities) {
  return modalities.some((item) => {
    const key = toKey(item);
    return key.includes("volei") || key.includes("voleibol");
  });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveRaStartYear(raDigits) {
  if (!raDigits || raDigits.length < 4) return null;
  const year = Number(raDigits.slice(0, 4));
  if (!Number.isFinite(year)) return null;
  if (year < 1990 || year > 2100) return null;
  return year;
}

function calcAge(birthDate) {
  if (!birthDate) return 18;
  const d = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 18;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > d.getMonth() ||
    (now.getMonth() === d.getMonth() && now.getDate() >= d.getDate());
  if (!hasBirthdayPassed) age -= 1;
  if (!Number.isFinite(age) || age < 5 || age > 100) return 18;
  return age;
}

function mapRow(row) {
  const fullName = findValue(row, ["nome:", "nome"]);
  const ra = findRaValue(row);
  const sexRaw = findValue(row, ["sexo"]);
  const sexKey = toKey(sexRaw);
  const sex = sexKey === "masculino" ? "masculino" : sexKey === "feminino" ? "feminino" : null;
  const birthDate = toIsoDate(findValue(row, ["data de nascimento"]));
  const email = findValue(row, ["email"]);
  const modalities = splitModalities(
    findValue(row, ["qual(ais) modalidade", "modalidade(s)", "modalidade"])
  );

  const cardioMedicalRestriction = yesNo(
    findValue(row, ["problema de coracao", "atividade fisica supervisionado"])
  );
  const chestPainExercise = yesNo(
    findValue(row, ["dores no peito quando pratica atividade fisica"])
  );
  const chestPainLastMonth = yesNo(
    findValue(row, ["ultimo mes", "dores no peito", "praticou atividade fisica"])
  );
  const dizzinessOrSyncope = yesNo(
    findValue(row, ["tontura", "perda de consciencia", "desequilibrio"])
  );
  const boneJointProblem = yesNo(
    findValue(row, ["problema osseo", "articular", "piorado pela atividade"])
  );
  const heartMedication = yesNo(
    findValue(row, ["medicamento para pressao", "problema de coracao"])
  );
  const otherReasonNoExercise = yesNo(
    findValue(row, ["outra razao", "nao deve praticar atividade fisica"])
  );

  const smoker = yesNo(findValue(row, ["fumante"]));
  const allergies = yesNo(findValue(row, ["possui alergias"]));
  const majorSurgery = yesNo(findValue(row, ["cirurgia de grande porte"]));
  const familyHistoryRisk = yesNo(findValue(row, ["pais com diabetes", "hipertensao"]));
  const orthopedicLimitation = yesNo(findValue(row, ["problema ortopedico", "limitacoes"]));
  const currentInjury = yesNo(findValue(row, ["possui atualmente algum tipo de lesao", "lesao"]));

  const parqPositive =
    cardioMedicalRestriction ||
    chestPainExercise ||
    chestPainLastMonth ||
    dizzinessOrSyncope ||
    heartMedication ||
    otherReasonNoExercise;

  const cardioRisk = parqPositive;
  const orthoRisk = boneJointProblem || orthopedicLimitation || currentInjury;
  const needsMedicalClearance = cardioRisk;
  const needsIndividualAttention = cardioRisk || orthoRisk || currentInjury;

  const tags = [];
  if (hasVolleyball(modalities)) tags.push("atleta-volei");
  if (unique(modalities.map((item) => toKey(item))).length > 1) tags.push("atleta-multi-modalidade");
  if (needsIndividualAttention) tags.push("precisa-acompanhamento");
  if (!needsIndividualAttention) tags.push("apto-sem-restricao-aparente");
  if (orthoRisk) tags.push("atencao-ortopedica");
  if (currentInjury) tags.push("lesao-atual");
  if (cardioRisk) tags.push("triagem-cardiovascular-positiva");
  if (allergies) tags.push("alergias");
  if (smoker) tags.push("tabagismo");
  if (majorSurgery) tags.push("cirurgia-previa");
  if (familyHistoryRisk) tags.push("historico-familiar-risco");
  if (dizzinessOrSyncope) tags.push("tontura-ou-sincope");
  if (orthoRisk || currentInjury) tags.push("monitorar-fadiga");

  const riskStatus = needsMedicalClearance
    ? "revisar"
    : needsIndividualAttention
      ? "atencao"
      : "apto";

  return {
    fullName,
    ra: ra || null,
    sex,
    birthDate,
    email: email || null,
    modalities,
    parqPositive,
    cardioRisk,
    orthoRisk,
    currentInjury,
    smoker,
    allergies,
    majorSurgery,
    familyHistoryRisk,
    dizzinessOrSyncope,
    needsMedicalClearance,
    needsIndividualAttention,
    jumpRestriction: orthoRisk || currentInjury ? "avaliar" : "nenhuma",
    riskStatus,
    tags: unique(tags),
    notes: null,
  };
}

function summary(records) {
  const volleyballOnly = records.filter((item) => {
    const mods = unique(item.modalities.map((m) => toKey(m)));
    return mods.length === 1 && mods[0].includes("volei");
  }).length;
  return {
    total: records.length,
    volleyballAny: records.filter((item) => hasVolleyball(item.modalities)).length,
    volleyballOnly,
    multiModality: records.filter((item) => unique(item.modalities.map((m) => toKey(m))).length > 1).length,
    parqPositive: records.filter((item) => item.parqPositive).length,
    cardioRisk: records.filter((item) => item.cardioRisk).length,
    orthoRisk: records.filter((item) => item.orthoRisk).length,
    currentInjury: records.filter((item) => item.currentInjury).length,
    allergies: records.filter((item) => item.allergies).length,
    smoker: records.filter((item) => item.smoker).length,
    dizzinessOrSyncope: records.filter((item) => item.dizzinessOrSyncope).length,
    needsMedicalClearance: records.filter((item) => item.needsMedicalClearance).length,
    needsIndividualAttention: records.filter((item) => item.needsIndividualAttention).length,
  };
}

function hashId(prefix, value) {
  const digest = crypto.createHash("sha1").update(value).digest("hex").slice(0, 20);
  return `${prefix}_${digest}`;
}

async function supabaseRequest(baseUrl, key, method, restPath, body) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1${restPath}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${method} ${restPath} -> ${response.status}: ${text}`);
  }
  return text;
}

async function resolveOrganizationId(options) {
  if (options.organizationId) return options.organizationId;
  const fallbackClassId = options.classId || options.classIdFeminino || options.classIdMasculino;
  if (!fallbackClassId) return "";
  const raw = await supabaseRequest(
    options.supabaseUrl,
    options.serviceRoleKey,
    "GET",
    `/classes?select=id,organization_id&id=eq.${encodeURIComponent(fallbackClassId)}&limit=1`,
    undefined
  );
  const rows = JSON.parse(raw || "[]");
  return rows[0]?.organization_id || "";
}

async function loadStudentsByClassId(options, classId) {
  if (!classId) return [];
  const raw = await supabaseRequest(
    options.supabaseUrl,
    options.serviceRoleKey,
    "GET",
    `/students?select=id,name,ra,login_email&classid=eq.${encodeURIComponent(classId)}`,
    undefined
  );
  const rows = JSON.parse(raw || "[]");
  return rows.map((row) => ({
    id: row.id,
    ra: normalizeDigits(row.ra),
    email: normalizeEmail(row.login_email),
    name: normalizeName(row.name),
  }));
}

async function loadStudentsByOrganizationId(options, organizationId) {
  if (!organizationId) return [];
  const raw = await supabaseRequest(
    options.supabaseUrl,
    options.serviceRoleKey,
    "GET",
    `/students?select=id,name,ra,login_email,classid&organization_id=eq.${encodeURIComponent(organizationId)}`,
    undefined
  );
  const rows = JSON.parse(raw || "[]");
  return rows.map((row) => ({
    id: row.id,
    classId: row.classid,
    ra: normalizeDigits(row.ra),
    email: normalizeEmail(row.login_email),
    name: normalizeName(row.name),
  }));
}

function resolveClassIdForRecord(record, options) {
  if (options.classIdFeminino || options.classIdMasculino) {
    if (record.sex === "feminino" && options.classIdFeminino) return options.classIdFeminino;
    if (record.sex === "masculino" && options.classIdMasculino) return options.classIdMasculino;
    return null;
  }
  return options.classId || null;
}

async function clearClassIntakes(options, organizationId, classIds) {
  if (!classIds.length) return;
  const encodedList = classIds.map((id) => `"${id}"`).join(",");
  await supabaseRequest(
    options.supabaseUrl,
    options.serviceRoleKey,
    "DELETE",
    `/athlete_intakes?organization_id=eq.${encodeURIComponent(organizationId)}&class_id=in.(${encodeURIComponent(encodedList)})`,
    undefined
  );
}

async function createStudentsFromRecords(records, options, organizationId, studentsByClassId) {
  if (!options.createStudents) return { created: 0 };

  const orgStudents = await loadStudentsByOrganizationId(options, organizationId);
  const orgByRa = new Map();
  const orgByEmail = new Map();
  const orgByName = new Map();
  for (const student of orgStudents) {
    if (student.ra) orgByRa.set(student.ra, student.id);
    if (student.email) orgByEmail.set(student.email, student.id);
    if (student.name) orgByName.set(student.name, student.id);
  }

  const nowIso = new Date().toISOString();
  const toInsert = [];
  const seenInsertIds = new Set();

  for (const record of records) {
    const classId = resolveClassIdForRecord(record, options);
    if (!classId) continue;

    const raDigits = normalizeDigits(record.ra).slice(0, 10);
    const email = normalizeEmail(record.email);
    const nameNorm = normalizeName(record.fullName);

    const classStudents = studentsByClassId.get(classId) || [];
    if (matchStudentId(record, classStudents)) continue;
    if ((raDigits && orgByRa.has(raDigits)) || (email && orgByEmail.has(email)) || (nameNorm && orgByName.has(nameNorm))) {
      continue;
    }

    const studentId = hashId(
      "stuimp",
      [organizationId, classId, raDigits, email, nameNorm, record.birthDate || ""].join("|")
    );
    if (seenInsertIds.has(studentId)) continue;
    seenInsertIds.add(studentId);

    toInsert.push({
      id: studentId,
      name: record.fullName || "Sem nome",
      organization_id: organizationId,
      classid: classId,
      age: calcAge(record.birthDate),
      phone: "",
      login_email: email || null,
      guardian_name: null,
      guardian_phone: null,
      guardian_relation: null,
      birthdate: record.birthDate || null,
      health_issue: false,
      health_issue_notes: null,
      medication_use: false,
      medication_notes: null,
      health_observations: null,
      position_primary: "indefinido",
      position_secondary: "indefinido",
      athlete_objective: "base",
      learning_style: "misto",
      createdat: nowIso,
      ra: raDigits || null,
      ra_start_year: deriveRaStartYear(raDigits),
    });

    const nextClassStudents = [...classStudents, { id: studentId, ra: raDigits, email, name: nameNorm }];
    studentsByClassId.set(classId, nextClassStudents);
    if (raDigits) orgByRa.set(raDigits, studentId);
    if (email) orgByEmail.set(email, studentId);
    if (nameNorm) orgByName.set(nameNorm, studentId);
  }

  const chunkSize = 200;
  for (let i = 0; i < toInsert.length; i += chunkSize) {
    const chunk = toInsert.slice(i, i + chunkSize);
    await supabaseRequest(
      options.supabaseUrl,
      options.serviceRoleKey,
      "POST",
      "/students?on_conflict=id",
      chunk
    );
  }

  return { created: toInsert.length };
}

function matchStudentId(record, students) {
  const intakeRa = normalizeDigits(record.ra);
  if (intakeRa) {
    const byRa = students.filter((student) => student.ra && student.ra === intakeRa);
    if (byRa.length === 1) return byRa[0].id;
  }

  const intakeEmail = normalizeEmail(record.email);
  if (intakeEmail) {
    const byEmail = students.filter((student) => student.email && student.email === intakeEmail);
    if (byEmail.length === 1) return byEmail[0].id;
  }

  const intakeName = normalizeName(record.fullName);
  if (intakeName) {
    const byName = students.filter((student) => student.name && student.name === intakeName);
    if (byName.length === 1) return byName[0].id;
  }

  return null;
}

async function upsertAthleteIntakes(records, options) {
  if (!options.supabaseUrl || !options.serviceRoleKey) {
    throw new Error("Para --upsert, informe SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (env ou flags).");
  }

  const organizationId = await resolveOrganizationId(options);
  if (!organizationId) {
    throw new Error("Nao foi possivel resolver organization_id. Informe --organization-id ou --class-id valido.");
  }

  const classIdsForLoad = unique([
    options.classId,
    options.classIdFeminino,
    options.classIdMasculino,
  ]);
  const studentsByClassId = new Map();
  for (const classId of classIdsForLoad) {
    const classStudents = await loadStudentsByClassId(options, classId);
    studentsByClassId.set(classId, classStudents);
  }

  if (options.classIdFeminino || options.classIdMasculino) {
    await clearClassIntakes(options, organizationId, classIdsForLoad);
  }

  const studentCreateResult = await createStudentsFromRecords(
    records,
    options,
    organizationId,
    studentsByClassId
  );

  const nowIso = new Date().toISOString();

  const payload = records.map((record, index) => {
    const classId = resolveClassIdForRecord(record, options);
    const stableIdentity = [
      organizationId,
      classId || "",
      normalizeDigits(record.ra),
      normalizeEmail(record.email),
      normalizeName(record.fullName),
      record.birthDate || "",
      String(index),
    ].join("|");
    const students = classId ? studentsByClassId.get(classId) || [] : [];
    const studentId = classId ? matchStudentId(record, students) : null;

    return {
      id: hashId("ai", stableIdentity),
      organization_id: organizationId,
      class_id: classId,
      student_id: studentId,
      full_name: record.fullName || "",
      ra: record.ra,
      sex: record.sex,
      birth_date: record.birthDate,
      email: record.email,
      modalities: record.modalities,
      parq_positive: Boolean(record.parqPositive),
      cardio_risk: Boolean(record.cardioRisk),
      ortho_risk: Boolean(record.orthoRisk),
      current_injury: Boolean(record.currentInjury),
      smoker: Boolean(record.smoker),
      allergies: Boolean(record.allergies),
      major_surgery: Boolean(record.majorSurgery),
      family_history_risk: Boolean(record.familyHistoryRisk),
      dizziness_or_syncope: Boolean(record.dizzinessOrSyncope),
      needs_medical_clearance: Boolean(record.needsMedicalClearance),
      needs_individual_attention: Boolean(record.needsIndividualAttention),
      jump_restriction: record.jumpRestriction,
      risk_status: record.riskStatus,
      tags: record.tags,
      notes: record.notes,
      created_at: nowIso,
      updated_at: nowIso,
    };
  });

  const effectivePayload = payload.filter((item) => item.class_id);
  const chunkSize = 200;
  for (let i = 0; i < effectivePayload.length; i += chunkSize) {
    const chunk = effectivePayload.slice(i, i + chunkSize);
    await supabaseRequest(
      options.supabaseUrl,
      options.serviceRoleKey,
      "POST",
      "/athlete_intakes?on_conflict=id",
      chunk
    );
  }

  const linkedCount = effectivePayload.filter((item) => item.student_id).length;
  console.log(`Upsert concluido em athlete_intakes: ${effectivePayload.length} registros.`);
  if (options.createStudents) {
    console.log(`Alunos criados automaticamente: ${studentCreateResult.created}.`);
  }
  console.log(`Vinculados automaticamente a alunos: ${linkedCount}.`);
}

(async () => {
  const sourcePath = path.resolve(inputPath);
  const csvRaw = fs.readFileSync(sourcePath, "utf8");
  const delimiter = detectDelimiter(csvRaw);
  const rows = parseCsv(csvRaw, delimiter);
  if (!rows.length) {
    console.error("CSV vazio.");
    process.exit(1);
  }

  const headers = rows[0];
  const bodyRows = rows.slice(1).filter((row) => row.some((cell) => String(cell).trim().length));

  const mapped = bodyRows.map((row) => {
    const record = {};
    for (let i = 0; i < headers.length; i += 1) {
      record[headers[i]] = String(row[i] ?? "").trim();
    }
    return mapRow(record);
  });

  const output = {
    createdAt: new Date().toISOString(),
    sourceFile: sourcePath,
    rows: mapped,
    summary: summary(mapped),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = path.basename(sourcePath, path.extname(sourcePath));
  const jsonPath = path.join(outputDir, `${baseName}.intake.normalized.json`);
  const summaryPath = path.join(outputDir, `${baseName}.intake.summary.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(output.rows, null, 2), "utf8");
  fs.writeFileSync(summaryPath, JSON.stringify(output.summary, null, 2), "utf8");

  console.log(`Arquivo lido: ${sourcePath}`);
  console.log(`Registros processados: ${output.rows.length}`);
  console.log(`Resumo salvo em: ${summaryPath}`);
  console.log(`Normalizado salvo em: ${jsonPath}`);
  console.log("Resumo:");
  console.log(output.summary);

  if (opts.upsert) {
    await upsertAthleteIntakes(output.rows, opts);
  }
})().catch((error) => {
  console.error("Falha ao importar anamnese:", error instanceof Error ? error.message : error);
  process.exit(1);
});
