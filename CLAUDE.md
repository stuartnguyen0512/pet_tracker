# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo docs

**Always read the versioned Expo docs before writing any Expo-specific code** — the API surface changes significantly between SDK versions. This project is on **SDK 54**:

https://docs.expo.dev/versions/v54.0.0/

> `AGENTS.md` previously referenced v57.0.0 (outdated) — fixed 2026-07-17 to point at v54 above, matching `package.json`'s `"expo": "~54.0.0"`.

## Commands

```bash
npx expo start          # start Metro dev server (scan QR in Expo Go)
npx expo start --ios    # open iOS simulator directly
npx expo start --web    # web preview — dev/demo convenience only, not a shipped platform (see "Platform targets" below)
npx tsc --noEmit        # type-check without building
npm test                # Jest suite — db/*.test.ts, lib/*.test.ts, userJourney.test.ts
npm run test:live       # lib/supabaseAuth.live.test.ts against a real Supabase project (needs RUN_LIVE_SUPABASE_TESTS=1)
```

There is no lint script yet.

**Do not run `npx expo start` automatically after making changes** — give the user the command to run instead.

## Git workflow

Every agent (UI, Data Layer, Integration/Fix-errors, or any other) does its work on its own branch — never commit directly to `main`.

- **Branch naming**: `<agent-role>/<short-description>` — e.g. `ui/onboarding-copy`, `data/sync-migration`, `integration/wire-auth-session`. Bug fixes use `fix/<short-description>` as their role slug — e.g. `fix/mutation-error-handling`.
- **Flow**: branch from `main` → do the work → push → **delete the local branch immediately after the push succeeds**. The pushed remote branch is what preserves the work from here.
- **Do not delete the remote branch.** Min reviews the PR and deletes the remote branch himself once it's merged into `main`. Agents only ever clean up their local copy.

### Starting a new feature or bug fix

1. Make sure `main` is current: `git checkout main && git pull`
2. Create the branch: `git checkout -b <role>/<short-description>` — e.g. `git checkout -b fix/ageStr-timezone-bug` or `git checkout -b ui/onboarding-copy`
3. Do the work, committing normally on that branch (never on `main`).
4. Push it: `git push -u origin <role>/<short-description>`
5. Open a PR for Min to review: `gh pr create` (or the GitHub UI).
6. Once the push has succeeded, delete the **local** branch: `git checkout main && git branch -d <role>/<short-description>`. Leave the remote branch alone — see above.

Branches that predated this convention (`feat/auth-integration`, `feat/auth-onboarding-ui`, `feat/supabase-data-layer`, `fix/mutation-error-handling-and-loading-states`, `fix/ui-date-picker-and-filter-height`, `ui-screens`) have **all already been merged into `main`** — see "Architecture — current state" below, which this file's previous version had not caught up to. No need to rename them; just use `<role>/<description>` going forward.

## Known environment quirk

Node.js v25 refuses to strip TypeScript types from files inside `node_modules`. This means any `expo-*` package that ships `.ts` source and is listed as a config plugin in `app.json` will crash Metro on startup. `expo-status-bar` was removed from `app.json`'s `plugins` array for this reason — do not add it back.

## Architecture — current state (verified 2026-07-17, sync/schema section re-verified 2026-07-23)

Verified by walking the actual repo (file tree, `git log --all --oneline`, and reading the code directly) — this replaces the earlier "needs a verification pass" placeholder. Treat this as ground truth until the code changes again.

> The 2026-07-17 pass predates commit `bd939c8` (MIN-46, 2026-07-20), which added the local `dirty`/`updated_at`/`deleted_at` columns and finished the sync engine. "Schema migrations", "Types", and "Target sync design" below were re-verified 2026-07-23 against the current code and updated accordingly — the rest of this section is still the 2026-07-17 pass.

### Data flow

