import { initDatabase } from './database';
import * as Q from './queries';
import { SQLiteDatabase } from 'expo-sqlite';
import { HealthRecord, Pet } from '../types';

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await initDatabase();
});

const newPet = (overrides: Partial<Omit<Pet, 'id'>> = {}): Omit<Pet, 'id'> => ({
  name: 'Milo',
  species: 'Dog',
  photo: null,
  birthdate: null,
  ...overrides,
});

const newRecord = (petId: string, overrides: Partial<Omit<HealthRecord, 'id'>> = {}): Omit<HealthRecord, 'id'> => ({
  petId,
  type: 'Note',
  date: '2024-01-01',
  details: 'checkup',
  photo: null,
  ...overrides,
});

describe('pets', () => {
  it('creates a pet and assigns it a UUID id', async () => {
    const pet = await Q.createPet(db, newPet());
    expect(pet.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(pet.name).toBe('Milo');
  });

  it('lists pets in insertion order', async () => {
    const a = await Q.createPet(db, newPet({ name: 'Alpha' }));
    const b = await Q.createPet(db, newPet({ name: 'Bravo' }));
    const c = await Q.createPet(db, newPet({ name: 'Charlie' }));
    const pets = await Q.listPets(db);
    expect(pets.map(p => p.id)).toEqual([a.id, b.id, c.id]);
  });

  it('gets a pet by id, and returns null for an unknown id', async () => {
    const pet = await Q.createPet(db, newPet());
    expect(await Q.getPet(db, pet.id)).toEqual(pet);
    expect(await Q.getPet(db, 'does-not-exist')).toBeNull();
  });

  it('updates a pet in place without changing its id', async () => {
    const pet = await Q.createPet(db, newPet());
    await Q.updatePet(db, pet.id, newPet({ name: 'Milo Jr.', species: 'Cat' }));
    const updated = await Q.getPet(db, pet.id);
    expect(updated).toEqual({ id: pet.id, name: 'Milo Jr.', species: 'Cat', photo: null, birthdate: null });
  });

  it('tombstones a pet instead of physically deleting it, and drops it from listPets', async () => {
    const pet = await Q.createPet(db, newPet());
    await Q.deletePet(db, pet.id);

    expect((await Q.listPets(db)).map(p => p.id)).not.toContain(pet.id);

    const row = await db.getFirstAsync<{ deleted_at: string | null; dirty: number }>(
      'SELECT deleted_at, dirty FROM pets WHERE id = ?',
      [pet.id],
    );
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.dirty).toBe(1);
  });

  it('cascades pet deletion to that pet’s records as tombstones, dropping them from listRecordsForPet', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    await Q.deletePet(db, pet.id);

    expect(await Q.listRecordsForPet(db, pet.id)).toEqual([]);

    const row = await db.getFirstAsync<{ deleted_at: string | null; dirty: number }>(
      'SELECT deleted_at, dirty FROM records WHERE id = ?',
      [record.id],
    );
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.dirty).toBe(1);
  });

  it('does not tombstone other pets’ records when one pet is deleted', async () => {
    const petA = await Q.createPet(db, newPet({ name: 'A' }));
    const petB = await Q.createPet(db, newPet({ name: 'B' }));
    const recordB = await Q.createRecord(db, newRecord(petB.id));
    await Q.deletePet(db, petA.id);
    expect(await Q.getRecord(db, recordB.id)).not.toBeNull();
    expect(await Q.listRecordsForPet(db, petB.id)).toHaveLength(1);
  });
});

describe('records', () => {
  it('creates a record and assigns it a UUID id', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id, { type: 'Vaccine', details: 'Rabies' }));
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(record.type).toBe('Vaccine');
  });

  it('lists a pet’s records ordered by date descending', async () => {
    const pet = await Q.createPet(db, newPet());
    const older = await Q.createRecord(db, newRecord(pet.id, { date: '2024-01-01' }));
    const newer = await Q.createRecord(db, newRecord(pet.id, { date: '2024-06-15' }));
    const records = await Q.listRecordsForPet(db, pet.id);
    expect(records.map(r => r.id)).toEqual([newer.id, older.id]);
  });

  it('breaks same-date ties by most-recently-inserted first', async () => {
    const pet = await Q.createPet(db, newPet());
    const first = await Q.createRecord(db, newRecord(pet.id, { date: '2024-03-01', details: 'first' }));
    const second = await Q.createRecord(db, newRecord(pet.id, { date: '2024-03-01', details: 'second' }));
    const records = await Q.listRecordsForPet(db, pet.id);
    expect(records.map(r => r.id)).toEqual([second.id, first.id]);
  });

  it('only returns records belonging to the requested pet', async () => {
    const petA = await Q.createPet(db, newPet({ name: 'A' }));
    const petB = await Q.createPet(db, newPet({ name: 'B' }));
    await Q.createRecord(db, newRecord(petA.id));
    const recordB = await Q.createRecord(db, newRecord(petB.id));
    const records = await Q.listRecordsForPet(db, petB.id);
    expect(records.map(r => r.id)).toEqual([recordB.id]);
  });

  it('gets a record by id, and returns null for an unknown id', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    expect(await Q.getRecord(db, record.id)).toEqual(record);
    expect(await Q.getRecord(db, 'does-not-exist')).toBeNull();
  });

  it('updates a record in place without changing its id', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id, { type: 'Weight', details: '10 kg' }));
    await Q.updateRecord(db, record.id, newRecord(pet.id, { type: 'Weight', details: '11 kg' }));
    const updated = await Q.getRecord(db, record.id);
    expect(updated?.details).toBe('11 kg');
    expect(updated?.id).toBe(record.id);
  });

  it('tombstones a record instead of physically deleting it, and drops it from listRecordsForPet', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    await Q.deleteRecord(db, record.id);

    expect(await Q.listRecordsForPet(db, pet.id)).toEqual([]);

    const row = await db.getFirstAsync<{ deleted_at: string | null; dirty: number }>(
      'SELECT deleted_at, dirty FROM records WHERE id = ?',
      [record.id],
    );
    expect(row?.deleted_at).not.toBeNull();
    expect(row?.dirty).toBe(1);
  });
});

