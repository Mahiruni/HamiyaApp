# HAMIYA production upgrade audit — 28 October 2026

Audited upstream `main` at `a38392adfad7cae30e4a35cab19088d7ac098d50`, including `671ee78`, `1fabefe` and `a38392a`. This upgrades the existing React/Vite/Capacitor application and the connected HAMIYA backend. No replacement app or production product/customer/order records were created.

## Implemented changes and causes

| Area | Finding | Result |
| --- | --- | --- |
| Android safe areas | Native generator did not enable AndroidX edge-to-edge; successive CSS patches imposed both 28px and 48px status-bar assumptions. | Explicit native setup, real SystemBars status/navigation/cutout insets, a single CSS inset source, and system surface/icon updates on startup, resume and configuration changes. No fixed status-bar-height fallback. |
| Product wrapper | `showModal()` made the floating dock inert even when visually exposed. Sheet rules repeatedly contradicted one another. | Dedicated non-modal portal sheet. Dock stays interactive. Actual viewport, safe top and measured dock occupancy define usable height; snaps are 45%, 60% and 75%. Drag handle, keyboard slider, internal scrolling, focus restoration, Escape and Back dismissal. |
| Startup | Auth/data requests could leave loading indefinitely. Native launch surface differed from branded web startup. | Navy native/HTML/React startup, one shared stylesheet, bounded auth/data requests, retry recovery, stale-auth-result protection and a module-load watchdog. No artificial delay or fake startup percentage. |
| Ordering | Cart silently clamped additions; controlled quantity input resisted clearing/retyping. Duplicate-click protection relied on asynchronous button state. Server minimum depended on a product attribute absent on most records. | Editable large quantities including 200; explicit whole-number/stock/minimum checks; no silent addition truncation; immediate submission guard plus existing persistent server idempotency keys. Shared server food minimum is 20 cartons. Existing maximum of 10,000 remains. |
| Customer shell | Header/dock rules were scattered across repeated overrides and the dock labels were visually hidden. | Three sticky floating controls at customer mobile/tablet widths; preserved black dock with Home/Products/Orders/Profile labels, active state and safe bottom clearance. Existing destinations and staff navigation remain. |
| Homepage/catalog | Selected Division Cards and Elegant Premium concepts already existed. Product-image failure handling was missing. | Retained those designs and live catalog source. Added branded image recovery, coherent shell spacing and readable dock labels. Existing search, category and stock filtering remain. |
| Account | Upload state lacked a progress indicator; logout did not inspect the returned error. | Indeterminate upload progress, duplicate upload guard and local-session logout error handling. Existing private upload validation, onboarding and verification remain. |
| Updates | Checksum validation did not prove release authenticity. | Pinned ECDSA P-256 manifest verification before native live installation, checksum/origin/app/compatibility validation, native update notice and Settings checks. Unsigned live installs fail closed. Version 1.2.0 requires the updated native binary. |
| Build/QA | Baseline had no lint command and one failing translation test (`add`). | Fixed translations in three languages, added linting, native-generation and behavioral regression tests, browser CI checks and separate React/Supabase cacheable bundles. Main application chunk is about 126 kB before gzip; vendor chunks remain necessary on first load. |

## Data and security audit

