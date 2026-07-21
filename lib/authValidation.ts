const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export const PASSWORD_REQUIREMENT_TEXT = 'At least 8 characters, with a letter and a number';

export function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// Supabase's signUp error message for a duplicate account, matched loosely
// (word order varies: "already registered" vs "already been registered")
// since GoTrue doesn't expose a stable error code for this over the JS SDK.
export function isDuplicateEmailError(message: string): boolean {
  return /already/i.test(message) && /regist|exist|in use/i.test(message);
}
