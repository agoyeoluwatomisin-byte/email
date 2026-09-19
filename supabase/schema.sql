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
  attachments jsonb not null default '[]'::jsonb,
  received_at timestamptz not null default now(),
  read boolean not null default false,
  starred boolean not null default false,
  folder text not null default 'inbox' check (folder in ('inbox', 'archive', 'spam', 'drafts', 'sent'))
);

alter table emails add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table emails add column if not exists starred boolean not null default false;
alter table emails add column if not exists folder text not null default 'inbox';

update emails set folder = case when direction = 'outbound' then 'sent' else 'inbox' end where folder is null;

create index if not exists emails_thread_id_idx on emails (thread_id);
create index if not exists emails_direction_idx on emails (direction);
create index if not exists emails_received_at_idx on emails (received_at desc);
create index if not exists emails_folder_idx on emails (folder);
create index if not exists emails_starred_idx on emails (starred) where starred = true;

-- Row Level Security is enabled with no public policies. The app only ever
-- talks to this table using the Supabase SERVICE ROLE key from server-side
-- API routes, which bypasses RLS - this just makes sure nothing can read or
-- write this table from the browser using the anon/public key by mistake.
alter table emails enable row level security;
