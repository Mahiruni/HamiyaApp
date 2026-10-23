# HAMIYA INVESTMENT GROUP — CUSTOMER & COMMERCE APP MASTER PROMPT

Act as a Principal Product Architect, Senior Full-Stack Engineer, Inventory Systems Specialist, Ethiopian Localization Specialist, and expert Mobile UX/UI Designer.

Design and build a secure, reliable, production-ready customer application for Hamiya Investment Group. Make it easy for local Ethiopian customers to register, submit their required information, discover products, see accurate prices and availability, and place orders or enquiries.

Build a working application with a connected administration system. Prioritize clarity, trust, speed, and everyday usability on affordable Android phones and slower internet connections.

## 1. Business structure

Create one Hamiya Investment Group customer account and three clearly separated business categories:

| Category        | Business name          | Main experience                               |
| --------------- | ---------------------- | --------------------------------------------- |
| Food processing | Hamiya Food Processing | Browse packaged products and submit orders    |
| Coffee export   | Hawinet Coffee Export  | Browse coffee products and request quotations |
| Car market      | Premium Car Import     | Browse vehicles and submit purchase enquiries |

Give each category its own catalogue and relevant product fields while retaining consistent navigation, account information, and Hamiya identity. Allow administrators to add more categories later.

Use only owner-supplied logos, company information, product photographs, and business contact details. Do not invent certifications, reviews, coffee grades, vehicle listings, or business claims.

## 2. Initial food product catalogue

Use the following supplied data exactly. Normalize spelling and capitalization for display, but retain the original entries in the import record for review.

| No. | Product       | Supplied variant | Supplied pack count | Supplied price, ETB |
| --- | ------------- | ---------------- | ------------------- | ------------------- |
| 1   | Banana        | Hard             | 96                  | 715                 |
| 2   | Energy Ranger | Hard             | 78                  | 845                 |
| 3   | Cappuccino    | Hard             | 60                  | 615                 |
| 4   | Cookies       | Softi            | 60                  | 630                 |
| 5   | Vanilla       | Hard             | 60                  | 605                 |
| 6   | Cappuccino    | Softi            | Not provided        | 830                 |
| 7   | Abu Bint      | Softi            | 48                  | 1,980               |
| 8   | Energy New    | Hard             | 80                  | 845                 |
| 9   | Orange        | Hard             | 96                  | 715                 |
| 10  | Apple         | Hard             | 96                  | 715                 |
| 11  | Mango         | Softi            | 60                  | 780                 |

Treat “Hard” and “Softi” as supplied variant labels until the owner confirms their meaning. Do not infer ingredients, weights, or packaging types.

The counts above describe supplied pack information; they are not warehouse stock quantities. The sales unit for each listed price has not been specified. Do not assume a price is per piece, packet, carton, or kilogram.

Store these entries as draft products with the supplied prices intact. Before activating ordering, require the administrator to confirm the sales unit, pack details, opening stock, and the missing Cappuccino Softi count. Never invent these values.

Once confirmed, display prices with their sales unit, such as “715 ETB / carton” only when carton pricing is confirmed. Keep pack count and available stock visibly distinct.

## 3. Required customer registration and verification

Create a guided registration process with progress indicators, saved drafts, and clear explanations in the selected language.

Collect all of the following before an account can submit orders or purchase-related enquiries:

- Full legal name.
- Business or trading name.
- Phone number.
- Email address.
- Password or another securely implemented sign-in method.
- Profile photograph.
- Region, city or town, sub-city or woreda, and kebele where applicable.
- Physical business address and a useful landmark.
- Location pin when available, with a manual address alternative.
- National ID number and supporting ID document.
- Trade licence number and a readable trade licence upload.
- Acceptance of the privacy notice and account terms.

Generate a unique customer account ID automatically. Keep this system ID separate from the customer’s National ID. Reuse the same uploaded document when it satisfies both identity requirements; avoid asking customers to upload the same document twice.

Make phone entry familiar for Ethiopian users, accept valid local and international formats, and normalize numbers for storage. Explain any input error beside the affected field.

