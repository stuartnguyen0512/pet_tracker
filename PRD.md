# Product Requirements Document
## Pet Health & Vet Record Tracker (iOS MVP)
**Author:** Min
**Status:** Draft v1.1
**Last updated:** July 6, 2026

**Changelog from v1:**
- Resolved contradiction between Section 6 and 7.5 (multi-pet paywall wording)
- Corrected Section 8 — repo is Expo/React Native, not native Swift; storage/photo recommendations rewritten accordingly
- Moved data export/backup from Open Questions into scope (new Section 7.6)
- Tightened v1 timeline framing to include dogfooding time
- Resolved weight-tracking open question (plain list, confirmed)
- Added App Store Connect note for conversion metric (no SDK needed)

---

## 1. Summary
A simple, local-only iOS app for pet owners to log and view their pet's health records — vaccinations, vet visits, medications, weight — without an account, subscription, or internet connection.

## 2. Problem Statement
Existing pet health apps (Vet Record, VitusVet, VetVault, PetnotePlus, PetDesk) have real, documented complaints:
- Basic features (adding a second pet, setting reminders) are **locked behind subscription paywalls**
- Several apps are **outdated, abandoned, or crash on newer iOS versions**
- Records are often **unreachable without internet**, which matters most in an actual emergency
- Some free apps monetize by **selling user data**

There's a clear gap for a simple, offline-reliable, privacy-respecting tracker that doesn't lock a single pet's core functionality behind recurring fees.

## 3. Goals
- Let an owner log a vaccine, vet visit, medication, or note in under 15 seconds
- Make all records fully accessible offline, instantly, with zero loading/sync delay
- Support multiple pets without a subscription or per-feature paywall — the only paywall is a one-time unlock for pet #2+
- Ship v1 solo in roughly 4-5 weeks of build time, plus a 2-week dogfooding period before considering public release (see Section 12) — "a few weeks" was underscoped in v1.0 once dogfooding is counted honestly

## 4. Non-Goals (v1)
- Cloud sync / multi-device access
- Account creation or login
- Push notification reminders (planned for v2)
- Vet-facing tools, sharing, or multi-user access
- OCR, document scanning, or AI features
- Android version — note: the scaffolded repo includes Expo's default Android config (this is boilerplate from `create-expo-app`, not a deliberate build target). No v1 time should go toward polishing or testing the Android build.

## 5. Target User
Pet owners who currently track health info via memory, paper, or notes apps, and want something purpose-built but simple — not a full veterinary practice management platform.

## 6. User Stories
| As a... | I want to... | So that... |
|---|---|---|
| Pet owner | Add a pet with name, species, and photo | I can start tracking right away |
| Pet owner | Log a vaccine, vet visit, medication, or note | I have a complete health history in one place |
| Pet owner | View a chronological timeline per pet | I can quickly see what's happened and when |
| Pet owner | Access all records with no internet connection | I'm never blocked during an emergency |
| Pet owner | Use every feature free, forever, for my first pet | The app never nickel-and-domes me on basics like competitors do |
| Pet owner | Pay once (no subscription) to add a second or third pet | If I need more than one pet tracked, I pay a fair one-time price instead of committing to recurring fees |

**Note on the two rows above:** v1.0 had these contradicting each other ("no paywall for basics" next to "pay to unlock more pets"). The resolved position: the free tier is fully-featured for exactly one pet — nothing is held back on pet #1. The paywall is scoped narrowly to pet *count*, not features, and it's a single $7.99 purchase, never a subscription. That's the actual differentiator from competitors, who subscription-gate a second pet. "No paywall for basics" was imprecise wording — the accurate claim is "no subscription, no feature-gating, and pet #1 is always fully free."

## 7. Functional Requirements (v1 MVP)

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
- Optional: attach a photo (e.g. of a paper vet document) — stored locally only
- Save / Cancel

### 7.4 Data Storage
- Fully local, on-device storage (no backend, no account)
- No data leaves the device; no analytics tied to personal data
- Data model kept simple: `Pet { id, name, species, photo, birthdate }`, `Record { id, petId, type, date, details, photo }`

