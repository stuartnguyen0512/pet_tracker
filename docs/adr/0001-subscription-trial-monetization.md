# ADR 0001: Reintroduce monetization as trial-then-subscription

**Status:** Accepted
**Date:** 2026-07-16
**Author:** Min (decided during a `grill-with-docs` session with Claude)

## Context

PRD v2.0 (current, `PRD.md`) explicitly removed all monetization: "The app is fully free — no purchases, no subscriptions, no pet-count cap" (§4, §10). `CLAUDE.md`'s Monetization constraint section codifies this as a hard rule not to be reversed without explicit revisiting.

Min brought a second, separate document — a PRD for "PetCare AI Assistant" — describing a much larger product vision: AI-driven symptom triage, GPS/geofencing via a smart collar, PDF vet-report sharing, and a subscription-first monetization model (freemium + paid AI/cloud tier), plus affiliate revenue from pet-insurance referrals.

These two documents conflict on nearly every axis: tech stack (Flutter/Firebase vs. the existing Expo/RN + Supabase codebase, which already has real migrations and a live Supabase test suite), monetization (free vs. subscription), and scope (local health log vs. AI + hardware + GPS platform). Rather than treat "PetCare AI Assistant" as a new product, Min chose to treat it as a set of proposed changes to evaluate against the existing Pet Tracker, one decision at a time, rather than adopt it wholesale.

## Decisions made this session

1. **Same app, not a new product.** Pet Tracker's existing Expo/React Native + Supabase codebase and in-flight sync work are kept. No migration to Flutter/Firebase.
2. **Monetization returns, in a new form: 14-day free trial → $4.99/month auto-renewing subscription.** Not the old one-time $7.99 unlock. Users get full, unrestricted access for the trial period, then are charged monthly unless they cancel. **No permanent free tier** — after the trial, the entire app is gated, not partially (no revived pet-count cap or feature-limited fallback).
3. **GPS/geofencing is cut from scope entirely for now**, deferred to a future roadmap item. Reasoning: real pet GPS tracking requires a physical collar (a phone doesn't travel with the pet); building or integrating hardware is a different kind of project than a solo indie app MVP.
4. **AI Vet Assistant is cut from the PRD entirely for now**, not merely descoped to something safer. Min does not want to build anything AI-related in this phase — this may return in a future revisit, but is out of scope, not a stub.

## Why subscription requires more than the old trusted flag

The old one-time unlock never had to touch real payment: it was a locally (and later Supabase-) stored boolean the client set itself, with no purchase behind it, because the app was never actually charging anyone for it in a shipped, App-Store-reviewed sense before it was removed.

A trial that converts to a real recurring charge is different: **Apple requires all digital subscriptions sold inside an iOS app to go through StoreKit (In-App Purchase)** — this isn't a design choice, it's an App Store Review requirement. That means this feature can't be built as a client-only trusted flag the way the old unlock was. At minimum it requires:

- An auto-renewable subscription product configured in App Store Connect, with an introductory free-trial offer.
- StoreKit 2 purchase + subscription-status APIs on-device.
- Some way to verify entitlement server-side (so a device can't just fake "subscribed" locally) — this is the part that was never needed before.

## Build vs. buy: receipt verification

Two paths for the server-side entitlement check:

- **Hand-rolled**: StoreKit 2 + Apple's App Store Server API, verify receipts/transactions yourself, store entitlement state in the `entitlements`-style table (previously removed, would need to come back). Full control, but receipt validation has real edge cases (renewals, refunds, billing retry, cross-device restore) that are easy to get subtly wrong — and getting them wrong either loses revenue (users get free access) or breaks legitimate subscribers.
- **RevenueCat** (or similar, e.g. Superwall for paywall UI + RevenueCat for entitlements): handles StoreKit receipt validation, trial tracking, renewal/refund webhooks, and cross-device entitlement sync out of the box. Free tier covers indie-scale MRR. This is the de facto standard for solo/indie iOS subscription apps specifically to avoid hand-rolling receipt verification.

**Decision: RevenueCat.** Consistent with this project's existing build-vs-buy precedent (PowerSync was evaluated and skipped for the *sync engine* specifically because personal-only accounts didn't need its complexity — that reasoning doesn't transfer to payments, where the failure mode of hand-rolling is losing real money, not just extra engineering effort). Confirmed by Min 2026-07-16.

## Consequences

- `CLAUDE.md`'s Monetization constraint section has been rewritten to describe the finalized trial-then-subscription model and explicitly permit StoreKit/RevenueCat integration.
- The `entitlements` concept returns to the Supabase schema (removed in v2.0's "monetization removed entirely" change) — needs a new migration; RLS-scoped like `pets`/`health_records` (PRD §7.5).
- The paywall screen (`app/paywall.tsx`) still exists in the codebase from the earlier unlock flow — needs rework for trial/subscription copy and RevenueCat-driven state rather than being deleted (PRD milestone 8).
- Marketing/positioning copy (PRD §2, §11) is stale and needs a rewrite before launch — new framing centers the 14-day trial, not "free forever."
- AI Vet Assistant and GPS/geofencing are **not** part of this ADR's scope — they remain deferred; do not start building against the PetCare AI Assistant PRD's AI/GPS sections without a separate, explicit decision.
- Affiliate insurance links are explicitly deferred to a future, separate decision — not bundled into this monetization pass.

## Resolved questions (2026-07-16, second pass with Min)

- **Trial length / price:** 14 days, then $4.99/month.
- **Gating:** no permanent free tier — the entire app is gated after trial expires, not partially.
- **RevenueCat vs. hand-rolled StoreKit:** RevenueCat, confirmed.
- **Affiliate insurance links:** out of scope for this pass, deferred to a future decision.
