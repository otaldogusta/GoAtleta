alter table public.class_plans
  add column if not exists generation_context_snapshot_json text,
  add column if not exists weekly_integrated_context_json text;
