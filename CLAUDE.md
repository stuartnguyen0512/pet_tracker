# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Expo docs

**Always read the versioned Expo docs before writing any Expo-specific code** — the API surface changes significantly between SDK versions. This project is on **SDK 54**:

https://docs.expo.dev/versions/v54.0.0/

> Note: `AGENTS.md` references v57.0.0 — that is outdated. Use the v54 link above.

## Commands

```bash
npx expo start          # start Metro dev server (scan QR in Expo Go)
npx expo start --ios    # open iOS simulator directly
npx tsc --noEmit        # type-check without building
```

There is no test suite yet. There is no lint script yet.

**Do not run `npx expo start` automatically after making changes** — give the user the command to run instead.

## Git workflow

Every agent (UI, Data Layer, Integration/Fix-errors, or any other) does its work on its own branch — never commit directly to `main`.

- **Branch naming**: `<agent-role>/<short-description>` — e.g. `ui/paywall-copy`, `data/sync-migration`, `integration/wire-auth-session`. Bug fixes use `fix/<short-description>` as their role slug — e.g. `fix/mutation-error-handling`.
- **Flow**: branch from `main` → do the work → push → **delete the local branch immediately after the push succeeds**. The pushed remote branch is what preserves the work from here.
- **Do not delete the remote branch.** Min reviews the PR and deletes the remote branch himself once it's merged into `main`. Agents only ever clean up their local copy.

### Starting a new feature or bug fix

1. Make sure `main` is current: `git checkout main && git pull`
2. Create the branch: `git checkout -b <role>/<short-description>` — e.g. `git checkout -b fix/ageStr-timezone-bug` or `git checkout -b ui/paywall-copy`
3. Do the work, committing normally on that branch (never on `main`).
4. Push it: `git push -u origin <role>/<short-description>`
5. Open a PR for Min to review: `gh pr create` (or the GitHub UI).
6. Once the push has succeeded, delete the **local** branch: `git checkout main && git branch -d <role>/<short-description>`. Leave the remote branch alone — see above.

Existing branches on `origin` (`feat/auth-integration`, `feat/auth-onboarding-ui`, `feat/supabase-data-layer`, `fix/mutation-error-handling-and-loading-states`, `fix/ui-date-picker-and-filter-height`, `ui-screens`) predate this convention — no need to rename them, just use `<role>/<description>` going forward.

## Known environment quirk

Node.js v25 refuses to strip TypeScript types from files inside `node_modules`. This means any `expo-*` package that ships `.ts` source and is listed as a config plugin in `app.json` will crash Metro on startup. `expo-status-bar` was removed from `app.json`'s `plugins` array for this reason — do not add it back.

## Architecture — current state (v1, implemented)

This is currently a **local-only iOS pet health tracker** (PRD is in `PRD.md`, now at v2.0). Everything below this heading describes what is **actually built and running today**. No Supabase client, auth screens, or sync code exist in the repo yet — see "Planned: cloud sync (v2)" further down for what's designed but not yet implemented. Do not assume anything in that section exists in code until it has actually been added here.

### Data flow

```
SQLite (pettracker.db)
  └── db/database.ts     initDatabase() — opens connection, enables WAL + FK enforcement, runs migrations
  └── db/queries.ts      pure async functions (createPet, listPets, createRecord, …) — all take db as first arg

store/pets.tsx           PetsProvider — owns the SQLiteDatabase connection and pets[] React state
  └── wraps the whole app via app/_layout.tsx
  └── exposes usePets() hook to screens

app/_layout.tsx          Root Stack navigator wrapped in PetsProvider
app/index.tsx            Pet list (home) screen — implemented, not a stub
```

### State split

`PetsProvider` holds `pets[]` in React state (home screen needs reactivity). Records are **not** held in global state — each pet profile screen fetches its own records via `usePets().listRecordsForPet(petId)` and manages them locally. This keeps the global context lean.

### Schema migrations

`db/database.ts` uses `PRAGMA user_version` as the migration counter. To add a schema change: append a new integer key to the `MIGRATIONS` object — never edit an existing entry. Each migration runs inside `withTransactionAsync` so partial migrations can't persist. When cloud sync (below) is implemented, the sync-related columns (`updated_at`, `dirty`, `deleted_at`) should be added this same way, as new migration entries — not by editing the existing `pets`/`records` table definitions.

### Types

`types.ts` at the project root defines `Pet`, `HealthRecord`, and `RecordType`. The TypeScript type is named `HealthRecord` (not `Record`) to avoid shadowing the built-in `Record<K,V>` utility. SQLite columns use `snake_case` (`pet_id`); the row mappers in `db/queries.ts` translate to camelCase at the boundary.

