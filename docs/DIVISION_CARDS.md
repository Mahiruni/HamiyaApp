# Division Cards interface — 28 October 2026

Implements the selected concept 04 across the existing application. The customer home opens with a short greeting, working product search, the Food / Hawinet Coffee / Vehicles image grid, a live latest-order shortcut, and shared product cards. The promotional dashboard hero and its competing styles have been removed.

The same navy, blue-gray, white and black palette, card shapes, compact headings, icon treatments and spacing continue through the catalog, product details, cart, order history, account, verification, settings and administrator controls. The approved Hamiya emblem, separate authentication screens and floating black navigation dock remain in place.

## Behavior

- Search carries localized queries safely into the catalog and preserves the query while switching categories.
- Home and catalog reuse the same product cards and quantity-selection sheet. The 20-carton minimum, editable cart quantities, pricing and stock rules are unchanged.
- The latest-order card reads only the signed-in customer's latest order. It refreshes after order events, reconnecting or returning to the app, and handles empty, loading and error states without inventing an order.
- Order detail links are consumed before opening the Back-aware sheet. Closing it leaves the order list; Back then returns to the originating page.
- English, Amharic and Afaan Oromo have complete new interface copy, including the known hard/soft variants and carton unit labels. Original product and order records remain intact.
- Settings retains the existing signed live-update flow. This is a compatible web-interface release for the existing 1.1.0 APK.

## Artwork

The three division images are illustrative category artwork, not supplied product photos or specific vehicle listings. They are generated, text-free studio compositions: food cartons and confectionery on navy; an unbranded coffee pouch and beans on blue-gray; a navy SUV on blue-gray. They are compressed as local WebP assets, about 76 KB combined, and precached for offline use. Actual product photos continue to come from the existing catalog; missing product photos stay explicitly identified.

## Verification

TypeScript, the production build and the Node tests cover existing integration safeguards plus new search routing, localization and order-sheet history behavior. Responsive browser checks exercise customer, staff and standalone authentication screens at 320, 360, 768 and 1440 pixels in all three languages. Interaction checks cover category links, search, product selection, 200-carton ordering, cart editing, order sheets, drawer Back, safe areas, keyboard hiding and reduced motion. Signed-in browser checks use isolated API fixtures and do not write to production data.

The final pass completed 216 screen/language/viewport combinations and 34 accessibility and interaction checks without findings. All 37 Node tests pass. A separate production-bundle check confirms the CSP, 25 public precached resources, all three division images offline, correct responsive product columns, unclipped localized headings, and disabled offline submission. The live-update archive passes its size and SHA-256 checks and retains the 1.1.0 native minimum.

Physical Android-device testing is still needed for device-specific keyboard and system-bar behavior; no new native permissions or plugins are introduced.
