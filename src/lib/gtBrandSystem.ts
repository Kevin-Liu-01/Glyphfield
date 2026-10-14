import { referencePack, type BrandSystemSource } from './brandDossierHelpers';

export const GT_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'monochrome-language',
    preview: 'translation-frame',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Glyph globe identity board', 'Language-motion header', 'Localization workspace', 'Welcome email', 'CLI and documentation', 'Event and lanyard system'],
    color: 'Four absolute colors (ink #070707, raised ink #101010, titanium #8A8F98, paper #FFFFFF) plus exactly one spectral accent per composition: signal blue #2F5CE0, lifted to #86A8FF on ink. The accent is a controlled edge, never a wash. Depth comes from lines and material, never shadows.',
    graphicDevice: 'Language as material: glyphs that make up greater wholes. The glyph globe draws the earth in characters from twenty writing systems; the glyph field rains scripts that condense into one word; every picture is printed in the 1-bit Bayer dither, density as ordered dots and never alpha veils.',
    imagery: 'The glyph globe and historical writing as artifact pictures: the Blue Marble, the Rosetta Stone, manuscripts, calligraphy, cuneiform and the sea, cut from public-domain or Creative Commons originals and screened in the Bayer dither on ink or paper, each with its credit. Real product appears as the T component and the dashboard. Never stock photography, people, flags or maps with borders.',
    layout: 'Use deep black or exact white fields, decisive typography, one quiet optical gesture, and generous negative space. Headlines stay within two lines; supporting Rasmus Inter copy remains visibly quieter through scale, spacing, and weight.',
    logo: 'The GT monogram draws every stroke as two parallel lines, in one ink: ink on paper or paper on ink, never a third color, gradient or shadow. The race-type speed marks (bar monogram, livery stack) sit beside it for campaign and motion work.',
    motion: 'A headline dissolves into glyph dust and reassembles in the next language; matter is conserved. Language also changes through centered morph fades and type-and-delete sequences, and dither shimmers across marks as a specular, never as a glow.',
    personality: 'Exact, progressive, globally aware, quietly magnetic, and product-grade. The identity should feel like premium infrastructure with a distinctive cultural signal.',
    premise: 'Every product in every language. General Translation keeps one source intact as it becomes native everywhere, and its identity treats writing systems as the raw material: glyphs that assemble into a globe, a word, a mark.',
    prohibited: ['No second accent color', 'No alpha veils where dither should carry density', 'No shadows or glows', 'No connected workflow boxes', 'No baked General Translation wordmark images', 'No decorative Locadex marks', 'No flags as decoration, emoji flags or maps with borders', 'No stock photography or private people', 'No interface-font fallback in exported work'],
    provenance: 'GT artwork from the brand system (glyph globes, openers, speed marks, product films) and artifact pictures cut from public-domain or Creative Commons originals, each credited. External partner marks remain proof assets with their own usage restrictions.',
    renderingRecipe: ['Begin with ink #070707 or paper #FFFFFF', 'Print imagery through the 8 x 8 Bayer screen at one-pixel cells', 'Spend the blue accent on one element only', 'Draw structure with hairlines, square corners and no shadows', 'Set Inter display at weight 500 or lighter against quieter body copy', 'Keep the GT mark isolated in one ink with generous clear space', 'Check every layout in CJK, RTL and Indic scripts'],
    typography: 'Inter is the one typeface: display, interface and text. Headings never go bolder than 500; long-form text is set at 400. Monospace is an instrument voice for code, tokens and terminals, never for headlines or marketing.',
  },
  references: referencePack('gt', {
    owner: 'General Translation',
    sourceUrl: 'https://generaltranslation.com',
    official: ['Current GT homepage', 'Dashboard localization workspace', 'GT documentation hierarchy', 'Locadex pull-request flow', 'Package and CLI surfaces', 'Welcome email system'],
    officialSources: ['https://generaltranslation.com', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs/core/quickstart', 'https://generaltranslation.com'],
    campaign: ['Multilingual launch sequence', 'Customer proof in monochrome', 'Language-motion announcement', 'Developer event signage'],
    concept: ['Glyph globe study', 'Writing-system rhythm comparison', 'Source-to-locale transformation', 'Artifact pictures of writing'],
    material: ['Uncoated white paper and black ink', 'Bayer-dithered print', 'Hairline blueprint structure'],
    motion: ['Centered morph fade', 'Type and delete sequence', 'Mark-to-language transition'],
  }),
};
