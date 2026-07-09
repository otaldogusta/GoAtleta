import { buildCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


const makeJsonHeaders = (req: Request) => ({ ...buildCorsHeaders(req), "Content-Type": "application/json" });

const createError = (req: Request, status: number, code: string, error: string) =>
  new Response(JSON.stringify({ code, error }), { status, headers: makeJsonHeaders(req) });

// This edge function is meant to be called securely either via a backend cron 
// or an authenticated admin request. We enforce a service role or a specific shared secret if called via cron.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsPreflight(req);
  }
  if (req.method !== "POST") {
    return createError(req, 405, "INVALID_REQUEST", "Method not allowed");
  }

  // We require the Authorization header to be the service_role key or an admin token.
  // For simplicity and automation, we'll validate the service role key.
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  
  if (!token || token !== serviceRoleKey) {
    return createError(req, 401, "UNAUTHORIZED", "Unauthorized request");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Fetch pending deletion requests
  const { data: pendingRequests, error: reqError } = await supabase
    .from("data_subject_requests")
    .select("id")
    .eq("status", "pending")
    .eq("request_type", "deletion")
    .limit(10); // Batch process

  if (reqError) {
    return createError(req, 500, "SERVER_ERROR", "Failed to fetch pending requests");
  }

  if (!pendingRequests || pendingRequests.length === 0) {
    return new Response(JSON.stringify({ status: "ok", processed: 0 }), { headers: makeJsonHeaders(req) });
  }

  // Lock requests by transitioning status to 'processing'
  const requestIds = pendingRequests.map(r => r.id);
  const { data: processingRequests, error: lockError } = await supabase
    .from("data_subject_requests")
    .update({ status: "processing" })
    .in("id", requestIds)
    .eq("status", "pending")
    .select("*");

  if (lockError || !processingRequests || processingRequests.length === 0) {
    return new Response(JSON.stringify({ status: "ok", processed: 0, note: "No requests locked" }), { headers: makeJsonHeaders(req) });
  }

  let processedCount = 0;

  for (const dsr of processingRequests) {
    const studentId = dsr.student_id;
    if (!studentId) {
      // Mark as rejected if no student ID is provided
      await supabase.from("data_subject_requests").update({ status: "rejected", reason: "Missing student_id" }).eq("id", dsr.id);
      continue;
    }

    try {
      // Step 1: Anonymize the student's personal data
      // We overwrite identifiable data but keep the row for referential integrity (statistics)
      // Fetch student to get the photo URL before anonymization
      const { data: student } = await supabase.from("students").select("student_photo").eq("id", studentId).single();

      const anonymousId = crypto.randomUUID();
      const anonymizedData = {
        name: `Anonymized User ${anonymousId.substring(0, 8)}`,
        phone: "00000000000",
        login_email: null,
        student_user_id: null,
        student_photo: null, // Clear photo
        cpf_encrypted: null, // Clear encrypted CPF
        student_cpf_masked_hmac: null, // Clear HMAC
        birthdate: null,
        health_issue: false,
        health_issue_notes: null,
        medication_use: false,
        medication_notes: null,
        health_observations: null
      };

      const { error: studentUpdateError } = await supabase
        .from("students")
        .update(anonymizedData)
        .eq("id", studentId);

      if (studentUpdateError) throw studentUpdateError;

      // Step 2: Anonymize related identifiable fields in other tables
      await supabase.from("student_scouting_logs").update({ general_notes: '[Anonymizado]' }).eq("student_id", studentId);
      
      // Step 3: Remove consents as they are no longer applicable
      await supabase.from("consents").delete().eq("student_id", studentId);

      // Step 4: Delete actual photos from storage bucket
      if (student?.student_photo) {
        try {
          const photoUrlStr = student.student_photo;
          // Look for 'student-photos/' and extract everything after it
          const marker = 'student-photos/';
          const markerIdx = photoUrlStr.indexOf(marker);
          if (markerIdx !== -1) {
            let objectPath = photoUrlStr.substring(markerIdx + marker.length);
            // Remove any query params (e.g. ?t=123)
            if (objectPath.includes('?')) {
              objectPath = objectPath.split('?')[0];
            }
            if (objectPath) {
              await supabase.storage.from('student-photos').remove([objectPath]);
            }
          }
        } catch (e) {
          console.warn('Failed to parse or delete photo', e);
        }
      }

      // Step 5: Mark DSR as completed
      await supabase
        .from("data_subject_requests")
        .update({ 
          status: "completed", 
          processed_at: new Date().toISOString(),
          reason: "Anonymization applied successfully"
        })
        .eq("id", dsr.id);

      processedCount++;
    } catch (err) {
      console.error(`Failed to process DSR ${dsr.id}:`, err);
      // We don't mark as rejected, we leave it pending for manual intervention or next retry
    }
  }

  return new Response(JSON.stringify({ status: "ok", processed: processedCount }), {
    headers: makeJsonHeaders(req),
  });
});
