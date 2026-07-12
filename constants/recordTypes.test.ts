import { RECORD_TYPES, recordTypeMeta } from './recordTypes';
import { RecordType } from '../types';

describe('RECORD_TYPES', () => {
  it('covers exactly the five record types enumerated in the PRD', () => {
    const types = RECORD_TYPES.map(t => t.type).sort();
    expect(types).toEqual(['Medication', 'Note', 'Vaccine', 'Vet Visit', 'Weight'].sort());
  });

  it('has no duplicate type entries', () => {
    const types = RECORD_TYPES.map(t => t.type);
    expect(new Set(types).size).toBe(types.length);
  });
});

describe('recordTypeMeta', () => {
  it('returns the matching metadata for a known type', () => {
    expect(recordTypeMeta('Weight').label).toBe('Weight');
    expect(recordTypeMeta('Vet Visit').short).toBe('Vet');
  });

  it('falls back to the first entry for an unrecognized type', () => {
    // RecordType is a closed union, so this can only happen via bad/legacy
    // data (e.g. a row written before a type was renamed) — recordTypeMeta
    // must not throw or return undefined in that case.
    const bogus = 'Grooming' as RecordType;
    expect(recordTypeMeta(bogus)).toBe(RECORD_TYPES[0]);
  });
});
