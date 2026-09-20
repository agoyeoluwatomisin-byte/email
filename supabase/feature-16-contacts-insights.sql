-- Feature 16: contacts, CSAT, and report settings.
-- Run after feature-15-automation.sql.

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  company text,
  phone text,
  notes text,
  vip boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contacts_email_idx on contacts(lower(email));
alter table contacts enable row level security;
alter table emails add column if not exists contact_id uuid references contacts(id) on delete set null;

create table if not exists csat_responses (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(thread_id) on delete cascade,
  contact_email text not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique(thread_id, contact_email)
);
alter table csat_responses enable row level security;

create table if not exists report_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  recipient_emails text[] not null default '{}',
  weekday integer not null default 1,
  hour integer not null default 9,
  updated_at timestamptz not null default now()
);
alter table report_settings enable row level security;
