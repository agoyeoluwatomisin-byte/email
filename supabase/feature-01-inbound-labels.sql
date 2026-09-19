-- Feature 1: label inbound mail by its recipient mailbox.
-- Run this in the Supabase SQL editor after schema.sql.

alter table emails
  add column if not exists label text not null default 'other';

create index if not exists emails_label_idx on emails (label);

-- Backfill existing inbound rows from the first recipient address.
update emails
set label = case
  when lower(to_address) ~ '(^|[<,;[:space:]])sales@' then 'sales'
  when lower(to_address) ~ '(^|[<,;[:space:]])support@' then 'support'
  when lower(to_address) ~ '(^|[<,;[:space:]])billing@' then 'billing'
  when lower(to_address) ~ '(^|[<,;[:space:]])invoice@' then 'billing'
  else coalesce(
    nullif(
      regexp_replace(
        lower(regexp_replace(split_part(to_address, ',', 1), '.*<([^>]+)>.*', '\1')),
        '^.*?([a-z0-9._%+-]+)@.*$',
        '\1'
      ),
      ''
    ),
    'other'
  )
end
where direction = 'inbound';
