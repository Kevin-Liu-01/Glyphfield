import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EMAIL_LIFECYCLE_TEMPLATES,
  getEmailLifecycleTemplate,
} from '../emailLifecycle';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';

describe('EMAIL_LIFECYCLE_TEMPLATES', () => {
  it('includes every user-facing template from the lifecycle redesign', () => {
    expect(EMAIL_LIFECYCLE_TEMPLATES).toHaveLength(24);
    expect(new Set(EMAIL_LIFECYCLE_TEMPLATES.map(({ id }) => id)).size).toBe(24);
  });

  it('preserves the source artwork routing', () => {
    expect(getEmailLifecycleTemplate('welcome-email')?.artworkPath).toMatch(
      /email-header-welcome\.gif$/
    );
    expect(getEmailLifecycleTemplate('onboarding-day3-no-api-key-email')?.artworkPath).toMatch(
      /email-header-start\.gif$/
    );
    expect(getEmailLifecycleTemplate('onboarding-day3-api-key-email')?.artworkPath).toMatch(
      /email-header-translate\.gif$/
    );
    expect(getEmailLifecycleTemplate('onboarding-day3-live-email')?.artworkPath).toMatch(
      /email-header-live\.gif$/
    );
    expect(getEmailLifecycleTemplate('auth-magic-link-email')?.artworkPath).toMatch(
      /email-header-auth\.gif$/
    );
    expect(getEmailLifecycleTemplate('billing-payment-failed-email')?.artworkPath).toMatch(
      /email-header-billing-alert\.gif$/
    );
    expect(getEmailLifecycleTemplate('upgrade-confirmation-email')?.artworkPath).toMatch(
      /email-header-credits\.gif$/
    );
    expect(getEmailLifecycleTemplate('usage-hard-limit-email')?.artworkPath).toMatch(
      /email-header-usage\.gif$/
    );
    expect(getEmailLifecycleTemplate('locadex-pr-reminder-email')?.artworkPath).toMatch(
      /email-header-locadex\.gif$/
    );
  });

  it('keeps enterprise follow-ups plain text', () => {
    const enterpriseTemplates = EMAIL_LIFECYCLE_TEMPLATES.filter(
      ({ group }) => group === 'Enterprise'
    );

    expect(enterpriseTemplates).toHaveLength(3);
    expect(enterpriseTemplates.every(({ artworkPath }) => artworkPath === null)).toBe(true);
  });

  it('keeps delivery cadence out of user-facing template labels', () => {
    for (const { description, name, timing } of EMAIL_LIFECYCLE_TEMPLATES) {
      expect(`${name} ${description} ${timing}`).not.toMatch(/\bday\b/i);
    }
  });

  it('matches the lifecycle emails with their supporting cards', () => {
    expect(getEmailLifecycleTemplate('welcome-email')?.supportingCards).toHaveLength(3);
    expect(
      getEmailLifecycleTemplate('onboarding-day3-api-key-email')?.supportingCards.map(
        ({ imagePath }) => imagePath
      )
    ).toEqual([expect.stringMatching(/github-language-panel\.png$/)]);
    expect(getEmailLifecycleTemplate('onboarding-day3-live-email')?.supportingCards).toHaveLength(
      3
    );
    expect(getEmailLifecycleTemplate('onboarding-day5-no-api-key-email')?.supportingCards).toEqual(
      []
    );
  });

  it('ships every referenced lifecycle asset with the studio', () => {
    for (const { artworkPath, supportingCards } of EMAIL_LIFECYCLE_TEMPLATES) {
      if (artworkPath) {
        expect(existsSync(join(process.cwd(), 'public', artworkPath))).toBe(true);
      }

      for (const { imagePath } of supportingCards) {
        expect(existsSync(join(process.cwd(), 'public', imagePath))).toBe(true);
      }
    }
  });

  it('builds distinct onboarding programs for every bundled identity', () => {
    const starter = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'starter')!;
    const identities = [
      ...BUILT_IN_BRAND_IDENTITIES,
      { ...starter, id: 'template', name: 'Template', shortName: 'TM' },
    ];
    const programs = identities.map((identity) => ({
      identity,
      start: getEmailLifecycleTemplate('onboarding-day3-no-api-key-email', identity),
      welcome: getEmailLifecycleTemplate('welcome-email', identity),
    }));

    expect(new Set(programs.map(({ start }) => start?.subject)).size).toBe(
      identities.length
    );

    for (const { identity, start, welcome } of programs) {
      expect(welcome?.subject).toContain(identity.name);
      expect(start?.body).toBeTruthy();
      expect(start?.name).toBeTruthy();

      if (identity.id !== 'gt') {
        expect(`${start?.name} ${start?.subject} ${start?.body}`).not.toMatch(
          /translat|localiz|locale|locadex|api key/i
        );
        expect(start?.supportingCards).toEqual([]);
      }
    }
  });

  it('removes GT product language from every non-GT email field', () => {
    const starter = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'starter')!;
    const identities = [
      ...BUILT_IN_BRAND_IDENTITIES.filter(({ id }) => id !== 'gt'),
      { ...starter, id: 'template', name: 'Template', shortName: 'TM' },
    ];

    for (const identity of identities) {
      for (const sourceTemplate of EMAIL_LIFECYCLE_TEMPLATES) {
        const template = getEmailLifecycleTemplate(sourceTemplate.id, identity)!;
        expect(
          [
            template.body,
            template.description,
            template.name,
            template.subject,
            ...template.keywords,
          ].join(' ')
        ).not.toMatch(/translat|localiz|locale|locadex|api key/i);
        expect(template.supportingCards).toEqual([]);
      }
    }
  });
});
