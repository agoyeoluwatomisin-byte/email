-- Feature 8: assign one staff member to a thread.
-- Run this in the Supabase SQL editor after schema.sql.

alter table emails add column if not exists claimed_by text;

create index if not exists emails_claimed_by_idx on emails (claimed_by);
create index if not exists emails_unclaimed_threads_idx on emails (thread_id) where claimed_by is null;
