export type IntakeRiskStatus = "apto" | "atencao" | "revisar";

export type AthleteIntake = {
  id: string;
  classId: string | null;
  studentId: string | null;
  fullName: string;
  ra: string | null;
  sex: "masculino" | "feminino" | "outro" | null;
  birthDate: string | null;
  email: string | null;
  modalities: string[];
  parqPositive: boolean;
  cardioRisk: boolean;
  orthoRisk: boolean;
  currentInjury: boolean;
  smoker: boolean;
  allergies: boolean;
  majorSurgery: boolean;
  familyHistoryRisk: boolean;
  dizzinessOrSyncope: boolean;
  needsMedicalClearance: boolean;
  needsIndividualAttention: boolean;
  jumpRestriction: "nenhuma" | "avaliar";
  riskStatus: IntakeRiskStatus;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AthleteIntakeAnswer = {
  id: string;
  athleteIntakeId: string;
  questionKey: string;
  questionLabel: string;
  answer: string;
};

export type AthleteIntakeMatchMethod = "ra" | "email" | "name";

export type AthleteIntakeMatchResult = {
  intakeId: string;
  studentId: string;
  methods: AthleteIntakeMatchMethod[];
  confidence: "high" | "medium";
  score: number;
};

type RawRow = Record<string, string>;

const toKey = (value: string) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const toBooleanYesNo = (value: string) => toKey(value) === "sim";

const toIsoDate = (value: string): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
};

