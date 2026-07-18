import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'pettracker.db';

// Migrations indexed by version number.
// Add a new entry (incrementing the key) for every future schema change —
// never mutate an existing one.
const MIGRATIONS: Record<number, string> = {
  1: `
    CREATE TABLE pets (
      id        TEXT PRIMARY KEY NOT NULL,
      name      TEXT NOT NULL,
      species   TEXT NOT NULL,
      photo     TEXT,
      birthdate TEXT
    );

    CREATE TABLE records (
      id      TEXT PRIMARY KEY NOT NULL,
      pet_id  TEXT NOT NULL,
      type    TEXT NOT NULL,
      date    TEXT NOT NULL,
      details TEXT NOT NULL,
      photo   TEXT,
      FOREIGN KEY (pet_id) REFERENCES pets(id) ON DELETE CASCADE
    );
  `,
  2: `
    CREATE TABLE settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `,
  // Sync scaffolding (milestone 3): mirrors the cloud schema's updated_at/deleted_at
  // columns and adds a local-only dirty flag to drive the future push/pull sync.
  3: `
    ALTER TABLE pets ADD COLUMN updated_at TEXT;
    ALTER TABLE pets ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE pets ADD COLUMN deleted_at TEXT;
    UPDATE pets SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE updated_at IS NULL;

    ALTER TABLE records ADD COLUMN updated_at TEXT;
    ALTER TABLE records ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE records ADD COLUMN deleted_at TEXT;
    UPDATE records SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE updated_at IS NULL;
  `,
};

const LATEST_VERSION = Math.max(...Object.keys(MIGRATIONS).map(Number));

async function migrate(db: SQLiteDatabase): Promise<void> {
  // user_version is a built-in SQLite integer pragma — safe to interpolate
  // since we only ever write controlled integer literals here.
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  while (version < LATEST_VERSION) {
    version += 1;
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version}`);
    });
  }
}

export async function initDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DB_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL');
  // Foreign-key enforcement is off by default in SQLite; must be set per connection.
  await db.execAsync('PRAGMA foreign_keys = ON');

  await migrate(db);
  return db;
}
