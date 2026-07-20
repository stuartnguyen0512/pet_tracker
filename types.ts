export type Pet = {
  id: string;
  name: string;
  species: string;
  photo: string | null;
  birthdate: string | null;
  // Sync metadata (MIN-46) — deliberately exposed here, reversing the prior
  // "internal to db/database.ts and lib/sync.ts" boundary now that the UI
  // has a real need for it: an unsynced-changes badge and a dimmed
  // pending-delete state (both separate follow-up tickets).
  dirty: boolean;
  deletedAt: string | null;
};

// PRD 7.3 enumerates the five record types
export type RecordType = 'Vaccine' | 'Vet Visit' | 'Medication' | 'Weight' | 'Note';

// Named HealthRecord to avoid shadowing TypeScript's built-in Record<K,V>
export type HealthRecord = {
  id: string;
  petId: string;
  type: RecordType;
  date: string;
  details: string;
  photo: string | null;
  dirty: boolean;
  deletedAt: string | null;
};

// What callers actually supply when creating/updating — sync metadata is
// always managed internally (db/queries.ts always stamps dirty=1 on write;
// deletedAt only ever changes via delete/tombstone or a pulled sync merge),
// never something a form screen sets directly.
export type PetInput = Omit<Pet, 'id' | 'dirty' | 'deletedAt'>;
export type HealthRecordInput = Omit<HealthRecord, 'id' | 'dirty' | 'deletedAt'>;
