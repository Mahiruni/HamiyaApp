# Hamiya premium polish — 27 October 2026

The application uses one navy, blue-gray and white interface while keeping the supplied Hamiya artwork. Authentication remains outside the customer and staff dashboards. Existing Supabase authentication, customer verification, document storage, pricing, ordering, enquiries and administration remain connected to the same project.

## Changes

- A small first-paint splash continues through session restoration without a forced introduction timer. Subsequent route loads use a neutral progress indicator.
- Shared buttons provide consistent touch targets, busy indicators, disabled styles and keyboard focus. Authentication has visible field labels and inline errors.
- Mobile drawers and dialogs have focus containment and dismiss through browser or Android Back before leaving the page. Drawer navigation preserves the previous page as the next Back destination. Resizing to desktop releases the mobile modal state.
- The dashboard, catalog, cart, order history, verification flow and staff screens share consistent spacing and surfaces. Repeated registration instructions were removed from the signed-in home screen. Staff navigation respects the existing staff roles.
- Operational alert labels and stock-editing controls are translated into English, Amharic and Afaan Oromo. Headings now use the bundled Ethiopic font, which covers the Ethiopic characters used in the translations.
- Cart quantities remain editable, including 200 cartons. Stock editing now accepts valid whole numbers while preserving reservations and limits.
- Catalog refreshes are deduplicated and toast updates no longer recreate the application context value. Commerce screens are loaded when needed. Header artwork uses the smaller existing asset.
- Release-specific service workers precache the public application chunks, startup styling and Ethiopic font. The previous build's cached chunks remain available to open tabs during an update. Identity, documents and authenticated API responses remain outside the cache.
- The Android release workflow applies the approved launcher artwork, matching launch colors, visible system bars, keyboard resizing and AndroidX Back handling. It adds no application dependencies.

## Verification

- TypeScript and production build pass. The Node test suite passes all 30 tests, including the existing Supabase schema, inventory, verification, session and order safeguards.
- Chromium layout checks exercised 144 screen/language/viewport combinations: guest, customer and administrator; English, Amharic and Afaan Oromo; widths of 320, 360, 768 and 1440 CSS pixels. The tablet overflow discovered during this pass was corrected.
- Accessibility checks exercised the three authentication modes, four customer screens and five administrator screens. Contrast findings were corrected and the affected screens rechecked. Onboarding was also checked in all three languages.
- Browser interactions covered drawer Back dismissal, dialog Back and Escape dismissal, drawer navigation, cart quantity editing, desktop resize, reduced motion and authentication errors.
- The production bundle was tested with its CSP and service worker. Offline reload and the lazy registration screen worked; submission stayed disabled offline. The worker precached 17 public resources without browser errors.
- Generated Android XML was parsed successfully, and the native configuration script was run twice to check repeatability.
- A read-only check confirmed the existing Supabase project is healthy and has 11 published products. Signed-in browser tests used isolated fixtures, with production writes and realtime connections intercepted.

## Limits

No physical Android device or emulator was attached. Native launch, system bars, accessibility scaling, IME behavior and predictive Back still require device verification on a newly built APK. This change updates the Android build configuration; it does not distribute a new APK or publish to Google Play. The production build still reports a non-blocking warning about its main JavaScript chunk size.
