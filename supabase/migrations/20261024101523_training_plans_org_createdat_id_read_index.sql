-- Match organization-scoped createdat/id reads, including tied timestamps.
-- B-tree backward scans support createdat DESC, id DESC under organization = X.
-- Non-unique; do not change historical rows, authorization or version semantics.
-- Fail on a conflicting relation name instead of masking another definition.
-- Standard CREATE INDEX blocks writes during construction; live execution needs
-- a separately authorized maintenance plan.
create index training_plans_org_createdat_id
  on public.training_plans using btree (organization_id, createdat, id);
