# HAMIYA Android release (APK + AAB)

## Production hardening (1.2.4)

See `docs/PRODUCTION_UPGRADE_1.2.4.md` for the audited scope and verification. This release protects the real status-area surface while scrolling, handles keyboard/panned product-sheet viewports, bounds lazy-screen recovery, fixes HTML/React startup ownership and delays live-bundle readiness until the actual screen renders. Optional confirmation haptics respect the Android setting without adding permissions. Android backup and cleartext traffic are disabled; installing over the existing signed app preserves local data and sessions.

Before publication the signed-release workflow now runs the production browser suite and checks the exact signed APK on Android 15/16 in light/dark portrait, keyboard, resume and landscape states. It validates visible status bars and accessible control bounds, in addition to rejecting native action bars. These guest-window emulator checks complement signed-in browser fixtures; they do not replace a physical-device customer acceptance pass.

The workflow `.github/workflows/android-release.yml` builds the current React/Vite customer app into a Capacitor Android application, signs **both** APK and AAB with the same persistent release keystore, and verifies their signatures. The APK is for direct distribution; the AAB is for Google Play.

## Existing signing identity

The production keystore already exists in GitHub Actions secrets. Reuse it; do not generate another key. The workflow requires `HAMIYA_ANDROID_KEYSTORE_BASE64`, `HAMIYA_ANDROID_KEYSTORE_PASSWORD`, `HAMIYA_ANDROID_KEY_ALIAS`, `HAMIYA_ANDROID_KEY_PASSWORD`, and the existing `VITE_SUPABASE_PUBLISHABLE_KEY`. Missing secrets fail the build with the missing variable name. No secret values are logged.

The accepted certificate SHA-256 is `7fcd1f1b41d9286ae9f8cfe3e0eeeec6da6237f1a805d70efc4700d8a30f253c`. Both APK and AAB signatures are checked before publishing. The version code is `10000 + GITHUB_RUN_NUMBER`; package version supplies the version name. Run the existing **HAMIYA Signed Android Release** workflow or push a native configuration change to `main`.

## Important
- After generating and syncing Android, the workflow runs `node scripts/configure-android.mjs` to apply Hamiya launcher artwork, launch colors, keyboard resizing and AndroidX Back navigation.
- The shared Capacitor configuration keeps the status and navigation bars visible, enables accessibility zoom and uses native safe-area handling. Test these changes on a newly built APK; a website deployment does not update an installed APK.
- Native Android app ID: `com.hamiyainvestmentgroup.customer`.
- Signing keys and passwords must **never** be committed to GitHub.
- This workflow builds from the current website source; native permission, notification, deep-link and hardware integrations require separate implementation and device testing.
- A GitHub Actions run is **not** a Google Play publication.

## Android 1.2.0 and signed web updates

Version 1.2.0 includes native changes: explicit AndroidX edge-to-edge setup, Capacitor's WindowInsets-to-CSS bridge, a small system-surface plugin, keyboard resizing and Back handling. Install the signed APK over the existing app to receive these changes. A web deployment cannot repair an older binary's native configuration. Never uninstall to update.

`SystemBars.insetsHandling = 'css'` publishes actual status/navigation/cutout values. Capacitor pads older WebViews natively and publishes zero CSS insets in that mode; newer WebViews receive the actual CSS insets. The shell consumes one set of insets. The native surface plugin keeps system icons readable through splash, resume and configuration changes. Physical Android 15/16 device testing is still required.

Settings shows the installed native version and checks the existing HTTPS release manifest. A new native build is required when the manifest's minimum native version exceeds the installed version. Compatible web packages require a valid ECDSA P-256 signature over the manifest, plus the archive's SHA-256 checksum and the trusted application/origin/path checks.

Signing configuration:

- `VITE_HAMIYA_UPDATE_PUBLIC_KEY`: base64 DER/SPKI ECDSA P-256 public key. Set it in the web build and in the GitHub repository variable used by the APK build. The verification key becomes pinned in the installed application.
- `HAMIYA_UPDATE_PRIVATE_KEY`: matching PEM private key, stored only in the trusted production web build environment. Never prefix this variable with `VITE_`, commit it, or paste it into chat.

Without these signing settings, web and APK builds still work, but the native app refuses unsigned live packages and uses the existing signed APK release flow. Automatic updates remain off. A failed live bundle that does not confirm readiness within the updater's timeout rolls back. The first 1.2.0 APK and later native changes must use the existing Android signing identity.

## Reliable Android downloads (1.2.1)

Settings now uses `https://hamiyainvestmentgroup.vercel.app/api/android` instead of opening a GitHub new-window link. The endpoint serves the existing release APK as an attachment on the HAMIYA domain, after verifying its release identity, exact byte length and GitHub SHA-256 digest. Redirects are restricted to GitHub's release-asset hosts. It streams the verified file to avoid the buffered Vercel response limit and never needs a customer session or GitHub token. Failed preflight requests have translated retry feedback. The website also exposes the Android download when the web app is current, so an older APK can be updated through the website.

The Android workflow checks that the public production endpoint returns a byte-identical copy of the signed APK it just built. Android still owns installation approval. Installed older APKs retain their bundled download button until they receive a compatible signed web update or a new APK.

## Floating controls (1.2.2)

The header no longer renders the HAMIYA wordmark. Android uses the compact floating controls and menu drawer at every viewport width, including landscape and tablets. The header has no rectangular background and keeps the hamburger, language selector and customer cart below the actual status/cutout inset while scrolling. The black customer dock remains in place. The base Android theme has no action bar, and the activity explicitly hides any action bar to prevent a native app-title strip. Install the new signed APK to receive both the bundled screens and native title-bar safeguard.

## Platform title-bar fix (1.2.3)

Native testing of the signed 1.2.2 APK reproduced `android:id/action_bar` on both Android 15 and Android 16, covering the floating controls. Hiding AppCompat's action bar did not hide this separate platform bar. `EdgeToEdge.enable()` obtains the decor view before Capacitor's later theme change, so the launch theme must prohibit the platform bar and both no-title features must be requested before edge-to-edge/decor creation.

The native generator now disables the platform action bar/title/overlay in the launch and runtime themes, requests the platform and support no-title features before edge-to-edge initialization, and hides any platform action bar as a fallback. It leaves Android's status and navigation bars visible. Version 1.2.3 is the minimum compatible native version; a web update cannot apply this native fix.

The signed-release workflow now installs the exact release APK on Android 15 and 16 emulators and rejects any visible native action-bar container or app-title label in light/dark mode before publishing. Screenshots and native view hierarchies are retained as CI evidence. These checks start a fresh guest session and do not submit customer orders or documents.
