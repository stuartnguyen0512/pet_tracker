# Product Requirements Document

## Pet Health & Vet Record Tracker (iOS, cloud-synced)

**Author:** Min
**Status:** Draft v2.0
**Last updated:** July 10, 2026

**Changelog from v1.2:**

- Major scope change: adds per-user accounts (Supabase Auth) and cloud sync (Supabase/Postgres). This reverses the v1 non-goals "cloud sync / multi-device access" and "account creation or login."
- Local SQLite remains the on-device source of truth. Sync is additive and **offline-first** — the app must keep working with zero connectivity between syncs, per the original v1 goal.
- Sync is **manual** — a "Sync Now" action, not automatic background sync. Chosen for v2 simplicity and debuggability.
- The pet-count unlock flag now also syncs per-account via Supabase, so unlocking on one device carries to the account's other devices. It remains a trusted client-set flag — **no payment/receipt verification is in scope**, unchanged from v1's explicit subscription non-goal.
- Photos now sync across devices via Supabase Storage (previously device-local only).
- v1 dogfooding data is **not migrated** — v2 starts fresh. Acceptable since v1 dogfooding was only a couple of weeks of test data.
- Sharing/collaboration between different people's accounts is explicitly out of scope — **personal-only** accounts (one user, their own devices).

---

## 1. Summary

A pet owner's app for logging and viewing health records — vaccinations, vet visits, medications, weight, notes — that works fully offline on-device and can be manually synced to the owner's own Supabase account so their data is available across their own multiple devices. No subscriptions, no data sharing between users, no payment processing in this phase.

## 2. Problem Statement

Existing pet health apps (Vet Record, VitusVet, VetVault, PetnotePlus, PetDesk) have real, documented complaints:

- Basic features (adding a second pet, setting reminders) are **locked behind subscription paywalls**
- Several apps are **outdated, abandoned, or crash on newer iOS versions**
- Records are often **unreachable without internet**, which matters most in an actual emergency
- Some free apps monetize by **selling user data**

v1 addressed this by staying local-only. v2 keeps the parts of that pitch that matter and drops the parts that were really just implementation detail: the differentiator was never "your phone never talks to a server" — it was "no subscription, ever" and "never unusable without signal." v2 adds accounts and sync while preserving both of those: the app never requires a connection to function, and there's still no subscription or feature-gating beyond pet count.

## 3. Goals

- Let an owner log a vaccine, vet visit, medication, or note in under 15 seconds — unchanged, still an instant local write.
- Make all records fully accessible offline, instantly, with zero loading/sync delay — unchanged. Sync is additive, never a dependency for core usage.
- Support multiple pets without a subscription or per-feature paywall — unchanged, one-time unlock only.
- **New:** let an owner access the same pet/record data from more than one of their own personal devices, by manually triggering a sync when online.
- **New:** let an owner's data survive losing or replacing their phone, by living in their own Supabase account rather than only in one device's local storage.
- Timeline: v1 was scoped at 4-5 weeks solo. v2 is materially more scope (auth, sync engine, storage, RLS) — treat the v1 timeline as void; a v2 estimate is an open question (§13), not inherited from v1.

## 4. Non-Goals (v2)

- **Subscription monetization or payment processing, in any form** — no recurring billing, no auto-renewing IAP, no tiered plans, and (new in v2) no receipt/purchase verification of any kind. The one-time unlock stays a trusted client/account flag exactly as in v1 — do not wire up StoreKit purchases or server-side receipt checks without this being explicitly revisited. This remains a hard constraint, not an oversight.
- Sharing or collaboration between different users' accounts (e.g. a co-owner or vet viewing/editing the same pet). Every account only ever sees its own data.
- Automatic/background sync. Sync only happens when the user taps "Sync Now."
- Push notification reminders (still planned for a future v3).
- Vet-facing tools, OCR, document scanning, or AI features.
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
| Pet owner | Use every feature free, forever, for my first pet           | The app never nickel-and-domes me on basics like competitors do                                          |
| Pet owner | Pay once (no subscription) to add a second or third pet     | If I need more than one pet tracked, I pay a fair one-time price instead of committing to recurring fees |
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

### 7.5 Free

- **Free:** full feature set — unlimited records, all record types, photo attachments, timeline — for exactly 1 pet, no time limit, no feature caps.

### 7.6 Data Export / Backup

- Manual "Export All Data" action, reachable from the settings screen (unchanged from v1)
- Exports all pets and records as a single JSON file via the native iOS share sheet
- This remains available as a manual, device-local safety net independent of cloud sync

### 7.7 Authentication (new)

- Sign up / log in via email + password, or Sign in with Apple
- Session persists across app launches
- Behavior on logout (whether local data is cleared or retained) is an open question — see §13

### 7.8 Cloud Sync (new)

