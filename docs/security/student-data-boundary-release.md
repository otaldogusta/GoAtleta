# Student data boundary release

This change is a two-phase, non-destructive rollout. The order matters because
older clients request every `students` column directly, while the hardened
database exposes health fields only through audited RPCs.

## Release order

1. Deploy the application commit first. It reads operational student columns
   explicitly and uses the audited health RPC, with a temporary fallback while
   the migration is not installed.
2. Confirm the web deployment and publish the compatible Expo update to every
   supported runtime before changing database grants.
3. Run the migration dry-run and record these production preconditions:
   - no student row has a null organization;
   - no primary class belongs to another organization;
   - no legacy tenant-scoped student remains;
   - the count of populated legacy health records is captured.
4. Apply `20260817143000_harden_student_data_boundaries.sql`.
5. Verify, as an authenticated admin, class staff member, unrelated member and
   student, that operational rows, health RPCs and private photos follow the
   expected least-privilege matrix.
6. Confirm that the student row count and the captured legacy health values are
   unchanged. New health edits should appear in `student_health_profiles` and
   every read/write should create a `health_data_access_logs` row.

## Compatibility and rollback gate

Do not apply the database migration while an older native client without the
explicit operational selection can still be used. If a rollback is needed,
restore the previous `students` grants and policies first, then roll back the
application. Do not delete `student_health_profiles` or legacy health columns;
they are the recovery sources and contain user data.

The migration intentionally performs no update, delete or health backfill on
`students`. Legacy health values remain available through the audited read RPC
until a separately reviewed, checksum-verified backfill is approved.
