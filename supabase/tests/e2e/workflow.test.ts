import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Setup URLs and Keys (Defaults for local Supabase)
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''; // Must be populated
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Must be populated

// Skip tests if keys are not provided (so CI doesn't crash if unconfigured)
const describeOrSkip = (SUPABASE_ANON_KEY && SUPABASE_SERVICE_ROLE_KEY) ? describe : describe.skip;

describeOrSkip('GoAtleta E2E LGPD Workflow', () => {
  let adminClient: any;
  let guardianClient: any;
  let staffClient: any;
  
  let orgId: string;
  let classId: string;
  let guardianId: string;
  let staffId: string;
  let studentId: string;

  const testGuardianEmail = `guardian_${Date.now()}@test.com`;
  const testStaffEmail = `staff_${Date.now()}@test.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1. Create Users via Admin API
    const guardianRes = await adminClient.auth.admin.createUser({
      email: testGuardianEmail,
      password: testPassword,
      email_confirm: true
    });
    guardianId = guardianRes.data.user.id;

    const staffRes = await adminClient.auth.admin.createUser({
      email: testStaffEmail,
      password: testPassword,
      email_confirm: true
    });
    staffId = staffRes.data.user.id;

    // 2. Set up Org and Class via Admin
    const orgRes = await adminClient.from('organizations').insert({
      name: 'E2E Test Organization',
      slug: `e2e-org-${Date.now()}`
    }).select('id').single();
    orgId = orgRes.data.id;

    // Add Staff to Organization Members (role_level >= 30 for admin/staff)
    await adminClient.from('organization_members').insert({
      organization_id: orgId,
      user_id: staffId,
      role_level: 50
    });

    const classRes = await adminClient.from('classes').insert({
      organization_id: orgId,
      name: 'Test Class 101'
    }).select('id').single();
    classId = classRes.data.id;

    // Add staff to class_staff
    await adminClient.from('class_staff').insert({
      class_id: classId,
      trainer_id: staffId,
      role: 'head_coach'
    });

    // 3. Create Student (owned by Guardian)
    const studentRes = await adminClient.from('students').insert({
      organization_id: orgId,
      name: 'John Test Doe',
      owner_id: guardianId,
      phone: '1234567890',
      birthdate: '2010-01-01'
    }).select('id').single();
    studentId = studentRes.data.id;

    // Enroll student in class
    await adminClient.from('student_class_enrollments').insert({
      student_id: studentId,
      class_id: classId,
      status: 'active'
    });
  });

  it('should authenticate a guardian and staff to create clients', async () => {
    guardianClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const auth1 = await guardianClient.auth.signInWithPassword({ email: testGuardianEmail, password: testPassword });
    expect(auth1.error).toBeNull();

    staffClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    const auth2 = await staffClient.auth.signInWithPassword({ email: testStaffEmail, password: testPassword });
    expect(auth2.error).toBeNull();
  });

  it('should verify RLS: Guardian can read their student, but random user cannot', async () => {
    // Guardian tries to read
    const { data: s1, error: e1 } = await guardianClient.from('students').select('*').eq('id', studentId);
    expect(e1).toBeNull();
    expect(s1.length).toBe(1);

    // Create a random stranger
    const strangerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
    await strangerClient.auth.signUp({ email: `stranger_${Date.now()}@test.com`, password: 'strangerpass' });
    const { data: s2 } = await strangerClient.from('students').select('*').eq('id', studentId);
    expect(s2.length).toBe(0); // RLS Blocks
  });

  it('should register a general_registration consent via Guardian', async () => {
    const { data, error } = await guardianClient.from('consents').insert({
      student_id: studentId,
      organization_id: orgId,
      purpose: 'general_registration',
      granted: true,
      guardian_id: guardianId
    }).select('id').single();

    expect(error).toBeNull();
    expect(data.id).toBeDefined();
  });

  it('should allow Staff to log health data access via SECURITY DEFINER', async () => {
    const { data, error } = await staffClient.rpc('log_health_data_access', {
      p_student_id: studentId,
      p_reason: 'Medical Assessment Update',
      p_source: 'E2E Test',
      p_ip_address: '127.0.0.1'
    });

    expect(error).toBeNull();

    // Verify it was actually inserted (using admin client to bypass RLS)
    const logs = await adminClient.from('health_data_access_logs').select('*').eq('student_id', studentId);
    expect(logs.data.length).toBeGreaterThan(0);
  });

  it('should submit a DSR for deletion via Guardian', async () => {
    const { data, error } = await guardianClient.from('data_subject_requests').insert({
      student_id: studentId,
      request_type: 'deletion',
      reason: 'E2E test auto-deletion'
    }).select('id').single();

    expect(error).toBeNull();
    expect(data.id).toBeDefined();
  });

  it('should execute anonymization via lgpd-process-dsr and verify data loss', async () => {
    // Trigger Edge Function directly using admin client (Service Role handles internal triggering)
    const { data: fnData, error: fnError } = await adminClient.functions.invoke('lgpd-process-dsr', {
      method: 'POST'
    });

    // If you don't have Edge Functions running locally, you can fallback to testing the DB state
    // For this test we assume edge functions are serving locally or we will skip if offline.
    if (fnError && fnError.message.includes('fetch')) {
      console.warn('Edge Functions not reachable. Skipping process validation.');
      return;
    }

    // After DSR processing, check anonymization
    const studentCheck = await adminClient.from('students').select('*').eq('id', studentId).single();
    expect(studentCheck.data.name).toContain('Anonymized');
    expect(studentCheck.data.phone).toBe('00000000000');
    expect(studentCheck.data.cpf_encrypted).toBeNull();
    
    // Check if consents were wiped
    const consentsCheck = await adminClient.from('consents').select('*').eq('student_id', studentId);
    expect(consentsCheck.data.length).toBe(0);
  });
});