- A manual **"Sync Now"** action (location TBD — see §13) triggers, in order: push all locally-changed ("dirty") pets/records/entitlement to Supabase; pull remote changes since the last successful sync; merge into local SQLite using last-write-wins on `updated_at`.
- Deleting a pet or record locally marks it as deleted (tombstone) rather than physically removing the row immediately, so the delete can propagate to other devices on the next sync in either direction.
- No automatic or background sync in v2 — only triggered by the user.
- Conflict handling is last-write-wins, silently — acceptable given personal-only accounts (low likelihood of the same record being edited offline on two devices before either syncs). No conflict-resolution UI in v2.

### 7.9 Cloud-Backed Pet Unlock (new)

- The `unlocked` flag (§7.5) is stored per-account in Supabase in addition to locally, so unlocking on one device is reflected on the account's other devices after a sync.
- This remains a trusted, client-settable flag — no StoreKit purchase flow, no receipt verification. Explicitly out of scope per §4 until revisited.

### 7.10 Photo Sync (new)

- Photos are stored locally on-device (as in v1) and additionally uploaded to Supabase Storage, scoped to the account, when a sync runs.
- Pulling a sync brings down any photos added on other devices, caching them locally for offline viewing.

## 8. Technical Considerations

- **Local storage:** `expo-sqlite`, unchanged from v1 — remains the on-device source of truth for instant reads/writes.
- **Cloud storage:** Supabase (Postgres) for relational data, Supabase Auth for accounts, Supabase Storage for photos.
- **Sync engine:** custom-built, not a third-party sync product. A dedicated offline-first sync engine (e.g. PowerSync) was considered and set aside for v2 — personal-only accounts mean no concurrent-editor conflicts, so a simple dirty-flag + last-write-wins outbox is sufficient without adding a paid external dependency.
- **Row-level security:** every Supabase table scoped `owner_id = auth.uid()`. No sharing/collaboration policies, consistent with personal-only scope (§4).
- **Apple platform requirement:** offering email/password login obligates also offering Sign in with Apple — already satisfied by this plan.
- **No subscription/payment SDK** of any kind, per §4/§7.9.
- **Git workflow:** every feature or bug fix starts on its own branch off `main` (never commit directly to `main`) — see `CLAUDE.md`'s "Git workflow" section for the exact branch-naming convention and commands.

## 9. Success Metrics (v2)

- App functions fully offline end-to-end between syncs, with no crashes on core flows (unchanged from v1).
- A manual sync round-trip (push then pull) completes with no data loss across two of Min's own devices during dogfooding.
- Personal daily use across at least two personal devices for a couple of weeks before considering public release.

## 10. Monetization

Unchanged from v1: one-time purchase (~$7.99) to unlock unlimited pets, no subscription. The only v2 change is that the unlock flag now also lives in Supabase per-account (§7.9) — the purchase itself is still not actually verified or processed; this is a trusted flag, not real payment collection. Do not add real payment processing without this being explicitly revisited.

## 11. Content / Distribution Angle

Updated framing: "I built a pet health app with no subscription, ever — and it works fully offline, syncing to your own account only when you want it to" remains a relatable, shareable story. The "your data never touches a server" framing from v1 is retired since it's no longer accurate; the differentiator is now "no subscription, no sharing, always usable offline."

## 12. Milestones (v2 proposed)

1. **Supabase project setup** — schema (`pets`, `health_records`, `entitlements`), row-level security policies, auth providers configured (email/password + Sign in with Apple)
2. **In-app authentication** — sign up / log in screens, Apple sign-in button, session-gated app entry (replacing today's "block render until local DB ready" gate)
3. **Local sync scaffolding** — add `updated_at` / `dirty` / `deleted_at` columns to the local schema; build the push/pull sync function
4. **"Sync Now" UI** — wire the manual sync trigger into the app (location per §13)
5. **Photo sync** — Supabase Storage bucket, upload/download of dirty photos
6. **Cloud-backed unlock** — wire `entitlements` table to the existing `unlocked` flag / `unlockPets()`
7. **Fresh dogfooding** — v1 local data is not migrated; dogfood v2 fresh across two of Min's own devices for at least 2 calendar weeks
8. **Docs + polish** — finalize `PRD.md`/`CLAUDE.md` to match the as-built implementation, then App Store submission

## 13. Open Questions

- What happens to local data on logout — cleared immediately, or retained until the next login/sync? Needs a decision before building the auth flow.
- Where does "Sync Now" live in the UI — the existing Settings screen, or a persistent control on the pet list? A UX call for Min.
- Is silent last-write-wins conflict handling acceptable long-term, or should the app ever surface "your other device also changed this" to the user? Silent is simpler and is v2's default; revisit if it causes real data loss during dogfooding.
- What's a realistic v2 timeline? v1's 4-5 week estimate does not carry over given the added scope (auth, sync engine, storage, RLS) — needs its own honest estimate before committing to a date.

---

_This PRD covers the v2 cloud-sync scope. Real payment/receipt verification and multi-user sharing are intentionally deferred; automatic background sync is deferred in favor of the manual "Sync Now" action._
