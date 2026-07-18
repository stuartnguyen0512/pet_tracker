import * as Crypto from 'expo-crypto';
import { SQLiteDatabase } from 'expo-sqlite';
import { HealthRecord, Pet, RecordType } from '../types';

// ---------------------------------------------------------------------------
// Internal row types (SQLite column names → TS field names differ for records)
// ---------------------------------------------------------------------------

type PetRow = {
  id: string;
  name: string;
  species: string;
  photo: string | null;
  birthdate: string | null;
};

type RecordRow = {
  id: string;
  pet_id: string;
  type: string;
  date: string;
  details: string;
  photo: string | null;
};

function rowToPet(row: PetRow): Pet {
  return row;
}

function rowToRecord(row: RecordRow): HealthRecord {
  return {
    id: row.id,
    petId: row.pet_id,
    type: row.type as RecordType,
    date: row.date,
    details: row.details,
    photo: row.photo,
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

// Explicit column lists (rather than `SELECT *`) so callers of these functions
// keep getting the original Pet/HealthRecord shape — the sync columns
// (updated_at, dirty, deleted_at) are an internal concern of db/database.ts
// and lib/sync.ts, not part of the public row shape.
const PET_COLUMNS = 'id, name, species, photo, birthdate';
const RECORD_COLUMNS = 'id, pet_id, type, date, details, photo';

// ---------------------------------------------------------------------------
// Pets
// ---------------------------------------------------------------------------

export async function createPet(
  db: SQLiteDatabase,
  data: Omit<Pet, 'id'>,
): Promise<Pet> {
  const pet: Pet = { id: generateId(), ...data };
  await db.runAsync(
    `INSERT INTO pets (id, name, species, photo, birthdate, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ${NOW_ISO}, 1)`,
    [pet.id, pet.name, pet.species, pet.photo, pet.birthdate],
  );
  return pet;
}

export async function listPets(db: SQLiteDatabase): Promise<Pet[]> {
  const rows = await db.getAllAsync<PetRow>(
    `SELECT ${PET_COLUMNS} FROM pets WHERE deleted_at IS NULL ORDER BY rowid ASC`,
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
  data: Omit<Pet, 'id'>,
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
  data: Omit<HealthRecord, 'id'>,
): Promise<HealthRecord> {
  const record: HealthRecord = { id: generateId(), ...data };
  await db.runAsync(
    `INSERT INTO records (id, pet_id, type, date, details, photo, updated_at, dirty) VALUES (?, ?, ?, ?, ?, ?, ${NOW_ISO}, 1)`,
    [record.id, record.petId, record.type, record.date, record.details, record.photo],
  );
  return record;
}

export async function listRecordsForPet(
  db: SQLiteDatabase,
  petId: string,
): Promise<HealthRecord[]> {
  const rows = await db.getAllAsync<RecordRow>(
    `SELECT ${RECORD_COLUMNS} FROM records WHERE pet_id = ? AND deleted_at IS NULL ORDER BY date DESC, rowid DESC`,
    [petId],
  );
  return rows.map(rowToRecord);
}

export async function updateRecord(
  db: SQLiteDatabase,
  id: string,
  data: Omit<HealthRecord, 'id'>,
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
