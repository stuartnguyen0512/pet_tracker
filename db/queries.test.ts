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

  it('deletes a pet', async () => {
    const pet = await Q.createPet(db, newPet());
    await Q.deletePet(db, pet.id);
    expect(await Q.getPet(db, pet.id)).toBeNull();
  });

  it('cascades pet deletion to that pet’s records', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    await Q.deletePet(db, pet.id);
    expect(await Q.getRecord(db, record.id)).toBeNull();
  });

  it('does not delete other pets’ records when one pet is deleted', async () => {
    const petA = await Q.createPet(db, newPet({ name: 'A' }));
    const petB = await Q.createPet(db, newPet({ name: 'B' }));
    const recordB = await Q.createRecord(db, newRecord(petB.id));
    await Q.deletePet(db, petA.id);
    expect(await Q.getRecord(db, recordB.id)).not.toBeNull();
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

  it('deletes a record', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, newRecord(pet.id));
    await Q.deleteRecord(db, record.id);
    expect(await Q.getRecord(db, record.id)).toBeNull();
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
