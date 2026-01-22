const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config();

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_KEY = SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // eslint-disable-next-line no-console
  console.error(
    "Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local or environment."
  );
  process.exit(1);
}

const REST_BASE = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1";

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const request = async (method, endpoint, body) => {
  const res = await fetch(REST_BASE + endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} failed: ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : [];
};

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
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
    } else if (char === ",") {
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

  const header = rows.shift()?.map((value) => value.trim()) ?? [];
  return rows
    .filter((items) => items.some((value) => value.trim().length))
    .map((items) => {
      const record = {};
      header.forEach((key, index) => {
        record[key] = (items[index] ?? "").trim();
      });
      return record;
    });
};

const splitList = (value) =>
  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);

const pad2 = (value) => String(value).padStart(2, "0");

const normalizeAgeBand = (value) => {
  const match = value.match(/(\d{1,2})\s*-\s*(\d{1,2})/);
  if (!match) return "";
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "";
  return `${pad2(start)}-${pad2(end)}`;
};

const normalizeTimeRange = (value) => {
  const match = value.match(
    /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/
  );
  if (!match) return "";
  const startHour = pad2(Number(match[1]));
  const startMin = pad2(Number(match[2]));
  const endHour = pad2(Number(match[3]));
  const endMin = pad2(Number(match[4]));
  return `${startHour}:${startMin}-${endHour}:${endMin}`;
};

const extractTitleInfo = (title) => {
  const parts = title
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
  const unit = parts[0] ?? "";
  const timePart = parts.find((part) =>
    /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/.test(part)
  );
  const agePart = parts.find((part) => /\d{1,2}\s*-\s*\d{1,2}/.test(part));
  const timeRange = timePart ? normalizeTimeRange(timePart) : "";
  const ageBand = agePart ? normalizeAgeBand(agePart) : "";
  const startTime = timeRange ? timeRange.split("-")[0] : "";
  return { unit, timeRange, startTime, ageBand };
};

const isValidIsoDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
};

const getWeekday = (dateIso) => {
  const date = new Date(`${dateIso}T00:00:00`);
  return date.getDay();
};

const buildMain = (row) => {
  const mainItems = splitList(row.main || "");
  const extras = [];
  if (row.objective_general) {
    extras.push(`Objetivo geral: ${row.objective_general}`);
  }
  if (row.objective_specific) {
    extras.push(`Objetivo especifico: ${row.objective_specific}`);
  }
  if (row.observations) {
    extras.push(`Observacoes: ${row.observations}`);
  }
  return [...extras, ...mainItems];
};

const normalizeWord = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const allowedObjectiveVerbs = new Set([
  "introduzir",
  "desenvolver",
  "consolidar",
  "reforcar",
  "aplicar",
  "trabalhar",
  "melhorar",
  "aumentar",
  "estimular",
  "iniciar",
  "promover",
  "orientar",
  "avaliar",
  "diagnosticar",
  "manter",
  "integrar",
  "aperfeicoar",
  "treinar",
  "ensinar",
  "revisar",
]);

const objectiveStartsWithVerb = (value) => {
  const firstWord = value.trim().split(/\s+/)[0];
  if (!firstWord) return false;
  return allowedObjectiveVerbs.has(normalizeWord(firstWord));
};

const matchClass = (classes, row, titleInfo, unitHint) => {
  const startTime = titleInfo.startTime;
  const ageBand = titleInfo.ageBand;
  const weekday = getWeekday(row.date);
  let candidates = classes;

  if (titleInfo.unit || unitHint) {
    const resolvedUnit = titleInfo.unit || unitHint;
    candidates = candidates.filter(
      (cls) => (cls.unit || "").toLowerCase() === resolvedUnit.toLowerCase()
    );
  }

  if (startTime) {
    candidates = candidates.filter((cls) => (cls.starttime || "") === startTime);
  }
  if (ageBand) {
    candidates = candidates.filter((cls) => (cls.ageband || "") === ageBand);
  }
  candidates = candidates.filter((cls) => {
    if (!Array.isArray(cls.days) || !cls.days.length) return true;
    return cls.days.includes(weekday);
  });

  return candidates;
};

