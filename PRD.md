# Product Requirements Document

## Pet Health & Vet Record Tracker (iOS, cloud-synced)

**Author:** Min
**Status:** Final v2.1
**Last updated:** July 16, 2026

**Changelog from v2.0 (see `docs/adr/0001-subscription-trial-monetization.md` for full reasoning):**

- **Monetization returns**, in a new form: a **14-day free trial converting to a $4.99/month auto-renewing subscription** — not the old one-time $7.99 unlock this document removed in the v2.0 changelog below, and not the fully-free model v2.0 replaced it with either.
- **No permanent free tier.** After the 14-day trial, the entire app requires an active subscription — there is no limited free version to fall back to (a deliberate simplicity choice over a `pet-count`-style cap).
- **RevenueCat** handles StoreKit receipt validation, trial tracking, and entitlement sync — not a hand-rolled StoreKit 2 + App Store Server API integration.
- **Affiliate insurance links are explicitly out of scope for this revision** — a separate future decision, not bundled into this monetization pass.
- This is evaluated against a separate, much larger "PetCare AI Assistant" concept Min was considering (AI symptom triage, GPS/geofencing collar, hardware, affiliate insurance links). Only the monetization-model piece is adopted here. **AI features and GPS/geofencing are explicitly evaluated and deferred, not adopted** — see updated §4.
- Tech stack, sync design, and everything else from v2.0 is unchanged — this is the same Expo/RN + Supabase app, not a rewrite.

**Changelog from v1.2:**

- Major scope change: adds per-user accounts (Supabase Auth) and cloud sync (Supabase/Postgres). This reverses the v1 non-goals "cloud sync / multi-device access" and "account creation or login."
- Local SQLite remains the on-device source of truth. Sync is additive and **offline-first** — the app must keep working with zero connectivity between syncs, per the original v1 goal.
- Sync is **manual** — a "Sync Now" action, not automatic background sync. Chosen for v2 simplicity and debuggability.
- **Monetization removed entirely.** v1's one-time-unlock pet cap (~$7.99) is gone — every pet is free and unlimited, for every account. See Non-Goals (§4), §7.5, and §10.
- Photos now sync across devices via Supabase Storage (previously device-local only).
- v1 dogfooding data is **not migrated** — v2 starts fresh. Acceptable since v1 dogfooding was only a couple of weeks of test data.
- Sharing/collaboration between different people's accounts is explicitly out of scope — **personal-only** accounts (one user, their own devices).

---

## 1. Summary

A pet owner's app for logging and viewing health records — vaccinations, vet visits, medications, weight, notes — that works fully offline on-device and can be manually synced to the owner's own Supabase account so their data is available across their own multiple devices. A 14-day free trial, then a $4.99/month subscription; no data sharing between users.

## 2. Problem Statement

Existing pet health apps (Vet Record, VitusVet, VetVault, PetnotePlus, PetDesk) have real, documented complaints:

- Basic features (adding a second pet, setting reminders) are **locked behind subscription paywalls**
- Several apps are **outdated, abandoned, or crash on newer iOS versions**
- Records are often **unreachable without internet**, which matters most in an actual emergency
- Some free apps monetize by **selling user data**

v1 addressed this by staying local-only. v2 keeps the part of that pitch that still matters and drops the rest: the differentiator was never "your phone never talks to a server" — it's "never unusable without signal." v2 adds accounts, sync, and a trial-then-subscription model (ADR 0001) while preserving that: the app never requires a connection to function offline between syncs, even though it's no longer free after the 14-day trial.

## 3. Goals