describe('sync scaffolding (dirty/updated_at stamping)', () => {
  const syncColumns = async (table: 'pets' | 'records', id: string) =>
    db.getFirstAsync<{ updated_at: string | null; dirty: number }>(
      `SELECT updated_at, dirty FROM ${table} WHERE id = ?`,
      [id],
    );

  it('stamps dirty=1 and a non-null updated_at on pet create, and bumps updated_at on update', async () => {
    const pet = await Q.createPet(db, newPet());
    const created = await syncColumns('pets', pet.id);
    expect(created?.dirty).toBe(1);
    expect(created?.updated_at).toEqual(expect.any(String));

    await Q.updatePet(db, pet.id, newPet({ name: 'Milo Jr.' }));
    const updated = await syncColumns('pets', pet.id);
    expect(updated?.dirty).toBe(1);
    expect(new Date(updated!.updated_at!).getTime()).toBeGreaterThanOrEqual(
      new Date(created!.updated_at!).getTime(),
    );
  });

  it('stamps dirty=1 and a non-null updated_at on record create, and bumps updated_at on update', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    const created = await syncColumns('records', record.id);
    expect(created?.dirty).toBe(1);
    expect(created?.updated_at).toEqual(expect.any(String));

    await Q.updateRecord(db, record.id, newRecord(pet.id, { details: 'follow-up' }));
    const updated = await syncColumns('records', record.id);
    expect(updated?.dirty).toBe(1);
    expect(new Date(updated!.updated_at!).getTime()).toBeGreaterThanOrEqual(
      new Date(created!.updated_at!).getTime(),
    );
  });
});

describe('settings', () => {
  it('returns null for a setting that has never been set', async () => {
    expect(await Q.getSetting(db, 'exampleKey')).toBeNull();
  });

  it('round-trips a value through setSetting/getSetting', async () => {
    await Q.setSetting(db, 'exampleKey', '1');
    expect(await Q.getSetting(db, 'exampleKey')).toBe('1');
  });

  it('overwrites rather than duplicating on a repeated key (upsert)', async () => {
    await Q.setSetting(db, 'exampleKey', '1');
    await Q.setSetting(db, 'exampleKey', '0');
    expect(await Q.getSetting(db, 'exampleKey')).toBe('0');
  });
});

describe('account switch / logout data lifecycle', () => {
  it('hasDirtyData is false on a clean db and true right after a create', async () => {
    expect(await Q.hasDirtyData(db)).toBe(false);
    await Q.createPet(db, newPet());
    expect(await Q.hasDirtyData(db)).toBe(true);
  });

  it('hasDirtyData is true from a dirty record even when pets are all clean', async () => {
    const pet = await Q.createPet(db, newPet());
    await db.runAsync('UPDATE pets SET dirty = 0 WHERE id = ?', [pet.id]);
    expect(await Q.hasDirtyData(db)).toBe(false);

    await Q.createRecord(db, newRecord(pet.id));
    expect(await Q.hasDirtyData(db)).toBe(true);
  });

  it('wipeLocalData removes every pet and record and leaves hasDirtyData false', async () => {
    const pet = await Q.createPet(db, newPet());
    await Q.createRecord(db, newRecord(pet.id));

    await Q.wipeLocalData(db);

    expect(await Q.listPets(db)).toEqual([]);
    expect(await db.getFirstAsync('SELECT id FROM pets')).toBeNull();
    expect(await db.getFirstAsync('SELECT id FROM records')).toBeNull();
    expect(await Q.hasDirtyData(db)).toBe(false);
  });

  it('wipeLocalData clears the sync cursor so the next login does a full pull', async () => {
    await Q.setSetting(db, 'last_synced_at', '2024-01-01T00:00:00.000Z');
    await Q.wipeLocalData(db);
    expect(await Q.getSetting(db, 'last_synced_at')).toBeNull();
  });
});