Verify the primary contact through a configured verification provider. Never simulate successful OTP or email delivery. Clearly report when verification delivery is unavailable.

Support verification states: Draft, Submitted, Under Review, Approved, Corrections Required, Rejected, and Suspended. Give customers a clear reason and next step when corrections are required.

Allow public catalogue browsing, but require a complete, approved account before order or purchase-enquiry submission. A missing required document must leave the application saved as a draft.

Request location permission only when needed. GPS failure or permission denial must not prevent manual address completion.

## 4. Three complete languages

Support:

- Amharic — አማርኛ.
- English.
- Afaan Oromo — Afaan Oromoo.

Show the language selector at first launch and make it easy to change later. Remember the customer’s preference.

Translate navigation, onboarding, forms, validation, product descriptions, availability labels, orders, notifications, support, and important account messages. Keep brand names and product identities consistent.

Use centralized translation files and font support that renders Ethiopian scripts clearly. Benaiah Amharic may be used if a licensed font asset is supplied; otherwise use a readable Ethiopic-compatible font.

Keep the same functionality in every language. Do not leave unfinished screens in English or put essential instructions inside images. Provide a translation review checklist for native speakers before launch.

## 5. Catalogue and product information

Build a simple home screen with the three business categories, product search, recently added products, and clear access to the customer’s orders.

Each product card must show its photograph, name, variant where relevant, confirmed pack or sales unit, ETB price or “Request quotation,” availability, and one clear next action.

Each product details page must include:

- Product name, category, photographs, and a concise description.
- Applicable specifications and packaging information.
- Confirmed price and sales unit.
- Availability and minimum order quantity, when configured.
- Quantity selection for orderable products.
- Add to Cart, Request Quotation, or Enquire, according to product type.
- Delivery or collection information when configured.

Food products need separate fields for variant, units per pack, sales unit, and stock in that sales unit.

Coffee products may include origin, grade, processing method, form, packaging, and minimum order quantity when supplied. Do not create export prices or quality claims.

Vehicle listings may include make, model, year, condition, mileage, fuel or power type, specifications, photographs, price, and status when supplied. Support individual vehicle records so one sold car does not mark other vehicles sold.

Use honest empty states when coffee products or vehicles have not yet been added.

## 6. Accurate inventory and availability

Maintain one authoritative inventory source shared by the customer application and administration system.

Support Available, Low Stock, Out of Stock, Temporarily Unavailable, and Coming Soon where appropriate. Use Reserved and Sold for individual vehicles. Keep Draft and Archived products out of the public catalogue.

“Newly Added” is a promotional label, separate from stock status.

When an administrator publishes a product, updates its price, records an offline sale, adds stock, or changes availability, update the customer view promptly. Refresh data when the app reconnects or returns to the foreground.

For food products, selling some units reduces available quantity. The product remains available while sufficient stock remains. Zero saleable stock makes it Out of Stock.

Use server-side, atomic stock operations to prevent negative inventory and overselling. Accepted orders reserve stock; fulfilment converts the reservation into a sale without deducting twice. Cancellation or an applicable reservation expiry releases stock.

Prevent duplicate submissions from creating duplicate orders or stock deductions. Keep an audit history of adjustments, including staff member, quantity, reason, and time.

Do not invent opening stock or display unverified availability. Disable ordering for unavailable items and explain why.

## 7. Orders, quotations, and enquiries

For food products, provide this flow:

Browse → Product Details → Cart → Review Address and Fulfilment → Review Total → Submit Order → Track Status.

Show sales unit, quantity, unit price, line totals, and total in ETB. Use precise currency calculations and server-side price validation.

Support order states: Submitted, Accepted, Preparing, Ready for Collection or Out for Delivery, Completed, Rejected, and Cancelled. Only offer fulfilment options the company has configured.

Show price or availability changes before confirmation and ask the customer to review the updated order. Preserve the original price and product details in the confirmed order record when catalogue prices change later.

For coffee, capture a quotation request with product, quantity and unit, packaging preference, destination, and notes. For cars, capture the selected vehicle and the customer’s enquiry. Keep enquiries, quotations, orders, and completed sales as distinct records.

