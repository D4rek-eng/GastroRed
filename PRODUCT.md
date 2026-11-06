# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Diners in Peru who want to discover nearby restaurants, compare options, review menus and request a reservation.
- Restaurant owners who use the demo portal to manage restaurant details, hours, available times and reservation policies.

## Product Purpose

GastroRed helps people find a restaurant for their next meal by combining a curated restaurant guide with nearby places from OpenStreetMap. Success means choosing a suitable place with useful information and a clear next step.

## Positioning

GastroRed combines curated restaurant information (menus, illustrative prices and reviews) with nearby places from OpenStreetMap, whose available details may be incomplete.

## Operating Context

The app is responsive and in Spanish. It uses Peruvian soles for prices. Diners can share their device location to calculate distances and discover nearby map listings; coordinates are not saved to a server.

## Capabilities and Constraints

- Search and filter by restaurant, district, cuisine and dish; compare restaurants; view restaurant details; save favorites on the device; and submit demo reservation requests.
- Discover nearby OpenStreetMap listings at 200 m, 500 m and 1 km. OpenStreetMap may not provide complete restaurant details.
- Free and Pro are informational plan descriptions for the requested landing page only. No subscription, payment, account entitlement or plan-based radius restriction is implemented.
- Free is described as nearby discovery at 200 m. Pro is described as offering 500 m to 1 km discovery. Pro pricing is undecided and must not be invented; show it as “Próximamente”.
- Demo restaurant data, prices, reviews, schedules, distances and reservation availability are illustrative, not verified claims.

## Brand Commitments

Keep the GastroRed name and Spanish-language identity. The landing should feel part of the existing restaurant discovery product. Eventbeds is a reference for a fluid, animated presentation, not content or branding to copy.

## Evidence on Hand

- Existing implementation and assets under `src/` and `public/`.
- The existing demo guide, nearby OpenStreetMap discovery, comparison and reservation flows.
- No confirmed subscription price, paying customers, testimonials or production payment integration.

## Product Principles

- Help diners make an informed choice without presenting demo information as verified.
- Make nearby discovery useful while explaining that OpenStreetMap coverage varies.
- Keep the curated guide available alongside map-based listings.
- Do not imply that reservations are confirmed when they are only demo requests.
