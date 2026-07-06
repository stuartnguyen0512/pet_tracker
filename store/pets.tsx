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
import { HealthRecord, Pet } from '../types';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

type PetsContextType = {
  // pets[] is held in React state so the home screen re-renders on any change.
  // Records are NOT held here — they're fetched per-pet by the profile screen
  // and managed as local state there (same lazy pattern as the old useExpenses
  // hook, just split across two levels).
  pets: Pet[];

  // Pet mutations — update both the DB and local pets[] atomically
  createPet: (data: Omit<Pet, 'id'>) => Promise<Pet>;
  updatePet: (id: string, data: Omit<Pet, 'id'>) => Promise<void>;
  deletePet: (id: string) => Promise<void>;

  // Record operations — thin DB pass-throughs; callers own their own state
  createRecord: (data: Omit<HealthRecord, 'id'>) => Promise<HealthRecord>;
  listRecordsForPet: (petId: string) => Promise<HealthRecord[]>;
  updateRecord: (id: string, data: Omit<HealthRecord, 'id'>) => Promise<void>;
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

  // --- Pet mutations ---

  const createPet = useCallback(async (data: Omit<Pet, 'id'>): Promise<Pet> => {
    const pet = await Q.createPet(db!, data);
    setPets(prev => [...prev, pet]);
    return pet;
  }, [db]);

  const updatePet = useCallback(async (id: string, data: Omit<Pet, 'id'>): Promise<void> => {
    await Q.updatePet(db!, id, data);
    setPets(prev => prev.map(p => (p.id === id ? { id, ...data } : p)));
  }, [db]);

  const deletePet = useCallback(async (id: string): Promise<void> => {
    await Q.deletePet(db!, id);
    setPets(prev => prev.filter(p => p.id !== id));
  }, [db]);

  // --- Record pass-throughs ---

  const createRecord = useCallback(
    (data: Omit<HealthRecord, 'id'>) => Q.createRecord(db!, data),
    [db],
  );
  const listRecordsForPet = useCallback(
    (petId: string) => Q.listRecordsForPet(db!, petId),
    [db],
  );
  const updateRecord = useCallback(
    (id: string, data: Omit<HealthRecord, 'id'>) => Q.updateRecord(db!, id, data),
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
        createPet,
        updatePet,
        deletePet,
        createRecord,
        listRecordsForPet,
        updateRecord,
        deleteRecord,
      }}
    >
      {children}
    </PetsContext.Provider>
  );
}
