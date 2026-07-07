import { RecordType } from '../types';

export type RecordTypeMeta = {
  type: RecordType;
  label: string;
  short: string;
  emoji: string;
  tint: string;
  ic: string;
  placeholder: string;
};

// Colors/labels mirror the Pet Health Tracker design (Pet Health Tracker.dc.html).
export const RECORD_TYPES: RecordTypeMeta[] = [
  { type: 'Vaccine', label: 'Vaccine', short: 'Vaccine', emoji: '💉', tint: '#E8EFEA', ic: '#3F7A54', placeholder: 'e.g. Rabies, 3-year' },
  { type: 'Vet Visit', label: 'Vet Visit', short: 'Vet', emoji: '🩺', tint: '#E9EDF3', ic: '#3E5C88', placeholder: 'e.g. Annual checkup — all clear' },
  { type: 'Medication', label: 'Medication', short: 'Meds', emoji: '💊', tint: '#F1EBEF', ic: '#7A4E6B', placeholder: 'e.g. Apoquel 16mg, 1x daily' },
  { type: 'Weight', label: 'Weight', short: 'Weight', emoji: '⚖️', tint: '#EFEDE6', ic: '#7A6A3E', placeholder: '0.0' },
  { type: 'Note', label: 'Note', short: 'Note', emoji: '📝', tint: '#EAEBEC', ic: '#5A626A', placeholder: 'Anything you want to remember' },
];

export function recordTypeMeta(type: RecordType): RecordTypeMeta {
  return RECORD_TYPES.find(t => t.type === type) ?? RECORD_TYPES[0];
}
