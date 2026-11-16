update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'image/jxl')
where id = 'profile-photos'
  and allowed_mime_types is not null
  and not ('image/jxl' = any(allowed_mime_types));
