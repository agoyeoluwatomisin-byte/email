-- Feature 21: push notification device tokens (FCM).
-- Run after feature-20-away-replies.sql.

create table if not exists device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on device_tokens(user_id);

alter table device_tokens enable row level security;