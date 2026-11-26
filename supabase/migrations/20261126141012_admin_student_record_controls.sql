create or replace function public.admin_delete_student_records(p_student_id uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_deleted integer;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role access required.';
  end if;
  if p_student_id is not null and not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Student record not found.';
  end if;
  if exists (
    select 1 from public.students s
    where (p_student_id is null or s.id = p_student_id)
      and (
        s.profile_id is not null
        or exists (select 1 from public.enrollments e where e.student_id = s.id)
        or exists (select 1 from public.attendance a where a.student_id = s.id)
        or exists (select 1 from public.assessments a where a.student_id = s.id)
        or exists (select 1 from public.payments p where p.student_id = s.id)
      )
  ) then
    raise exception 'Deletion blocked: at least one selected student has a linked portal login or academic/financial history. Delete the login first where appropriate, or deactivate the student to preserve history.';
  end if;
  delete from public.students where p_student_id is null or id = p_student_id;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.admin_delete_student_records(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_student_records(uuid) to service_role;
