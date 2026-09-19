-- Create the initial Supabase-authenticated staff login.
-- Run feature-09-users.sql first, then run this file in Supabase SQL Editor.
-- The password is stored only as a bcrypt hash.

insert into users (email, password_hash, display_name, active)
values (
  'agosoft@agosoft.com.ng',
  '$2b$12$JZxxn0FI1SJ.QN25BVpwQO8zM0e9sZEogu1UOLWc2lipZuBl71WG2',
  'Agosoft Admin',
  true
)
on conflict (email) do update set
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  active = excluded.active,
  updated_at = now();
