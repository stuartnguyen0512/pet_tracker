import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from '../db/database';
import * as Q from '../db/queries';

// supabase-js isn't mockable-by-network in this sandbox (see
// lib/supabaseAuth.live.test.ts), so runSync's push/pull calls are exercised
// against a stubbed client instead. Variable names must start with "mock" —
// jest's out-of-scope check for jest.mock() factories requires it.
const mockPetsUpsert = jest.fn();
const mockRecordsUpsert = jest.fn();
const mockPetsSelect = jest.fn();
const mockRecordsSelect = jest.fn();

jest.mock('./supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'pets') {
        return {
          upsert: (...args: unknown[]) => mockPetsUpsert(...args),
          select: (...args: unknown[]) => mockPetsSelect(...args),
        };
      }
      if (table === 'health_records') {
        return {
          upsert: (...args: unknown[]) => mockRecordsUpsert(...args),
          select: (...args: unknown[]) => mockRecordsSelect(...args),
        };
      }
      throw new Error(`unexpected supabase table: ${table}`);
    },
  },
}));

// Imported after the mock so `runSync` picks up the stubbed client.
import { runSync } from './sync';

const USER_ID = 'user-123';

function emptyPull() {
  return { eq: () => ({ gt: () => Promise.resolve({ data: [], error: null }) }) };
}

function pullReturning(rows: unknown[]) {
  return { eq: () => ({ gt: () => Promise.resolve({ data: rows, error: null }) }) };
}

let db: SQLiteDatabase;

beforeEach(async () => {
  db = await initDatabase();
  mockPetsUpsert.mockReset().mockResolvedValue({ error: null });
  mockRecordsUpsert.mockReset().mockResolvedValue({ error: null });
  mockPetsSelect.mockReset().mockReturnValue(emptyPull());
  mockRecordsSelect.mockReset().mockReturnValue(emptyPull());
});

const newPet = (overrides: Partial<Omit<import('../types').Pet, 'id'>> = {}) => ({
  name: 'Milo',
  species: 'Dog',
  photo: null,
  birthdate: null,
  ...overrides,
});

describe('runSync — push', () => {
  it('pushes dirty pets mapped to the cloud shape, then clears their dirty flag', async () => {
    const pet = await Q.createPet(db, newPet());

    await runSync(db, USER_ID);

    expect(mockPetsUpsert).toHaveBeenCalledTimes(1);
    const [rows, opts] = mockPetsUpsert.mock.calls[0];
    expect(rows).toEqual([
      expect.objectContaining({
        id: pet.id,
        owner_id: USER_ID,
        name: 'Milo',
        species: 'Dog',
        photo_url: null,
        birthdate: null,
      }),
    ]);
    expect(opts).toEqual({ onConflict: 'id' });

    const row = await db.getFirstAsync<{ dirty: number }>('SELECT dirty FROM pets WHERE id = ?', [pet.id]);
    expect(row?.dirty).toBe(0);
  });

  it('maps record photo -> photo_url and pet_id through to health_records', async () => {
    const pet = await Q.createPet(db, newPet());
    const record = await Q.createRecord(db, {
      petId: pet.id,
      type: 'Vaccine',
      date: '2024-01-01',
      details: 'Rabies',
      photo: 'file:///rabies.jpg',
    });

    await runSync(db, USER_ID);

    expect(mockRecordsUpsert).toHaveBeenCalledTimes(1);
    const [rows] = mockRecordsUpsert.mock.calls[0];
    expect(rows).toEqual([
      expect.objectContaining({
        id: record.id,
        pet_id: pet.id,
        owner_id: USER_ID,
        type: 'Vaccine',
        details: 'Rabies',
        photo_url: 'file:///rabies.jpg',
      }),
    ]);
  });

  it('does not call upsert when there is nothing dirty', async () => {
    await runSync(db, USER_ID);
    expect(mockPetsUpsert).not.toHaveBeenCalled();
    expect(mockRecordsUpsert).not.toHaveBeenCalled();
  });

  it('pushes a tombstoned pet with deleted_at set', async () => {
    const pet = await Q.createPet(db, newPet());
    await runSync(db, USER_ID); // clear the create's dirty flag first
    mockPetsUpsert.mockClear();

    await Q.deletePet(db, pet.id);
    await runSync(db, USER_ID);

    const [rows] = mockPetsUpsert.mock.calls[0];
    expect(rows[0]).toEqual(expect.objectContaining({ id: pet.id, deleted_at: expect.any(String) }));
  });
});

