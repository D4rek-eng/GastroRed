# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Diners in Peru who want to discover nearby restaurants, compare options, review menus and request a reservation.
- Restaurant owners who manage restaurant hours, availability, pricing, and reservation requests through an authenticated portal.

## Product Purpose

GastroRed helps people find a restaurant for their next meal by combining a curated restaurant guide with nearby places from OpenStreetMap. Success means choosing a suitable place with useful information and a clear next step.

## Positioning

GastroRed combines curated restaurant information (menus, illustrative prices and reviews) with nearby places from OpenStreetMap, whose available details may be incomplete.

## Operating Context

The app is responsive and in Spanish. It uses Peruvian soles for prices. Diners can share their device location to calculate distances and discover nearby map listings; coordinates are not saved to a server.

## Capabilities and Constraints

- Search and filter by restaurant, district, cuisine and dish; compare restaurants; view restaurant details; save personal favorites; and request restaurant reservations. Reservations, reviews and favorites require a signed-in customer account.
- Discover nearby OpenStreetMap listings at 200 m, 500 m and 1 km. Guests and Free customers are limited to 200 m; active Pro customers may choose 500 m or 1 km. Choosing a Pro radius explains the paid plan and links to upgrade or sign-in.
- Customer accounts use a personal email and can select Free or Pro at S/ 100 per month. Restaurant accounts use a company domain and matching corporate email and require the S/ 120 monthly plan.
- When the API, MySQL, SMTP and Mercado Pago are configured, account data, sessions, reservations, reviews and subscription state persist in MySQL. Paid access is activated only after a verified Mercado Pago webhook; incomplete setup must be reported rather than presented as a completed payment.
- Active restaurant accounts can edit hours, available times, reservation policy, per-person pricing and listed dish prices, and can manage their pending and completed reservations.
- Reservation requests remain pending until the restaurant confirms them; restaurants can later mark them completed. A submitted request is not a confirmed booking.
- Restaurant data, prices, reviews, schedules, distances and availability remain illustrative until verified and maintained by the restaurant.

## Brand Commitments

Keep the GastroRed name and Spanish-language identity. The landing should feel part of the existing restaurant discovery product. Eventbeds is a reference for a fluid, animated presentation, not content or branding to copy.

## Evidence on Hand

- Existing implementation and assets under `src/` and `public/`.
- The existing demo guide, nearby OpenStreetMap discovery, comparison and reservation flows.
- Mercado Pago and SMTP require deployment credentials; no credentials or production payment account are included in the repository.

## Product Principles

- Help diners make an informed choice without presenting demo information as verified.
- Make nearby discovery useful while explaining that OpenStreetMap coverage varies.
- Keep the curated guide available alongside map-based listings.
- Do not imply that reservations are confirmed before restaurant approval.
- Do not claim that a plan is paid or active until Mercado Pago confirms it through a verified webhook.