### Photos

`expo-image-picker` selects/captures photos; `expo-file-system` persists them to the app sandbox. Photo fields on both `Pet` and `HealthRecord` are nullable strings (local file URIs). `expo-sharing` is used for the JSON data export (PRD §7.6). Cloud photo sync (Supabase Storage) is planned but not yet implemented — see below.

## Monetization constraint

**No subscription model — not now, not planned. No payment/receipt verification of any kind.** The only monetization is a one-time, non-consumable unlock (~$7.99) that removes the 1-pet cap (PRD §4, §7.5, §7.9, §10). `store/pets.tsx`'s `unlocked` flag and `unlockPets()` already implement this correctly as a simple trusted boolean — not a subscription entitlement check, and not a verified purchase. Do not introduce StoreKit auto-renewable subscriptions, subscription tiers, recurring billing, or any receipt/purchase verification of any kind without this constraint being explicitly revisited first. This holds even once the cloud entitlements table (below) exists — that table syncs the same trusted flag, it does not add verification.

## Planned: cloud sync (v2) — NOT YET IMPLEMENTED

The project is migrating to per-user accounts and cross-device sync via Supabase. This section documents the **target** design from `PRD.md` v2.0 so future work stays consistent — as of the last update to this file, **none of it exists in code yet**. Treat every item below as a plan to build, not a description of the current app. Check `PRD.md` §12 for phase order before starting any of this work.

### Key decisions (already made, do not re-litigate without asking Min)

- **SQLite stays the source of truth on-device.** Supabase is a synced copy, not a replacement — the app must keep working fully offline between syncs.
- **Sync is manual** — a "Sync Now" action the user triggers, not automatic/background sync.
- **Personal-only accounts** — no sharing/collaboration between different users. This is why the sync design below can get away with silent last-write-wins instead of real conflict resolution or a dedicated sync engine.
- **No payment verification** — the pet-unlock flag syncs to Supabase but remains a trusted client flag (see Monetization constraint above).
- **v1 local dogfooding data is not migrated** — v2 starts fresh, no migration script needed.
- Deliberately **not** using a third-party offline-sync engine (e.g. PowerSync) — evaluated and skipped since personal-only accounts don't need real conflict resolution; a hand-rolled dirty-flag outbox is enough. Reconsider only if sync bugs prove hard to get right by hand.

### Target schema (Supabase / Postgres)

| Table | Key columns | Notes |
|---|---|---|
| `pets` | `id uuid pk`, `owner_id uuid → auth.users`, `name`, `species`, `photo_url`, `birthdate`, `updated_at`, `deleted_at` | `deleted_at` is a tombstone, not an immediate delete — needed so sync can propagate deletes both directions |
| `health_records` | `id uuid pk`, `pet_id → pets`, `owner_id uuid` (denormalized to keep RLS simple), `type`, `date`, `details`, `photo_url`, `updated_at`, `deleted_at` | same tombstone pattern as `pets` |
| `entitlements` | `owner_id uuid pk → auth.users`, `unlocked bool`, `unlocked_at` | mirrors the local `unlocked` flag — no purchase/transaction columns, since there's no verification (see Monetization constraint) |

Row-level security: every table gets one policy, `owner_id = auth.uid()`. No sharing policies — personal-only scope.

### Target sync design

Local schema gains `updated_at` / `dirty` / `deleted` columns (added via new migration entries, per Schema migrations above) mirroring the cloud shape. Every local write sets `dirty = 1` and bumps `updated_at`. "Sync Now" does, in order: push all dirty local rows to Supabase (upsert, last-write-wins by comparing `updated_at`), pull remote rows changed since the last sync cursor, merge into local SQLite (again last-write-wins), clear dirty flags. Deletes are tombstoned locally too, so they propagate the same way as edits rather than needing special-case handling.

### Target auth

Supabase Auth, two providers: email/password and Sign in with Apple. Apple requires offering Sign in with Apple if any other third-party login is offered, which is why both are in scope together — do not add email/password without also keeping Sign in with Apple. Session-gates app entry (this will replace/extend the current "block render until `db` is set" gate in `PetsProvider`).

### Target photo sync

Supabase Storage bucket, scoped per account. On sync, dirty local photos upload; pulled remote photos download and cache locally so they're viewable offline afterward. Local `expo-file-system` storage remains the working copy either way — this is additive, not a replacement for local photo storage.

### Open questions (see PRD.md §13 for full context — do not resolve unilaterally in code)

- Whether local data is cleared or retained on logout.
- Where the "Sync Now" control lives in the UI.
- Whether silent last-write-wins is acceptable long-term or needs a conflict UI later.
