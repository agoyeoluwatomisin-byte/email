-- Feature 10: audit activity for thread actions and replies.
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists thread_activity (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  actor_email text not null,
  activity_type text not null,
  message_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists thread_activity_thread_created_idx
  on thread_activity (thread_id, created_at desc);

alter table thread_activity enable row level security;
