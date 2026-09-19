-- Feature 2: reusable editable reply templates.
-- Run this in the Supabase SQL editor after schema.sql.

create table if not exists canned_responses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists canned_responses_title_idx on canned_responses (lower(title));

alter table canned_responses enable row level security;

-- Optional starter templates. The conflict guard keeps this migration repeatable.
insert into canned_responses (title, body)
select 'Thanks for contacting us', 'Thanks for reaching out. We have received your message and will review it shortly.'
where not exists (
  select 1 from canned_responses where title = 'Thanks for contacting us'
);

insert into canned_responses (title, body)
select 'We need more information', 'Thanks for your message. Could you please provide a few more details so we can help you properly?'
where not exists (
  select 1 from canned_responses where title = 'We need more information'
);
