-- Supabase projects may grant EXECUTE to the API roles through default
-- privileges. These helpers are only used from authenticated RLS policies.
revoke execute on function public.owns_student(text) from anon;
revoke execute on function public.owns_workout(text) from anon;
revoke execute on function public.owns_execution_log(text) from anon;
revoke execute on function public.log_health_data_access(text, text, text, text, jsonb) from anon;

grant execute on function public.owns_student(text) to authenticated;
grant execute on function public.owns_workout(text) to authenticated;
grant execute on function public.owns_execution_log(text) to authenticated;
grant execute on function public.log_health_data_access(text, text, text, text, jsonb) to authenticated;
