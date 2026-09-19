-- Feature 4: store inbound attachments in Supabase Storage instead of email rows.
-- Run this in the Supabase SQL editor after schema.sql.

insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do update set public = excluded.public;

-- The application uses the Supabase service-role key server-side, so no public
-- object policy is needed. Keep this bucket private and serve files through
-- pages/api/emails/[id]/attachment.js.