```
SQLite (pettracker.db) — unchanged, still the on-device source of truth
  └── db/database.ts     initDatabase() — opens connection, enables WAL + FK enforcement, runs migrations
  └── db/queries.ts      pure async functions (createPet, listPets, createRecord, …) — all take db as first arg

store/pets.tsx           PetsProvider — owns the SQLiteDatabase connection and pets[] React state
  └── wraps the whole app via app/_layout.tsx
  └── exposes usePets() hook to screens
  └── still has the original "block render until db is set" gate (`if (!db) return null`) — UNCHANGED,
      and this is intentionally still the only blocking gate in the app (see "Auth" below)

store/uiSession.tsx       UiSessionProvider — wraps real supabase.auth session tracking
  └── exposes isLoggedIn / user / logOut via useUiSession()
  └── does NOT gate anything — nothing in app/_layout.tsx reads isLoggedIn to redirect

app/_layout.tsx           Root Stack navigator: PetsProvider > ToastProvider > UiSessionProvider > Stack
                           All screens (index, pet/*, settings, login, signup, onboarding) are registered
                           as peers — there is no auth-conditional routing here.
app/index.tsx              Pet list (home) — implemented; redirects to /onboarding on first launch only
                           (via lib/onboarding.ts + AsyncStorage), unrelated to auth.
```

### State split

`PetsProvider` holds `pets[]` in React state (home screen needs reactivity). Records are **not** held in global state — each pet profile screen fetches its own records via `usePets().listRecordsForPet(petId)` and manages them locally. This keeps the global context lean.

### Schema migrations

`db/database.ts` uses `PRAGMA user_version` as the migration counter. To add a schema change: append a new integer key to the `MIGRATIONS` object — never edit an existing entry. Each migration runs inside `withTransactionAsync` so partial migrations can't persist.

**Local schema now has 3 migrations** — `1` (`pets`/`records`), `2` (`settings`), and `3` (MIN-46, 2026-07-20), which adds `updated_at` / `dirty` / `deleted_at` to both `pets` and `records`, mirroring the cloud shape. Milestone 3 (local sync scaffolding) is **done**.

**Cloud schema exists and is further along** — `supabase/migrations/20260711202355_schema_v2_cloud_sync.sql` creates `pets` and `health_records` with `owner_id`, `updated_at`, `deleted_at`, RLS enabled, one policy per table (`owner_id = auth.uid()`). This part of milestone 1 is done. That same migration also created an `entitlements` table for the **old** one-time-unlock model (`unlocked boolean`) — this is now stale, see "Monetization constraint" below for what replaces it.

### Types

`types.ts` at the project root defines `Pet`, `HealthRecord`, and `RecordType`. The TypeScript type is named `HealthRecord` (not `Record`) to avoid shadowing the built-in `Record<K,V>` utility. SQLite columns use `snake_case` (`pet_id`); the row mappers in `db/queries.ts` translate to camelCase at the boundary. Since MIN-46, both `Pet` and `HealthRecord` also carry `dirty: boolean` and `deletedAt: string | null` (see Schema migrations above) — deliberately exposed to the UI, not just internal to `db/database.ts`/`lib/sync.ts`, because the unsynced-changes badge and pending-delete dimming on the home screen need them. `PetInput`/`HealthRecordInput` omit `id`/`dirty`/`deletedAt` since form screens never set sync metadata directly — `db/queries.ts` always stamps `dirty = 1` on write.

### Photos

`expo-image-picker` selects/captures photos; `expo-file-system` (via `lib/photos.ts`) persists them to the app sandbox. Photo fields on both `Pet` and `HealthRecord` are nullable strings (local file URIs). `expo-sharing` is used for the JSON data export (PRD §7.6). **Cloud photo sync (Supabase Storage) does not exist anywhere in the codebase** — `lib/photos.ts` is purely local. Milestone 5 has not started.

### Auth

`app/login.tsx` / `app/signup.tsx` call real `supabase.auth.signInWithPassword` / `signUp` — not mocked, fully wired for email/password. Sign in with Apple is a **stub only**: the UI button exists but is disabled and just shows a toast ("Apple Sign In coming soon"); `supabase/config.toml` has `[auth.external.apple] enabled = false`. Not built yet — see "Planned / in-progress: cloud sync" → Auth below for the plan and the Apple Developer Program prerequisite.

**Accounts are optional by design, not by omission.** `app/_layout.tsx` has no session-based redirect at all. A user can use the entire app — add pets, log records, everything — forever, without ever logging in. This was confirmed intentional and is now a locked decision (2026-07-17, do not re-litigate without asking Min): **hybrid gating**. Anonymous use is allowed; login is only required when the user taps "Sync Now," or later, when the RevenueCat client-side entitlement check says the trial/subscription has lapsed. This supersedes PRD §12 milestone 2's literal wording ("session-gated app entry... replacing today's block-render gate") — the PRD text is stale relative to this decision, not the code. Don't "fix" `_layout.tsx` to add a blanket login gate without checking with Min first.

