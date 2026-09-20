-- Feature 19: weekly report configuration.
-- Run after feature-18-integrations-widget.sql.

create table if not exists report_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  recipient_emails text[] not null default '{}',
  weekday integer not null default 1 check (weekday between 0 and 6),
  hour integer not null default 9 check (hour between 0 and 23),
  updated_at timestamptz not null default now()
);
alter table report_settings enable row level security;
alter table report_settings add column if not exists last_sent_at timestamptz;
