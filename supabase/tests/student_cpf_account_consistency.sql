begin;
create temporary table cpf_account_probe (cpf_hmac text, student_user_id uuid) on commit drop;
do $test$
declare definition text;
begin
 select pg_get_constraintdef(oid) into strict definition from pg_constraint
 where conrelid='public.students'::regclass and conname='students_cpf_athlete_account_excl' and convalidated;
 execute 'alter table cpf_account_probe add constraint probe_excl ' || definition;
 insert into cpf_account_probe values ('test-a','00000000-0000-0000-0000-000000000001'),('test-a','00000000-0000-0000-0000-000000000001'),('test-a',null),('test-b','00000000-0000-0000-0000-000000000002');
 begin
  insert into cpf_account_probe values ('test-a','00000000-0000-0000-0000-000000000002');
  raise exception 'FAIL: duplicate account accepted';
 exception when exclusion_violation then null;
 end;
 begin
  update cpf_account_probe set student_user_id='00000000-0000-0000-0000-000000000002' where student_user_id is null;
  raise exception 'FAIL: conflicting claim accepted';
 exception when exclusion_violation then null;
 end;
end $test$;
rollback;
