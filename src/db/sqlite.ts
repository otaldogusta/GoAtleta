import * as SQLite from "expo-sqlite";

export const db = SQLite.openDatabaseSync("coachperiod.db");

export function initDb() {
  db.execSync(
    `
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      ageBand TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'misto',
      daysPerWeek INTEGER NOT NULL,
      goal TEXT NOT NULL,
      equipment TEXT NOT NULL,
      level INTEGER NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      modality TEXT NOT NULL DEFAULT 'fitness',
      unitId TEXT NOT NULL DEFAULT '',
      mvLevel TEXT NOT NULL DEFAULT '',
      cycleStartDate TEXT NOT NULL DEFAULT '',
      cycleLengthWeeks INTEGER NOT NULL DEFAULT 0,
      acwrLow REAL NOT NULL DEFAULT 0.8,
      acwrHigh REAL NOT NULL DEFAULT 1.3,
      startTime TEXT NOT NULL DEFAULT '',
      endTime TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      address TEXT,
      notes TEXT,
      organizationId TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      classId TEXT NOT NULL,
      rpe INTEGER NOT NULL,
      technique TEXT NOT NULL,
      attendance INTEGER NOT NULL,
      activity TEXT NOT NULL DEFAULT '',
      conclusion TEXT NOT NULL DEFAULT '',
      participantsCount INTEGER NOT NULL DEFAULT 0,
      photos TEXT NOT NULL DEFAULT '',
      painScore INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      startAt TEXT NOT NULL DEFAULT '',
      endAt TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'scheduled',
      type TEXT NOT NULL DEFAULT 'training',
      source TEXT NOT NULL DEFAULT 'manual',
      planId TEXT,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS training_session_classes (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      classId TEXT NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS training_session_attendance (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      studentId TEXT NOT NULL,
      classId TEXT NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'present',
      note TEXT NOT NULL DEFAULT '',
      painScore INTEGER,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS scouting_logs (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      serve0 INTEGER NOT NULL DEFAULT 0,
      serve1 INTEGER NOT NULL DEFAULT 0,
      serve2 INTEGER NOT NULL DEFAULT 0,
      receive0 INTEGER NOT NULL DEFAULT 0,
      receive1 INTEGER NOT NULL DEFAULT 0,
      receive2 INTEGER NOT NULL DEFAULT 0,
      set0 INTEGER NOT NULL DEFAULT 0,
      set1 INTEGER NOT NULL DEFAULT 0,
      set2 INTEGER NOT NULL DEFAULT 0,
      attackSend0 INTEGER NOT NULL DEFAULT 0,
      attackSend1 INTEGER NOT NULL DEFAULT 0,
      attackSend2 INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS student_scouting_logs (
      id TEXT PRIMARY KEY NOT NULL,
      studentId TEXT NOT NULL,
      classId TEXT NOT NULL,
      date TEXT NOT NULL,
      serve0 INTEGER NOT NULL DEFAULT 0,
      serve1 INTEGER NOT NULL DEFAULT 0,
      serve2 INTEGER NOT NULL DEFAULT 0,
      receive0 INTEGER NOT NULL DEFAULT 0,
      receive1 INTEGER NOT NULL DEFAULT 0,
      receive2 INTEGER NOT NULL DEFAULT 0,
      set0 INTEGER NOT NULL DEFAULT 0,
      set1 INTEGER NOT NULL DEFAULT 0,
      set2 INTEGER NOT NULL DEFAULT 0,
      attackSend0 INTEGER NOT NULL DEFAULT 0,
      attackSend1 INTEGER NOT NULL DEFAULT 0,
      attackSend2 INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS training_plans (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      title TEXT NOT NULL,
      warmup TEXT NOT NULL,
      main TEXT NOT NULL,
      cooldown TEXT NOT NULL,
      warmupTime TEXT NOT NULL,
      mainTime TEXT NOT NULL,
      cooldownTime TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_plans (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      startDate TEXT NOT NULL,
      weekNumber INTEGER NOT NULL,
      phase TEXT NOT NULL,
      theme TEXT NOT NULL,
      technicalFocus TEXT NOT NULL,
      physicalFocus TEXT NOT NULL,
      constraints TEXT NOT NULL,
      mvFormat TEXT NOT NULL,
      warmupProfile TEXT NOT NULL,
      jumpTarget TEXT NOT NULL,
      rpeTarget TEXT NOT NULL,
      source TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_competitive_profiles (
      classId TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      planningMode TEXT NOT NULL DEFAULT 'adulto-competitivo',
      cycleStartDate TEXT NOT NULL DEFAULT '',
      targetCompetition TEXT NOT NULL DEFAULT '',
      targetDate TEXT NOT NULL DEFAULT '',
      tacticalSystem TEXT NOT NULL DEFAULT '',
      currentPhase TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS class_calendar_exceptions (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT 'no_training',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      chunk TEXT NOT NULL DEFAULT '',
      embedding TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      sport TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT '',
      knowledgeBaseVersionId TEXT,
      knowledgeSourceId TEXT,
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS knowledge_base_versions (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT 'general',
      versionLabel TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      publishedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      knowledgeBaseVersionId TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL DEFAULT '',
      authors TEXT NOT NULL DEFAULT '',
      sourceYear INTEGER,
      edition TEXT NOT NULL DEFAULT '',
      sourceType TEXT NOT NULL DEFAULT 'other',
      sourceUrl TEXT NOT NULL DEFAULT '',
      citationText TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS knowledge_rules (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      knowledgeBaseVersionId TEXT NOT NULL DEFAULT '',
      domain TEXT NOT NULL DEFAULT 'general',
      ruleKey TEXT NOT NULL DEFAULT '',
      ruleLabel TEXT NOT NULL DEFAULT '',
      ruleKind TEXT NOT NULL DEFAULT 'recommendation',
      status TEXT NOT NULL DEFAULT 'draft',
      payload TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS knowledge_rule_citations (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      knowledgeRuleId TEXT NOT NULL DEFAULT '',
      knowledgeSourceId TEXT,
      kbDocumentId TEXT,
      pages TEXT NOT NULL DEFAULT '',
      evidence TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS org_ai_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      philosophy TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '[]',
      goals TEXT NOT NULL DEFAULT '[]',
      equipmentNotes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS unit_ai_profiles (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      unitId TEXT NOT NULL DEFAULT '',
      realityNotes TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '[]',
      focus TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS session_skill_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      classId TEXT NOT NULL DEFAULT '',
      unitId TEXT NOT NULL DEFAULT '',
      sessionDate TEXT NOT NULL DEFAULT '',
      objective TEXT NOT NULL DEFAULT '',
      focusSkills TEXT NOT NULL DEFAULT '[]',
      consistencyScore REAL NOT NULL DEFAULT 0,
      successRate REAL NOT NULL DEFAULT 0,
      decisionQuality REAL NOT NULL DEFAULT 0,
      appliedDrillIds TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS class_profiles (
      classId TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      unitId TEXT NOT NULL DEFAULT '',
      modality TEXT NOT NULL DEFAULT 'volleyball_indoor',
      ageBand TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'development',
      sessionsPerWeek INTEGER NOT NULL DEFAULT 2,
      cycleGoal TEXT NOT NULL DEFAULT '',
      constraintsDefault TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS session_execution_log (
      id TEXT PRIMARY KEY NOT NULL,
      classId TEXT NOT NULL,
      date TEXT NOT NULL,
      plannedFocusTags TEXT NOT NULL DEFAULT '[]',
      executedDrills TEXT NOT NULL DEFAULT '[]',
      rpeGroup INTEGER NOT NULL DEFAULT 5,
      quality TEXT NOT NULL DEFAULT 'medium',
      constraints TEXT NOT NULL DEFAULT '[]',
      coachNotes TEXT NOT NULL DEFAULT '',
      attendanceCount INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pending_writes (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      requeuedAt TEXT,
      retryCount INTEGER NOT NULL DEFAULT 0,
      lastError TEXT,
      dedupKey TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS pending_writes_dead (
      id TEXT PRIMARY KEY NOT NULL,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      dedupKey TEXT NOT NULL DEFAULT '',
      retryCount INTEGER NOT NULL DEFAULT 0,
      finalError TEXT,
      errorKind TEXT NOT NULL DEFAULT 'unknown',
      deadAt TEXT NOT NULL,
      resolvedAt TEXT,
      resolutionNote TEXT
    );

    CREATE TABLE IF NOT EXISTS assistant_memory_entries (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      classId TEXT NOT NULL DEFAULT '',
      userId TEXT NOT NULL DEFAULT '',
      scope TEXT NOT NULL DEFAULT 'class',
      role TEXT NOT NULL DEFAULT 'assistant',
      content TEXT NOT NULL DEFAULT '',
      expiresAt TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS weekly_autopilot_proposals (
      id TEXT PRIMARY KEY NOT NULL,
      organizationId TEXT NOT NULL DEFAULT '',
      classId TEXT NOT NULL DEFAULT '',
      weekStart TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      actions TEXT NOT NULL DEFAULT '[]',
      proposedPlanIds TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'proposed',
      createdBy TEXT NOT NULL DEFAULT '',
      knowledgeBaseVersionId TEXT,
      knowledgeBaseVersionLabel TEXT NOT NULL DEFAULT '',
      knowledgeDomain TEXT NOT NULL DEFAULT 'general',
      knowledgeReferences TEXT NOT NULL DEFAULT '[]',
      knowledgeRuleHighlights TEXT NOT NULL DEFAULT '[]',
      planReview TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    );
  `
  );

  try {
    db.execSync(
      "CREATE UNIQUE INDEX IF NOT EXISTS class_plans_unique_week ON class_plans (classId, weekNumber)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE UNIQUE INDEX IF NOT EXISTS class_calendar_exceptions_unique_day ON class_calendar_exceptions (classId, date, kind)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_units_org_name ON units (organizationId, name)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_classes_org ON classes (organizationId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_class_competitive_profiles_org ON class_competitive_profiles (organizationId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_class_calendar_exceptions_class_date ON class_calendar_exceptions (classId, date)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_createdAt ON pending_writes (createdAt)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_dedupKey ON pending_writes (dedupKey)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_requeuedAt ON pending_writes (requeuedAt)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_deadAt ON pending_writes_dead (deadAt)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_errorKind ON pending_writes_dead (errorKind)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_pending_writes_dead_dedupKey ON pending_writes_dead (dedupKey)"
    );
  } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_kb_documents_org_sport ON kb_documents (organizationId, sport)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_kb_documents_org_version ON kb_documents (organizationId, knowledgeBaseVersionId)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_kb_documents_source ON kb_documents (knowledgeSourceId)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_base_versions_org_domain ON knowledge_base_versions (organizationId, domain)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_sources_version ON knowledge_sources (knowledgeBaseVersionId)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_rules_version ON knowledge_rules (knowledgeBaseVersionId)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_knowledge_rule_citations_rule ON knowledge_rule_citations (knowledgeRuleId)"
      );
    } catch {}

    try {
      db.execSync(
        "CREATE INDEX IF NOT EXISTS idx_org_ai_profiles_org ON org_ai_profiles (organizationId)"
      );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_unit_ai_profiles_org_unit ON unit_ai_profiles (organizationId, unitId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_session_skill_snapshots_class_date ON session_skill_snapshots (classId, sessionDate)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_class_profiles_org_unit ON class_profiles (organizationId, unitId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_session_execution_log_class_date ON session_execution_log (classId, date DESC)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE UNIQUE INDEX IF NOT EXISTS training_session_classes_unique ON training_session_classes (sessionId, classId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE UNIQUE INDEX IF NOT EXISTS training_session_attendance_unique ON training_session_attendance (sessionId, studentId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_sessions_org_start ON training_sessions (organizationId, startAt DESC)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_session_classes_class ON training_session_classes (classId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_session_classes_org_class ON training_session_classes (organizationId, classId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_session_attendance_session ON training_session_attendance (sessionId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_session_attendance_class ON training_session_attendance (classId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_training_session_attendance_student ON training_session_attendance (studentId)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_memory_org_class_created ON assistant_memory_entries (organizationId, classId, createdAt DESC)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_memory_expires ON assistant_memory_entries (expiresAt)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_weekly_autopilot_org_class_week ON weekly_autopilot_proposals (organizationId, classId, weekStart DESC)"
    );
  } catch {}

  try {
    db.execSync(
      "CREATE INDEX IF NOT EXISTS idx_weekly_autopilot_org_knowledge_version ON weekly_autopilot_proposals (organizationId, knowledgeBaseVersionId)"
    );
  } catch {}

  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN classId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN warmupTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN mainTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE training_plans ADD COLUMN cooldownTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN unit TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN organizationId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN modality TEXT NOT NULL DEFAULT 'fitness'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN gender TEXT NOT NULL DEFAULT 'misto'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN unitId TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN mvLevel TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN cycleStartDate TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN cycleLengthWeeks INTEGER NOT NULL DEFAULT 0"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN acwrLow REAL NOT NULL DEFAULT 0.8"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN acwrHigh REAL NOT NULL DEFAULT 1.3"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN startTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN endTime TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE classes ADD COLUMN createdAt TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN technicalFocus TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN physicalFocus TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN constraints TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN mvFormat TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN source TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN updatedAt TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN jumpTarget TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE class_plans ADD COLUMN rpeTarget TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE pending_writes ADD COLUMN requeuedAt TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE pending_writes_dead ADD COLUMN dedupKey TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE pending_writes_dead ADD COLUMN resolvedAt TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE pending_writes_dead ADD COLUMN resolutionNote TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN knowledgeBaseVersionId TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN knowledgeBaseVersionLabel TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN knowledgeDomain TEXT NOT NULL DEFAULT 'general'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN knowledgeReferences TEXT NOT NULL DEFAULT '[]'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN knowledgeRuleHighlights TEXT NOT NULL DEFAULT '[]'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE weekly_autopilot_proposals ADD COLUMN planReview TEXT NOT NULL DEFAULT '{}'"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN painScore INTEGER"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN activity TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN conclusion TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN participantsCount INTEGER NOT NULL DEFAULT 0"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE session_logs ADD COLUMN photos TEXT NOT NULL DEFAULT ''"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE kb_documents ADD COLUMN knowledgeBaseVersionId TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE kb_documents ADD COLUMN knowledgeSourceId TEXT"
    );
  } catch {}
  try {
    db.execSync(
      "ALTER TABLE units ADD COLUMN organizationId TEXT NOT NULL DEFAULT ''"
    );
    // Fix existing units: assign them to the first available organization
    // This prevents orphaned units from disappearing
    const orgs = db.getAllSync<{ id: string }>("SELECT id FROM organizations LIMIT 1");
    if (orgs.length > 0) {
      const escapedOrgId = orgs[0].id.replace(/'/g, "''");
      db.execSync(
        `UPDATE units SET organizationId = '${escapedOrgId}' WHERE organizationId = ''`
      );
    }
  } catch {}
}

// Helper: Get all units (locations) for an organization
export function getUnitsByOrg(organizationId: string) {
  return db.getAllAsync<{
    id: string;
    name: string;
    address: string | null;
    notes: string | null;
    organizationId: string;
    createdAt: string;
  }>("SELECT * FROM units WHERE organizationId = ? ORDER BY name ASC", [
    organizationId,
  ]);
}
