# Customer experience redesign — 24 October 2026

The customer app now shares a consistent HAMIYA mark, navy visual system, category colors, navigation states and responsive controls. The dashboard uses translated copy and real catalogue/cart counts. Category pages have division-specific headings. Orders and enquiries can be viewed together or separately. The profile summary and editor use the same visual system.

Mobile layouts reserve space for the bottom navigation and device safe areas. The menu announces its expanded/current state, traps focus, closes on Escape, and releases the page when resizing to desktop. Product images retain their full framing. Missing product photography remains explicit rather than being replaced with invented product photos.

The shared mark has PWA PNG exports, five densities of Android legacy launcher icons, adaptive vectors and Android 13 themed-icon resources. The release workflow applies these after Capacitor generates the native project. The service worker cache version is incremented for the new shell and icons.

## Validation

- TypeScript check passed.
- 23 automated tests passed, covering existing authentication, navigation and database rules plus the new Android resource-copy integration.
- 28 browser checks passed using isolated customer, catalogue, order and enquiry fixtures: all four customer screens at 320, 390, 768, 1024 and 1440 pixels; menu dismissal and resize behavior; product search/details/cart; activity filters; English, Amharic and Afaan Oromo; profile editing; and sign-out. No page errors or horizontal document overflow were recorded.
- Browser checks used a portable bundle of the actual app source because this Windows host blocks the native Vite/Rolldown binding. The production build passed in GitHub Actions on Linux. The existing App checks workflow now also saves the built web assets for review.

Browser fixtures are test data and are never shipped in the app. No live customer, product, order or database records were changed. Physical-device Android testing and a newly signed APK/AAB are separate from this frontend validation. New translated interface labels should receive native-speaker review before release.

## Menu and language control follow-up

The hamburger control now has a 44 px touch target and a matching close icon. The mobile drawer includes the customer's profile shortcut, keeps its close control visible when scrolling, and closes on route changes. Keyboard focus stays in the open drawer and returns to the hamburger button when dismissed.

One shared globe-icon language selector is used in the app header, sign-in screens and standalone information pages. It opens the native language picker without displaying a language name or dropdown arrow in the header. English, Amharic and Afaan Oromo remain available. Follow-up verification passed 32 browser checks, including the actual picker interaction and keyboard focus behavior, with no page errors or document overflow.
