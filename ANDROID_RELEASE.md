# HAMIYA Android release (APK + AAB)

The workflow `.github/workflows/android-release.yml` builds the current React/Vite customer app into a Capacitor Android application, signs **both** APK and AAB with the same persistent release keystore, and verifies their signatures. The APK is for direct distribution; the AAB is for Google Play.

## One-time secure setup

1. Generate a persistent Android release keystore **on a trusted computer** (do not put the keystore or passwords in GitHub source files):
   `keytool -genkeypair -v -keystore hamiya-release.jks -alias hamiya -keyalg RSA -keysize 3072 -validity 10000`
2. Back up the keystore and its passwords securely. Future Android updates require the same signing identity. If you later enroll in Google Play App Signing, follow Play Console's upload-key instructions.
3. In GitHub repository **Settings → Secrets and variables → Actions → Secrets**, add:
   - `HAMIYA_ANDROID_KEYSTORE_BASE64`: base64 representation of the entire JKS file (single line)
   - `HAMIYA_ANDROID_KEYSTORE_PASSWORD`: keystore password
   - `HAMIYA_ANDROID_KEY_ALIAS`: `hamiya` (or your actual alias)
   - `HAMIYA_ANDROID_KEY_PASSWORD`: key password
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: public/anon key used by the existing frontend (never service-role key)
4. Under **Actions → Variables**, optionally set `VITE_SUPABASE_URL` to your existing Supabase project URL. The Vite configuration defaults to the HAMIYA Supabase URL if omitted.
5. Open **Actions → HAMIYA Signed Android Release → Run workflow**.
6. Download the `HAMIYA-signed-android-release` artifact containing both files. Test the APK on a real Android device before distributing. Upload the AAB through Play Console after completing store listing and policy requirements.

On macOS/Linux: `base64 -w 0 hamiya-release.jks` (on macOS: `base64 < hamiya-release.jks | tr -d '\\n'`). Do not paste this value into chats.

## Important
- After generating and syncing Android, the workflow runs `node scripts/configure-android.mjs` to apply Hamiya launcher artwork, launch colors, keyboard resizing and AndroidX Back navigation.
- The shared Capacitor configuration keeps the status and navigation bars visible, enables accessibility zoom and uses native safe-area handling. Test these changes on a newly built APK; a website deployment does not update an installed APK.
- Native Android app ID: `com.hamiyainvestmentgroup.customer`.
- Signing keys and passwords must **never** be committed to GitHub.
- This workflow builds from the current website source; native permission, notification, deep-link and hardware integrations require separate implementation and device testing.
- A GitHub Actions run is **not** a Google Play publication.

## Updates from Settings

Version 1.1.0 adds **App settings → App updates**, also available before sign-in. Opening Settings checks the HTTPS release manifest. Customers can apply a compatible web update and restart the app without installing another APK. Downloads are checked against the release SHA-256; failed startup confirmation triggers the updater's return to the last working bundle. The application does not send updater telemetry to Capgo.

Every production web build creates a bundle and `/updates/latest.json` on the existing Vercel project. Native changes require an APK with a higher version code and the existing signing certificate. Increase the package version and the `minimumNativeVersion` in `scripts/package-updates.mjs` when introducing new native requirements. The Android workflow publishes `Hamiya.apk` to GitHub Releases after signature verification. It refuses a signing certificate different from the previous Hamiya release.

The first 1.1.0 APK must be installed over the existing Hamiya app to enable live updates. Do not uninstall the old app. Live updates cover JavaScript, CSS and static assets; they cannot change Android permissions, native plugins or the app's signing identity.
