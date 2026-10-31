/**
 * Production HTML for brand-element emails: a 600 px table layout with every
 * style inlined, an Outlook (MSO) wrapper, a hidden preheader, bulletproof
 * buttons and absolute image URLs. No <style> block, no flexbox or grid, so
 * Gmail, Outlook and Apple Mail render the same structure.
 */
import { brandAssetPath, brandTypographyFamily, type BrandIdentity } from './brandIdentity';
import type { BrandElement, BrandElementSettings } from './brandElements';
import { brandElementContent } from './brandElementContent';
import { contrastRatio, cssSingleQuoted, escapeXml, isDarkColor } from './brandOutputKit';
import { mixHexColors, normalizeHexOrFallback } from './color';
import { getEmailLifecycleTemplate } from './emailLifecycle';

export const BRAND_EMAIL_WIDTH = 600;

/** Elements with an HTML email export. The system sheet is a review board and exports as PNG. */
export function brandElementHasEmailHtml(element: Pick<BrandElement, 'id' | 'preview'>): boolean {
  return element.preview === 'email' && element.id !== 'email-system-sheet';
}

export type BrandEmailHtmlOptions = {
  /** Origin that root-relative image paths resolve against, such as https://glyphfield.app. */
  assetOrigin: string;
  element: Pick<BrandElement, 'id' | 'name' | 'preview'>;
  /** Optional header artwork (an http(s) or data: URL) shown under the logo. */
  headerImage?: string;
  identity: BrandIdentity;
  settings: BrandElementSettings;
};

type Palette = { accent: string; background: string; foreground: string; onAccent: string; quiet: string; rule: string; canvas: string };

const e = escapeXml;

function absolute(path: string | undefined, origin: string): string | undefined {
  if (!path) return undefined;
  if (/^(?:https?:|data:)/i.test(path)) return path;
  return `${origin.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

function siteUrl(website: string): string {
  if (!website) return '#';
  return /^https?:\/\//i.test(website) ? website : `https://${website}`;
}

function stack(family: string, fallback: string): string {
  return `'${e(cssSingleQuoted(family))}', ${fallback}`;
}

function palette(settings: BrandElementSettings): Palette {
  const accent = normalizeHexOrFallback(settings.accentColor, '#FF5A47');
  const background = normalizeHexOrFallback(settings.backgroundColor, '#FFFFFF');
  const foreground = normalizeHexOrFallback(settings.foregroundColor, '#111111');
  const onAccent = [background, foreground, '#FFFFFF', '#111111'].reduce((best, candidate) => (
    contrastRatio(accent, candidate) > contrastRatio(accent, best) + 0.5 ? candidate : best
  ), background);
  let quiet = mixHexColors(foreground, background, 0.34);
  if (contrastRatio(quiet, background) < 4.5) quiet = mixHexColors(foreground, background, 0.2);
  return { accent, background, canvas: mixHexColors(background, foreground, 0.05), foreground, onAccent, quiet, rule: mixHexColors(foreground, background, 0.86) };
}

function paragraphs(text: string, style: string): string {
  return text.split(/\n{2,}|\n/).map((line) => line.trim()).filter(Boolean)
    .map((line) => `<p style="${style}">${e(line)}</p>`).join('');
}

/** A table-cell button that survives Outlook: the cell carries the colour, the link carries the label. */
function button(label: string, href: string, colors: Palette, font: string, radius: number): string {
  if (!label.trim()) return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;"><tr><td bgcolor="${colors.accent}" style="background:${colors.accent};border-radius:${radius}px;mso-padding-alt:14px 22px;"><a href="${e(href)}" style="display:inline-block;padding:14px 22px;font-family:${font};font-size:15px;font-weight:600;line-height:20px;color:${colors.onAccent};text-decoration:none;border-radius:${radius}px;">${e(label)} &rarr;</a></td></tr></table>`;
}

