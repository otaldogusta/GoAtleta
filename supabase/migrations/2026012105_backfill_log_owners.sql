-- Backfill missing owner_id values for legacy logs after RLS enablement.

update public.classes c
set owner_id = u.owner_id
from public.units u
where c.owner_id is null
  and c.unit_id = u.id
  and u.owner_id is not null;

update public.session_logs sl
set owner_id = c.owner_id
from public.classes c
where sl.owner_id is null
  and sl.classid = c.id
  and c.owner_id is not null;

update public.attendance_logs al
set owner_id = c.owner_id
from public.classes c
where al.owner_id is null
  and al.classid = c.id
  and c.owner_id is not null;

update public.scouting_logs sc
set owner_id = c.owner_id
from public.classes c
where sc.owner_id is null
  and sc.classid = c.id
  and c.owner_id is not null;
