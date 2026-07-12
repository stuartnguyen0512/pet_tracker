// Shared visual helpers for rendering a Pet across screens (list, profile, forms).

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
