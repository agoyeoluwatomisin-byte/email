-- Feature 15: rules, business hours, assignment, SLA, and sender controls.
-- Run after feature-14-organizing.sql.

alter table users add column if not exists availability text not null default 'available' check (availability in ('available', 'away'));
alter table emails add column if not exists authentication_results text;
alter table emails add column if not exists first_response_at timestamptz;
alter table emails add column if not exists resolved_at timestamptz;

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table rules enable row level security;

create table if not exists business_hours (
  id uuid primary key default gen_random_uuid(),
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'Africa/Lagos',
  enabled boolean not null default true,
  unique(weekday)
);
alter table business_hours enable row level security;

create table if not exists sla_targets (
  label text primary key,
  first_response_minutes integer not null default 240,
  resolution_minutes integer not null default 1440
);
alter table sla_targets enable row level security;

create table if not exists sender_lists (
  id uuid primary key default gen_random_uuid(),
  value text not null unique,
  list_type text not null check (list_type in ('allow', 'block')),
  created_at timestamptz not null default now()
);
alter table sender_lists enable row level security;

create table if not exists mailbox_settings (
  label text primary key,
  round_robin_enabled boolean not null default false,
  next_user_id uuid references users(id),
  auto_reply_enabled boolean not null default false,
  business_hours_reply text,
  out_of_hours_reply text
);
alter table mailbox_settings enable row level security;
