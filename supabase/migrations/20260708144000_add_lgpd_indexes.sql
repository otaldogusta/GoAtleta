-- Indexes for consents
create index if not exists idx_consents_student_id on public.consents (student_id);
create index if not exists idx_consents_organization_id on public.consents (organization_id);

-- Indexes for data_subject_requests
create index if not exists idx_dsr_student_id on public.data_subject_requests (student_id);
create index if not exists idx_dsr_user_id on public.data_subject_requests (user_id);
create index if not exists idx_dsr_status on public.data_subject_requests (status);

-- Indexes for health_data_access_logs
create index if not exists idx_hd_access_student_id on public.health_data_access_logs (student_id);