function row(content: string, padding = '0 40px', background?: string): string {
  return `<tr><td style="padding:${padding};${background ? `background:${background};` : ''}">${content}</td></tr>`;
}

type EmailParts = { body: string; preheader: string; subject: string };

function lifecycleParts(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string; display: string; code: string }): EmailParts {
  const { element, identity, settings } = options;
  const content = brandElementContent(identity);
  const template = getEmailLifecycleTemplate(element.id, identity);
  const first = content.person.name.split(/\s+/)[0] ?? '';
  const radius = Math.min(identity.style?.borderRadius ?? 6, 12);
  const text = `margin:0 0 16px;font-family:${fonts.body};font-size:16px;line-height:26px;color:${colors.foreground};`;
  const title = `<h1 style="margin:0 0 20px;font-family:${fonts.display};font-size:30px;line-height:36px;font-weight:600;color:${colors.foreground};">${e(settings.headline)}</h1>`;
  const greeting = `<p style="${text}">Hi ${e(first)},</p>`;
  const cards = (template?.supportingCards ?? []).map((card) => `<tr><td style="padding:16px 0;border-top:1px solid ${colors.rule};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" style="padding-right:16px;font-family:${fonts.body};"><strong style="display:block;font-size:16px;line-height:22px;color:${colors.foreground};">${e(card.title)}</strong><span style="display:block;margin-top:4px;font-size:14px;line-height:21px;color:${colors.quiet};">${e(card.body)}</span></td><td width="160" valign="top" bgcolor="${card.imageBackgroundColor}" style="background:${card.imageBackgroundColor};"><img src="${e(absolute(card.imagePath, options.assetOrigin) ?? '')}" width="160" alt="" style="display:block;width:160px;height:auto;border:0;"></td></tr></table></td></tr>`).join('');
  const products = !cards && element.id === 'welcome-email'
    ? content.products.slice(0, 3).map((product, index) => `<tr><td style="padding:14px 0;border-top:1px solid ${colors.rule};font-family:${fonts.body};"><span style="font-family:${fonts.code};font-size:12px;color:${colors.quiet};">${String(index + 1).padStart(2, '0')}</span>&nbsp;&nbsp;<strong style="font-size:16px;color:${colors.foreground};">${e(product.name)}</strong>${product.summary ? `<span style="display:block;margin-top:2px;font-size:14px;line-height:21px;color:${colors.quiet};">${e(product.summary)}</span>` : ''}</td></tr>`).join('')
    : '';
  const list = cards || products ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">${cards || products}</table>` : '';
  const body = `${title}${greeting}${paragraphs(settings.body, text)}${button(settings.cta, siteUrl(identity.website), colors, fonts.body, radius)}${list}`;
  return { body, preheader: settings.body, subject: settings.headline };
}

function plainParts(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string }): EmailParts {
  const { identity, settings } = options;
  const first = brandElementContent(identity).person.name.split(/\s+/)[0] ?? '';
  const text = `margin:0 0 16px;font-family:${fonts.body};font-size:16px;line-height:26px;color:${colors.foreground};`;
  const body = `<p style="${text}">Hi ${e(first)},</p>${paragraphs(settings.body, text)}<p style="${text}">All best,<br>${e(settings.personName)}<br><span style="color:${colors.quiet};">${e(settings.personRole)}</span></p>`;
  return { body, preheader: settings.body, subject: settings.headline };
}

