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

## Known environment quirk

Node.js v25 refuses to strip TypeScript types from files inside `node_modules`. This means any `expo-*` package that ships `.ts` source and is listed as a config plugin in `app.json` will crash Metro on startup. `expo-status-bar` was removed from `app.json`'s `plugins` array for this reason — do not add it back.

## Architecture

This is a **local-only iOS pet health tracker** (PRD is in `PRD.md`). No backend, no auth, no cloud sync.

### Data flow

```
SQLite (pettracker.db)
  └── db/database.ts     initDatabase() — opens connection, enables WAL + FK enforcement, runs migrations
  └── db/queries.ts      pure async functions (createPet, listPets, createRecord, …) — all take db as first arg

store/pets.tsx           PetsProvider — owns the SQLiteDatabase connection and pets[] React state
  └── wraps the whole app via app/_layout.tsx
  └── exposes usePets() hook to screens

app/_layout.tsx          Root Stack navigator wrapped in PetsProvider
app/index.tsx            Home screen (currently a stub — pets list goes here)
```

### State split

`PetsProvider` holds `pets[]` in React state (home screen needs reactivity). Records are **not** held in global state — each pet profile screen fetches its own records via `usePets().listRecordsForPet(petId)` and manages them locally. This keeps the global context lean.

### Schema migrations

`db/database.ts` uses `PRAGMA user_version` as the migration counter. To add a schema change: append a new integer key to the `MIGRATIONS` object — never edit an existing entry. Each migration runs inside `withTransactionAsync` so partial migrations can't persist.

### Types

`types.ts` at the project root defines `Pet`, `HealthRecord`, and `RecordType`. The TypeScript type is named `HealthRecord` (not `Record`) to avoid shadowing the built-in `Record<K,V>` utility. SQLite columns use `snake_case` (`pet_id`); the row mappers in `db/queries.ts` translate to camelCase at the boundary.

### Photos

`expo-image-picker` selects/captures photos; `expo-file-system` persists them to the app sandbox. Photo fields on both `Pet` and `HealthRecord` are nullable strings (local file URIs). `expo-sharing` is used for the JSON data export (PRD §7.6).

## Monetization constraint

**No subscription model — not now, not planned.** The only monetization is a one-time, non-consumable unlock (~$7.99) that removes the 1-pet cap (PRD §4, §7.5, §10). `store/pets.tsx`'s `unlocked` flag and `unlockPets()` already implement this correctly as a simple persisted boolean — not a subscription entitlement check. Do not introduce StoreKit auto-renewable subscriptions, subscription tiers, or recurring billing of any kind without this constraint being explicitly revisited first.
