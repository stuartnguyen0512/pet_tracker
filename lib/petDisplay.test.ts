import { initialOf, speciesTint } from './petDisplay';

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

  // BUG: initialOf reads name[0], which indexes by UTF-16 code unit, not by
  // Unicode code point. Any name starting with an astral character (emoji,
  // some non-Latin scripts) is a surrogate pair, so name[0] slices off only
  // the leading half — an invalid lone surrogate — instead of the full
  // character. React Native renders that as a broken glyph in the avatar
  // circle. Fix is `[...name][0]` (spreads by code point) instead of name[0].
  it('BUG: produces a broken lone surrogate for a name starting with an emoji', () => {
    const result = initialOf('🐶Rex');
    const codePoint = result.codePointAt(0)!;
    const isLoneSurrogate = codePoint >= 0xd800 && codePoint <= 0xdbff;

    // This is the CURRENT (buggy) behavior. Once initialOf is fixed to split
    // by code point, this assertion should change to expect('🐶').
    expect(isLoneSurrogate).toBe(true);
  });
});
