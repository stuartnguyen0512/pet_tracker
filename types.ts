export type Pet = {
  id: string;
  name: string;
  species: string;
  photo: string | null;
  birthdate: string | null;
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
};
