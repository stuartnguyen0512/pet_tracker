// Shared visual helpers for rendering a Pet across screens (list, profile, forms).

export function speciesTint(species: string): string {
  if (species === 'Cat') return '#F0EDEA';
  if (species === 'Other') return '#ECEEF0';
  return '#E7EEED'; // Dog and default
}

export function initialOf(name: string): string {
  return (name[0] || '?').toUpperCase();
}
