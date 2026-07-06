# Pet Tracker

A local-only iOS app for pet owners to log and view their pet's health records — vaccinations, vet visits, medications, weight, and notes. No account, no internet connection required, no data leaves the device.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54 |
| UI | React Native 0.81.5 |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Database | SQLite via `expo-sqlite` ~16.x |
| Photos | `expo-image-picker`, `expo-file-system` |
| Export | `expo-sharing` |

## Folder Structure

```
app/                  Expo Router screens
  _layout.tsx         Root Stack navigator (wraps PetsProvider)
  index.tsx           Home screen (pet list)
db/
  database.ts         SQLite connection, WAL config, schema migrations
  queries.ts          Data-access functions (createPet, listPets, createRecord, …)
store/
  pets.tsx            PetsProvider context + usePets() hook
types.ts              Pet, HealthRecord, RecordType type definitions
assets/               App icons and splash image
```

## Installation

**Requirements:** Node.js, npm, and the [Expo Go](https://expo.dev/go) app on your iOS device.

```bash
npm install
```

## Running Locally

```bash
npx expo start
```

Scan the QR code in the terminal with the Expo Go app on your phone. Both your phone and Mac must be on the same Wi-Fi network.

```bash
npx expo start --ios    # open in iOS simulator instead
```

## Environment Variables

None. The app is fully local — no API keys, no backend, no configuration required.

## Data Storage

All data is stored on-device in a SQLite database (`pettracker.db`). The schema has two tables:

- **`pets`** — `id, name, species, photo, birthdate`
- **`records`** — `id, pet_id, type, date, details, photo` (FK → `pets.id` with cascade delete)

Schema migrations are versioned via `PRAGMA user_version`. To add a migration, append a new key to the `MIGRATIONS` object in `db/database.ts` — never edit an existing one.
