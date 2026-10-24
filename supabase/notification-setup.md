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
