import { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './supabaseClient';
import { getSetting, setSetting, wipeLocalData } from '../db/queries';

export const LAST_SYNCED_AT_KEY = 'last_synced_at';
const LOCAL_OWNER_ID_KEY = 'local_owner_id';
const EPOCH = '1970-01-01T00:00:00.000Z';

type DirtyPetRow = {
  id: string;
  name: string;
  species: string;
  photo: string | null;
  birthdate: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type DirtyRecordRow = {
  id: string;
  pet_id: string;
  type: string;
  date: string;
  details: string;
  photo: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type RemotePetRow = {
  id: string;
  name: string;
  species: string;
  photo_url: string | null;
  birthdate: string | null;
  updated_at: string;
  deleted_at: string | null;
};

type RemoteRecordRow = {
  id: string;
  pet_id: string;
  type: string;
  date: string;
  details: string;
  photo_url: string | null;
  updated_at: string;
  deleted_at: string | null;
};

// ---------------------------------------------------------------------------
// Push: dirty local rows -> Supabase
// ---------------------------------------------------------------------------

async function pushDirtyPets(db: SQLiteDatabase, userId: string): Promise<void> {
  const dirty = await db.getAllAsync<DirtyPetRow>(
    'SELECT id, name, species, photo, birthdate, updated_at, deleted_at FROM pets WHERE dirty = 1',
  );
  if (dirty.length === 0) return;

  const { error } = await supabase.from('pets').upsert(
    dirty.map(p => ({
      id: p.id,
      owner_id: userId,
      name: p.name,
      species: p.species,
      photo_url: p.photo,
      birthdate: p.birthdate,
      updated_at: p.updated_at,
      deleted_at: p.deleted_at,
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;

  await db.runAsync(
    `UPDATE pets SET dirty = 0 WHERE id IN (${dirty.map(() => '?').join(',')})`,
    dirty.map(p => p.id),
  );
}

async function pushDirtyRecords(db: SQLiteDatabase, userId: string): Promise<void> {
  const dirty = await db.getAllAsync<DirtyRecordRow>(
    'SELECT id, pet_id, type, date, details, photo, updated_at, deleted_at FROM records WHERE dirty = 1',
  );
  if (dirty.length === 0) return;

  const { error } = await supabase.from('health_records').upsert(
    dirty.map(r => ({
      id: r.id,
      pet_id: r.pet_id,
      owner_id: userId,
      type: r.type,
      date: r.date,
      details: r.details,
      photo_url: r.photo,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;

  await db.runAsync(
    `UPDATE records SET dirty = 0 WHERE id IN (${dirty.map(() => '?').join(',')})`,
    dirty.map(r => r.id),
  );
}

// ---------------------------------------------------------------------------
// Pull + merge: remote rows changed since the cursor -> local SQLite
// (last-write-wins by updated_at, compared as actual instants rather than
// raw strings — local and remote timestamp strings don't share one format)
// ---------------------------------------------------------------------------

async function mergePets(db: SQLiteDatabase, remoteRows: RemotePetRow[]): Promise<void> {
  for (const row of remoteRows) {
    const local = await db.getFirstAsync<{ updated_at: string }>(
      'SELECT updated_at FROM pets WHERE id = ?',
      [row.id],
    );
    if (!local) {
      await db.runAsync(
        'INSERT INTO pets (id, name, species, photo, birthdate, updated_at, dirty, deleted_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        [row.id, row.name, row.species, row.photo_url, row.birthdate, row.updated_at, row.deleted_at],
      );
    } else if (new Date(row.updated_at).getTime() > new Date(local.updated_at).getTime()) {
      await db.runAsync(
        'UPDATE pets SET name = ?, species = ?, photo = ?, birthdate = ?, updated_at = ?, dirty = 0, deleted_at = ? WHERE id = ?',
        [row.name, row.species, row.photo_url, row.birthdate, row.updated_at, row.deleted_at, row.id],
      );
    }
  }
}

async function mergeRecords(db: SQLiteDatabase, remoteRows: RemoteRecordRow[]): Promise<void> {
  for (const row of remoteRows) {
    const local = await db.getFirstAsync<{ updated_at: string }>(
      'SELECT updated_at FROM records WHERE id = ?',
      [row.id],
    );
    if (!local) {
      await db.runAsync(
        'INSERT INTO records (id, pet_id, type, date, details, photo, updated_at, dirty, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
        [row.id, row.pet_id, row.type, row.date, row.details, row.photo_url, row.updated_at, row.deleted_at],
      );
    } else if (new Date(row.updated_at).getTime() > new Date(local.updated_at).getTime()) {
      await db.runAsync(
        'UPDATE records SET pet_id = ?, type = ?, date = ?, details = ?, photo = ?, updated_at = ?, dirty = 0, deleted_at = ? WHERE id = ?',
        [row.pet_id, row.type, row.date, row.details, row.photo_url, row.updated_at, row.deleted_at, row.id],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// runSync — push all dirty rows, then pull + merge remote changes since the
// last cursor, then advance the cursor. Manual only: nothing in this module
// calls this on a timer or on app launch — a caller (Settings' "Sync Now",
// milestone 4) triggers it explicitly once the user is logged in.
// ---------------------------------------------------------------------------

export async function runSync(db: SQLiteDatabase, userId: string): Promise<void> {
  // Local data can only ever belong to one account (personal-only accounts,
  // no sharing). Settings' logout flow wipes it, but that's not the only way
  // a device switches accounts — signing into a different account directly
  // from the login screen, over an existing session, never routes through
  // that logout wipe. Without this check, pushDirtyPets/pushDirtyRecords
  // below would try to upsert the previous owner's rows under this userId
  // and Supabase RLS (owner_id = auth.uid()) rejects it outright (42501).
  // So: whoever synced last is compared against who's syncing now, and any
  // mismatch wipes first, exactly like an explicit logout would have.
  const localOwnerId = await getSetting(db, LOCAL_OWNER_ID_KEY);
  if (localOwnerId && localOwnerId !== userId) {
    await wipeLocalData(db);
  }
  await setSetting(db, LOCAL_OWNER_ID_KEY, userId);

  const syncStartedAt = new Date().toISOString();

  await pushDirtyPets(db, userId);
  await pushDirtyRecords(db, userId);

  const cursor = (await getSetting(db, LAST_SYNCED_AT_KEY)) ?? EPOCH;

  const { data: remotePets, error: petsError } = await supabase
    .from('pets')
    .select('id, name, species, photo_url, birthdate, updated_at, deleted_at')
    .eq('owner_id', userId)
    .gt('updated_at', cursor);
  if (petsError) throw petsError;
  await mergePets(db, remotePets ?? []);

  const { data: remoteRecords, error: recordsError } = await supabase
    .from('health_records')
    .select('id, pet_id, type, date, details, photo_url, updated_at, deleted_at')
    .eq('owner_id', userId)
    .gt('updated_at', cursor);
  if (recordsError) throw recordsError;
  await mergeRecords(db, remoteRecords ?? []);

  await setSetting(db, LAST_SYNCED_AT_KEY, syncStartedAt);
}
