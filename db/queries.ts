import * as Crypto from 'expo-crypto';
import { SQLiteDatabase } from 'expo-sqlite';
import { HealthRecord, HealthRecordInput, Pet, PetInput, RecordType } from '../types';

// ---------------------------------------------------------------------------
// Internal row types (SQLite column names → TS field names differ for records)
// ---------------------------------------------------------------------------

type PetRow = {
  id: string;
  name: string;
  species: string;
  photo: string | null;
  birthdate: string | null;
  dirty: number;
  deleted_at: string | null;
};

type RecordRow = {
  id: string;
  pet_id: string;
  type: string;
  date: string;
  details: string;
  photo: string | null;
  dirty: number;
  deleted_at: string | null;
};

function rowToPet(row: PetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    photo: row.photo,
    birthdate: row.birthdate,
    dirty: !!row.dirty,
    deletedAt: row.deleted_at,
  };
}

function rowToRecord(row: RecordRow): HealthRecord {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type as RecordType,
    date: row.date,
    details: row.details,
    photo: row.photo,
    dirty: !!row.dirty,
    deletedAt: row.deleted_at,
  };
}

function generateId(): string {
  return Crypto.randomUUID();
}

// SQLite has no native timestamptz type; storing ISO 8601 (not the bare
// `datetime('now')` space-separated format) keeps local updated_at strings
// directly comparable — both lexicographically and via `new Date(...)` — to
// the ISO strings Supabase returns for its timestamptz columns.
const NOW_ISO = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

// Explicit column lists (rather than `SELECT *`) so we control exactly what
// reaches the public Pet/HealthRecord shape. `dirty`/`deleted_at` are
// included deliberately (MIN-46) — `updated_at` still isn't, since nothing
// outside lib/sync.ts needs it.
const PET_COLUMNS = 'id, name, species, photo, birthdate, dirty, deleted_at';
const RECORD_COLUMNS = 'id, pet_id, type, date, details, photo, dirty, deleted_at';

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

export async function createPet(
  db: SQLiteDatabase,
  data: PetInput,
): Promise<Pet> {
  const pet: Pet = { id: generateId(), ...data, dirty: true, deletedAt: null };
  await db.runAsync(
    `INSERT INTO pets (id, name, species, photo, birthdate, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ${NOW_ISO}, 1)`,
    [pet.id, pet.name, pet.species, pet.photo, pet.birthdate],
  );
  return pet;
}

// Includes rows tombstoned but not yet synced (dirty = 1) so the UI can
// still show a pending delete instead of it vanishing before the deletion
// has actually propagated anywhere — a fully-synced tombstone (dirty = 0)
// is dropped same as before.
export async function listPets(db: SQLiteDatabase): Promise<Pet[]> {
  const rows = await db.getAllAsync<PetRow>(
    `SELECT ${PET_COLUMNS} FROM pets WHERE deleted_at IS NULL OR dirty = 1 ORDER BY rowid ASC`,
  );
  return rows.map(rowToPet);
}

export async function getPet(
  db: SQLiteDatabase,
  id: string,
): Promise<Pet | null> {
  const row = await db.getFirstAsync<PetRow>(
    `SELECT ${PET_COLUMNS} FROM pets WHERE id = ?`,
    [id],
  );
  return row ? rowToPet(row) : null;
}

export async function updatePet(
  db: SQLiteDatabase,
  id: string,
  data: PetInput,
): Promise<void> {
  await db.runAsync(
    `UPDATE pets SET name = ?, species = ?, photo = ?, birthdate = ?, updated_at = ${NOW_ISO}, dirty = 1 WHERE id = ?`,
    [data.name, data.species, data.photo, data.birthdate, id],
  );
}

