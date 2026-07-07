const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
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
  const birth = new Date(iso);
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

// YYYY-MM-DD, permissive but rejects obviously malformed input.
export function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}
