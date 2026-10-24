# HAMIYA order notification deployment

The Supabase project `lhdsodqeojxogcwgyjpo` now has the tables `hamiya_admin_notifications`, `hamiya_notification_reads`, and `hamiya_notification_deliveries` plus an order submission trigger.

The admin notification bell is implemented in `src/Admin.tsx`.

## Remaining integration steps

1. Configure a verified transactional email provider for `yenedeen@gmail.com` (server-side secrets only).
2. Create a Telegram bot using BotFather; securely bind its destination chat ID and store the bot token server-side.
3. Deploy an authenticated background worker that processes `hamiya_notification_deliveries`, sends via the configured providers, records delivery receipts, and retries transient errors with backoff.
4. Configure scheduled worker invocation and test with a real authorized customer order.
5. Verify Vercel production deployment under the `mahirtwin-8946` team; current linked Vercel accounts have no access.

Do not place credentials in frontend environment variables, browser storage, or this repository.

## October 2026: Telegram operations

- Database notification event types: `order_submitted`, `customer_verification`, `payment_evidence`, `low_inventory`, `critical_system`.
- Admin controls: Administration → Settings → Telegram Bot Control.
- Delivery worker: `supabase/functions/hamiya-telegram-deliver/index.ts` (deployed to Supabase).
- PostgreSQL cron: `hamiya-telegram-delivery`, every minute. It safely skips execution until a matching shared secret exists in **both** Supabase Edge Function secrets (`HAMIYA_WORKER_SECRET`) and Supabase Vault (`hamiya_worker_secret`). Generate one cryptographically random secret of at least 32 characters, store it in both locations. Never commit it to Git.
- Vault example (run in trusted Supabase SQL editor, replacing the placeholder locally): `select vault.create_secret('<secure-random-value>', 'hamiya_worker_secret');`.
- Do not enable a public unauthenticated worker endpoint or expose the service-role key.
- Customer verification and low inventory triggers are active. Payment evidence and critical system event producers are not yet connected to real workflows.
- SQL transactional queue test passed (rolled back; no fake order inserted). Full Telegram delivery test through cron and Vercel production build remain unverified until shared-secret configuration and project access.