export async function deletePet(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  // Tombstone, not a physical DELETE, so the deletion can propagate to
  // Supabase on the next sync. ON DELETE CASCADE no longer fires (nothing is
  // actually deleted), so the child records are tombstoned explicitly here.
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE records SET deleted_at = ${NOW_ISO}, dirty = 1 WHERE pet_id = ? AND deleted_at IS NULL`,
      [id],
    );
    await db.runAsync(
      `UPDATE pets SET deleted_at = ${NOW_ISO}, dirty = 1 WHERE id = ?`,
      [id],
    );
  });
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export async function createRecord(
  db: SQLiteDatabase,
  data: HealthRecordInput,
): Promise<HealthRecord> {
  const record: HealthRecord = { id: generateId(), ...data, dirty: true, deletedAt: null };
  await db.runAsync(
    `INSERT INTO records (id, pet_id, type, date, details, photo, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ?, ${NOW_ISO}, 1)`,
    [record.id, record.petId, record.type, record.date, record.details, record.photo],
  );
  return record;
}

// Same dirty-tombstone carve-out as listPets — see its comment above.
export async function listRecordsForPet(
  db: SQLiteDatabase,
  petId: string,
): Promise<HealthRecord[]> {
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT ${RECORD_COLUMNS} FROM records WHERE pet_id = ? AND (deleted_at IS NULL OR dirty = 1) ORDER BY date DESC, rowid DESC`,
    [petId],
  );
  return rows.map(rowToRecord);
}

export async function updateRecord(
  db: SQLiteDatabase,
  id: string,
  data: HealthRecordInput,
): Promise<void> {
  await db.runAsync(
    `UPDATE records SET pet_id = ?, type = ?, date = ?, details = ?, photo = ?, updated_at = ${NOW_ISO}, dirty = 1 WHERE id = ?`,
    [data.petId, data.type, data.date, data.details, data.photo, id],
  );
}

export async function deleteRecord(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  await db.runAsync(
    `UPDATE records SET deleted_at = ${NOW_ISO}, dirty = 1 WHERE id = ?`,
    [id],
  );
}

export async function getRecord(
  db: SQLiteDatabase,
  id: string,
): Promise<HealthRecord | null> {
  const row = await db.getFirstAsync<RecordRow>(
    `SELECT ${RECORD_COLUMNS} FROM records WHERE id = ?`,
    [id],
  );
  return row ? rowToRecord(row) : null;
}

// ---------------------------------------------------------------------------
// Settings (key/value)
// ---------------------------------------------------------------------------

export async function getSetting(
  db: SQLiteDatabase,
  key: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLiteDatabase,
  key: string,
  value: string,
): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

// ---------------------------------------------------------------------------
// Account switch / logout data lifecycle
// ---------------------------------------------------------------------------

// Cheap existence check (LIMIT 1, no row data) so the home list (MIN-47) can
// know whether a pet has any unsynced record without loading that pet's
// records — the home screen deliberately doesn't hold records in state (see
// store/pets.tsx's state-split comment).
export async function hasUnsyncedRecordsForPet(db: SQLiteDatabase, petId: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM records WHERE pet_id = ? AND dirty = 1 LIMIT 1',
    [petId],
  );
  return !!row;
}

export async function hasDirtyData(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT (SELECT COUNT(*) FROM pets WHERE dirty = 1) + (SELECT COUNT(*) FROM records WHERE dirty = 1) AS n`,
  );
  return (row?.n ?? 0) > 0;
}

// Hard delete, not a tombstone — this is a genuine local wipe, nothing to
// propagate. Also clears the sync cursor ('last_synced_at') and the
// local-owner marker ('local_owner_id', both written by lib/sync.ts) so the
// next login does a full pull instead of an incremental one, and so the
// owner-mismatch guard in runSync doesn't think there's still someone to
// compare against.
export async function wipeLocalData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM records');
    await db.runAsync('DELETE FROM pets');
    await db.runAsync("DELETE FROM settings WHERE key IN ('last_synced_at', 'local_owner_id')");
  });
}
