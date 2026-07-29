-- Allow the new DRAFT value in the timesheets.status CHECK constraint.
-- Hibernate (ddl-auto=update) does NOT alter an existing enum CHECK constraint when a new
-- enum value is added, so the original constraint kept rejecting DRAFT rows. Run this once
-- against the database to widen it. Idempotent.
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_status_check;
ALTER TABLE timesheets ADD CONSTRAINT timesheets_status_check
    CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED'));