Do not assume delivery fees, taxes, payment providers, or payment terms. Make these configurable and disclose all applicable charges before confirmation. Do not present an order submission as a successful payment.

Keep online payment integration ready for a later phase unless a provider and credentials are explicitly supplied.

## 8. Administration workspace

Provide a separate administration interface with role-based permissions.

Allow authorized staff to:

- Review customer profiles, IDs, and trade licences.
- Approve, reject, request corrections, suspend, or reactivate accounts with recorded reasons.
- Manage categories, products, variants, images, translations, prices, and sales units.
- Add or adjust stock and record sales made outside the app.
- Manage orders, coffee quotations, car enquiries, and vehicle reservations.
- Publish announcements and update business contact details.
- View low-stock products, pending applications, pending orders, and recent activity.
- Review actual completed sales and operational reports.

Separate full administrators from catalogue or inventory staff. Staff who manage stock must not automatically gain access to customer identity documents.

Distinguish confirmed sales from enquiries and unpaid orders in reporting. Base all metrics on real stored records.

## 9. Easy local user experience

Create a polished, welcoming interface with readable text, strong contrast, large tap targets, recognizable icons, and visible text labels.

Use a compact mobile navigation structure: Home, Categories, Orders, and Account. Show the cart contextually. Keep help easy to find.

Use short sentences, familiar actions, clear back navigation, and confirmation for important changes. Show upload progress and allow customers to retry failed uploads without restarting registration.

Adopt the supplied Hamiya branding. If brand assets are unavailable, use a restrained provisional design and clearly identify it for owner review.

Optimize for affordable Android phones and limited data. Compress images, load thumbnails first, paginate long lists, and minimize unnecessary animation.

Support an installable mobile web experience where appropriate. Cache public catalogue content for browsing and preserve drafts, but clearly label offline or stale information. Revalidate stock and prices online before submitting an order. Never show an offline request as confirmed.

## 10. Privacy, security, and reliability

Enforce authentication and permissions on the server. Customers may access only their own private profile, documents, orders, and enquiries.

Store identity and trade licence files privately with encryption in transit and at rest, access controls, and short-lived authorized download links. Keep them out of public buckets, analytics, logs, and ordinary catalogue caches.

Mask National ID values in routine views. Explain why documents are collected, who can review them, and the applicable retention process. Keep marketing consent separate and optional.

Validate uploaded file types and sizes, protect sign-in and verification endpoints against abuse, and retain an audit trail for sensitive staff actions. Never expose administrative credentials in client code.

Handle slow connections, expired sessions, interrupted uploads, duplicate taps, unavailable products, rejected applications, and backend failures with clear recovery actions.

## 11. Implementation and delivery

Inspect any existing project before changing it. Reuse its repository, branding, and integrations where appropriate. If this is a new project, propose a maintainable stack and document the choice.

Deliver the customer application, administration workspace, database schema and migrations, private document storage, translation files, supplied food seed data, and setup instructions.

Keep credentials in environment configuration. Clearly identify integrations, assets, translations, and business settings that still require owner input. Do not claim a service is connected until it has been verified.

## 12. Acceptance criteria

Demonstrate that:

1. Customers can register, save progress, upload all required documents, and see their verification status.
2. Incomplete or unapproved profiles cannot bypass ordering restrictions.
3. All three languages cover the complete customer journey.
4. All three business categories work, with honest empty states for missing listings.
5. The eleven supplied products retain the correct prices and counts; unresolved sales units and the missing Cappuccino Softi count remain flagged.
6. Every displayed price and order total uses ETB with an explicit sales unit where applicable.
7. Publishing products, recording sales, adding stock, and marking items unavailable update customer-facing information.
8. Competing orders and duplicate submissions cannot oversell stock or deduct it twice.
9. Food orders, coffee quotations, and car enquiries follow their appropriate workflows.
10. Customers cannot read another customer’s documents or records, and staff permissions are enforced.
11. Slow-network and offline states preserve work and never fabricate confirmed orders, availability, or payments.
12. The application is usable on a small Android screen without clipped text or obstructed controls.

Build a practical Hamiya customer application that local people can understand quickly and staff can operate confidently.
