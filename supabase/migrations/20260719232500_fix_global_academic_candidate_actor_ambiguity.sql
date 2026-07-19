-- The original replacement-candidate migration used actor_user_id both as a
-- PL/pgSQL variable and as an audit-log column. PostgreSQL therefore rejected
-- the idempotency lookup as ambiguous at runtime.
--
-- Keep the already-applied migration immutable and patch the stored function
-- definition in place. The guarded replacements make this migration fail
-- loudly if the expected function body is not present.
do $migration$
declare
  function_definition text;
  patched_definition text;
begin
  select pg_get_functiondef(
    'public.create_global_academic_candidate(uuid,jsonb,text)'::regprocedure
  )
  into function_definition;

  -- Rename every occurrence first, then restore the two real audit-log column
  -- references. This is insensitive to pg_get_functiondef indentation.
  patched_definition := replace(
    function_definition,
    'actor_user_id',
    'curator_user_id'
  );
  patched_definition := replace(
    patched_definition,
    'audit.curator_user_id',
    'audit.actor_user_id'
  );
  patched_definition := regexp_replace(
    patched_definition,
    '(interpretation_id,[[:space:]]+)curator_user_id([[:space:]]*,[[:space:]]+action)',
    E'\\1actor_user_id\\2',
    'g'
  );

  if patched_definition = function_definition
     or position('actor_user_id uuid' in patched_definition) > 0
     or position('audit.actor_user_id = actor_user_id' in patched_definition) > 0
     or position('owner_user_id <> actor_user_id' in patched_definition) > 0
     or position('audit.curator_user_id' in patched_definition) > 0 then
    raise exception 'Expected candidate-function actor references were not patched';
  end if;

  execute patched_definition;
end;
$migration$;

revoke all on function public.create_global_academic_candidate(uuid, jsonb, text)
  from public, anon;
grant execute on function public.create_global_academic_candidate(uuid, jsonb, text)
  to authenticated;
