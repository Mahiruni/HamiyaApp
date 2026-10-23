# Implementation verification

## Automated checks

- TypeScript build and production asset build.
- PostgreSQL schema and RPC integration tests using PGlite.
- Anonymous RPC calls are denied; clients cannot directly update verification or staff roles.
- Customers cannot read another customer's profile or identity files.
- Inventory staff cannot read verification documents.
- Document completion and email confirmation are required for approval.
- Product publishing requires the confirmed selling unit and pack count.
- Prices are validated on the server and retained in order snapshots.
- Duplicate order keys return the existing order.
- Competing order acceptance cannot reserve more than stock.
- Manual sales cannot consume reserved stock.
- Cancellation releases reservations once; completion deducts stock once.
- Identity/profile edits revoke approval; language preferences do not.
- Sold individual vehicles cannot receive purchase enquiries.

## Verified on the supplied Supabase project

- Project `lhdsodqeojxogcwgyjpo` was healthy and empty before setup.
- Initial schema and explicit private denial policies were applied successfully.
- Eleven supplied food products are stored as drafts, with their original prices.
- No opening stock was invented. Cappuccino Softi's missing count remains NULL.
- The document bucket is private; product photography uses a separate bucket.
- RLS is enabled on every Hamiya table.
- Anonymous callers cannot execute the write RPC.
- Authenticated customers have no direct profile UPDATE grant and cannot self-approve.
- Supabase security advisors reported no findings after setup.
- Live HTTP checks with the frontend publishable key returned zero draft rows and denied anonymous RPC execution.
- Supabase Auth reports email signup enabled, registration enabled and automatic email confirmation disabled.

Performance advisors reported unused indexes on the new empty operational tables. These ownership, foreign-key and inventory indexes are intentionally retained for incoming traffic. [Supabase's unused-index explanation](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Browser review

- Desktop homepage, business categories and navigation rendered successfully.
- English, Amharic and Afaan Oromo interfaces were inspected.
- A 390px iframe viewport was used to review actual mobile breakpoints and registration layout.
- Changing language survived a reload.
- No real customer account, payment, order, government ID or verification document was created as part of browser testing.

## Inputs still needed before business launch

1. Confirm each selling unit and actual opening stock; supply Cappuccino Softi's count.
2. Register the owner's account and grant the intended staff role explicitly.
3. Approve branding and provide actual product photographs, coffee and vehicle listings.
4. Provide business contact/collection details and any delivery fee.
5. Review Amharic and Afaan Oromo wording with native speakers.
6. Approve privacy/trading notices and define document retention/deletion operations.
7. Configure the hosted Auth callback URLs, email templates and production email delivery; test a real owner-controlled signup, confirmation, recovery and private upload.

The repository push is separate from a public hosting deployment. No public production domain has been selected for this application.
