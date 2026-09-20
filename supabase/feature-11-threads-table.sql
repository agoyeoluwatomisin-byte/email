-- Feature 11: one authoritative state row per email thread.
-- Run after feature-10-thread-activity.sql.

create table if not exists threads (
  thread_id uuid primary key,
  status text not null default 'new' check (status in ('new', 'in progress', 'closed')),
  claimed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The state columns on emails are deprecated and retained for compatibility.
insert into threads (thread_id, status, claimed_by, created_at, updated_at)
select
  e.thread_id,
  coalesce(latest.status, 'new'),
  claimed.claimed_by,
  min(e.received_at),
  max(e.received_at)
from emails e
left join lateral (
  select status
  from emails
  where thread_id = e.thread_id
  order by received_at desc
  limit 1
) latest on true
left join lateral (
  select claimed_by
  from emails
  where thread_id = e.thread_id and claimed_by is not null
  order by received_at desc
  limit 1
) claimed on true
group by e.thread_id, latest.status, claimed.claimed_by
on conflict (thread_id) do update set
  status = excluded.status,
  claimed_by = excluded.claimed_by,
  updated_at = excluded.updated_at;

create index if not exists threads_status_idx on threads (status);
create index if not exists threads_claimed_by_idx on threads (claimed_by);
alter table threads enable row level security;
