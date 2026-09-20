# Agosoft Email Inbox

An internal email inbox and outbound sender. Staff use the Next.js 14 pages-router app to send and manage messages; Supabase stores users, messages, attachments, and thread state; Resend sends notifications and staff mail; and a Cloudflare Email Worker receives inbound mail and forwards a parsed payload to `/api/inbound`.

## Setup

```bash
npm install
npm run dev
```

Apply these SQL files in order in the Supabase SQL editor:

1. `supabase/schema.sql`
2. `supabase/feature-01-inbound-labels.sql`
3. `supabase/feature-02-canned-responses.sql`
4. `supabase/feature-04-attachment-storage.sql`
5. `supabase/feature-05-inbox-filters.sql`
6. `supabase/feature-07-thread-status.sql`
7. `supabase/feature-08-thread-claims.sql`
8. `supabase/feature-09-users.sql`
9. `supabase/feature-10-thread-activity.sql`
10. `supabase/feature-11-threads-table.sql`
11. `supabase/feature-12-inbound-message-id.sql`
12. `supabase/feature-13-compose-and-delivery.sql`
13. `supabase/feature-14-organizing.sql`
14. `supabase/feature-15-automation.sql`
15. `supabase/feature-16-contacts-insights.sql`
16. `supabase/feature-17-team-security.sql`
17. `supabase/feature-18-integrations-widget.sql`
18. `supabase/feature-19-weekly-reports.sql`

The deployed database must have these migrations applied as well as the app code. In particular, `feature-14-organizing.sql` creates `notifications` and adds the email trash/search columns. The APIs include compatibility fallbacks for older schemas, but applying the migrations is required for the full feature set.

Do not run `feature-09-admin-user.example.sql` unchanged. It is a template only.

## Environment

Put these values in `.env.local`:

