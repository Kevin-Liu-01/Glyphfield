import { describe, expect, it } from 'vitest';

import { BRAND_ELEMENTS, createBrandElementSettings } from '../brandElements';
import { brandElementHasEmailHtml, brandEmailHtml } from '../brandEmailHtml';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { exportInput } from '../brandElementExport';

const stripe = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'stripe')!;
const element = (id: string) => BRAND_ELEMENTS.find((candidate) => candidate.id === id)!;

function html(id: string, identity = stripe) {
  return brandEmailHtml({ assetOrigin: 'https://brand.example.com', element: element(id), headerImage: 'data:image/png;base64,AAAA', identity, settings: createBrandElementSettings(element(id), identity) });
}

describe('brandEmailHtml', () => {
  it('writes a send-ready table document with inlined styles and no style block', () => {
    const document = html('welcome-email');
    expect(document).toMatch(/^<!doctype html>/);
    expect(document).toContain('<table role="presentation"');
    expect(document).toContain('<!--[if mso]>');
    expect(document).not.toMatch(/<style|class=|display:\s*(?:flex|grid)/);
    expect(document).toContain('Welcome to Stripe');
    expect(document).toContain('Accept and optimize payments globally, online and in person.');
    expect(document).toContain('src="https://brand.example.com/brands/stripe/logos/wordmark-slate.svg"');
    expect(document).toContain('href="https://stripe.com"');
    expect(document).toContain('bgcolor="#533AFD"');
  });

  it('renders invitations, newsletters, plain-text letters and signatures from brand content', () => {
    expect(html('event-invitation-email')).toContain('Stripe Sessions');
    expect(html('newsletter-email')).toContain('99.999% historical uptime');
    const letter = BRAND_ELEMENTS.find((candidate) => candidate.preview === 'email' && candidate.format === 'Plain text');
    if (letter) expect(html(letter.id)).not.toContain('data:image/png');
    const signature = html('email-signature');
    expect(signature).toContain('Elena Novak');
    expect(signature).toContain('Payments engineer');
  });

  it('escapes copy and refuses non-email elements', () => {
    const settings = { ...createBrandElementSettings(element('welcome-email'), stripe), headline: 'A & <B>' };
    expect(brandEmailHtml({ assetOrigin: 'https://x.dev', element: element('welcome-email'), identity: stripe, settings })).toContain('A &amp; &lt;B&gt;');
    expect(brandElementHasEmailHtml(element('opengraph'))).toBe(false);
    expect(brandElementHasEmailHtml(element('email-system-sheet'))).toBe(false);
    expect(() => html('opengraph')).toThrow(RangeError);
  });

  it('validates export input', () => {
    expect(exportInput(undefined)).toEqual({ assetOrigin: undefined, download: false, elementId: undefined, scale: 1 });
    expect(exportInput({ download: true, elementId: 'opengraph', scale: 2 })).toMatchObject({ download: true, elementId: 'opengraph', scale: 2 });
    expect(() => exportInput({ scale: 3 })).toThrow(RangeError);
    expect(() => exportInput({ assetOrigin: 'javascript:alert(1)' })).toThrow(TypeError);
  });
});
