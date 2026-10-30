# HAMIYA branded email templates

These are email-safe HTML source templates, **not live Supabase configuration**.

## Activation

1. Upload the official HAMIYA Food Processing logo to a public HTTPS asset host (e.g. public Supabase Storage bucket with appropriate permissions). Replace `REPLACE_WITH_PUBLIC_HTTPS_HAMIYA_LOGO_URL` in each HTML file with that URL.
2. In Supabase Dashboard > Authentication > Email Templates, copy the corresponding Auth HTML for Confirm signup, Reset password, Magic link, Invite user, and Change email. Preserve `{{ .ConfirmationURL }}` exactly. Review configured Site URL, Redirect URLs, and email confirmation settings. Save each template.
3. `welcome.html` and `order-confirmation.html` are **transactional** templates, not native Supabase Auth templates. They require a separate trusted backend email service/event integration, idempotency and delivery monitoring. Do not send from the browser or expose SMTP credentials.
4. Verify custom SMTP delivery with a new test address, including inbox/spam, link behavior on web and Android, resend and password reset. Do not claim successful delivery without a real end-to-end test.

## Notes

- Avoid inserting unescaped customer-supplied text into HTML emails.
- Use actual verified order amounts and states; do not send fictitious transaction details.
- The current Android signup flow has previously generated a localhost redirect and should be fixed separately in app code.
