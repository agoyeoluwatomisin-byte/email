-- Example only. Prefer scripts/create-user.js so passwords never appear in SQL.
insert into users (email, password_hash, display_name, active)
values ('staff@example.com', '$2b$12$PASTE_BCRYPT_HASH_HERE', 'Staff member', true)
on conflict (email) do update set
  password_hash = excluded.password_hash,
  display_name = excluded.display_name,
  active = excluded.active,
  updated_at = now();
