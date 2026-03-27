// ---------------------------------------------------------------------------
// Internal database row types — shared across all db/ modules
// These are NOT part of the public API; domain modules map them to app models
// ---------------------------------------------------------------------------

export type ClassRow = {
  id: string;
  name: string;
  organization_id?: string | null;
  unit?: string;
  unit_id?: string | null;
  color_key?: string | null;
  modality?: string | null;
  ageband: string;
  gender?: string | null;
  starttime?: string;
  endtime?: string | null;
  end_time?: string | null;
  duration?: number;
  days?: number[];
  daysperweek: number;
  goal: string;
  equipment: string;
  level: number;
  mv_level?: string | null;
  cycle_start_date?: string | null;
  cycle_length_weeks?: number | null;
  acwr_low?: number | null;
  acwr_high?: number | null;
  created_at?: string | null;
  createdat?: string | null;
};

export type UnitRow = {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  createdat: string;
};

export type TrainingPlanRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  title: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  applydays?: number[];
  applydate?: string;
  createdat: string;
};

export type TrainingTemplateRow = {
  id: string;
  title: string;
  ageband: string;
  tags: string[];
  warmup: string[];
  main: string[];
  cooldown: string[];
  warmuptime: string;
  maintime: string;
  cooldowntime: string;
  createdat: string;
};

export type HiddenTemplateRow = {
  id: string;
  templateid: string;
  createdat: string;
};

export type TrainingSessionIntegrationRuleRow = {
  id: string;
  organization_id?: string | null;
  source_session_id: string;
  start_at: string;
  end_at: string;
  class_count?: number | null;
  created_at: string;
  updated_at?: string | null;
};

export type TrainingSessionIntegrationRuleRpcRow = TrainingSessionIntegrationRuleRow & {
  class_ids?: string[] | null;
};

export type TrainingSessionIntegrationRuleClassRow = {
  id: string;
  rule_id: string;
  class_id: string;
  organization_id?: string | null;
  created_at: string;
};

export type StudentRow = {
  id: string;
  name: string;
  organization_id?: string | null;
  photo_url?: string | null;
  ra?: string | null;
  ra_start_year?: number | null;
  external_id?: string | null;
  cpf_masked?: string | null;
  cpf_hmac?: string | null;
  cpf_input?: string | null;
  rg?: string | null;
  rg_normalized?: string | null;
  college_course?: string | null;
  is_experimental?: boolean | null;
  source_pre_registration_id?: string | null;
  guardian_cpf_hmac?: string | null;
  classid: string;
  age: number;
  phone: string;
  login_email?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  guardian_relation?: string | null;
  health_issue?: boolean | null;
  health_issue_notes?: string | null;
  medication_use?: boolean | null;
  medication_notes?: string | null;
  health_observations?: string | null;
  position_primary?: string | null;
  position_secondary?: string | null;
  athlete_objective?: string | null;
  learning_style?: string | null;
  birthdate?: string | null;
  createdat: string;
};

