-- Feature 13: drafts, signatures, scheduled mail, attachment metadata, and delivery events.
-- Run after feature-12-inbound-message-id.sql.

alter table canned_responses add column if not exists category text not null default 'General';

create table if not exists email_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid,
  kind text not null default 'compose' check (kind in ('compose', 'reply', 'forward')),
  to_address text not null default '',
  cc text not null default '',
  bcc text not null default '',
  reply_to text not null default '',
  subject text not null default '',
  text_body text not null default '',
  html_body text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique(user_id, id)
);
create index if not exists email_drafts_user_updated_idx on email_drafts (user_id, updated_at desc);
alter table email_drafts enable row level security;

create table if not exists user_signatures (
  user_id uuid primary key references users(id) on delete cascade,
  signature_html text not null default '',
  signature_text text not null default '',
  updated_at timestamptz not null default now()
);
alter table user_signatures enable row level security;

create table if not exists scheduled_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  payload jsonb not null,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists scheduled_emails_pending_idx on scheduled_emails (scheduled_at) where status = 'pending';
alter table scheduled_emails enable row level security;

create table if not exists stored_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  bucket text not null,
  path text not null unique,
  filename text not null,
  content_type text not null,
  size integer not null,
  created_at timestamptz not null default now()
);
create index if not exists stored_attachments_user_idx on stored_attachments (user_id, created_at desc);
alter table stored_attachments enable row level security;

create table if not exists email_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid references emails(id) on delete set null,
  message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  unique(event_type, message_id, occurred_at)
);
create index if not exists email_events_message_idx on email_events (message_id, occurred_at desc);
alter table email_events enable row level security;
