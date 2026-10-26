-- Align organization-scoped athlete directory/birthday reads with name/id order.
-- Non-unique: athletes may share a name; id remains the deterministic tie-breaker.
-- Fail on a same-name relation rather than silently accepting another definition.
-- Standard CREATE INDEX is transactional and blocks writes while building;
-- any live execution requires a separately authorized maintenance plan.
create index students_org_name_id
  on public.students using btree (organization_id, name, id);
