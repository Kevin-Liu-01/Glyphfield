import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

type LocaleConfigOptions = {
  customMapping?: Record<string, { code: string; name?: string }>;
  defaultLocale?: string;
  locales?: string[];
};
type LocaleExports = {
  determineLocale: (locales: string | string[], approvedLocales: string[]) => string | undefined;
  isValidLocale: (locale: string) => boolean;
  LocaleConfig: new (options: LocaleConfigOptions) => {
    determineLocale: (locales: string | string[]) => string | undefined;
    requiresTranslation: (locale: string) => boolean;
  };
};

// Resolve the actual transitive dependency used by GT, including its pnpm patch.
const requireGT = createRequire(createRequire(import.meta.url).resolve('gt-next'));
const formatEntry = requireGT.resolve('@generaltranslation/format');

describe.each(['ESM', 'CommonJS'] as const)('GT exact-locale resolution (%s)', (entry) => {
  let format: LocaleExports;

  beforeAll(async () => {
    format = entry === 'ESM'
      ? await import(pathToFileURL(join(dirname(formatEntry), 'index.mjs')).href) as LocaleExports
      : requireGT('@generaltranslation/format') as LocaleExports;
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(['en-US', 'fr-FR', 'ar-EG', 'zh-Hant-TW'])(
    'resolves repeated exact %s labels without computing display-name metadata',
    (locale) => {
      const maximize = vi.spyOn(Intl.Locale.prototype, 'maximize');
      const minimize = vi.spyOn(Intl.Locale.prototype, 'minimize');
      const displayName = vi.spyOn(Intl.DisplayNames.prototype, 'of');
      const approved = ['en-US', locale];
      const config = new format.LocaleConfig({ defaultLocale: 'en-US', locales: approved });
      // Validation still checks language/region/script names. Only the additional
      // display-name metadata work is redundant for an exact approved match.
      [locale, ...approved].forEach((candidate) => expect(format.isValidLocale(candidate)).toBe(true));
      const validationNameCalls = displayName.mock.calls.length;
      displayName.mockClear();

      for (let label = 0; label < 24; label += 1) {
        expect(config.determineLocale(locale)).toBe(locale);
      }

      expect({
        displayName: displayName.mock.calls.length,
        maximize: maximize.mock.calls.length,
        minimize: minimize.mock.calls.length,
      }).toEqual({ displayName: validationNameCalls * 24, maximize: 0, minimize: 0 });
      expect(config.requiresTranslation(locale)).toBe(locale !== 'en-US');
    },
  );

  it.each([
    { name: 'normalized casing', requested: 'EN-us', approved: ['en-US'], expected: 'en-US' },
    { name: 'exact dialect', requested: 'en-GB', approved: ['en-US', 'en-GB'], expected: 'en-GB' },
    { name: 'earlier requested-language fallback before a later exact match', requested: ['fr-CA', 'en-US'], approved: ['fr', 'en-US'], expected: 'fr' },
    { name: 'requested-locale order', requested: ['fr-FR', 'en-US'], approved: ['en-US', 'fr-FR'], expected: 'fr-FR' },
    { name: 'region fallback', requested: 'de-AT', approved: ['de'], expected: 'de' },
    { name: 'script fallback', requested: 'zh-HK', approved: ['zh-Hans', 'zh-Hant'], expected: 'zh-Hant' },
    { name: 'invalid requested locale skipped', requested: ['invalid!!', 'fr-FR'], approved: ['en-US', 'fr-FR'], expected: 'fr-FR' },
    { name: 'invalid approved locale skipped', requested: 'en-US', approved: ['invalid!!', 'en-US'], expected: 'en-US' },
    { name: 'invalid identical values rejected', requested: 'invalid!!', approved: ['invalid!!'], expected: undefined },
    { name: 'unsupported language', requested: 'ja-JP', approved: ['en-US', 'fr-FR'], expected: undefined },
    { name: 'empty requested locales', requested: [], approved: ['en-US'], expected: undefined },
    { name: 'empty approved locales', requested: 'en-US', approved: [], expected: undefined },
  ])('preserves $name', ({ requested, approved, expected }) => {
    expect(format.determineLocale(requested, approved)).toBe(expected);
  });

  it('returns configured aliases after canonical normalization without changing translation eligibility', () => {
    const config = new format.LocaleConfig({
      customMapping: {
        english: { code: 'en-US', name: 'English' },
        french: { code: 'fr-FR', name: 'Français' },
      },
      defaultLocale: 'english',
      locales: ['english', 'french'],
    });
    expect(config.determineLocale('english')).toBe('english');
    expect(config.determineLocale('EN-us')).toBe('english');
    expect(config.determineLocale('french')).toBe('french');
    expect(config.determineLocale('FR-fr')).toBe('french');
    expect(config.requiresTranslation('english')).toBe(false);
    expect(config.requiresTranslation('french')).toBe(true);
  });
});