function invitationParts(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string; code: string; display: string }): EmailParts {
  const { identity, settings } = options;
  const { event } = brandElementContent(identity);
  const radius = Math.min(identity.style?.borderRadius ?? 6, 12);
  // The value leads; its label follows in quiet sentence case.
  const fact = (label: string, value: string) => `<td valign="top" style="padding:0 16px 0 0;font-family:${fonts.body};"><span style="display:block;font-size:16px;line-height:22px;color:${colors.foreground};">${e(value)}</span><span style="display:block;margin-top:2px;font-size:13px;line-height:18px;color:${colors.quiet};">${label}</span></td>`;
  const facts = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;"><tr>${fact('Date', event.date)}${fact('Time', event.time)}${fact('Where', event.location)}</tr></table>`;
  const text = `margin:0 0 16px;font-family:${fonts.body};font-size:16px;line-height:26px;color:${colors.foreground};`;
  const body = `${facts}<h1 style="margin:0 0 20px;font-family:${fonts.display};font-size:30px;line-height:36px;font-weight:600;color:${colors.foreground};">${e(settings.headline)}</h1>${paragraphs(settings.body, text)}${button(settings.cta, siteUrl(identity.website), colors, fonts.body, radius)}`;
  return { body, preheader: `${event.name} · ${event.date}`, subject: settings.headline };
}

function newsletterParts(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string; code: string; display: string }): EmailParts {
  const { identity, settings } = options;
  const content = brandElementContent(identity);
  const radius = Math.min(identity.style?.borderRadius ?? 6, 12);
  const text = `margin:0 0 16px;font-family:${fonts.body};font-size:16px;line-height:26px;color:${colors.foreground};`;
  const items = content.release.items.slice(0, 3).map((item) => `<tr><td width="18" valign="top" style="padding:9px 0 0;"><div style="width:10px;height:2px;background:${colors.accent};font-size:0;line-height:0;">&nbsp;</div></td><td style="padding:0 0 10px;font-family:${fonts.body};font-size:16px;line-height:24px;color:${colors.foreground};">${e(item)}</td></tr>`).join('');
  const stories = content.products.slice(0, 3).map((product, index) => `<tr><td style="padding:16px 0;border-top:1px solid ${colors.rule};font-family:${fonts.body};"><span style="font-family:${fonts.code};font-size:12px;color:${colors.quiet};">${String(index + 1).padStart(2, '0')}</span><strong style="display:block;margin-top:4px;font-family:${fonts.display};font-size:19px;line-height:24px;color:${colors.foreground};">${e(product.name)}</strong><span style="display:block;margin-top:4px;font-size:14px;line-height:21px;color:${colors.quiet};">${e(product.summary || identity.positioning)}</span></td></tr>`).join('');
  const body = `<h1 style="margin:0 0 20px;font-family:${fonts.display};font-size:30px;line-height:36px;font-weight:600;color:${colors.foreground};">${e(settings.headline)}</h1>${paragraphs(settings.body, text)}${items ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${items}</table>` : ''}${button(settings.cta, siteUrl(identity.website), colors, fonts.body, radius)}${stories ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;">${stories}</table>` : ''}`;
  return { body, preheader: settings.body, subject: settings.headline };
}

