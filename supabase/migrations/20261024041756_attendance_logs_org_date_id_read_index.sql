-- Supports organization-scoped date/id keyset reads without changing row access.
-- Non-unique: multiple attendance records may share an organization and date.
-- Intentionally omit IF NOT EXISTS so a conflicting index definition fails.
-- Standard CREATE INDEX is transactional and blocks writes during construction;
-- execution on a live database requires a separately authorized maintenance plan.
create index attendance_logs_org_date_id
  on public.attendance_logs using btree (organization_id, date, id);
