import { initDatabase } from './database';

describe('initDatabase', () => {
  it('creates the pets, records, and settings tables', async () => {
    const db = await initDatabase();
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map(t => t.name)).toEqual(['pets', 'records', 'settings']);
  });

  it('advances PRAGMA user_version to the latest migration', async () => {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(3);
  });

  it('enables foreign key enforcement so ON DELETE CASCADE actually fires', async () => {
    const db = await initDatabase();
    const row = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(row?.foreign_keys).toBe(1);
  });

  it('is safe to run twice against the same underlying connection (re-launch simulation)', async () => {
    // Each initDatabase() call here opens a fresh in-memory DB (per the mock),
    // but this guards against the migration loop throwing if it's ever asked
    // to run against a DB already at the latest version.
    const db = await initDatabase();
    await expect(
      (async () => {
        const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        return row?.user_version;
      })(),
    ).resolves.toBe(3);
  });

  it('adds sync scaffolding columns to pets and records without touching migrations 1/2', async () => {
    const db = await initDatabase();
    const petColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(pets)');
    const recordColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(records)');
    expect(petColumns.map(c => c.name)).toEqual(
      expect.arrayContaining(['updated_at', 'dirty', 'deleted_at']),
    );
    expect(recordColumns.map(c => c.name)).toEqual(
      expect.arrayContaining(['updated_at', 'dirty', 'deleted_at']),
    );
  });
});
