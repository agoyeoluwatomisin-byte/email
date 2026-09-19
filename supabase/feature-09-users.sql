-- Feature 9: multiple staff users with bcrypt password hashes.
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on users (lower(email));
alter table users enable row level security;

-- Generate a hash locally, then insert a staff user:
-- node -e "console.log(require('bcryptjs').hashSync('replace-with-password', 12))"
-- insert into users (email, password_hash, display_name)
-- values ('staff@example.com', '$2b$12$PASTE_BCRYPT_HASH_HERE', 'Staff member');