### 7.5 Free / Paid Tiers
- **Free:** full feature set — unlimited records, all record types, photo attachments, timeline — for exactly 1 pet, no time limit, no feature caps.
- **Paid (one-time unlock, ~$7.99):** removes the 1-pet limit, unlocking unlimited pets. No subscription, no recurring billing, no other feature is gated.
- This is the app's only paywall. It gates pet count, nothing else.

### 7.6 Data Export / Backup (moved into scope from Open Questions)
- Manual "Export All Data" action, reachable from a settings or profile screen
- Exports all pets and records (including photo references) as a single JSON file
- Uses the native iOS share sheet (`expo-sharing`) so the user can save to Files, iCloud Drive, AirDrop, email, etc.
- No automatic backup, no cloud storage integration — a manual safety net only, directly mitigating the data-loss risk in Section 8

## 8. Technical Considerations

**Corrected from v1.0:** the repo (`expo` + `react-native` + `expo-router`, TypeScript) is an Expo/React Native project, not a native Swift app. The original PRD's SwiftData/Core Data language assumed native iOS — replaced below with the actual stack.

- **Storage:** `expo-sqlite` (SQLite) for the Pet/Record relational data — closest RN equivalent to Core Data/SwiftData for this simple two-table model. No ORM needed for v1's scope; revisit only if the schema grows materially more complex.
- **Photos:** `expo-image-picker` to capture/select, `expo-file-system` to store in the app's local sandbox — not synced anywhere.
- **Backup:** `expo-file-system` + `expo-sharing` for the JSON export in Section 7.6.
- **No third-party SDKs** needed for v1 beyond Expo's own modules — keeps the app lightweight and avoids the privacy complaints that plague competitors.
- **Android:** already scaffolded by default (see Section 4) — costs nothing to leave in place, but don't spend v1 time on it.

## 9. Success Metrics (v1)
- App functions fully offline, end to end, with no crashes on core flows
- Personal daily use: Min tracks at least one real pet's records for a couple of weeks before considering public release
- If released: ratio of free-to-paid conversion as an early signal (no hard target yet — goal is validation, not revenue, at this stage). This is available natively via App Store Connect's sales reports — no third-party analytics SDK required, consistent with the no-SDK stance in Section 8.

## 10. Monetization
One-time purchase (~$7.99) to unlock unlimited pets, consistent with the proven precedent of simple utility apps monetizing via freemium + one-time unlock rather than subscription. See Section 6 for the resolved framing of what's free vs. paid.

## 11. Content / Distribution Angle
Not the primary driver here (unlike the earlier dev-tool idea), but still usable: "I built a pet health app because every existing one tries to lock basic features behind a subscription" is a relatable, shareable story for a broader audience than a dev-tooling niche.

## 12. Milestones (proposed)
1. **Data model + local storage** — Pet and Record models, `expo-sqlite` persistence working
2. **Pet list + Add Pet flow**
3. **Pet profile + timeline view**
4. **Add/Edit Record flow**, including optional photo attachment and the data export/backup action (7.6)
5. **Paywall/unlock flow** for pet #2+
6. **Personal dogfooding** — track a real pet for at least 2 real calendar weeks (not a buffer squeezed out of the build schedule)
7. **Polish + App Store submission**

## 13. Open Questions
- ~~Should weight tracking include a simple chart, or just a plain list in v1?~~ **Resolved:** plain list for v1; chart deferred to v2.
- ~~Is a manual "export as file" backup worth including in v1, or genuinely a v2 item?~~ **Resolved:** included in v1 (Section 7.6) — cheap to build, directly mitigates the only known data-loss risk.
- What's the simplest, least intrusive way to communicate "your data never leaves this device" in the app itself, since that's a core differentiator? **Still open** — suggest a single static line of text in Settings rather than an onboarding modal, but this is a UX call for Min to make, not a technical one.

---
*This PRD covers the MVP only. Reminders, cloud backup, and multi-device sync are intentionally deferred to keep v1 scoped appropriately for solo work.*
