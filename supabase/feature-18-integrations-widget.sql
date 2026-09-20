-- Feature 18: outbound integrations and per-site contact widgets.
-- Run after feature-17-team-security.sql.

create table if not exists widgets (
  id uuid primary key default gen_random_uuid(),
  widget_key text not null unique,
  name text not null,
  allowed_origins text[] not null default '{}',
  destination_label text not null default 'website',
  destination_email text not null,
  title text not null default 'Contact us',
  accent_color text not null default '#2f8fca',
  custom_fields jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table widgets enable row level security;

create table if not exists integration_settings (
  user_id uuid primary key references users(id) on delete cascade,
  webhook_url text,
  webhook_secret text,
  browser_notifications boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table integration_settings enable row level security;