| Variable                          | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `SUPABASE_URL`                    | Supabase project URL.                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`       | Server-only Supabase service-role key; never expose it to the browser. |
| `SESSION_SECRET`                  | Secret used to sign seven-day staff session cookies.                   |
| `RESEND_API_KEY`                  | Resend API key.                                                        |
| `RESEND_FROM_ADDRESS`             | Verified Resend sender address, optionally in `Name <address>` form.   |
| `INBOUND_SHARED_SECRET`           | Secret accepted by `/api/inbound` from the worker.                     |
| `INBOUND_NOTIFICATION_EMAIL`      | Optional address that receives a short inbound notification.           |
| `SUPABASE_ATTACHMENTS_BUCKET`     | Optional private Storage bucket name; defaults to `email-attachments`. |
| `ALLOWED_RECIPIENTS`              | Optional comma-separated recipient allow-list for staff sends.         |
| `CONTACT_WIDGET_TO_EMAIL`         | Destination for contact-widget notifications.                          |
| `CONTACT_WIDGET_ALLOWED_ORIGINS`  | Comma-separated browser origins allowed to submit the widget.          |
| `CONTACT_WIDGET_ALLOW_ANY_ORIGIN` | Must be `true` to make `*` in the origin list effective.               |

Create the first staff user with the service-role key in `.env.local`:

```bash
node scripts/create-user.js staff@example.com 'use-a-strong-password' 'Staff member'
```

The script hashes passwords with bcrypt cost 12 and upserts the user.

## Cloudflare Worker

Set these Worker secrets from `cloudflare-worker/`:

| Secret                     | Purpose                                                                  |
| -------------------------- | ------------------------------------------------------------------------ |
| `INBOUND_WEBHOOK_URL`      | Full app URL ending in `/api/inbound`.                                   |
| `INBOUND_SHARED_SECRET`    | Must match the app variable with the same purpose.                       |
| `FALLBACK_FORWARD_ADDRESS` | Optional address to forward mail to after three failed webhook attempts. |

Deploy with:

```bash
cd cloudflare-worker
npm install
npx wrangler secret put INBOUND_WEBHOOK_URL
npx wrangler secret put INBOUND_SHARED_SECRET
npx wrangler secret put FALLBACK_FORWARD_ADDRESS
npx wrangler deploy
```

Configure the Cloudflare Email Routing rule to send inbound mail to this Worker.

Scheduled sends and weekly reports remain available through the protected task endpoints. Configure an external scheduler to call `/api/cron/send-scheduled` and `/api/cron/weekly-report` with `Authorization: Bearer $SCHEDULED_TASK_SECRET`, then configure report recipients under Settings.

## Security notes

- Protected API routes require a signed cookie and an active row in `users`; deactivating a user immediately invalidates access.
- Inbound delivery uses a shared secret with a timing-safe comparison and has an idempotency index on inbound Message-IDs.
- Supabase service-role access is server-side only, and RLS is enabled on application tables.
- Attachment responses use `nosniff`, a sandbox CSP, safe inline MIME types, and RFC 5987 filenames.
- Login and public widget endpoints use the shared Upstash limiter when configured, with a bounded in-memory fallback that resets on deploy and is not shared across instances.

## What's new

1. Per-user compose and reply drafts autosave to Supabase; Drafts has deletion.
2. Sends support a 10-second undo window and scheduled delivery through the protected cron route.
3. Replies support CC/BCC, reply-all, forwarding mode, and threading headers.
4. Rich compose/reply HTML, plain-text alternatives, and per-user signatures are supported.
5. Canned responses have CRUD management, categories, and variable substitution.
6. Attachments upload to private Storage with size and extension checks and preview-safe serving.
7. Resend webhook events are stored and exposed as outbound delivery status.
8. Threads support private notes and @mentions.
9. Mentions create protected in-app notifications with unread counts.
10. Colored tags and thread-tag APIs are available.
11. Threads can be snoozed and awakened by cron.
12. Search uses a Postgres tsvector/GIN index; saved-view APIs are included.
13. Thread merge and message split APIs write activity records.
14. Deletes are soft-trash operations with restore, empty-trash, and 30-day purge.
15. Inbound rules support matching and actions, with tested pure matching logic.
16. Optional first-message acknowledgements avoid no-reply/bulk loops.
17. Mailbox round-robin assignment supports available/away staff state.
18. SLA targets and tested countdown/business-hour helpers are available.
19. Sender allow/block controls and authentication-result forwarding are implemented.
20. Contacts are created from inbound mail and have history, editing, VIP, and export support.
21. Closed threads can send signed one-click CSAT invitations.
22. Analytics API returns volume, labels, agent counts, and CSAT averages.
23. Authenticated CSV and ZIP/EML exports are available.
24. Admin-only roles and user management are enforced server-side.
25. Password change/reset, persistent sessions, optional TOTP, recovery codes, and session revocation are included.
26. Admin audit-log API records security and user-management actions.
27. Health checks, security headers, CI, optional Sentry hook, and Upstash-compatible limiting are included.
28. Inbox polling fallback, browser notification permission, and outbound webhook integration are included.
29. Keyboard shortcuts, Ctrl/Cmd+K navigation, offline state, and responsive existing inbox behavior are included.
30. Contact Widget v2 supports site configs, Turnstile, optional attachments, origin controls, and success/failure responses.

## Complete environment table

| Variable                          | Used for                                             |
| --------------------------------- | ---------------------------------------------------- |
| `SUPABASE_URL`                    | Supabase project URL.                                |
| `SUPABASE_SERVICE_ROLE_KEY`       | Server-only Supabase service-role key.               |
| `SESSION_SECRET`                  | Cookie, CSAT, and reset-token signing.               |
| `RESEND_API_KEY`                  | Resend delivery.                                     |
| `RESEND_FROM_ADDRESS`             | Verified sender address.                             |
| `RESEND_WEBHOOK_SECRET`           | Svix/Resend webhook signature verification.          |
| `INBOUND_SHARED_SECRET`           | Worker to `/api/inbound` authentication.             |
| `INBOUND_NOTIFICATION_EMAIL`      | Optional inbound notification recipient.             |
| `SUPABASE_ATTACHMENTS_BUCKET`     | Private Storage bucket name.                         |
| `ALLOWED_RECIPIENTS`              | Optional staff-recipient allow list.                 |
| `CONTACT_WIDGET_TO_EMAIL`         | Default widget destination.                          |
| `CONTACT_WIDGET_ALLOWED_ORIGINS`  | Default widget CORS origins.                         |
| `CONTACT_WIDGET_ALLOW_ANY_ORIGIN` | Explicitly enables `*` origin entries.               |
| `TURNSTILE_SECRET_KEY`            | Optional Cloudflare Turnstile verification.          |
| `SCHEDULED_TASK_SECRET`           | Authentication for external scheduled-task requests. |
| `APP_URL`                         | Absolute links for reset and CSAT pages.             |
| `CSAT_ENABLED`                    | Enables close-thread survey invitations.             |
| `UPSTASH_REDIS_REST_URL`          | Optional shared rate limiter endpoint.               |
| `UPSTASH_REDIS_REST_TOKEN`        | Optional shared rate limiter token.                  |
| `SENTRY_DSN`                      | Optional structured error reporting destination.     |
| `OUTBOUND_WEBHOOK_URL`            | Optional inbound event webhook destination.          |
| `OUTBOUND_WEBHOOK_SECRET`         | Optional HMAC secret for that webhook.               |

Worker secrets in addition to the application variables:

| Secret                     | Used for                              |
| -------------------------- | ------------------------------------- |
| `INBOUND_WEBHOOK_URL`      | Full deployed `/api/inbound` URL.     |
| `INBOUND_SHARED_SECRET`    | Must match the application secret.    |
| `FALLBACK_FORWARD_ADDRESS` | Optional failure-forward destination. |

## Simplifications and follow-up

- Supabase Realtime is represented by a 15-second polling fallback; enable Realtime later if live channel credentials and policies are required.
- The settings page covers signatures and canned responses; rules, tags, SLA, sender-list, widget, and integration APIs are ready but do not yet have dedicated management forms.
- Analytics is an API foundation rather than the full inline chart dashboard, and report scheduling is not surfaced in the UI.
- Rich text uses the browser editing commands instead of a third-party editor; forwarding preserves quoted text but does not yet re-upload every original attachment automatically.
- The CSAT invitation is optional and requires `CSAT_ENABLED=true`; the public page accepts signed links only.
- Production rate limiting uses Upstash when configured and a bounded local fallback otherwise.
