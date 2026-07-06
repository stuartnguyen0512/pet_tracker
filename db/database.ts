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
