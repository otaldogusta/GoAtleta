import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCorsHeaders, corsPreflight } from '../_shared/cors.ts';
import { processDeletionJobs, type DeletionJob } from '../_shared/lgpd-deletion-worker.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsPreflight(req);
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
    status, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  });
  if (req.method !== 'POST') return json(405, { code: 'INVALID_REQUEST' });
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!serviceRoleKey || token !== serviceRoleKey) return json(401, { code: 'UNAUTHORIZED' });

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: jobs, error } = await supabase.rpc('claim_lgpd_deletion_requests', { p_limit: 10 });
  if (error) return json(503, { code: 'CLAIM_FAILED' });
  const result = await processDeletionJobs((jobs ?? []) as DeletionJob[], {
    prepare: async (job) => await supabase.rpc('prepare_lgpd_student_anonymization', {
      p_request_id: job.id, p_processing_token: job.processing_token,
    }),
    removePhoto: async (objectPath) => await supabase.storage.from('student-photos').remove([objectPath]),
    finish: async (job, errorCode) => await supabase.rpc('finish_lgpd_deletion_request', {
      p_request_id: job.id, p_processing_token: job.processing_token, p_error_code: errorCode,
    }),
  });
  return json(result.failed ? 503 : 200, { status: result.failed ? 'incomplete' : 'ok', ...result });
});