const buildPlanRow = (row, classId) => {
  const nowIso = new Date().toISOString();
  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    classid: classId,
    title: row.title,
    tags: ["importado", "planejamento", "janeiro-2026"],
    warmup: splitList(row.warmup || ""),
    main: buildMain(row),
    cooldown: splitList(row.cooldown || ""),
    warmuptime: row.warmup_time || "",
    maintime: row.main_time || "",
    cooldowntime: row.cooldown_time || "",
    applydays: [],
    applydate: row.date,
    createdat: nowIso,
  };
};

const deleteExistingPlan = async (classId, applyDate) => {
  const endpoint =
    "/training_plans?classid=eq." +
    encodeURIComponent(classId) +
    "&applydate=eq." +
    encodeURIComponent(applyDate);
  await request("DELETE", endpoint);
};

const run = async () => {
  const args = process.argv.slice(2);
  let inputPath = "";
  let unitHint = "";
  args.forEach((arg) => {
    if (arg.startsWith("--unit=")) {
      unitHint = arg.split("=").slice(1).join("=").trim();
      return;
    }
    if (!arg.startsWith("--") && !inputPath) {
      inputPath = arg;
    }
  });
  if (!inputPath) {
    inputPath = path.join(
      __dirname,
      "..",
      "data",
      "imports",
      "planejamento-janeiro-2026.csv"
    );
  }

  const csv = fs.readFileSync(inputPath, "utf8");
  const rows = parseCsv(csv);
  if (!rows.length) {
    console.error("Nenhuma linha encontrada no CSV.");
    process.exit(1);
  }

  const classes = await request("GET", "/classes?select=*");
  const errors = [];
  const warnings = [];
  const plans = [];

  rows.forEach((row, index) => {
    const titleInfo = extractTitleInfo(row.title || "");
    const issues = [];

    if (!row.date || !isValidIsoDate(row.date)) {
      issues.push("date deve estar no formato YYYY-MM-DD");
    }
    if (!titleInfo.unit && !unitHint) {
      issues.push("unidade não encontrada no title");
    }
    if (!titleInfo.timeRange) {
      issues.push("horário não encontrado (HH:MM-HH:MM)");
    }
    if (!titleInfo.ageBand) {
      issues.push("faixa etaria não encontrada (08-11)");
    }

    if (issues.length) {
      errors.push({
        index,
        date: row.date,
        title: row.title,
        reason: issues.join("; "),
      });
      return;
    }

    const objectiveIssues = [];
    if (row.objective_general && !objectiveStartsWithVerb(row.objective_general)) {
      objectiveIssues.push("objetivo geral não inicia com verbo");
    }
    if (row.objective_specific && !objectiveStartsWithVerb(row.objective_specific)) {
      objectiveIssues.push("objetivo especifico não inicia com verbo");
    }
    if (objectiveIssues.length) {
      warnings.push({
        index,
        date: row.date,
        title: row.title,
        reason: objectiveIssues.join("; "),
      });
    }

    const candidates = matchClass(classes, row, titleInfo, unitHint);
    if (candidates.length !== 1) {
      errors.push({
        index,
        date: row.date,
        title: row.title,
        candidates: candidates.map((cls) => cls.id),
        reason:
          candidates.length === 0
            ? "nenhuma turma encontrada (verifique unidade/horário/faixa/dia)"
            : "ambiguidade (mais de uma turma encontrada)",
      });
      return;
    }
    plans.push(buildPlanRow(row, candidates[0].id));
  });

  if (errors.length) {
    console.error("Falha ao resolver turma para algumas linhas:");
    errors.forEach((err) => {
      const base = `- Linha ${err.index + 2} (${err.date}): ${err.title}`;
      const candidates = err.candidates?.length
        ? ` -> ${err.candidates.join(", ")}`
        : "";
      const reason = err.reason ? ` (${err.reason})` : "";
      console.error(`${base}${candidates}${reason}`);
    });
    process.exit(1);
  }

  if (warnings.length) {
    console.warn("Aviso: objetivos sem verbo no inicio:");
    warnings.forEach((warn) => {
      const reason = warn.reason ? ` (${warn.reason})` : "";
      console.warn(`- Linha ${warn.index + 2} (${warn.date}): ${warn.title}${reason}`);
    });
  }

  for (const plan of plans) {
    await deleteExistingPlan(plan.classid, plan.applydate);
  }

  await request("POST", "/training_plans", plans);
  console.log(`Importado: ${plans.length} planos.`);
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