### Sync Now UI

**Done, verified 2026-07-19.** `app/settings.tsx`'s "Sync Now" button calls real `runSync` (`lib/sync.ts`), gated behind `isLoggedIn`. Feedback is in-button state (spinner/checkmark/error text), not the global toast — Settings is a `presentation: 'modal'` screen, and on iOS a native modal renders in its own layer above the whole app including the root-mounted Toast overlay, so toasts fired from inside it are invisible. See "Key decisions" → "Sync is manual, refined 2026-07-19" above for the other two trigger points (forced post-login, prompted post-pet-create) beyond this button.

### Monetization / subscription state

The old one-time-unlock paywall was **fully removed** (`fix/remove-paywall`, PR #8, commit `96e412d` — "Remove monetization: the app is now fully free with unlimited pets"). This happened *after* auth/data-layer merged but *before* ADR 0001 (the trial/subscription model) was finalized. There is no `react-native-purchases` dependency and no paywall screen in the codebase today. **Milestone 8 is greenfield** — nothing to resume, and the existing `entitlements` migration is the wrong shape for it (see below).

### Platform targets

iOS is the only real build target per the PRD title. `integration/web-platform-support` (adds `react-native-web` + `expo start --web`) was merged and is **kept intentionally as a dev/preview convenience only — not a shipped platform.** Don't spend milestone time on web-specific bugs beyond "doesn't crash the dev preview."

## Monetization constraint (finalized 2026-07-16 — see `docs/adr/0001-subscription-trial-monetization.md`)

**No longer fully free.** The app has moved to a free-trial-then-auto-renewing-subscription model. This supersedes both the old one-time $7.99 unlock (removed via `fix/remove-paywall`, see "Architecture — current state" above) and the "fully free" model that replaced it.

- **14-day free trial, then $4.99/month.** No permanent free tier — after the trial the entire app is gated, not partially. Do not build a limited-free-forever fallback.
- **StoreKit + RevenueCat.** Apple requires all in-app digital subscriptions to use IAP, so this cannot be a client-only trusted flag the way the old unlock was. RevenueCat handles purchase flow, receipt validation, trial tracking, and cross-device entitlement sync — do not hand-roll StoreKit 2 + App Store Server API receipt verification instead.
- **Affiliate revenue (e.g. pet-insurance referral links) is explicitly out of scope** for this monetization work — a separate future decision, not bundled in here.
- Do not build AI features or GPS/geofencing as part of this monetization work — both were evaluated (as part of a separate "PetCare AI Assistant" concept) and explicitly deferred, not adopted. See PRD §4.

### Entitlement design (decided 2026-07-17, consistent with the hybrid auth decision above)

- **RevenueCat SDK (client-side `Purchases.getCustomerInfo()`) is the source of truth** for "is this device currently entitled." This is the actual app-access gate — it works for anonymous users too, consistent with hybrid gating (no Supabase account needed for the SDK to answer correctly).
- **Supabase `entitlements` is a secondary mirror**, used only to recognize entitlement cross-device once a user has created an account. It must never become the primary gate — that would require login before every access check, which breaks the hybrid decision.
- Sync mechanism: **RevenueCat webhook → a new Supabase Edge Function** writes entitlement state into Supabase. This is a new infra component, not yet built. Do not implement "app self-reports entitlement on every launch" as the primary sync path — it's not reliable if the user doesn't open the app.
- The existing `entitlements` migration (`unlocked boolean`, `unlocked_at`) is the pre-ADR-0001 one-time-unlock shape and cannot be reused as-is. Per the "never edit an existing migration" rule above, this must be handled with a **new migration** that alters the table: drop `unlocked` / `unlocked_at`, add `revenuecat_customer_id`, `trial_ends_at`, `current_period_ends_at`, `is_active`. Do not edit `20260711202355_schema_v2_cloud_sync.sql` directly.

## Planned / in-progress: cloud sync

The project is migrating to per-user accounts and cross-device sync via Supabase, per `PRD.md` (v2.1). Auth (email/password only), the Supabase data layer, onboarding UI, local sync scaffolding + push/pull engine (milestone 3, MIN-46), and wiring "Sync Now" to real logic (milestone 4) have all merged into `main` — see "Architecture — current state" above for exactly what that means in practice. Confirmed still outstanding: photo sync (milestone 5), Sign in with Apple, and the RevenueCat/subscription work (milestone 8).

### Key decisions (already made, do not re-litigate without asking Min)

- **SQLite stays the source of truth on-device.** Supabase is a synced copy, not a replacement — the app must keep working fully offline between syncs.
- **Sync is manual, refined 2026-07-19** — still always a user-confirmed action (never silent/background), but no longer *only* the Settings "Sync Now" button. Three trigger points now exist, all requiring an explicit tap:
  1. **Forced immediately after login/signup** (`app/login.tsx`, `app/signup.tsx`) — happens automatically as part of the login transition itself, before the user reaches the app, so a device that just switched accounts reconciles before anything else can touch local data. If it fails, the user is let in anyway with a warning toast — hybrid gating's "must always work offline" guarantee is not suspended by a failed forced sync (see "Accounts are optional" below).
  2. **Prompted after creating a new pet** (`components/PetFormScreen.tsx`, create path only, not edit) — an ActionSheet asks "Sync this pet to your account now? / Not Now". Not asked on edits or on new records — only the pet-creation moment, to avoid nagging on every write.
  3. **Manual, via Settings' "Sync Now"** — unchanged, still there for everything else.
  Reason: dogfooding surfaced a real bug (Postgres `42501` RLS rejection) caused by local data surviving a logout and then getting pushed under a *different* account on the next sync — same local row `id`, different `owner_id`, RLS correctly refuses it. Fixing that required tying wipe-on-logout (see "Target auth" below) to *something* that repopulates local data afterward, which is what the forced post-login sync is for.
  **Follow-up, 2026-07-20**: the same `42501` recurred even with wipe-on-logout in place, because logout isn't the only way a device switches accounts — signing into a *different* account directly from the login screen, over an existing session, never routes through that wipe. Fixed properly at the choke point instead of the trigger: `lib/sync.ts`'s `runSync` now stores which account's data currently lives locally (`local_owner_id` setting) and wipes first, before ever pushing, if the account calling it doesn't match. This subsumes the logout-time wipe rather than replacing it — logout still wipes immediately for its own reason (data must not linger after signing out), this just closes the gap for every other path that changes which account owns local data.
- **Personal-only accounts** — no sharing/collaboration between different users. This is why the sync design below can get away with silent last-write-wins instead of real conflict resolution or a dedicated sync engine.
- **Accounts are optional (hybrid gating)** — see "Architecture — current state" → Auth above. Login is required only for Sync Now and once trial/subscription lapses, not for core app use. This still holds even for the forced post-login sync above: a failed forced sync does not block app entry.
- **v1 local dogfooding data is not migrated** — v2 starts fresh, no migration script needed.
- Deliberately **not** using a third-party offline-sync engine (e.g. PowerSync) — evaluated and skipped since personal-only accounts don't need real conflict resolution; a hand-rolled dirty-flag outbox is enough. Reconsider only if sync bugs prove hard to get right by hand.

### Target schema (Supabase / Postgres)

| Table | Key columns | Notes |
|---|---|---|
| `pets` | `id uuid pk`, `owner_id uuid → auth.users`, `name`, `species`, `photo_url`, `birthdate`, `updated_at`, `deleted_at` | `deleted_at` is a tombstone, not an immediate delete — needed so sync can propagate deletes both directions. **Exists, done.** |
| `health_records` | `id uuid pk`, `pet_id → pets`, `owner_id uuid` (denormalized to keep RLS simple), `type`, `date`, `details`, `photo_url`, `updated_at`, `deleted_at` | same tombstone pattern as `pets`. **Exists, done.** |

Row-level security: every table gets one policy, `owner_id = auth.uid()`. No sharing policies — personal-only scope. **Confirmed in place** (`supabase/migrations/20260711202355_schema_v2_cloud_sync.sql`).

### Sync design (done, milestones 3 & 4 — re-verified 2026-07-23)

`lib/sync.ts`'s `runSync(db, userId)` implements exactly the design this section used to describe as a future target — it's no longer aspirational:

- Local `pets`/`records` carry `updated_at` / `dirty` / `deleted_at` (migration 3, MIN-46). Every local write sets `dirty = 1` and bumps `updated_at` (`db/queries.ts`).
- **Account-switch guard, first.** Before anything else, `runSync` compares a stored `local_owner_id` setting against the `userId` calling it; on a mismatch it wipes local data before pushing. This is the fix for the `42501` RLS bug described under "Sync is manual" below — it closes the gap for *any* path that changes which account owns local data, not just logout.
- **Push.** All `dirty = 1` rows in `pets` and `records` are upserted to Supabase (`onConflict: 'id'`), then their local `dirty` flag is cleared.
- **Pull + merge.** Rows from `pets`/`health_records` with `updated_at` greater than the stored `last_synced_at` cursor are fetched and merged into local SQLite — insert if the local row doesn't exist, otherwise last-write-wins by comparing `updated_at` as actual instants (not raw string comparison, since local/remote timestamp formats differ).
- **Deletes** are tombstones (`deleted_at`) on both sides, so they propagate through the same push/pull path as edits — no special-case delete sync.
- The cursor (`last_synced_at` setting) only advances after a successful push+pull+merge.

Not yet done: this is silent last-write-wins with no conflict UI (matches the "Target 'Sync Now' UI and conflict handling" decision below), and sync errors aren't classified — see the "generic sync-failed copy" known gap in the QA walkthrough. Photo sync (Supabase Storage) is still entirely unbuilt — see "Target photo sync" below.

### Target auth

Supabase Auth, two providers: email/password (**done**) and Sign in with Apple (**stub UI only, not built**). Apple requires offering Sign in with Apple if any other third-party login is offered, which is why both are in scope together — do not ship email/password without also shipping Sign in with Apple; this blocks App Store submission (Guideline 4.8) if skipped. **Building Sign in with Apple requires a paid Apple Developer Program enrollment** (native entitlement, needs EAS Build / custom dev client — will not work in Expo Go) — confirm Min has completed enrollment before starting this ticket. Per the hybrid gating decision above, session does **not** gate app entry — do not add a blanket redirect-to-login in `app/_layout.tsx`.

**Logout clears local data immediately — done 2026-07-19** (`app/settings.tsx`'s `onAccountRowPress`, `db/queries.ts`'s `wipeLocalData`/`hasDirtyData`, `store/pets.tsx`'s `wipeAllLocal`). Confirms first only if there's unsynced (`dirty = 1`) data — if everything's already synced there's nothing to lose, so it wipes silently. This is not just a UX nicety: it's the fix for the `42501` RLS bug above — without it, a second account logging in on the same device inherits the first account's local rows and its `owner_id` mismatch gets rejected by Supabase on the next sync. The sync cursor (`last_synced_at`) is cleared too, so the next login does a full pull rather than an incremental one against an empty local DB.

### Target photo sync

Supabase Storage bucket, scoped per account. On sync, dirty local photos upload; pulled remote photos download and cache locally so they're viewable offline afterward. Local `expo-file-system` storage remains the working copy either way — this is additive, not a replacement for local photo storage. Not started.

### Target "Sync Now" UI and conflict handling

"Sync Now" lives on the Settings screen, next to "Export All Data" — **already correctly placed.** Conflicts (same record edited on two devices before either syncs) resolve silently via last-write-wins, no conflict UI in v2 — revisit only if this causes real, noticed data loss during dogfooding. See PRD §7.8.

All PRD §13 open questions were resolved 2026-07-16 — see PRD.md §13 for the full record.

## Sub-agent / Linear label mapping

`ui` / `data` / `integration` / `fix` (the branch role slugs already established above) are a **starting point Min came up with, not a hard constraint.** Use them as the default when they fit — they roughly map like this:

| Linear label | Branch role slug | Owns |
|---|---|---|
| `ui` | `ui/` | Screens, navigation, onboarding, paywall UI |
| `data` | `data/` | SQLite + Supabase schema, migrations, sync engine (push/pull/merge) |
| `integration` | `integration/` | Wiring cross-cutting concerns together — auth session plumbing, RevenueCat/subscription SDK integration, etc. |
| `fix` | `fix/` | Bug fixes, regardless of area |

Feel free to keep this as-is, or split/add roles when a piece of work genuinely doesn't fit cleanly (e.g. a dedicated `subscription` role for milestone 8, if that turns out to be substantial enough to warrant its own lane) — just keep whatever labels get used consistent between Linear and branch prefixes so the two stay traceable to each other.