- Let an owner log a vaccine, vet visit, medication, or note in under 15 seconds — unchanged, still an instant local write.
- Make all records fully accessible offline, instantly, with zero loading/sync delay — unchanged. Sync is additive, never a dependency for core usage.
- Support unlimited pets during the trial and for subscribers — no per-pet cap (only the trial/subscription boundary itself gates access, not pet count).
- **New:** let an owner access the same pet/record data from more than one of their own personal devices, by manually triggering a sync when online.
- **New:** let an owner's data survive losing or replacing their phone, by living in their own Supabase account rather than only in one device's local storage.
- Timeline: **6–8 weeks solo**, covering auth + sync (milestones 1–5, ~4–5 weeks), RevenueCat/paywall integration (milestone 8, ~1–2 weeks, can run in parallel with 3–5), then dogfooding (milestone 6) before submission (milestone 7). v1's 4-5 week estimate does not apply — this is materially more scope.

## 4. Non-Goals (v2)

- ~~Monetization or payment processing, in any form~~ — **superseded, see `docs/adr/0001-subscription-trial-monetization.md`.** A 14-day free trial → $4.99/month subscription via RevenueCat/StoreKit is now in scope (§7.5, §10).
- **Any permanent free tier.** After the trial, the full app is gated — do not build a limited-free-forever mode (e.g. reviving a 1-pet cap) alongside the subscription.
- **Affiliate insurance links or any other affiliate revenue.** Considered as part of the PetCare AI Assistant concept, explicitly deferred to a future, separate decision — not part of this monetization pass.
- **AI features of any kind** — including AI-driven symptom analysis/triage ("AI Vet Assistant"). Evaluated as part of a separate PetCare AI Assistant concept and explicitly deferred, not adopted, in this revision. Do not build against this without a separate explicit decision.
- **GPS tracking / geofencing.** Also evaluated and deferred — real pet GPS requires a physical collar (a phone doesn't travel with the pet), which is a different kind of project (hardware) than this app's scope. Revisit only if a specific third-party collar API integration is separately proposed.
- Sharing or collaboration between different users' accounts (e.g. a co-owner or vet viewing/editing the same pet). Every account only ever sees its own data.
- Automatic/background sync. Sync only happens when the user taps "Sync Now."
- Push notification reminders (still planned for a future v3).
- Vet-facing tools, OCR, document scanning.
- Android — still just default Expo scaffolding, not a build target.

## 5. Target User

Pet owners who currently track health info via memory, paper, or notes apps, and want something purpose-built but simple. In v2, this includes an owner who uses more than one personal device (e.g. replaced their phone, or also uses an iPad) — but still just one person per account, not a shared household or vet-facing tool.

## 6. User Stories

| As a...   | I want to...                                                | So that...                                                                                               |
| --------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pet owner | Add a pet with name, species, and photo                     | I can start tracking right away                                                                          |
| Pet owner | Log a vaccine, vet visit, medication, or note               | I have a complete health history in one place                                                            |
| Pet owner | View a chronological timeline per pet                       | I can quickly see what's happened and when                                                               |
| Pet owner | Access all records with no internet connection              | I'm never blocked during an emergency                                                                    |
| Pet owner | Try every feature free for 14 days, for as many pets as I have | I can see the app's full value before committing to a subscription                                    |
| Pet owner | Create an account with email/password or Sign in with Apple | My data is tied to me, not just to one device                                                            |
| Pet owner | Tap "Sync Now" when I have signal                           | My latest changes are backed up and available on my other device                                         |
| Pet owner | Keep logging records with no connection between syncs       | I'm never blocked just because I don't have signal right now                                             |

## 7. Functional Requirements (v2 MVP)

### 7.1 Pet List (Home Screen)

- List of added pets: name, species, thumbnail photo
- "+ Add Pet" button
- Tap a pet to open its profile

### 7.2 Pet Profile

- Header: name, species, photo, age/birthdate (optional)
- Chronological timeline of all records (newest first)
- Each timeline entry shows: type icon, date, short title
- "+ Add Record" button

### 7.3 Add/Edit Record

- Record type selector: Vaccine / Vet Visit / Medication / Weight / Note
- Date picker (defaults to today)
- Free-text details field
- Optional: attach a photo — stored locally, synced to the account's cloud storage on next sync
- Save / Cancel

### 7.4 Data Storage

- `expo-sqlite` remains the on-device source of truth — reads and writes are always instant and local, never blocked on a network call.
- Supabase (Postgres) holds the cloud copy of the same data, scoped per account.
- Data model (local + cloud, cloud adds sync/ownership columns): `Pet { id, name, species, photo, birthdate }`, `HealthRecord { id, petId, type, date, details, photo }`, both cloud-side gaining `owner_id`, `updated_at`, `deleted_at`.

### 7.5 Trial / Subscription (finalized — see ADR 0001)

- **14-day free trial**, full access to the entire app, no feature restrictions.
- After the trial: **$4.99/month auto-renewing subscription** required to continue using the app. There is no permanent free tier or feature-limited fallback — the app is fully gated, not partially.
- Implemented via **StoreKit** (Apple requires all in-app digital subscriptions to go through IAP) with **RevenueCat** handling purchase flow, receipt validation, trial tracking, and cross-device entitlement sync — not a hand-rolled StoreKit 2 + App Store Server API integration, and not a client-only trusted flag like the old one-time unlock.
- Entitlement state syncs per-account (mirrors the pattern already used for `pets`/`health_records` — RLS-scoped to `owner_id`), so a subscription started on one device is recognized on the account's other devices.

### 7.6 Data Export / Backup

- Manual "Export All Data" action, reachable from the settings screen (unchanged from v1)
- Exports all pets and records as a single JSON file via the native iOS share sheet
- This remains available as a manual, device-local safety net independent of cloud sync

### 7.7 Authentication (new)

- Sign up / log in via email + password, or Sign in with Apple
- Session persists across app launches
- **Logout clears local data immediately.** Before confirming logout, show a warning so the user knows what's about to happen — e.g. "Logging out will delete all pet data stored on this device. Make sure you've synced first." (exact copy TBD at build time, but a warning is required, not optional — this is a destructive, irreversible local action per this project's Reversibility Rule). Data already synced to Supabase is unaffected and comes back on next login + pull.

### 7.8 Cloud Sync (new)

- A manual **"Sync Now"** action, on the **Settings screen next to "Export All Data"**, triggers, in order: push all locally-changed ("dirty") pets/records to Supabase; pull remote changes since the last successful sync; merge into local SQLite using last-write-wins on `updated_at`.
- Deleting a pet or record locally marks it as deleted (tombstone) rather than physically removing the row immediately, so the delete can propagate to other devices on the next sync in either direction.
- No automatic or background sync in v2 — only triggered by the user.
- **Conflict handling is last-write-wins, silently, confirmed for MVP** (2026-07-16) — acceptable given personal-only accounts (low likelihood of the same record being edited offline on two devices before either syncs). No conflict-resolution UI in v2; revisit only if this causes real, noticed data loss during dogfooding (milestone 6).

### 7.9 Photo Sync (new)

- Photos are stored locally on-device (as in v1) and additionally uploaded to Supabase Storage, scoped to the account, when a sync runs.
- Pulling a sync brings down any photos added on other devices, caching them locally for offline viewing.

## 8. Technical Considerations

- **Local storage:** `expo-sqlite`, unchanged from v1 — remains the on-device source of truth for instant reads/writes.
- **Cloud storage:** Supabase (Postgres) for relational data, Supabase Auth for accounts, Supabase Storage for photos.
- **Sync engine:** custom-built, not a third-party sync product. A dedicated offline-first sync engine (e.g. PowerSync) was considered and set aside for v2 — personal-only accounts mean no concurrent-editor conflicts, so a simple dirty-flag + last-write-wins outbox is sufficient without adding a paid external dependency.
- **Row-level security:** every Supabase table scoped `owner_id = auth.uid()`. No sharing/collaboration policies, consistent with personal-only scope (§4).
- **Apple platform requirement:** offering email/password login obligates also offering Sign in with Apple — already satisfied by this plan.
- **Git workflow:** every feature or bug fix starts on its own branch off `main` (never commit directly to `main`) — see `CLAUDE.md`'s "Git workflow" section for the exact branch-naming convention and commands.

## 9. Success Metrics (v2)

- App functions fully offline end-to-end between syncs, with no crashes on core flows (unchanged from v1).
- A manual sync round-trip (push then pull) completes with no data loss across two of Min's own devices during dogfooding.
- Personal daily use across at least two personal devices for a couple of weeks before considering public release.

## 10. Monetization

**Finalized — see `docs/adr/0001-subscription-trial-monetization.md`.** 14-day free trial, full app access, no restrictions. After the trial, a **$4.99/month auto-renewing subscription** is required to continue using the app — there is no permanent free tier. Implemented via StoreKit + RevenueCat (not a hand-rolled receipt-verification integration, not a client-only trusted flag). Affiliate revenue (e.g. pet-insurance referral links) is explicitly out of scope for this monetization pass — a separate future decision.

## 11. Content / Distribution Angle

**Needs a full rewrite before launch** — the previous "completely free" framing no longer applies. New framing should center the trial ("try the full app free for 14 days") rather than "free forever," since that promise no longer holds. Do not reuse old marketing copy claiming the app is free.

## 12. Milestones (v2 proposed)

1. **Supabase project setup** — schema (`pets`, `health_records`), row-level security policies, auth providers configured (email/password + Sign in with Apple)
2. **In-app authentication** — sign up / log in screens, Apple sign-in button, session-gated app entry (replacing today's "block render until local DB ready" gate)
3. **Local sync scaffolding** — add `updated_at` / `dirty` / `deleted_at` columns to the local schema; build the push/pull sync function
4. **"Sync Now" UI** — wire the manual sync trigger into the Settings screen, next to "Export All Data" (§7.8)
5. **Photo sync** — Supabase Storage bucket, upload/download of dirty photos
6. **Fresh dogfooding** — v1 local data is not migrated; dogfood v2 fresh across two of Min's own devices for at least 2 calendar weeks
7. **Docs + polish** — finalize `PRD.md`/`CLAUDE.md` to match the as-built implementation, then App Store submission
8. **Trial/subscription** — RevenueCat SDK integration + App Store Connect subscription product (14-day trial, $4.99/month); `entitlements` table + migration (RLS-scoped like `pets`/`health_records`); rework `app/paywall.tsx` for trial/subscription state instead of the old one-time unlock; rewrite distribution copy (§11) around the trial. Can run in parallel with milestones 3–5 since it touches different code, but should land before milestone 7 (App Store submission) since the app can't ship without it.

## 13. Open Questions — all resolved 2026-07-16

- ~~What happens to local data on logout~~ — **Resolved: cleared immediately, with a confirmation warning before logout** (not a silent wipe) telling the user local data will be deleted and to sync first if they haven't. See §7.7.
- ~~Where does "Sync Now" live in the UI~~ — **Resolved: Settings screen, next to "Export All Data."** See §7.8.
- ~~Is silent last-write-wins conflict handling acceptable long-term~~ — **Resolved: yes for MVP, no conflict UI.** Revisit only if it causes real, noticed data loss during dogfooding (milestone 6). See §7.8.
- ~~What's a realistic v2 timeline~~ — **Resolved: 6–8 weeks solo.** See §3.

No open questions remain blocking implementation. Milestones 1–8 (§12) can proceed in the sequence/parallelism described there.

---

_This PRD covers the v2.1 cloud-sync + trial-subscription scope. Multi-user sharing, AI features, and GPS/geofencing are intentionally out of scope; automatic background sync is deferred in favor of the manual "Sync Now" action; affiliate revenue is deferred to a future decision._
