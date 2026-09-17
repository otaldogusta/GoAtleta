-- Admission does not require enrollment; the workspace/class FK is preserved.
alter table public.students alter column classid drop not null;

create function public.approve_family_registration(p_request_id uuid, p_idempotency_key uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r public.organization_access_requests%rowtype; sid text; student_name text;
begin
  select * into r from public.organization_access_requests where id=p_request_id;
  if auth.uid() is null or not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  perform 1 from auth.users where id=r.requester_user_id for update;
  select * into r from public.organization_access_requests where id=p_request_id for update;
  if not coalesce(public.is_org_admin(r.organization_id),false) then raise exception 'Not authorized'; end if;
  if r.request_kind not in ('athlete','guardian') or p_idempotency_key is null then raise exception 'INVALID_REQUEST'; end if;
  if r.status <> 'pending' then
    if r.status='approved' and r.review_idempotency_key=p_idempotency_key then return false; end if;
    raise exception 'Solicitação já revisada.';
  end if;
  student_name := nullif(trim(r.requested_student_name),'');
  if student_name is null then raise exception 'Informe o nome do atleta na solicitação.'; end if;
  if r.request_kind='guardian' and nullif(trim(r.requested_relationship_label),'') is null then raise exception 'Informe o parentesco na solicitação.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.organization_id::text || ':' || lower(student_name),0));
  -- A name/email match is a conflict to review, never proof of identity.
  if exists(select 1 from public.students s where s.organization_id=r.organization_id and
    (lower(trim(s.name))=lower(student_name) or (r.request_kind='athlete' and
      (s.student_user_id=r.requester_user_id or lower(s.login_email)=lower(r.requester_email))))) then
    raise exception 'Já existe um cadastro possível. Confira o vínculo antes de aprovar.';
  end if;
  sid := 's_' || gen_random_uuid()::text;
  insert into public.students(id,organization_id,name,classid) values(sid,r.organization_id,student_name,null);
  perform public.review_family_access_request(p_request_id,'approved',sid,p_idempotency_key);
  -- Only the newly created registration: never expand an existing relationship.
  update public.student_relationships set can_view_financial=true,can_pay=true
    where organization_id=r.organization_id and student_id=sid and user_id=r.requester_user_id and status='active';
  return true;
end;
$$;
revoke all on function public.approve_family_registration(uuid,uuid) from public,anon;
grant execute on function public.approve_family_registration(uuid,uuid) to authenticated;
