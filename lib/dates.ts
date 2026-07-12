const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Local-date-safe conversions for use with the native date picker — going
// through toISOString()/`new Date(iso)` shifts the day near midnight in
// timezones behind UTC.
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// iso is expected as YYYY-MM-DD
export function monthLabel(iso: string): string {
  const [year, month] = iso.split('-');
  return `${MONTHS_FULL[Number(month) - 1]} ${year}`;
}

export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${MONTHS_SHORT[Number(month) - 1]} ${Number(day)}`;
}

// Returns e.g. "3 yr" or "8 mo"; empty string if no birthdate given.
export function ageStr(iso: string | null): string {
  if (!iso) return '';
  const birth = fromIsoDate(iso);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years <= 0) return `${months} mo`;
  return `${years} yr`;
}