- All existing exposed HAMIYA tables have RLS enabled. Profile/order ownership and staff permissions remain in place.
- Identity documents remain in the private `hamiya-documents` bucket, restricted to allowed MIME types and 8 MiB. Signed document links expire after 60 seconds. Inventory staff cannot read identity documents in the database regression tests.
- Existing server role checks, verification requirements, price checks, stock reservation/cancellation/fulfilment logic and order idempotency remain intact.
- Applied only migration `20261028014357_enforce_food_carton_minimum`: guarded replacement of the food quantity lower bound in `hamiya_private.dispatch(text,jsonb)`. No rows, stock values, prices, financial records or RLS policies were changed. A read-back verified both the new minimum and the unchanged inventory bounds. Tests replay the migration from the older rule and apply it twice.
- Telegram delivery function is ACTIVE and its existing minute schedule is enabled. The audit observed delivered order alerts and a queued alert. Existing tokens stay server-side. No test messages or real orders were sent.
- Post-change security advisors showed the same existing findings: worker delivery table intentionally has no client RLS policy; two notification SECURITY DEFINER helpers are callable by authenticated users but contain explicit staff checks; leaked-password protection is disabled. [Supabase password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verification evidence

- `pnpm typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm test`: 43 tests pass, including actual Postgres-compatible RLS/verification/order behavior in isolated PGlite and Android generator idempotence.
- `pnpm test:browser`: 17 tests pass on Chromium, using isolated mocked Supabase responses. Widths: 320, 390, 768 and 1280 pixels. Covers all three languages, safe-area emulation, sheet bounds/dock access, 200-carton totals, cart editing, duplicate submission, stock blocking, search/filtering, auth recovery/timeouts, logout, registration validation, staff/customer separation, dragging/scroll separation, Back/focus restoration, reduced motion, catalog retry and delayed sign-in chunk handoff.
- `pnpm build`: pass, with lazy screen chunks and separate vendor chunks. Built update metadata honestly reports when release signing is absent.
- Existing production public startup and standalone sign-in were inspected. No real authenticated customer/admin order or document mutation was performed against production.
- Capacitor Android generation and sync: pass. Native application ID remains `com.hamiyainvestmentgroup.customer`; existing signing fingerprint validation is unchanged.
- Local APK compilation is unavailable: no Android SDK/adb/emulator, Java is 17 rather than required 21, and Gradle distribution download fails with `Network is unreachable`. The existing GitHub Android workflow provides the release build environment and checks signing secrets/certificate before publishing. See its actual run result for APK delivery.

## Release limitations requiring follow-through

1. Vercel's connected account returned HTTP 403 for the specified `gulit` team (`team_gflAoUYP3f45QlNAWZG0Q5p3`). Team authorization is required before an authenticated forced deployment/log/READY check. Do not change teams or create a project.
2. Physical Tecno/Android 15/16 checks (clock/cutout, gesture navigation, keyboard and app resume), TalkBack and actual upgrade installation remain unexecuted. Browser inset emulation and native-generation tests do not substitute for device testing.
3. Live web installation requires `VITE_HAMIYA_UPDATE_PUBLIC_KEY` pinned in the APK and `HAMIYA_UPDATE_PRIVATE_KEY` in the trusted production build. These signing credentials were not available locally. Unsigned packages are refused.
4. The audited baseline has **unpaid order requests only**: the database constrains `payment_status` to `unpaid`; there is no customer payment-evidence upload or administrator payment-confirmation implementation. Alert labels for payment evidence do not constitute that workflow. It remains absent; this upgrade does not invent financial records or change that financial model.
5. Real production credentialed login, ID upload/review, coffee/vehicle enquiry submission and Telegram delivery were not exercised with live accounts. Existing authorization/business behavior is covered by isolated database tests and browser fixtures where applicable.

## Main files/components

- Shell/startup/auth: `src/App.tsx`, `src/state.tsx`, `src/async.ts`, `src/experience.ts`, `src/components.tsx`, `src/main.tsx`, `src/mobile-shell.css`, `public/startup.css`, `public/boot.js`, `public/sw.js`, `index.html`.
- Commerce: `src/Commerce.tsx`, `src/ProductSheet.tsx`, `src/product-sheet.css`, `src/sheet-geometry.ts`, `src/quantity.ts`, `src/premium.css`.
- Account/languages/updates: `src/Account.tsx`, `src/Settings.tsx`, `src/UpdateNotice.tsx`, `src/i18n.ts`, `src/production-translations.ts`, `src/native-updates.ts`, `src/update-policy.ts`, `src/update-signature.ts`.
- Platform/backend/build: `capacitor.config.ts`, `scripts/configure-android.mjs`, `scripts/package-updates.mjs`, `src/api.ts`, `supabase/setup.sql`, the minimum-order migration, `vite.config.ts`, `package.json`, lockfile, lint/browser configs and both existing workflows.
- Regression coverage: `tests/production.test.mjs`, `tests/android-generation.test.mjs`, `tests/database.test.mjs`, `tests/browser/customer.spec.ts`, `tests/browser/fixtures.ts`.

Generated native projects, dependencies, build output, test traces and signing material are excluded from the commit.
