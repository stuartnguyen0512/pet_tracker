import { isDuplicateEmailError, isStrongPassword, isValidEmail } from './authValidation';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('min@example.com')).toBe(true);
  });

  it('trims surrounding whitespace before checking', () => {
    expect(isValidEmail('  min@example.com  ')).toBe(true);
  });

  it.each(['min', 'min@', '@example.com', 'min@example', 'min example.com'])(
    'rejects %s',
    (bad) => {
      expect(isValidEmail(bad)).toBe(false);
    },
  );
});

describe('isStrongPassword', () => {
  it('accepts 8+ chars with a letter and a number', () => {
    expect(isStrongPassword('abcd1234')).toBe(true);
  });

  it('rejects short passwords', () => {
    expect(isStrongPassword('a1b2c3')).toBe(false);
  });

  it('rejects letters-only', () => {
    expect(isStrongPassword('abcdefgh')).toBe(false);
  });

  it('rejects numbers-only', () => {
    expect(isStrongPassword('12345678')).toBe(false);
  });
});

describe('isDuplicateEmailError', () => {
  it.each([
    'User already registered',
    'A user with this email address has already been registered',
    'email already exists',
  ])('matches %s', (msg) => {
    expect(isDuplicateEmailError(msg)).toBe(true);
  });

  it('does not match unrelated errors', () => {
    expect(isDuplicateEmailError('Invalid login credentials')).toBe(false);
  });
});
