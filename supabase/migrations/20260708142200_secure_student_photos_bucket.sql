-- Change bucket to private
update storage.buckets
set public = false
where id = 'student-photos';

drop policy if exists "student_photos public read" on storage.objects;

-- Create secure read policy using existing access control logic
create policy "student_photos secure read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-photos'
  and public.can_manage_student_photo_object(name)
);
