alter table public.classes
  add column if not exists training_space text;

comment on column public.classes.training_space is
  'Court or internal space used by the class for schedule conflict detection.';

notify pgrst, 'reload schema';
