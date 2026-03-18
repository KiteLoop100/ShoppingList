# ALDI Einkaufsliste — Executive Summary

## What It Is

The ALDI Einkaufsliste is a smart, installable shopping list app that learns each customer's habits and their local store layout to make grocery shopping faster, easier, and more enjoyable. It works offline on any smartphone, tablet, or desktop browser — no app store download required. Beyond serving the customer, it creates a continuous feedback loop of anonymized shopping data that gives ALDI real-time demand signals, assortment intelligence, and crowdsourced store-layout information.

---

## Value for the Customer

- **Self-learning store navigation** — The app learns the aisle order of each store from the sequence in which items are checked off, so the shopping list automatically re-sorts itself to match the customer's walking route.
- **Instant product search** — A client-side search engine delivers results in under 50 ms with personalized ranking based on purchase history, dietary preferences, and current promotions.
- **Flyer & receipt integration** — Customers can browse digital flyers, add promotional items with one tap, and scan receipts to track prices and build a household inventory with shelf-life reminders.
- **Multi-retailer awareness** — Items not available at ALDI can be tagged for purchase elsewhere, keeping the entire weekly shop in a single list.
- **Barcode scanning & photo capture** — Products can be added by scanning a barcode or photographing a shelf label; AI extracts the product details automatically.
- **Works offline, syncs everywhere** — The app is fully usable without an internet connection and syncs seamlessly across devices when connectivity returns.
- **Bilingual** — Available in German and English.

---

## Value for ALDI

- **Early demand signals** — Aggregated list data reveals what customers plan to buy before they enter the store, enabling more accurate demand forecasting and replenishment.
- **Planned vs. actual analysis** — Receipt scanning closes the loop between what was planned and what was purchased, exposing substitution patterns, impulse additions, and unmet demand.
- **Assortment intelligence** — Search queries that return no results and competitor-product entries highlight gaps in the current assortment.
- **Crowdsourced store mapping** — Check-off sequences build a detailed model of each store's layout without manual surveying or hardware investment.
- **Direct customer channel** — In-app feedback (product-level, general, and post-shopping) gives ALDI a low-friction way to collect qualitative insights.
- **Digital flyer conversion** — Measurable click-to-list rates show which promotions drive real purchase intent.
- **Competitive visibility** — Multi-retailer tagging and competitor-product data provide insight into where and why customers shop outside ALDI.

---

## Architecture at a Glance

| Layer | Technology | Role |
|-------|-----------|------|
| Frontend | Next.js 14, React, Tailwind CSS | Server-rendered PWA, installable on home screen |
| Local database | Dexie.js (IndexedDB) | Offline-first cache for products, store layouts, preferences |
| Backend & auth | Supabase (PostgreSQL, Auth, Realtime) | Source of truth for lists, trips, receipts, user data |
| AI services | Google Gemini, Anthropic Claude | Photo recognition, receipt OCR, product categorization |
| Hosting | Vercel (serverless) | Auto-scaling, global CDN, zero-ops deployment |
| Monitoring | Sentry | Error tracking and performance monitoring |

**Key architectural principle — offline-first:** All reads hit the local IndexedDB cache first. Supabase syncs changes in the background via delta-sync (only records modified since the last sync are transferred). This keeps the UI responsive even on poor mobile connections inside a store.

---

## Data Model Overview

The database centres on a small number of core entities:

- **Products** (~4,000 active ALDI SKUs) — linked to ~61 demand groups (commodity categories) and optional sub-groups.
- **Shopping Lists & Items** — one active list per user; items reference either an ALDI product or a competitor product and carry a demand-group code for aisle sorting.
- **Stores** — GPS coordinates, retailer identifier, and a flag indicating whether learned sorting data exists.
- **Aisle Orders** — per-store learned positions derived from check-off sequences and pairwise comparisons; a chain-wide aggregate serves as fallback.
- **Receipts & Receipt Items** — scanned receipts with line-item detail, supporting multi-retailer price tracking.
- **Competitor Products** — non-ALDI items with retailer tag, demand-group mapping, and price history.

All user data is row-level secured via Supabase Auth (each user can only access their own data).

---

## Current Status & Outlook

The app is **deployed and functional** with core features live: smart list management, self-learning aisle sorting, product search, receipt scanning, flyer browsing, photo capture, and multi-device sync. Security hardening and launch-readiness checks are complete.

Planned next phases include:

- **Voice input** for hands-free item entry
- **Shared / family lists** with real-time collaboration
- **Semantic AI search** for natural-language queries ("something for dinner tonight")
- **Smart savings notifications** with personalized deal alerts and geofencing
- **Analytics dashboard** for shopping trends and budget tracking
- **ALDI Customer Intelligence** — opt-in micro-surveys, out-of-stock reports, and assortment wish lists fed directly back to category management

---

*Document generated: March 2026*
