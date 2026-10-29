# HAMIYA 1.2.5 — public website and updates inside the app

The requested behavior is a public HAMIYA marketing/download website and app updates that never send customers to a browser download page.

## Website

- `/` presents the three existing divisions, official logo, existing brand imagery, customer portal and Android download in English, Amharic and Afaan Oromo.
- `/app` retains the existing application and all hash routes. The marketing entry preserves old hash links and authentication callbacks. The installed APK continues to load its original application entry, not the marketing site.
- The public download points directly to the repository's latest `Hamiya.apk`; existing `/api/android` remains backward compatible for older clients. PWA startup and offline caches distinguish the portal from the public website.

## Updates inside Android

- `src/android-updates.ts` is a small typed bridge; `src/AndroidUpdates.tsx` owns Settings progress, retry, cancellation and Android approval states. `UpdateNotice` uses the same deduplicated check. No Vercel download URL or browser navigation is used by this flow.
- `native/HamiyaAppUpdatePlugin.java` only accepts releases from the existing repository. HTTPS redirects are limited to GitHub release-asset hosts. Metadata and APK responses have size and time bounds; private files are streamed to disk and verified before installation.
- SHA-256 and byte length must match GitHub's release asset digest. Android package parsing must match the original app ID, newer version code and the installed signing certificate. The native installer performs Android's final package validation and asks for approval.
- The file provider exposes only `cache/hamiya-updates/` using read-only URI permission, and is not exported. Customer documents, session stores and financial data are not exposed or changed.
- `scripts/package-android-release.mjs` binds the exact published APK to its commit, version and digest. The existing production certificate is preserved.

## Verification

Local checks: lint, type checking, production build, 53 unit/database tests, and 41 production browser tests pass. The browser suite covers all existing ordering/admin/safe-area regressions plus marketing widths 320/390/768/1280, language persistence into the portal, direct-file downloads, legacy deep links, update progress, no browser navigation, duplicate protection, cancellation, permission denial and retry.

The signed Android workflow gates publication on existing safe-area tests and four native update/security/installer tests on both API 35 and 36. Actual CI results and release links are recorded in GitHub Actions and the published release; local checks alone are not evidence of an Android pass.

## Delivery limits

An installed app without the new native plugin needs one initial installation from the website. Thereafter the user starts **App settings → App updates → Update app** and approves Android installation. Android cannot silently install a self-distributed APK without user approval. Signed web-bundle updates remain separately gated on their existing public/private signing configuration; this release does not weaken that policy.

Direct Vercel management access for team `gulit` still returns 403, and the advertised consent lookup returns 404. The existing Git integration can publish a pushed commit; production HTML and Git deployment status must be checked without claiming unobserved direct API READY or build-log access.
