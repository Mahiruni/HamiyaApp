# HAMIYA 1.2.4 production audit and implementation

Audit date: 28 October 2026. Repository: `Mahiruni/HamiyaApp`, `main`.
Baseline: `51661c5f22847147a38ff3af32a0828d79e5f97b`.

## Audit findings

The application is the existing React 19/Vite 8 application packaged by Capacitor 8.5.3. The Android project is generated in CI, rather than committed. The application ID remains `com.hamiyainvestmentgroup.customer`. The three referenced commits (`671ee78`, `1fabefe`, `a38392a`) were inspected together with subsequent fixes, rather than treated as acceptance evidence.

| Area | Findings and outcome |
| --- | --- |
| Android insets | Capacitor SystemBars already owns real WindowInsets. Older WebViews receive native padding and zero CSS insets; newer ones receive CSS insets. Retained this single owner. Added a surface limited to the actual status inset so scrolling content cannot undermine system-icon contrast. |
| Android activity | Kept the existing no-title/no-action-bar setup, visible system bars, AndroidX edge-to-edge, resize behavior and Back dispatcher. Added optional system-setting-aware confirmation haptics. Disabled Android data backup and cleartext traffic for this account/document application. |
| Startup | Found a production-only race where the plain HTML recovery timer could remove React-owned elements after missing the boot event. Recovery now captures only the original static HTML element. React startup and lazy-screen loading have bounded recovery with translated retry controls. |
| Update readiness | The previous readiness check could acknowledge a live bundle while the lazy sign-in screen was still loading. Readiness now observes the rendered UI and waits for startup/loading/error states to clear. Native system-surface synchronization survives the React error boundary. |
| Customer shell | Verified the three compact floating controls and the black Home/Products/Orders/Profile dock. Kept both designs and their destinations. No large rectangular mobile header was introduced. |
| Home/catalog | Kept the selected division-card home and elegant two-column catalog. Search now accepts original and translated names/variants. Available-only filtering respects the 20-carton minimum. Low-stock display uses actual stock minus reservations. |
| Product sheet | Kept the non-modal 45/60/75% sheet. Fixed visual-viewport versus layout-viewport coordinates when a keyboard pans or resizes only the visible area. Reacts to changing native insets. Background controls become inert while the dock remains usable. Actions can scroll within very short sheets. Enlarged the official branded fallback. |
| Cart/orders | Kept the existing server-authorized RPC, integer ETB cents, snapshots, idempotency and duplicate-submit guard. Quantity controls respect stock and the existing 10,000-carton transaction ceiling, including 200 cartons. Cart names/units follow the language. Sign-out clears the previous customer's cart; account changes cannot inherit a known different owner's cart. RPC responses are bounded. |
| Account/uploads | Existing standalone authentication/onboarding, profile validation, private immutable uploads, MIME/signature checks and short-lived document links were reviewed. Required-field screen-reader text now translates. The existing indeterminate upload indicator reports actual pending work. |
| Administration | Existing role-separated customer/order/inventory/enquiry interfaces remain. No administrator privileges, customer records, financial records or production stock were changed. |
| Telegram | Existing server-side worker and delivery configuration retained. Read-only inspection found five Telegram deliveries marked delivered. No test messages were sent. Tokens remain server-side. |
| Supabase | Connected project `lhdsodqeojxogcwgyjpo` reports healthy. All inspected public/private application tables have RLS. Customer profiles/orders/documents have ownership/reviewer/staff policies. `hamiya-documents` is private with an 8 MiB MIME allow list; product images use a separate public bucket. An anonymous catalog query returned the eleven existing products. |

The production product prices were read and preserved. Banana and Cappuccino Soft had available stock during the audit; zero-stock products were not given invented availability. No migration or production data write was needed.

## Files and ownership

- Startup/shell: `index.html`, `public/boot.js`, `src/main.tsx`, `src/App.tsx`, `src/components.tsx`, `src/native-platform.ts`, `src/mobile-shell.css`, `src/premium.css`.
- Catalog/cart: `src/catalog.ts`, `src/quantity.ts`, `src/api.ts`, `src/Commerce.tsx`, `src/state.tsx`.
- Bounded sheet: `src/ProductSheet.tsx`, `src/sheet-geometry.ts`, `src/product-sheet.css`.
- Languages: `src/production-translations.ts` adds matching English, Amharic and Afaan Oromo recovery text; existing language persistence and Ethiopic fallback remain.
- Android/release: `package.json`, `scripts/configure-android.mjs`, `scripts/check-installed-android-window.sh`, `scripts/verify-android-window.py`, `.github/workflows/android-release.yml`.
- Regression coverage: `tests/production.test.mjs`, `tests/android-generation.test.mjs`, `tests/browser/production-upgrade.spec.ts`.

## Local verification

- ESLint and TypeScript pass.
- 51 unit/database tests pass, including execution of the existing SQL/RPC in PGlite and a regression for the actual Android 15 InsetsSource dump format.
- Production build passes; lazy customer/admin chunks remain separate.
- 31 Chromium browser tests pass against the production build.
- Phone widths 320/390px, tablet 768px, desktop 1280px and native-layout simulation are covered.
- Browser checks include login boundaries/logout, 200-carton ordering, cart edits, duplicate submissions, order history, stock/search, languages, drawer/dock, sheet snaps/drag/Back/focus, keyboard geometry, real-inset simulation, startup failures, stalled chunks and native bundle readiness.
- Capacitor Android generation/sync succeeds with the existing application ID and updater plugin.

Browser tests use isolated Supabase fixtures; database tests use PGlite. They do not create commercial orders, upload identity documents or impersonate a real customer in production. The live checks were read-only. Physical Tecno/Android 15/16 signed-in testing and real email delivery are separate acceptance steps.

## Release gates and limitations

The existing Android signing identity is retained. The GitHub release workflow runs application checks, production browser tests, signature/package verification, then installs the exact signed APK on Android 15 and 16. Each emulator checks light/dark portrait, keyboard, resume and landscape windows, rejects action bars and controls inside the status area, and saves screenshots/view/inset evidence. Only a passing APK is published. Consult the workflow for the commit for actual release results.

Web updates remain manual and require the pinned ECDSA public key, matching private signing key, signed manifest and archive checksum. Automatic unsigned updates remain disabled. The local environment has no web-release signing key; the signed APK path remains available. Native updates preserve the application ID and signing certificate and install over the existing app.

Vercel's connection returned HTTP 403 for the specified `gulit` team (`team_gflAoUYP3f45QlNAWZG0Q5p3`). It explicitly requires a team-access consent grant. No alternate team/project was selected. A production READY result must be verified after access is restored.

The source and connected database contain order requests and payment alert types, but no payment-evidence storage/API or administrator payment-confirmation implementation. Orders still do not represent confirmed payments. Adding that financial workflow requires a separate compatible backend implementation; this release does not simulate it.

The security advisor flags leaked-password protection as disabled. The flagged notification SECURITY DEFINER functions were inspected: they check the authenticated user's enabled admin role and return no delivery status to other users. The delivery table has RLS with no client policies, which intentionally denies direct customer access. Those authorization boundaries were preserved.
