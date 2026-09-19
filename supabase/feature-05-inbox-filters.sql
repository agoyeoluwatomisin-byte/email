-- Feature 5: indexed inbox filtering by sender domain, date, and read state.
-- Run this in the Supabase SQL editor after schema.sql.

alter table emails add column if not exists sender_domain text;

update emails
set sender_domain = lower(
  regexp_replace(
    split_part(regexp_replace(from_address, '.*<([^>]+)>.*', '\1'), ',', 1),
    '.*@([^[:space:]>]+).*',
    '\1'
  )
)
where sender_domain is null and direction = 'inbound';

create index if not exists emails_sender_domain_idx on emails (sender_domain);
create index if not exists emails_inbound_received_at_idx on emails (direction, received_at desc);
create index if not exists emails_inbound_read_received_at_idx on emails (direction, read, received_at desc);