export type StudentClassEnrollmentRow = {
  id: string;
  organization_id?: string | null;
  student_id: string;
  class_id: string;
  modality?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StudentPreRegistrationRow = {
  id: string;
  organization_id: string;
  child_name: string;
  guardian_name: string;
  guardian_phone: string;
  age_or_birth?: string | null;
  class_interest?: string | null;
  unit_interest?: string | null;
  trial_date?: string | null;
  status: string;
  notes?: string | null;
  converted_student_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRow = {
  id: string;
  classid: string;
  studentid: string;
  date: string;
  status: string;
  note: string;
  organization_id?: string | null;
  pain_score?: number | null;
  createdat: string;
};

export type AbsenceNoticeRow = {
  id: string;
  student_id: string;
  class_id: string;
  organization_id?: string | null;
  session_date: string;
  reason: string;
  note?: string | null;
  status: string;
  created_at: string;
};

export type ScoutingLogRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  unit?: string | null;
  mode?: string | null;
  client_id?: string | null;
  date: string;
  serve_0?: number | null;
  serve_1?: number | null;
  serve_2?: number | null;
  receive_0?: number | null;
  receive_1?: number | null;
  receive_2?: number | null;
  set_0?: number | null;
  set_1?: number | null;
  set_2?: number | null;
  attack_send_0?: number | null;
  attack_send_1?: number | null;
  attack_send_2?: number | null;
  createdat: string;
  updatedat?: string | null;
};

export type StudentScoutingRow = {
  id: string;
  studentid: string;
  classid: string;
  date: string;
  serve_0?: number | null;
  serve_1?: number | null;
  serve_2?: number | null;
  receive_0?: number | null;
  receive_1?: number | null;
  receive_2?: number | null;
  set_0?: number | null;
  set_1?: number | null;
  set_2?: number | null;
  attack_send_0?: number | null;
  attack_send_1?: number | null;
  attack_send_2?: number | null;
  createdat: string;
  updatedat?: string | null;
};

export type ClassPlanRow = {
  id: string;
  classid: string;
  organization_id?: string | null;
  startdate: string;
  weeknumber: number;
  phase: string;
  theme: string;
  technical_focus: string;
  physical_focus: string;
  constraints: string;
  mv_format: string;
  warmupprofile: string;
  ruleset?: string | null;
  jump_target?: string | null;
  rpe_target?: string | null;
  source: string;
  created_at?: string | null;
  updated_at?: string | null;
  createdat?: string | null;
  updatedat?: string | null;
};

export type ClassCompetitiveProfileRow = {
  class_id: string;
  organization_id: string;
  planning_mode?: string | null;
  cycle_start_date?: string | null;
  target_competition?: string | null;
  target_date?: string | null;
  tactical_system?: string | null;
  current_phase?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClassCalendarExceptionRow = {
  id: string;
  class_id: string;
  organization_id: string;
  date: string;
  reason?: string | null;
  kind?: string | null;
  created_at?: string | null;
};

export type AthleteIntakeRow = {
  id: string;
  organization_id?: string | null;
  class_id?: string | null;
  student_id?: string | null;
  full_name?: string | null;
  ra?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  email?: string | null;
  modalities?: string[] | string | null;
  parq_positive?: boolean | null;
  cardio_risk?: boolean | null;
  ortho_risk?: boolean | null;
  current_injury?: boolean | null;
  smoker?: boolean | null;
  allergies?: boolean | null;
  major_surgery?: boolean | null;
  family_history_risk?: boolean | null;
  dizziness_or_syncope?: boolean | null;
  needs_medical_clearance?: boolean | null;
  needs_individual_attention?: boolean | null;
  jump_restriction?: string | null;
  risk_status?: string | null;
  tags?: string[] | string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SessionLogRow = {
  id: string;
  client_id?: string | null;
  classid: string;
  organization_id?: string | null;
  rpe: number;
  technique: string;
  attendance: number;
  activity?: string | null;
  conclusion?: string | null;
  participants_count?: number | null;
  photos?: string | null;
  pain_score?: number | null;
  createdat: string;
};

export type TrainingSessionRow = {
  id: string;
  organization_id?: string | null;
  title?: string | null;
  description?: string | null;
  start_at: string;
  end_at: string;
  status: string;
  type: string;
  source: string;
  plan_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TrainingSessionClassRow = {
  id: string;
  session_id: string;
  class_id: string;
  organization_id?: string | null;
  created_at?: string | null;
};

export type TrainingSessionAttendanceRow = {
  id: string;
  session_id: string;
  student_id: string;
  class_id: string;
  organization_id?: string | null;
  status: string;
  note?: string | null;
  pain_score?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type KnowledgeBaseVersionRow = {
  id: string;
  organization_id?: string | null;
  domain: string;
  version_label: string;
  description?: string | null;
  status: string;
  published_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeSourceRow = {
  id: string;
  organization_id?: string | null;
  knowledge_base_version_id: string;
  domain: string;
  title: string;
  authors?: string | null;
  source_year?: number | null;
  edition?: string | null;
  source_type: string;
  source_url?: string | null;
  citation_text?: string | null;
  created_at: string;
  updated_at: string;
};

export type KnowledgeRuleRow = {
  id: string;
  organization_id?: string | null;
  knowledge_base_version_id: string;
  domain: string;
  rule_key: string;
  rule_label?: string | null;
  rule_kind: string;
  status: string;
  payload?: unknown;
  created_at: string;
  updated_at: string;
};

export type KnowledgeRuleCitationRow = {
  id: string;
  organization_id?: string | null;
  knowledge_rule_id: string;
  knowledge_source_id?: string | null;
  kb_document_id?: string | null;
  pages?: string | null;
  evidence?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ExerciseRow = {
  id: string;
  title: string;
  tags: string[];
  videourl: string;
  source: string;
  description: string;
  publishedat: string;
  notes: string;
  createdat: string;
};

export type PendingWriteRow = {
  id: string;
  kind: "session_log" | "attendance_records" | "scouting_log" | "student_scouting_log" | "nfc_checkin";
  payload: string;
  createdAt: string;
  requeuedAt: string | null;
  retryCount: number;
  lastError: string | null;
  dedupKey: string;
};
