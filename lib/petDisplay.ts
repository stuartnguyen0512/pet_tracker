// Shared visual helpers for rendering a Pet across screens (list, profile, forms).

import { HealthRecord, Pet } from '../types';

// Pure — no I/O. Drives the "unsynced changes" badge on the home list (a
// follow-up ticket): true if the pet itself is dirty, or any of its records
// are, regardless of whether the pet or any record is also tombstoned.
export function hasUnsyncedChanges(pet: Pet, records: HealthRecord[]): boolean {
  return pet.dirty || records.some(r => r.dirty);
}

export function speciesTint(species: string): string {
  if (species === 'Cat') return '#F0EDEA';
  if (species === 'Other') return '#ECEEF0';
  return '#E7EEED'; // Dog and default
}

export function initialOf(name: string): string {
  // Iterate by code point (not name[0], which indexes by UTF-16 code unit and
  // would split an astral character like an emoji into a broken surrogate half).
  const first = [...name][0];
  return (first || '?').toUpperCase();
}
