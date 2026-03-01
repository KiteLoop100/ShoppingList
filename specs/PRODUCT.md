# PRODUCT.md – Smart Shopping List for ALDI SÜD

## 1. Product Vision

An intelligent shopping list app that makes the entire ALDI SÜD shopping process – from planning to the last product in the cart – as fast and frictionless as possible.

The app automatically sorts the shopping list in the order of products in each store, supports both generic entries ("Milk") and specific ALDI products ("Milsani Low-Fat Milk 1.5% 1L"), and learns with every use – without manual data maintenance.

---

## 2. Project Background

- **Initiator:** Private project by an ALDI SÜD employee
- **Goal:** Build a functional prototype for internal presentation at ALDI SÜD
- **Status:** Stand-alone – no dependency on ALDI IT infrastructure
- **Perspective:** If successful, potential transition into the official ALDI app (possibly rebuilt with ALDI resources)
- **Resources:** Private budget, no company resources

---

## 3. Target Audience

- **Primary:** ALDI SÜD customers in Germany
- **Secondary:** ALDI SÜD customers worldwide (Australia, UK, USA, etc.)
- **Use case:** Families and individuals who regularly shop at ALDI and want to plan their shopping efficiently
- **Technical reach:** Must work on all common smartphones (iOS + Android), initially as web app (PWA)

---

## 4. The Problem

Shopping at ALDI consists of two phases, both unnecessarily tedious:

### Planning Phase
- Note down what's needed, ask the family
- Existing solutions (notes, to-do apps) are not optimized for shopping
- No way to check if a specific product is available at ALDI
- No overview of the expected price

### In-Store Phase
- The list is not sorted by store layout → walking back and forth
- Forgetting products or overlooking entries
- Shopping takes longer than necessary

No existing tool combines: intelligent product search, store-specific sorting, family-friendliness and self-learning behavior.

---

## 5. Design Principles

- **Minimal Clicks:** Every frequent action reachable in max 2 taps
- **Self-Learning:** System learns from all user behavior, minimal manual data maintenance
- **Modular:** Architecture allows standalone operation or later integration into existing apps
- **Multi-language from Day 1:** i18n built in. Start languages: German and English

---

## 6. Core Functions (Overview)

> Detailed feature descriptions in FEATURES-CORE.md, FEATURES-CAPTURE.md, FEATURES-FLYER.md.
> MVP scope in MVP.md.

- Smart product input with autocomplete (generic + specific)
- Automatic aisle sorting (self-learning, GPS-based store detection)
- Efficient check-off in store
- Family-friendly shared lists (requires account, Phase 3)
- Price estimation
- Shopping analytics (background)
- Error feedback for sorting

---

## 7. Account Model

### Anonymous-First
On first app open, an anonymous account (generic ID) is created in the background. All data – shopping history, preferences, learning progress – stored with this anonymous ID from the start.

### Without Registration
Full single-user functionality. Data accessible only on the registered device.

### With Registration (Phase 3)
User can create a personal account (email/password). Existing anonymous account linked to credentials – no data lost. Prerequisite for family features.

---

## 8. Product Database & Assortment

### Data Sources
- **Phase 1 (MVP):** Manual input via admin UI + crowdsourcing + photo capture
- **Phase 2:** Product database upload (CSV/JSON) or API connection
- Admin mode phased out once official data source is connected

### Assortment Types

**Daily Range (Permanent Assortment)**
- ~3,500 year-round products
- Prices change at varying intervals
- Partly national, partly regional availability

**Specials**
- Delivered once and sold until gone
- Always in roughly the same store location
- Products delivered on the same date are grouped together
- ~6,000 new specials per year

---

## 9. Phase Plan

| Phase | Focus |
|-------|-------|
| **Phase 1: MVP** | PWA, single user, generic + specific products, category pre-sorting, manual product maintenance + crowdsourcing + photo capture |
| **Phase 2: Intelligence** | Self-learning aisle sorting, personalized product ranking, price estimation, shopping analytics |
| **Phase 3: Family Features** | Shared lists, real-time sync, account model |
| **Phase 4: Native Apps** | PWA as iOS/Android app via Capacitor |
| **Phase 5: Extensions** | Multiple store chains (LIDL etc.), price comparison, Alexa integration, official product database API |

---

## 10. Long-Term Vision

- **Cross-chain price comparison:** Matching algorithm compares shopping list across competing chains
- **External integrations:** Recipe import, voice assistants, smart home
- **Transition to official ALDI app:** Concept and/or architecture transferred to official ALDI app if prototype is successful

---

## 11. Design & Brand Language

- ALDI SÜD design language (colors, typography) derived from public sources
- Usability oriented at best-in-class consumer apps, not the existing ALDI app
- Goal: ALDI look, best-in-class experience

---

## 12. Non-Functional Requirements

- **Performance:** Smooth with 4,000+ products in database
- **Device compatibility:** iOS Safari (15+), Android Chrome (10+)
- **Scalability:** Architecture scales from 1 user to thousands
- **Load time:** App opens in under 2 seconds
- **Accessibility:** Basic accessibility (font sizes, contrasts) from the start

---

*Last updated: 2025-02-22*
