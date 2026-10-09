-- Additive self-service RPC. No table grants/policies or historical rows change.
create or replace function private.save_my_student_profile(p_student_id text, p_profile jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  student public.students%rowtype;
  next_student public.students%rowtype;
  field text; value jsonb;
  allowed text[] := array['name','birthdate','phone','cpf_input','rg','address','gender_identity',
    'guardian_name','guardian_phone','guardian_relation','position_primary','position_secondary',
    'health_issue','health_issue_notes','medication_use','medication_notes','health_observations'];
begin
  if actor is null or not exists (
    select 1 from auth.users where id=actor and not coalesce(is_anonymous,false)
      and (nullif(trim(raw_app_meta_data->>'email_verified_hybrid_at'),'') is not null
        or raw_app_meta_data->>'provider' in ('google','apple','facebook')
        or coalesce(raw_app_meta_data->'providers','[]'::jsonb) ?| array['google','apple','facebook'])
  ) then raise exception 'STUDENT_SELF_ACCESS_DENIED' using errcode='42501'; end if;

  select * into student from public.students where id=p_student_id
    and student_user_id=actor and organization_id is not null
    and membership_status='active' and student_access_revoked_at is null for update;
  if not found then raise exception 'STUDENT_SELF_ACCESS_DENIED' using errcode='42501'; end if;
  if p_profile is null or jsonb_typeof(p_profile)<>'object' or p_profile='{}'::jsonb then
    raise exception 'INVALID_SELF_PROFILE' using errcode='22023';
  end if;
  for field,value in select * from jsonb_each(p_profile) loop
    if not field=any(allowed) then raise exception 'SELF_PROFILE_FIELD_DENIED' using errcode='42501'; end if;
    if field in ('health_issue','medication_use') then
      if jsonb_typeof(value)<>'boolean' then raise exception 'INVALID_SELF_PROFILE' using errcode='22023'; end if;
    elsif jsonb_typeof(value)<>'string' or length(value #>> '{}')>2000 then
      raise exception 'INVALID_SELF_PROFILE' using errcode='22023';
    end if;
  end loop;
  next_student := jsonb_populate_record(student,p_profile);
  if length(trim(next_student.name)) not between 2 and 160
    or next_student.birthdate is null or next_student.birthdate>current_date
    or next_student.birthdate<current_date-interval '120 years'
    or (coalesce(next_student.phone,'')<>'' and next_student.phone !~ '^[0-9]{8,15}$')
    or next_student.position_primary not in ('indefinido','levantador','oposto','ponteiro','central','libero')
    or next_student.position_secondary not in ('indefinido','levantador','oposto','ponteiro','central','libero')
    or (p_profile ? 'cpf_input' and next_student.cpf_input !~ '^[0-9]{11}$') then
    raise exception 'INVALID_SELF_PROFILE' using errcode='22023';
  end if;
  -- Existing document triggers retain CPF encryption, uniqueness and RG normalization.
  update public.students set
    name=trim(next_student.name), birthdate=next_student.birthdate,
    age=extract(year from age(current_date,next_student.birthdate)), phone=next_student.phone,
    cpf_input=case when p_profile ? 'cpf_input' then next_student.cpf_input else null end,
    rg=next_student.rg, address=next_student.address, gender_identity=next_student.gender_identity,
    guardian_name=next_student.guardian_name, guardian_phone=next_student.guardian_phone,
    guardian_relation=next_student.guardian_relation,
    position_primary=next_student.position_primary, position_secondary=next_student.position_secondary,
    health_issue=next_student.health_issue,
    health_issue_notes=case when next_student.health_issue then next_student.health_issue_notes else null end,
    medication_use=next_student.medication_use,
    medication_notes=case when next_student.medication_use then next_student.medication_notes else null end,
    health_observations=next_student.health_observations
  where id=student.id and student_user_id=actor;
  if not found then raise exception 'STUDENT_SELF_ACCESS_DENIED' using errcode='42501'; end if;
  return jsonb_build_object('student_id',student.id,'organization_id',student.organization_id);
end;
$$;
revoke all on function private.save_my_student_profile(text,jsonb) from public,anon,authenticated;
grant execute on function private.save_my_student_profile(text,jsonb) to authenticated;

create or replace function public.save_my_student_profile(p_student_id text,p_profile jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.save_my_student_profile(p_student_id,p_profile);
$$;
revoke all on function public.save_my_student_profile(text,jsonb) from public,anon,authenticated;
grant execute on function public.save_my_student_profile(text,jsonb) to authenticated;
