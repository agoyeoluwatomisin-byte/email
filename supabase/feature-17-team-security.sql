-- Feature 17: roles, persistent sessions, password reset, 2FA, and audit logs.
-- Run after feature-16-contacts-insights.sql.

alter table users add column if not exists role text not null default 'agent' check (role in ('admin', 'agent'));
alter table users add column if not exists totp_secret text;
alter table users add column if not exists totp_enabled boolean not null default false;
alter table users add column if not exists recovery_codes jsonb not null default '[]'::jsonb;
update users set role = 'admin' where id = (select id from users order by created_at asc limit 1) and not exists (select 1 from users where role = 'admin');

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists user_sessions_user_idx on user_sessions(user_id, created_at desc);
alter table user_sessions enable row level security;

create table if not exists password_reset_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table password_reset_tokens enable row level security;

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created_idx on audit_log(created_at desc);
alter table audit_log enable row level security;
