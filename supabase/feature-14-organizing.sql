-- Feature 14: notes, mentions, tags, snooze, saved views, search, and trash.
-- Run after feature-13-compose-and-delivery.sql.

alter table emails add column if not exists deleted_at timestamptz;
alter table emails drop constraint if exists emails_folder_check;
alter table emails add constraint emails_folder_check check (folder in ('inbox', 'archive', 'spam', 'drafts', 'sent', 'trash'));
create index if not exists emails_deleted_at_idx on emails (deleted_at) where deleted_at is not null;

alter table threads add column if not exists snoozed_until timestamptz;
create index if not exists threads_snoozed_until_idx on threads (snoozed_until) where snoozed_until is not null;

alter table emails add column if not exists search_vector tsvector;
update emails set search_vector = to_tsvector('simple', coalesce(subject, '') || ' ' || coalesce(text_body, '') || ' ' || coalesce(from_address, '')) where search_vector is null;
create index if not exists emails_search_vector_idx on emails using gin (search_vector);
create or replace function emails_search_vector_update() returns trigger language plpgsql as $$
begin
  new.search_vector := to_tsvector('simple', coalesce(new.subject, '') || ' ' || coalesce(new.text_body, '') || ' ' || coalesce(new.from_address, ''));
  return new;
end;
$$;
drop trigger if exists emails_search_vector_trigger on emails;
create trigger emails_search_vector_trigger before insert or update of subject, text_body, from_address on emails for each row execute function emails_search_vector_update();

create table if not exists thread_notes (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(thread_id) on delete cascade,
  author_id uuid not null references users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists thread_notes_thread_idx on thread_notes(thread_id, created_at desc);
alter table thread_notes enable row level security;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid references threads(thread_id) on delete cascade,
  kind text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications(user_id, created_at desc);
alter table notifications enable row level security;

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#38bdf8',
  created_at timestamptz not null default now()
);
alter table tags enable row level security;

create table if not exists thread_tags (
  thread_id uuid not null references threads(thread_id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(thread_id, tag_id)
);
alter table thread_tags enable row level security;

create table if not exists saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_views_user_idx on saved_views(user_id, name);
alter table saved_views enable row level security;
