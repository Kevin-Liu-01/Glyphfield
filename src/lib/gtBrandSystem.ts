import { referencePack, type BrandSystemSource } from './brandDossierHelpers';

export const GT_SYSTEM: BrandSystemSource = {
  artDirection: {
    moodboard: 'monochrome-language',
    preview: 'translation-frame',
    titleMaxLines: 2,
  },
  dossier: {
    applications: ['Monochrome identity board', 'Language-motion header', 'Localization workspace', 'Welcome email', 'CLI and documentation', 'Event and lanyard system'],
    color: 'Black and white are the identity. Soft grayscale light, fine dither, and quiet optical depth create richness without adding chroma. Gray exists only as light, hierarchy, or surface depth.',
    graphicDevice: 'The monochrome light field combines restrained gradients, fine dither, and matte planes. It makes one source becoming many native outputs visible without turning the identity into a diagram or a material spectacle.',
    imagery: 'Prefer monochrome light fields, restrained matte surfaces, language motion, real product evidence, and carefully cropped implementation details. Locadex artwork appears only when the subject is explicitly Locadex.',
    layout: 'Use deep black or exact white fields, decisive typography, one quiet optical gesture, and generous negative space. Headlines stay within two lines; supporting Rasmus Inter copy remains visibly quieter through scale, spacing, and weight.',
    logo: 'Use the official GT mark by itself in black or white. Compose the company name as live Rasmus Inter text only when needed; never use baked wordmark images with an unverified typeface.',
    motion: 'Light and dither move softly across stable geometric fields. Language changes through centered morph fades, type-and-delete sequences, and text-to-mark transitions without vertical collapse.',
    personality: 'Exact, progressive, globally aware, quietly magnetic, and product-grade. The identity should feel like premium infrastructure with a distinctive cultural signal.',
    premise: 'General Translation keeps one idea intact as it becomes native everywhere. The identity gives that invisible act a quiet optical form: one monochrome field, many precise expressions, no loss of meaning.',
    prohibited: ['No rings or organic waves', 'No chromatic material noise', 'No connected workflow boxes', 'No baked General Translation wordmark images', 'No decorative Locadex marks', 'No corner brackets as a house motif', 'No layered duplicate headlines', 'No generic globe or flag collage', 'No interface-font fallback in exported work'],
    provenance: 'Use current GT-owned marks, product captures, documentation, and original Glyphfield studies. External partner marks remain proof assets with their own usage restrictions.',
    renderingRecipe: ['Begin with a deep black or exact white field', 'Add one soft gradient, fine dither, or matte plane', 'Use slight corner radii only where a surface needs a finished edge', 'Keep highlights broad and quiet rather than chrome-like', 'Set Rasmus Inter display type against quieter Inter support', 'Keep the GT mark isolated with generous clear space', 'Use gray as light rather than a decorative color'],
    typography: 'Use Rasmus Inter for display, body, multilingual, and interface copy. Keep it open and restrained; visible weight never exceeds 550. Code uses Geist Mono only when the content is genuinely code.',
  },
  references: referencePack('gt', {
    owner: 'General Translation',
    sourceUrl: 'https://generaltranslation.com',
    official: ['Current GT homepage', 'Dashboard localization workspace', 'GT documentation hierarchy', 'Locadex pull-request flow', 'Package and CLI surfaces', 'Welcome email system'],
    officialSources: ['https://generaltranslation.com', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs', 'https://generaltranslation.com/en-US/docs/platform', 'https://generaltranslation.com/en-US/docs/core/quickstart', 'https://generaltranslation.com'],
    campaign: ['Multilingual launch sequence', 'Customer proof in monochrome', 'Language-motion announcement', 'Developer event signage'],
    concept: ['Optical-center language study', 'Writing-system rhythm comparison', 'Source-to-locale transformation', 'Black-and-white editorial translation'],
    material: ['Uncoated white paper and black ink', 'Embossed monochrome signage', 'Transparent language overlays'],
    motion: ['Centered morph fade', 'Type and delete sequence', 'Mark-to-language transition'],
  }),
};
