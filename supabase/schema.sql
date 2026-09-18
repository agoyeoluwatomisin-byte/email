-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query)

create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  message_id text,
  in_reply_to text,
  from_address text not null,
  to_address text not null,
  subject text,
  text_body text,
  html_body text,
  received_at timestamptz not null default now(),
  read boolean not null default false
);

create index if not exists emails_thread_id_idx on emails (thread_id);
create index if not exists emails_received_at_idx on emails (received_at desc);

-- Row Level Security is enabled with no public policies. The app only ever
-- talks to this table using the Supabase SERVICE ROLE key from server-side
-- API routes, which bypasses RLS - this just makes sure nothing can read or
-- write this table from the browser using the anon/public key by mistake.
alter table emails enable row level security;
