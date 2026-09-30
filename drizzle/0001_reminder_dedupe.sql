-- FR-PUSH-07: an event reminder must be sent AT MOST ONCE.
--
-- The scheduler is expected to run repeatedly (cron, retries, overlapping invocations,
-- a redeploy mid-run). Checking "has this been sent?" in application code before
-- inserting is a race: two concurrent runs can both read "no" and both send. The only
-- reliable guard is a constraint the database enforces.
--
-- This is a PARTIAL unique index -- it applies only to reminder rows, so a single event
-- can still have any number of other notifications (a broadcast announcement that
-- happens to reference it, for example).
--
-- Written by hand because Drizzle's schema DSL cannot express a partial index predicate.
-- Insert reminders with ON CONFLICT DO NOTHING and treat "0 rows inserted" as
-- "already sent, do not send" -- decide that BEFORE dispatching to the push service.

CREATE UNIQUE INDEX IF NOT EXISTS "notification_event_reminder_once_idx"
  ON "notification" ("event_id")
  WHERE "kind" = 'event_reminder';