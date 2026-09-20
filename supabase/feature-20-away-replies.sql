-- Feature 20: personal away/auto-reply message.
-- Run after feature-19-weekly-reports.sql.
-- `availability` ('available' | 'away') already exists on users (feature-15).
-- This adds the message that goes out automatically while someone is away.

alter table users add column if not exists away_message text;