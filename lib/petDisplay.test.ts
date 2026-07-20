import { HealthRecord, Pet } from '../types';
import { hasUnsyncedChanges, initialOf, speciesTint } from './petDisplay';

const clean = (overrides: Partial<Pet> = {}): Pet => ({
  id: 'pet-1',
  name: 'Milo',
  species: 'Dog',
  photo: null,
  birthdate: null,
  dirty: false,
  deletedAt: null,
  ...overrides,
});

const cleanRecord = (overrides: Partial<HealthRecord> = {}): HealthRecord => ({
  id: 'record-1',
  petId: 'pet-1',
  type: 'Note',
  date: '2024-01-01',
  details: '',
  photo: null,
  dirty: false,
  deletedAt: null,
  ...overrides,
});

describe('speciesTint', () => {
  it('returns the cat tint for Cat', () => {
    expect(speciesTint('Cat')).toBe('#F0EDEA');
  });

  it('returns the other tint for Other', () => {
    expect(speciesTint('Other')).toBe('#ECEEF0');
  });

  it('returns the dog/default tint for Dog', () => {
    expect(speciesTint('Dog')).toBe('#E7EEED');
  });

  it('falls back to the dog/default tint for an unrecognized species', () => {
    expect(speciesTint('Rabbit')).toBe('#E7EEED');
  });
});

describe('initialOf', () => {
  it('returns the uppercased first letter of a name', () => {
    expect(initialOf('milo')).toBe('M');
  });

  it('returns "?" for an empty string', () => {
    expect(initialOf('')).toBe('?');
  });

  it('uppercases a name that is already lowercase-first', () => {
    expect(initialOf('bella')).toBe('B');
  });

  // Regression test for a fixed bug: initialOf used to read name[0], which
  // indexes by UTF-16 code unit, not by Unicode code point. Any name
  // starting with an astral character (emoji, some non-Latin scripts) is a
  // surrogate pair, so name[0] sliced off only the leading half — an
  // invalid lone surrogate — instead of the full character, which React
  // Native renders as a broken glyph in the avatar circle.
  it('returns the full leading character for a name starting with an emoji', () => {
    expect(initialOf('🐶Rex')).toBe('🐶');
  });
});

describe('hasUnsyncedChanges', () => {
  it('is false when the pet and all its records are clean', () => {
    expect(hasUnsyncedChanges(clean(), [cleanRecord(), cleanRecord({ id: 'record-2' })])).toBe(false);
  });

  it('is true when the pet itself is dirty', () => {
    expect(hasUnsyncedChanges(clean({ dirty: true }), [])).toBe(true);
  });

  it('is true when any one of its records is dirty, even if the pet is clean', () => {
    const records = [cleanRecord(), cleanRecord({ id: 'record-2', dirty: true })];
    expect(hasUnsyncedChanges(clean(), records)).toBe(true);
  });

  it('is false for a pet with no records at all', () => {
    expect(hasUnsyncedChanges(clean(), [])).toBe(false);
  });
});
