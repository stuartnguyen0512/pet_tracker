import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { SQLiteDatabase } from 'expo-sqlite';
import { initDatabase } from '../db/database';
import * as Q from '../db/queries';
import { HealthRecord, HealthRecordInput, Pet, PetInput } from '../types';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

type PetsContextType = {
  // pets[] is held in React state so the home screen re-renders on any change.
  // Records are NOT held here — they're fetched per-pet by the profile screen
  // and managed as local state there (same lazy pattern as the old useExpenses
  // hook, just split across two levels).
  pets: Pet[];

  // Exposed so callers that write to SQLite directly (e.g. lib/sync.ts's
  // runSync, from Settings) can do so without duplicating query logic here.
  db: SQLiteDatabase;

  // Reloads pets[] from SQLite. Needed after anything that writes to the DB
  // without going through the mutations below — runSync merges rows straight
  // into SQLite, bypassing setPets, so callers must refresh state manually.
  refreshPets: () => Promise<void>;

  // Hard-deletes all local pets/records and clears the sync cursor. Used on
  // logout — accounts are personal-only, so a different account logging in
  // later must never see this device's leftover local rows (they'd carry the
  // old owner's data and collide with Supabase RLS on the next sync).
  wipeAllLocal: () => Promise<void>;

  // Pet mutations — update both the DB and local pets[] atomically
  createPet: (data: PetInput) => Promise<Pet>;
  updatePet: (id: string, data: PetInput) => Promise<void>;
  deletePet: (id: string) => Promise<void>;

  // Record operations — thin DB pass-throughs; callers own their own state
  createRecord: (data: HealthRecordInput) => Promise<HealthRecord>;
  listRecordsForPet: (petId: string) => Promise<HealthRecord[]>;
  getRecord: (id: string) => Promise<HealthRecord | null>;
  updateRecord: (id: string, data: HealthRecordInput) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Context + hook
// ---------------------------------------------------------------------------

const PetsContext = createContext<PetsContextType | null>(null);

export function usePets(): PetsContextType {
  const ctx = useContext(PetsContext);
  if (!ctx) throw new Error('usePets must be used within PetsProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function PetsProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);

  // Open the database and run migrations once on mount.
  // Children are blocked from rendering until the DB is ready so no screen
  // can call a DB operation on an uninitialised connection.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const database = await initDatabase();
        if (!active) return;
        setPets(await Q.listPets(database));
        setDb(database);
      } catch (e) {
        console.error('[PetsProvider] DB init failed:', e);
      }
    })();
    return () => { active = false; };
  }, []);

  const refreshPets = useCallback(async (): Promise<void> => {
    setPets(await Q.listPets(db!));
  }, [db]);

  const wipeAllLocal = useCallback(async (): Promise<void> => {
    await Q.wipeLocalData(db!);
    setPets([]);
  }, [db]);

  // --- Pet mutations ---

  const createPet = useCallback(async (data: PetInput): Promise<Pet> => {
    const pet = await Q.createPet(db!, data);
    setPets(prev => [...prev, pet]);
    return pet;
  }, [db]);

  const updatePet = useCallback(async (id: string, data: PetInput): Promise<void> => {
    await Q.updatePet(db!, id, data);
    // Spread the previous pet first (not just `id`) so dirty/deletedAt carry
    // forward rather than needing to be fabricated here — then force
    // dirty: true since updatePet's SQL always sets dirty = 1 on any write.
    setPets(prev => prev.map(p => (p.id === id ? { ...p, ...data, dirty: true } : p)));
  }, [db]);

  const deletePet = useCallback(async (id: string): Promise<void> => {
    await Q.deletePet(db!, id);
    // Merge the tombstone into state (mirroring updatePet above) instead of
    // filtering the pet out — Q.deletePet is a soft delete (deleted_at +
    // dirty), and the pet list's pending-delete dimming relies on deletedAt
    // surviving here until the next sync actually drops the row.
    setPets(prev =>
      prev.map(p => (p.id === id ? { ...p, dirty: true, deletedAt: new Date().toISOString() } : p)),
    );
  }, [db]);

  // --- Record pass-throughs ---

  const createRecord = useCallback(
    (data: HealthRecordInput) => Q.createRecord(db!, data),
    [db],
  );
  const listRecordsForPet = useCallback(
    (petId: string) => Q.listRecordsForPet(db!, petId),
    [db],
  );
  const getRecord = useCallback(
    (id: string) => Q.getRecord(db!, id),
    [db],
  );
  const updateRecord = useCallback(
    (id: string, data: HealthRecordInput) => Q.updateRecord(db!, id, data),
    [db],
  );
  const deleteRecord = useCallback(
    (id: string) => Q.deleteRecord(db!, id),
    [db],
  );

  // Block render until DB is open
  if (!db) return null;

  return (
    <PetsContext.Provider
      value={{
        pets,
        db,
        refreshPets,
        wipeAllLocal,
        createPet,
        updatePet,
        deletePet,
        createRecord,
        listRecordsForPet,
        getRecord,
        updateRecord,
        deleteRecord,
      }}
    >
      {children}
    </PetsContext.Provider>
  );
}
