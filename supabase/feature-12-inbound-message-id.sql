-- Feature 12: prevent duplicate inbound webhook deliveries.
-- Run after feature-11-threads-table.sql.

create unique index if not exists emails_inbound_message_id_uidx
  on emails (message_id)
  where message_id is not null and direction = 'inbound';
