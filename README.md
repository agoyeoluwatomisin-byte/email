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

Do not run `feature-09-admin-user.example.sql` unchanged. It is a template only.

## Environment

Put these values in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key; never expose it to the browser. |
| `SESSION_SECRET` | Secret used to sign seven-day staff session cookies. |
| `RESEND_API_KEY` | Resend API key. |
| `RESEND_FROM_ADDRESS` | Verified Resend sender address, optionally in `Name <address>` form. |
| `INBOUND_SHARED_SECRET` | Secret accepted by `/api/inbound` from the worker. |
| `INBOUND_NOTIFICATION_EMAIL` | Optional address that receives a short inbound notification. |
| `SUPABASE_ATTACHMENTS_BUCKET` | Optional private Storage bucket name; defaults to `email-attachments`. |
| `ALLOWED_RECIPIENTS` | Optional comma-separated recipient allow-list for staff sends. |
| `CONTACT_WIDGET_TO_EMAIL` | Destination for contact-widget notifications. |
| `CONTACT_WIDGET_ALLOWED_ORIGINS` | Comma-separated browser origins allowed to submit the widget. |
| `CONTACT_WIDGET_ALLOW_ANY_ORIGIN` | Must be `true` to make `*` in the origin list effective. |

Create the first staff user with the service-role key in `.env.local`:

```bash
node scripts/create-user.js staff@example.com 'use-a-strong-password' 'Staff member'
```

The script hashes passwords with bcrypt cost 12 and upserts the user.

## Cloudflare Worker

Set these Worker secrets from `cloudflare-worker/`:

| Secret | Purpose |
| --- | --- |
| `INBOUND_WEBHOOK_URL` | Full app URL ending in `/api/inbound`. |
| `INBOUND_SHARED_SECRET` | Must match the app variable with the same purpose. |
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

## Security notes

- Protected API routes require a signed cookie and an active row in `users`; deactivating a user immediately invalidates access.
- Inbound delivery uses a shared secret with a timing-safe comparison and has an idempotency index on inbound Message-IDs.
- Supabase service-role access is server-side only, and RLS is enabled on application tables.
- Attachment responses use `nosniff`, a sandbox CSP, safe inline MIME types, and RFC 5987 filenames.
- Login and public widget endpoints use best-effort in-memory rate limits. These reset on deploy and are not shared across instances; use a shared rate limiter for a multi-instance production deployment.
