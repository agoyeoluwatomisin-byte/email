-- Feature 7: thread status for the existing thread_id-based data model.
-- Run this in the Supabase SQL editor after schema.sql.
-- Status is copied to every email row in a thread so existing thread queries remain compatible.

alter table emails
  add column if not exists status text not null default 'new';

alter table emails
  drop constraint if exists emails_status_check;

alter table emails
  add constraint emails_status_check check (status in ('new', 'in progress', 'closed'));

create index if not exists emails_thread_status_idx on emails (thread_id, status);