describe('runSync — pull + merge', () => {
  it('inserts a remote pet that does not exist locally yet', async () => {
    mockPetsSelect.mockReturnValue(
      pullReturning([
        {
          id: 'remote-pet-1',
          name: 'Nova',
          species: 'Cat',
          photo_url: null,
          birthdate: null,
          updated_at: new Date().toISOString(),
          deleted_at: null,
        },
      ]),
    );

    await runSync(db, USER_ID);

    const pets = await Q.listPets(db);
    expect(pets).toEqual([
      { id: 'remote-pet-1', name: 'Nova', species: 'Cat', photo: null, birthdate: null, dirty: false, deletedAt: null },
    ]);
    const row = await db.getFirstAsync<{ dirty: number }>(
      'SELECT dirty FROM pets WHERE id = ?',
      ['remote-pet-1'],
    );
    expect(row?.dirty).toBe(0);
  });

  it('keeps the local row when the remote row is older (last-write-wins)', async () => {
    const pet = await Q.createPet(db, newPet({ name: 'Local Name' }));
    await runSync(db, USER_ID); // push once so we have a baseline updated_at

    mockPetsSelect.mockReturnValue(
      pullReturning([
        {
          id: pet.id,
          name: 'Stale Remote Name',
          species: 'Dog',
          photo_url: null,
          birthdate: null,
          updated_at: '2000-01-01T00:00:00.000Z',
          deleted_at: null,
        },
      ]),
    );

    await runSync(db, USER_ID);

    const stored = await Q.getPet(db, pet.id);
    expect(stored?.name).toBe('Local Name');
  });

  it('overwrites the local row when the remote row is newer (last-write-wins)', async () => {
    const pet = await Q.createPet(db, newPet({ name: 'Local Name' }));
    await runSync(db, USER_ID);

    const future = new Date(Date.now() + 60_000).toISOString();
    mockPetsSelect.mockReturnValue(
      pullReturning([
        {
          id: pet.id,
          name: 'Fresh Remote Name',
          species: 'Dog',
          photo_url: null,
          birthdate: null,
          updated_at: future,
          deleted_at: null,
        },
      ]),
    );

    await runSync(db, USER_ID);

    const stored = await Q.getPet(db, pet.id);
    expect(stored?.name).toBe('Fresh Remote Name');
  });

  it('inserts a pulled record after its pet in the same pull, without an FK error', async () => {
    const now = new Date().toISOString();
    mockPetsSelect.mockReturnValue(
      pullReturning([
        {
          id: 'remote-pet-2',
          name: 'Rex',
          species: 'Dog',
          photo_url: null,
          birthdate: null,
          updated_at: now,
          deleted_at: null,
        },
      ]),
    );
    mockRecordsSelect.mockReturnValue(
      pullReturning([
        {
          id: 'remote-record-1',
          pet_id: 'remote-pet-2',
          type: 'Note',
          date: '2024-01-01',
          details: 'first visit',
          photo_url: null,
          updated_at: now,
          deleted_at: null,
        },
      ]),
    );

    await expect(runSync(db, USER_ID)).resolves.not.toThrow();

    const records = await Q.listRecordsForPet(db, 'remote-pet-2');
    expect(records.map(r => r.id)).toEqual(['remote-record-1']);
  });
});

describe('runSync — cursor', () => {
  it('pulls from the epoch on the first sync, then from the stored cursor on the next', async () => {
    const mockGt = jest.fn().mockReturnValue(Promise.resolve({ data: [], error: null }));
    mockPetsSelect.mockReturnValue({ eq: () => ({ gt: mockGt }) });
    mockRecordsSelect.mockReturnValue({ eq: () => ({ gt: mockGt }) });

    await runSync(db, USER_ID);
    expect(mockGt).toHaveBeenCalledWith('updated_at', '1970-01-01T00:00:00.000Z');

    const firstCursor = await Q.getSetting(db, 'last_synced_at');
    expect(firstCursor).toEqual(expect.any(String));

    mockGt.mockClear();
    await runSync(db, USER_ID);
    expect(mockGt).toHaveBeenCalledWith('updated_at', firstCursor);
  });
});

describe('runSync — owner mismatch guard', () => {
  const OTHER_USER_ID = 'user-456';

  it('wipes local data before pushing when syncing under a different account than last time', async () => {
    const pet = await Q.createPet(db, newPet({ name: 'Old Owner Pet' }));
    await runSync(db, USER_ID); // establishes local_owner_id = USER_ID, pushes + clears dirty

    // Simulate switching accounts directly from the login screen without an
    // explicit logout first — the same local pet is still here and gets
    // edited (dirty again) before the switch.
    await db.runAsync('UPDATE pets SET dirty = 1 WHERE id = ?', [pet.id]);
    mockPetsUpsert.mockClear();

    await runSync(db, OTHER_USER_ID);

    // Must never have tried to push the previous owner's row under the new
    // account — the guard should wipe it before push even looks for dirty rows.
    expect(mockPetsUpsert).not.toHaveBeenCalled();
    expect(await Q.listPets(db)).toEqual([]);
  });

  it('does not wipe when syncing again under the same account', async () => {
    const pet = await Q.createPet(db, newPet());
    await runSync(db, USER_ID);
    await runSync(db, USER_ID);
    expect(await Q.listPets(db)).toEqual([
      { id: pet.id, name: 'Milo', species: 'Dog', photo: null, birthdate: null, dirty: false, deletedAt: null },
    ]);
  });

  it('does not wipe on the very first sync ever (no prior owner recorded)', async () => {
    const pet = await Q.createPet(db, newPet());
    await runSync(db, USER_ID);
    expect(await Q.listPets(db)).toEqual([
      { id: pet.id, name: 'Milo', species: 'Dog', photo: null, birthdate: null, dirty: false, deletedAt: null },
    ]);
  });
});