function signatureHtml(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string; code: string; display: string }): string {
  const { identity, settings } = options;
  const mark = absolute(brandAssetPath(identity, isDarkColor(colors.background) ? 'mark-light' : 'mark-dark'), options.assetOrigin);
  const website = settings.showWebsite && identity.website ? `<br><a href="${e(siteUrl(identity.website))}" style="color:${colors.quiet};text-decoration:none;">${e(identity.website)}</a>` : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${e(settings.personName)} · ${e(identity.name)}</title></head><body style="margin:0;padding:0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:${fonts.body};"><tr>${settings.showLogo && mark ? `<td valign="top" style="padding:0 16px 0 0;"><img src="${e(mark)}" width="44" height="44" alt="${e(identity.name)}" style="display:block;width:44px;height:44px;border:0;"></td>` : ''}<td valign="top" style="border-left:2px solid ${colors.accent};padding:0 0 0 16px;"><strong style="display:block;font-family:${fonts.display};font-size:16px;line-height:22px;color:${colors.foreground};">${e(settings.personName)}</strong><span style="display:block;font-size:14px;line-height:20px;color:${colors.quiet};">${e(settings.personRole)}</span><span style="display:block;margin-top:6px;font-family:${fonts.code};font-size:12px;line-height:18px;color:${colors.quiet};">${e(identity.contactEmail)}${website}</span></td></tr></table></body></html>`;
}

function emailParts(options: BrandEmailHtmlOptions, colors: Palette, fonts: { body: string; code: string; display: string }): EmailParts {
  const { element, identity } = options;
  if (element.id === 'event-invitation-email') return invitationParts(options, colors, fonts);
  if (element.id === 'newsletter-email') return newsletterParts(options, colors, fonts);
  const template = getEmailLifecycleTemplate(element.id, identity);
  if (template && template.artworkPath === null) return plainParts(options, colors, fonts);
  return lifecycleParts(options, colors, fonts);
}

/** The complete, send-ready HTML document for one email brand element. */
export function brandEmailHtml(options: BrandEmailHtmlOptions): string {
  const { element, identity, settings } = options;
  if (!brandElementHasEmailHtml(element)) throw new RangeError(`${element.name} is not an email; export it as PNG.`);
  const colors = palette(settings);
  const fonts = {
    body: stack(brandTypographyFamily(identity, 'Body'), 'Helvetica, Arial, sans-serif'),
    code: stack(brandTypographyFamily(identity, 'Code'), 'Menlo, Consolas, monospace'),
    display: stack(brandTypographyFamily(identity, settings.fontRole), 'Helvetica, Arial, sans-serif'),
  };
  if (element.id === 'email-signature') return signatureHtml(options, colors, fonts);
  const parts = emailParts(options, colors, fonts);
  const template = getEmailLifecycleTemplate(element.id, identity);
  const plain = template?.artworkPath === null;
  const dark = isDarkColor(colors.background);
  const wordmark = absolute(brandAssetPath(identity, dark ? 'wordmark-light' : 'wordmark') ?? brandAssetPath(identity, dark ? 'mark-light' : 'mark-dark'), options.assetOrigin);
  const header = settings.showLogo && wordmark && !plain
    ? row(`<img src="${e(wordmark)}" height="28" alt="${e(identity.name)}" style="display:block;height:28px;width:auto;border:0;">`, '32px 40px 24px')
    : '';
  const art = settings.showLogo && options.headerImage && !plain
    ? row(`<img src="${e(options.headerImage)}" width="${BRAND_EMAIL_WIDTH}" alt="" style="display:block;width:100%;max-width:${BRAND_EMAIL_WIDTH}px;height:auto;border:0;">`, '0')
    : '';
  const unsubscribe = `${siteUrl(identity.website).replace(/\/$/, '')}/account`;
  const footer = row(`<p style="margin:0 0 8px;font-family:${fonts.body};font-size:13px;line-height:20px;color:${colors.quiet};">Questions? Reply to this email and the ${e(identity.name)} team will help.</p><p style="margin:0;font-family:${fonts.code};font-size:11px;line-height:18px;letter-spacing:0.5px;color:${colors.quiet};">${settings.showWebsite && identity.website ? `<a href="${e(siteUrl(identity.website))}" style="color:${colors.quiet};text-decoration:none;">${e(identity.website)}</a> · ` : ''}<a href="${e(unsubscribe)}" style="color:${colors.quiet};text-decoration:underline;">Unsubscribe</a></p>`, '24px 40px 32px');
  const preheader = parts.preheader.replace(/\s+/g, ' ').slice(0, 140);
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<meta name="color-scheme" content="${dark ? 'dark' : 'light'}">
<title>${e(parts.subject)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background:${colors.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;">${e(preheader)}&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colors.canvas}" style="background:${colors.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<!--[if mso]><table role="presentation" width="${BRAND_EMAIL_WIDTH}" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colors.background}" style="width:100%;max-width:${BRAND_EMAIL_WIDTH}px;background:${colors.background};">
${header}
${art}
${row(parts.body, '32px 40px 8px')}
${footer}
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>
`;
}