const splitModalities = (value: string) =>
  String(value ?? "")
    .split(/;|,|\//g)
    .map((item) => item.trim())
    .filter(Boolean);

const matchesHeaderToken = (normalizedHeader: string, token: string) => {
  const normalizedToken = toKey(token);
  if (!normalizedToken) return false;
  if (normalizedHeader === normalizedToken) return true;
  if (normalizedToken.length <= 2) {
    return normalizedHeader.split(" ").includes(normalizedToken);
  }
  return normalizedHeader.includes(normalizedToken);
};

const findValue = (row: RawRow, includes: string[]): string => {
  const entries = Object.entries(row);
  for (const [header, value] of entries) {
    const normalizedHeader = toKey(header);
    if (includes.some((token) => matchesHeaderToken(normalizedHeader, token))) {
      return String(value ?? "").trim();
    }
  }
  return "";
};

const toSex = (value: string): AthleteIntake["sex"] => {
  const normalized = toKey(value);
  if (["masculino", "masc", "m", "male", "homem", "menino"].includes(normalized)) return "masculino";
  if (["feminino", "fem", "f", "female", "mulher", "menina"].includes(normalized)) return "feminino";
  if (normalized) return "outro";
  return null;
};

const containsVolleyball = (modalities: string[]) =>
  modalities.some((item) => {
    const normalized = toKey(item);
    return normalized.includes("volei") || normalized.includes("voleibol");
  });

const hasMultiModality = (modalities: string[]) =>
  new Set(modalities.map((item) => toKey(item))).size > 1;

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export const normalizeAthleteModality = (value: string) => toKey(value);

export const extractDetectedModalities = (rows: RawRow[]) => {
  const counts = new Map<string, { label: string; count: number }>();

  rows.forEach((row) => {
    const modalities = splitModalities(
      findValue(row, ["qual(ais) modalidade", "modalidade(s)", "modalidade"])
    );
    modalities.forEach((modality) => {
      const normalized = normalizeAthleteModality(modality);
      if (!normalized) return;
      const current = counts.get(normalized);
      if (current) {
        current.count += 1;
        return;
      }
      counts.set(normalized, { label: modality.trim(), count: 1 });
    });
  });

  return Array.from(counts.entries())
    .map(([normalized, item]) => ({
      normalized,
      label: item.label,
      count: item.count,
      isVolleyball:
        normalized.includes("volei") || normalized.includes("voleibol"),
    }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
};

export function mapGoogleFormsRowToAthleteIntake(
  row: RawRow,
  opts?: { classId?: string | null; studentId?: string | null }
): AthleteIntake {
  const name = findValue(row, ["nome:", "nome"]);
  const ra = findValue(row, ["ra"]);
  const sex = toSex(findValue(row, ["sexo"]));
  const birthDate = toIsoDate(findValue(row, ["data de nascimento"]));
  const emailRaw = findValue(row, ["email"]);
  const modalities = splitModalities(
    findValue(row, ["qual(ais) modalidade", "modalidade(s)", "modalidade"])
  );

  const cardioMedicalRestriction = toBooleanYesNo(
    findValue(row, ["problema de coracao", "atividade fisica supervisionado"])
  );
  const chestPainExercise = toBooleanYesNo(
    findValue(row, ["dores no peito quando pratica atividade fisica"])
  );
  const chestPainLastMonth = toBooleanYesNo(
    findValue(row, ["ultimo mes", "dores no peito", "praticou atividade fisica"])
  );
  const dizzinessSyncope = toBooleanYesNo(
    findValue(row, ["tontura", "perda de consciencia", "desequilibrio"])
  );
  const boneJointProblem = toBooleanYesNo(
    findValue(row, ["problema osseo", "articular", "piorado pela atividade"])
  );
  const heartMedication = toBooleanYesNo(
    findValue(row, ["medicamento para pressao", "problema de coracao"])
  );
  const otherReasonNoExercise = toBooleanYesNo(
    findValue(row, ["outra razao", "nao deve praticar atividade fisica"])
  );

  const smoker = toBooleanYesNo(findValue(row, ["fumante"]));
  const allergies = toBooleanYesNo(findValue(row, ["possui alergias"]));
  const majorSurgery = toBooleanYesNo(
    findValue(row, ["cirurgia de grande porte"])
  );
  const familyHistoryRisk = toBooleanYesNo(
    findValue(row, ["pais com diabetes", "hipertensao"])
  );
  const orthopedicLimitation = toBooleanYesNo(
    findValue(row, ["problema ortopedico", "limitacoes"])
  );
  const currentInjury = toBooleanYesNo(
    findValue(row, ["possui atualmente algum tipo de lesao", "lesao"])
  );

  const parqPositive =
    cardioMedicalRestriction ||
    chestPainExercise ||
    chestPainLastMonth ||
    dizzinessSyncope ||
    heartMedication ||
    otherReasonNoExercise;

  const cardioRisk = parqPositive;
  const orthoRisk = boneJointProblem || orthopedicLimitation || currentInjury;
  const needsMedicalClearance = cardioRisk;
  const needsIndividualAttention = cardioRisk || orthoRisk || currentInjury;

  const riskStatus: IntakeRiskStatus = needsMedicalClearance
    ? "revisar"
    : needsIndividualAttention
      ? "atencao"
      : "apto";

  const tags: string[] = [];
  if (containsVolleyball(modalities)) tags.push("atleta-volei");
  if (hasMultiModality(modalities)) tags.push("atleta-multi-modalidade");
  if (needsIndividualAttention) tags.push("precisa-acompanhamento");
  if (!needsIndividualAttention) tags.push("apto-sem-restricao-aparente");
  if (orthoRisk) tags.push("atencao-ortopedica");
  if (currentInjury) tags.push("lesao-atual");
  if (cardioRisk) tags.push("triagem-cardiovascular-positiva");
  if (allergies) tags.push("alergias");
  if (smoker) tags.push("tabagismo");
  if (majorSurgery) tags.push("cirurgia-previa");
  if (familyHistoryRisk) tags.push("historico-familiar-risco");
  if (dizzinessSyncope) tags.push("tontura-ou-sincope");
  if (orthoRisk || currentInjury) tags.push("monitorar-fadiga");

  const notes = findValue(row, ["nenhuma informacao", "observa", "momento", "resfriada", "sedentaria"]);
  const nowIso = new Date().toISOString();

  return {
    id: `intake_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    classId: opts?.classId ?? null,
    studentId: opts?.studentId ?? null,
    fullName: name,
    ra: ra || null,
    sex,
    birthDate,
    email: emailRaw || null,
    modalities,
    parqPositive,
    cardioRisk,
    orthoRisk,
    currentInjury,
    smoker,
    allergies,
    majorSurgery,
    familyHistoryRisk,
    dizzinessOrSyncope: dizzinessSyncope,
    needsMedicalClearance,
    needsIndividualAttention,
    jumpRestriction: orthoRisk || currentInjury ? "avaliar" : "nenhuma",
    riskStatus,
    tags: unique(tags),
    notes: notes || null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function buildAthleteIntakeSummary(records: AthleteIntake[]) {
  const total = records.length;
  const onlyVolleyball = records.filter((item) => {
    const uniqueModalities = Array.from(
      new Set(item.modalities.map((entry) => toKey(entry)).filter(Boolean))
    );
    return uniqueModalities.length === 1 && containsVolleyball(item.modalities);
  }).length;

  const summary = {
    total,
    volleyballAny: records.filter((item) => containsVolleyball(item.modalities)).length,
    volleyballOnly: onlyVolleyball,
    multiModality: records.filter((item) => hasMultiModality(item.modalities)).length,
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

  return summary;
}

type StudentLike = {
  id: string;
  name: string;
  ra?: string | null;
  loginEmail?: string | null;
};

const normalizeDigits = (value: string | null | undefined) =>
  String(value ?? "").replace(/\D/g, "");

const normalizeEmail = (value: string | null | undefined) =>
  String(value ?? "").trim().toLowerCase();

const normalizeName = (value: string | null | undefined) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const scoreNameSimilarity = (a: string, b: string) => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = a.split(" ").filter(Boolean);
  const bTokens = b.split(" ").filter(Boolean);
  if (!aTokens.length || !bTokens.length) return 0;
  const bSet = new Set(bTokens);
  const intersection = aTokens.filter((token) => bSet.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union ? intersection / union : 0;
};

export function matchAthleteIntakeToStudents(
  intakes: AthleteIntake[],
  students: StudentLike[]
): { matches: AthleteIntakeMatchResult[]; unmatchedIntakeIds: string[] } {
  const byRa = new Map<string, StudentLike[]>();
  const byEmail = new Map<string, StudentLike[]>();

  for (const student of students) {
    const ra = normalizeDigits(student.ra);
    if (ra) {
      const bucket = byRa.get(ra) ?? [];
      bucket.push(student);
      byRa.set(ra, bucket);
    }
    const email = normalizeEmail(student.loginEmail);
    if (email) {
      const bucket = byEmail.get(email) ?? [];
      bucket.push(student);
      byEmail.set(email, bucket);
    }
  }

  const matches: AthleteIntakeMatchResult[] = [];
  const unmatchedIntakeIds: string[] = [];

  for (const intake of intakes) {
    const methods: AthleteIntakeMatchMethod[] = [];
    let score = 0;
    let selected: StudentLike | null = null;

    const intakeRa = normalizeDigits(intake.ra);
    if (intakeRa) {
      const candidates = byRa.get(intakeRa) ?? [];
      if (candidates.length === 1) {
        selected = candidates[0];
        methods.push("ra");
        score += 100;
      }
    }

    const intakeEmail = normalizeEmail(intake.email);
    if (intakeEmail) {
      const candidates = byEmail.get(intakeEmail) ?? [];
      if (candidates.length === 1) {
        if (!selected || selected.id === candidates[0].id) {
          selected = candidates[0];
          methods.push("email");
          score += 80;
        }
      }
    }

    if (!selected) {
      const intakeName = normalizeName(intake.fullName);
      if (intakeName) {
        let best: StudentLike | null = null;
        let bestScore = 0;
        for (const student of students) {
          const currentScore = scoreNameSimilarity(intakeName, normalizeName(student.name));
          if (currentScore > bestScore) {
            best = student;
            bestScore = currentScore;
          }
        }
        if (best && bestScore >= 0.85) {
          selected = best;
          methods.push("name");
          score += Math.round(bestScore * 60);
        }
      }
    }

    if (!selected) {
      unmatchedIntakeIds.push(intake.id);
      continue;
    }

    matches.push({
      intakeId: intake.id,
      studentId: selected.id,
      methods,
      confidence: score >= 100 ? "high" : "medium",
      score,
    });
  }

  return { matches, unmatchedIntakeIds };
}
