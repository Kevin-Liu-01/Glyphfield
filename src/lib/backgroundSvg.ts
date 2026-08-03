import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import { mixHexColors } from '@/lib/color';
import { buildLogoSvgFilter, DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';

export type BackgroundStyle = 'gradient' | 'grain-gradient' | 'dither' | 'pattern' | 'live-shader';
export type BackgroundPattern = 'none' | 'dots' | 'lines' | 'grid' | 'fibers' | 'speckles' | 'topographic' | 'crosshatch';
export type BackgroundGradient = 'linear' | 'radial' | 'mesh' | 'orbit' | 'wave' | 'bloom';
export type BackgroundDitherShape = 'dots' | 'squares';
export const SURFACE_TEXTURE_OPTIONS = [
  { id: 'none', label: 'Smooth / no texture', substrate: 'Smooth' },
  { id: 'kerf-wood', label: 'Wood · Grain and kerf cuts', substrate: 'Wood' },
  { id: 'woven-wire', label: 'Metal · Woven wire', substrate: 'Metal' },
  { id: 'perforated-metal', label: 'Metal · Perforated sheet', substrate: 'Metal' },
  { id: 'carved-stone', label: 'Stone · Carved fissures', substrate: 'Stone' },
  { id: 'embossed-paper', label: 'Paper · Blind emboss', substrate: 'Paper' },
  { id: 'brushed-metal', label: 'Metal · Directional brush', substrate: 'Metal' },
  { id: 'hammered-foil', label: 'Metal · Hammered dimples', substrate: 'Metal' },
  { id: 'corrugated-polymer', label: 'Polymer · Molded ribs', substrate: 'Polymer' },
  { id: 'cork-composite', label: 'Natural · Cork cells', substrate: 'Natural' },
  { id: 'frosted-glass', label: 'Glass · Etched micro-pits', substrate: 'Glass' },
  { id: 'linen-weave', label: 'Textile · Linen weave', substrate: 'Textile' },
  { id: 'felted-wool', label: 'Textile · Felted wool', substrate: 'Textile' },
  { id: 'pebbled-leather', label: 'Leather · Pebbled grain', substrate: 'Leather' },
  { id: 'crackle-glaze', label: 'Ceramic · Crackle glaze', substrate: 'Ceramic' },
  { id: 'sandblasted-plaster', label: 'Mineral · Sandblasted plaster', substrate: 'Mineral' },
  { id: 'carbon-twill', label: 'Composite · Carbon twill', substrate: 'Composite' },
] as const;

export type SurfaceMaterial = (typeof SURFACE_TEXTURE_OPTIONS)[number]['id'];
export const SURFACE_MATERIAL_IDS = SURFACE_TEXTURE_OPTIONS.map(({ id }) => id) as SurfaceMaterial[];

export type BackgroundSettings = {
  angle: number;
  bandCount: number;
  bandDepth: number;
  bandGap: number;
  colorA: string;
  colorB: string;
  colorC: string;
  ditherMatrix: 2 | 4 | 8;
  ditherShape: BackgroundDitherShape;
  focalX: number;
  focalY: number;
  gradient: BackgroundGradient;
  grain: number;
  height: number;
  logoOpacity: number;
  logoColor: string;
  logoScale: number;
  logoTone: 'black' | 'white';
  logoX: number;
  logoY: number;
  lightingEnabled: boolean;
  liveMaterialId?: LiveMaterialId;
  liveSettings?: LiveMaterialSettings;
  pattern: BackgroundPattern;
  patternOpacity: number;
  relief: number;
  spacing: number;
  style: BackgroundStyle;
  surfaceAngle: number;
  surfaceDepth: number;
  surfaceMaterial: SurfaceMaterial;
  surfaceMetallic: number;
  surfaceOpenArea: number;
  surfaceRoughness: number;
  surfaceScale: number;
  surfaceTextureAmount: number;
  surfaceIrregularity: number;
  width: number;
};

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  angle: 32,
  bandCount: 15,
  bandDepth: 56,
  bandGap: 0,
  colorA: '#FFFFFF',
  colorB: '#181818',
  colorC: '#737373',
  ditherMatrix: 4,
  ditherShape: 'dots',
  focalX: 42,
  focalY: 38,
  gradient: 'linear',
  grain: 10,
  height: 750,
  logoOpacity: 100,
  logoColor: '#FFFFFF',
  logoScale: 28,
  logoTone: 'white',
  logoX: 0,
  logoY: 0,
  lightingEnabled: true,
  liveMaterialId: DEFAULT_LIVE_MATERIAL_ID,
  liveSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
  pattern: 'none',
  patternOpacity: 12,
  relief: 18,
  spacing: 24,
  style: 'gradient',
  surfaceAngle: 28,
  surfaceDepth: 28,
  surfaceMaterial: 'none',
  surfaceMetallic: 0,
  surfaceOpenArea: 52,
  surfaceRoughness: 58,
  surfaceScale: 44,
  surfaceTextureAmount: 72,
  surfaceIrregularity: 34,
  width: 1200,
};

export const BACKGROUND_GRADIENT_DEFAULTS: Readonly<Record<BackgroundGradient, Partial<BackgroundSettings>>> = {
  bloom: { angle: 24, focalX: 34, focalY: 32, relief: 24 },
  linear: { angle: 24 },
  radial: { focalX: 38, focalY: 42 },
  mesh: { bandCount: 9, bandDepth: 72, bandGap: 2, focalX: 50, lightingEnabled: true },
  orbit: { angle: 24, focalX: 62, focalY: 46, relief: 12 },
  wave: { angle: 138, focalY: 38, relief: 24 },
};

export const BACKGROUND_PRESETS = [
  {
    category: 'Gradient',
    description: 'A quiet directional field with smooth tonal separation and deep edge contrast.',
    id: 'signal-axis',
    name: 'Signal axis',
    settings: { angle: 24, colorA: '#07090D', colorB: '#394457', colorC: '#F5F7FA', gradient: 'linear', grain: 3, relief: 0, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Full-height architectural strips hold crisp edges over a controlled vertical falloff.',
    id: 'spectral-mesh',
    name: 'Signal terraces',
    settings: { angle: 90, bandCount: 9, bandDepth: 72, bandGap: 2, colorA: '#06070A', colorB: '#28334A', colorC: '#EEF2FF', focalX: 50, gradient: 'mesh', grain: 3, lightingEnabled: true, relief: 0, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Warm amber, coral, and lilac moving through an orbit field.',
    id: 'solar-orbit',
    name: 'Solar orbit',
    settings: { angle: 24, colorA: '#25113D', colorB: '#FF763D', colorC: '#FFD06A', focalX: 62, focalY: 46, gradient: 'orbit', grain: 8, relief: 12, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'A quiet cyan field with broad directional movement.',
    id: 'mineral-wave',
    name: 'Mineral wave',
    settings: { angle: 138, colorA: '#061A22', colorB: '#28B9B1', colorC: '#B9FFF2', gradient: 'wave', grain: 6, relief: 24, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'A focused off-axis aperture with a soft paper falloff and restrained vignette.',
    id: 'paper-light',
    name: 'Paper aperture',
    settings: { angle: 18, colorA: '#DDD8CE', colorB: '#F3F0EA', colorC: '#FFFFFF', focalX: 34, focalY: 31, gradient: 'radial', grain: 2, relief: 8, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'A monochrome ordered-dither transition for marks and fields.',
    id: 'ink-dither',
    name: 'Ink dither',
    settings: { angle: 24, colorA: '#F4F4F0', colorB: '#181818', colorC: '#737373', ditherMatrix: 4, ditherShape: 'dots', spacing: 16, style: 'dither' },
  },
  {
    category: 'Print',
    description: 'Electric violet and mint resolved into a compact pixel field.',
    id: 'signal-dither',
    name: 'Signal dither',
    settings: { angle: 145, colorA: '#130A33', colorB: '#795CFF', colorC: '#7BFFD9', ditherMatrix: 8, ditherShape: 'squares', spacing: 13, style: 'dither' },
  },
  {
    category: 'Gradient',
    description: 'A soft lilac, mineral blue, and opal field assembled from broad overlapping light blooms.',
    id: 'aurora-veil',
    name: 'Aurora veil',
    settings: { angle: 18, colorA: '#15112B', colorB: '#7C70FF', colorC: '#C9FFF1', focalX: 32, focalY: 28, gradient: 'bloom', grain: 5, relief: 28, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Deep ultraviolet with a concentrated electric-blue glow and a quiet rose counterpoint.',
    id: 'ultraviolet-dusk',
    name: 'Ultraviolet dusk',
    settings: { angle: 146, colorA: '#09051D', colorB: '#5137FF', colorC: '#FF8ED8', focalX: 66, focalY: 30, gradient: 'bloom', grain: 7, relief: 34, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Muted rose, warm stone, and clear milk light for editorial and cosmetic surfaces.',
    id: 'rose-quartz',
    name: 'Rose quartz',
    settings: { angle: 32, colorA: '#7E4E5B', colorB: '#D8A9A4', colorC: '#FFF4E8', focalX: 38, focalY: 34, gradient: 'bloom', grain: 4, relief: 22, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'A nocturnal cobalt field with cold cyan light pooling at the edge.',
    id: 'cobalt-haze',
    name: 'Cobalt haze',
    settings: { angle: 154, colorA: '#02091D', colorB: '#164ED8', colorC: '#A8F4FF', focalX: 72, focalY: 38, gradient: 'orbit', grain: 6, relief: 18, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Oxidized teal moving through warm copper and soft mineral highlights.',
    id: 'copper-patina',
    name: 'Copper patina',
    settings: { angle: 126, colorA: '#102F2B', colorB: '#B8603B', colorC: '#E5C48E', focalY: 46, gradient: 'wave', grain: 10, relief: 28, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Warm cotton stock with restrained fibers and a soft, off-center studio light.',
    id: 'cotton-rag',
    name: 'Cotton rag',
    settings: { angle: 12, colorA: '#CFC7B8', colorB: '#ECE6DA', colorC: '#FFFDF8', focalX: 42, focalY: 35, gradient: 'radial', grain: 14, pattern: 'fibers', patternOpacity: 18, spacing: 30, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'A cool translucent paper field with fine clouding and scattered pulp flecks.',
    id: 'vellum-mist',
    name: 'Vellum mist',
    settings: { angle: 20, colorA: '#C9CED0', colorB: '#E7EAE7', colorC: '#FFFFFF', focalX: 31, focalY: 28, gradient: 'bloom', grain: 18, pattern: 'speckles', patternOpacity: 10, spacing: 26, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Uncoated kraft with visible directional fiber and low-contrast natural variation.',
    id: 'kraft-fiber',
    name: 'Kraft fiber',
    settings: { angle: 18, colorA: '#8C6D49', colorB: '#BA9567', colorC: '#D7B98B', gradient: 'linear', grain: 22, pattern: 'fibers', patternOpacity: 24, spacing: 24, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Bleached stock with faint blue-gray shadow and a subtle recycled-paper speckle.',
    id: 'pulp-white',
    name: 'Pulp white',
    settings: { angle: 142, colorA: '#D8DDE0', colorB: '#F0F1ED', colorC: '#FFFFFF', gradient: 'linear', grain: 18, pattern: 'speckles', patternOpacity: 12, spacing: 32, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'A warm risograph bloom with ink overlap, paper grain, and a fine crosshatch screen.',
    id: 'riso-sunset',
    name: 'Riso sunset',
    settings: { angle: 30, colorA: '#3C2B66', colorB: '#F05D4D', colorC: '#FFD16B', focalX: 38, focalY: 35, gradient: 'bloom', grain: 18, pattern: 'crosshatch', patternOpacity: 12, spacing: 18, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'Quiet elevation lines over a mineral gray wash for maps, packaging, and editorial fields.',
    id: 'topographic-mist',
    name: 'Topographic mist',
    settings: { angle: 18, colorA: '#D4D8D1', colorB: '#A3ADA2', colorC: '#F6F7F2', focalX: 42, focalY: 36, gradient: 'radial', grain: 8, pattern: 'topographic', patternOpacity: 20, spacing: 38, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'Dense graphite crosshatching that reads like ink, carbon paper, and technical drafting film.',
    id: 'graphite-hatch',
    name: 'Graphite hatch',
    settings: { angle: 26, colorA: '#111216', colorB: '#555B61', colorC: '#DDE1E4', gradient: 'linear', grain: 12, pattern: 'crosshatch', patternOpacity: 34, spacing: 14, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'A milky pearl film carrying cool blue and pale rose interference without animation.',
    id: 'pearl-film',
    name: 'Pearl film',
    settings: { angle: 154, colorA: '#A9C7D5', colorB: '#F3D6DF', colorC: '#FFFDF2', focalX: 62, focalY: 38, gradient: 'bloom', grain: 4, relief: 18, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'Static spectral laminate with a dark violet base, cyan shift, and warm foil edge.',
    id: 'spectral-laminate',
    name: 'Spectral laminate',
    settings: { angle: 128, colorA: '#21114F', colorB: '#39D9E6', colorC: '#FFB169', focalX: 36, focalY: 30, gradient: 'bloom', grain: 6, relief: 36, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'Dark anodized blue with machined vertical terraces and a cool metallic crest.',
    id: 'anodized-cobalt',
    name: 'Anodized cobalt',
    settings: { angle: 90, bandCount: 14, bandDepth: 88, bandGap: 1, colorA: '#020714', colorB: '#123D9B', colorC: '#7BCBFF', focalX: 62, gradient: 'mesh', grain: 7, lightingEnabled: true, style: 'grain-gradient' },
  },
  {
    category: 'Wood',
    description: 'Warm oak grain crossed by deep CNC-style kerf cuts, with visible directional relief.',
    id: 'kerf-cut-oak',
    name: 'Kerf-cut oak',
    settings: { angle: 18, colorA: '#2B160D', colorB: '#8A5630', colorC: '#D8A66A', grain: 12, style: 'grain-gradient', surfaceAngle: 8, surfaceDepth: 76, surfaceMaterial: 'kerf-wood', surfaceMetallic: 0, surfaceOpenArea: 18, surfaceRoughness: 72, surfaceScale: 58 },
  },
  {
    category: 'Wood',
    description: 'Pale ash with broad growth lines and shallow routed channels for a quieter architectural panel.',
    id: 'routed-ash',
    name: 'Routed ash',
    settings: { angle: 6, colorA: '#8B7358', colorB: '#C7A97E', colorC: '#F0D9B4', gradient: 'linear', grain: 9, style: 'grain-gradient', surfaceAngle: 2, surfaceDepth: 46, surfaceMaterial: 'kerf-wood', surfaceMetallic: 0, surfaceOpenArea: 8, surfaceRoughness: 64, surfaceScale: 92 },
  },
  {
    category: 'Architecture',
    description: 'Interlaced stainless cable with adjustable open area, raised crossings, and tight specular highlights.',
    id: 'woven-cable-mesh',
    name: 'Woven cable mesh',
    settings: { colorA: '#101317', colorB: '#727A83', colorC: '#F1F4F6', gradient: 'linear', grain: 2, style: 'gradient', surfaceAngle: 45, surfaceDepth: 68, surfaceMaterial: 'woven-wire', surfaceMetallic: 92, surfaceOpenArea: 64, surfaceRoughness: 24, surfaceScale: 38 },
  },
  {
    category: 'Architecture',
    description: 'A dark perforated panel with staggered openings and a low-gloss powder-coated face.',
    id: 'perforated-graphite',
    name: 'Perforated graphite',
    settings: { colorA: '#050607', colorB: '#25292D', colorC: '#8A9198', gradient: 'radial', grain: 3, style: 'gradient', surfaceAngle: 0, surfaceDepth: 54, surfaceMaterial: 'perforated-metal', surfaceMetallic: 58, surfaceOpenArea: 48, surfaceRoughness: 52, surfaceScale: 42 },
  },
  {
    category: 'Architecture',
    description: 'Chiseled mineral planes and hairline fissures with a dry, diffuse stone response.',
    id: 'carved-basalt',
    name: 'Carved basalt',
    settings: { colorA: '#111315', colorB: '#3C4144', colorC: '#8A908F', gradient: 'bloom', grain: 18, style: 'grain-gradient', surfaceAngle: 22, surfaceDepth: 72, surfaceMaterial: 'carved-stone', surfaceMetallic: 4, surfaceOpenArea: 14, surfaceRoughness: 88, surfaceScale: 86 },
  },
  {
    category: 'Paper',
    description: 'Raised geometric impressions pressed into uncoated stock, with soft shadows and no gloss.',
    id: 'blind-emboss-stock',
    name: 'Blind emboss stock',
    settings: { colorA: '#D4CEC2', colorB: '#ECE7DE', colorC: '#FFFDF8', gradient: 'radial', grain: 14, style: 'grain-gradient', surfaceAngle: 0, surfaceDepth: 34, surfaceMaterial: 'embossed-paper', surfaceMetallic: 0, surfaceOpenArea: 38, surfaceRoughness: 92, surfaceScale: 62 },
  },
  {
    category: 'Metal',
    description: 'Fine directional brushing over cool anodized aluminum with a stretched, controlled reflection.',
    id: 'brushed-aluminum',
    name: 'Brushed aluminum',
    settings: { angle: 90, colorA: '#252B31', colorB: '#89939D', colorC: '#F3F6F8', gradient: 'linear', grain: 5, style: 'grain-gradient', surfaceAngle: 90, surfaceDepth: 24, surfaceMaterial: 'brushed-metal', surfaceMetallic: 96, surfaceOpenArea: 0, surfaceRoughness: 28, surfaceScale: 28 },
  },
  {
    category: 'Metal',
    description: 'Irregular shallow dimples break a warm foil reflection into soft, premium highlights.',
    id: 'hammered-brass',
    name: 'Hammered brass',
    settings: { colorA: '#3A2109', colorB: '#B4741E', colorC: '#FFE3A0', gradient: 'bloom', grain: 5, style: 'grain-gradient', surfaceAngle: 18, surfaceDepth: 58, surfaceMaterial: 'hammered-foil', surfaceMetallic: 94, surfaceOpenArea: 22, surfaceRoughness: 36, surfaceScale: 52 },
  },
  {
    category: 'Polymer',
    description: 'Tight molded ribs with deep directional shadow, suited to technical housings and grip surfaces.',
    id: 'ribbed-polymer',
    name: 'Ribbed polymer',
    settings: { colorA: '#05070A', colorB: '#1E2630', colorC: '#647384', gradient: 'linear', grain: 3, style: 'gradient', surfaceAngle: 90, surfaceDepth: 82, surfaceMaterial: 'corrugated-polymer', surfaceMetallic: 8, surfaceOpenArea: 26, surfaceRoughness: 68, surfaceScale: 34 },
  },
  {
    category: 'Natural',
    description: 'Compressed cork cells, dark inclusions, and fibrous grain form a warm acoustic composite.',
    id: 'cork-acoustic',
    name: 'Cork acoustic',
    settings: { colorA: '#3A2414', colorB: '#8B5D32', colorC: '#D0A66D', gradient: 'radial', grain: 24, style: 'grain-gradient', surfaceAngle: 12, surfaceDepth: 42, surfaceMaterial: 'cork-composite', surfaceMetallic: 0, surfaceOpenArea: 34, surfaceRoughness: 96, surfaceScale: 46 },
  },
  {
    category: 'Glass',
    description: 'A translucent etched field with dense micro-pitting and a broad pearlescent light response.',
    id: 'frosted-pearl-glass',
    name: 'Frosted pearl glass',
    settings: { colorA: '#71808B', colorB: '#C6D4D8', colorC: '#FFF8EE', gradient: 'bloom', grain: 16, style: 'grain-gradient', surfaceAngle: 30, surfaceDepth: 18, surfaceMaterial: 'frosted-glass', surfaceMetallic: 18, surfaceOpenArea: 72, surfaceRoughness: 78, surfaceScale: 32 },
  },
  {
    category: 'Textile',
    description: 'Alternating warp and weft threads with subtle slub variation and a dry woven highlight.',
    id: 'natural-linen-weave',
    name: 'Natural linen',
    settings: { colorA: '#726657', colorB: '#B8AA94', colorC: '#EEE5D5', gradient: 'linear', grain: 12, style: 'grain-gradient', surfaceAngle: 2, surfaceDepth: 42, surfaceIrregularity: 46, surfaceMaterial: 'linen-weave', surfaceMetallic: 0, surfaceOpenArea: 18, surfaceRoughness: 92, surfaceScale: 30, surfaceTextureAmount: 82 },
  },
  {
    category: 'Textile',
    description: 'Dense matted fibers form a quiet wool field with soft directional nap and almost no specular edge.',
    id: 'graphite-felt',
    name: 'Graphite felt',
    settings: { colorA: '#111214', colorB: '#303235', colorC: '#74777A', gradient: 'radial', grain: 28, style: 'grain-gradient', surfaceAngle: 18, surfaceDepth: 24, surfaceIrregularity: 86, surfaceMaterial: 'felted-wool', surfaceMetallic: 0, surfaceOpenArea: 30, surfaceRoughness: 100, surfaceScale: 22, surfaceTextureAmount: 76 },
  },
  {
    category: 'Leather',
    description: 'Irregular raised pebble grain over a deep dyed hide, balancing soft valleys and polished high points.',
    id: 'oxblood-pebbled-leather',
    name: 'Oxblood leather',
    settings: { colorA: '#160808', colorB: '#5A1E22', colorC: '#B56357', gradient: 'bloom', grain: 10, style: 'grain-gradient', surfaceAngle: 12, surfaceDepth: 48, surfaceIrregularity: 74, surfaceMaterial: 'pebbled-leather', surfaceMetallic: 0, surfaceOpenArea: 22, surfaceRoughness: 62, surfaceScale: 38, surfaceTextureAmount: 88 },
  },
  {
    category: 'Ceramic',
    description: 'Fine crackle lines sit beneath a glossy celadon glaze, with gentle pooling around the network.',
    id: 'celadon-crackle',
    name: 'Celadon crackle',
    settings: { colorA: '#293E38', colorB: '#8AA89C', colorC: '#E5EEE6', gradient: 'radial', grain: 4, style: 'grain-gradient', surfaceAngle: 0, surfaceDepth: 18, surfaceIrregularity: 68, surfaceMaterial: 'crackle-glaze', surfaceMetallic: 4, surfaceOpenArea: 16, surfaceRoughness: 18, surfaceScale: 62, surfaceTextureAmount: 72 },
  },
  {
    category: 'Mineral',
    description: 'Fine aggregate and shallow pits create a chalky architectural plaster with diffuse mineral light.',
    id: 'sandblasted-lime-plaster',
    name: 'Lime plaster',
    settings: { colorA: '#8F887B', colorB: '#C5BFB2', colorC: '#F3EFE5', gradient: 'linear', grain: 22, style: 'grain-gradient', surfaceAngle: 28, surfaceDepth: 34, surfaceIrregularity: 92, surfaceMaterial: 'sandblasted-plaster', surfaceMetallic: 0, surfaceOpenArea: 48, surfaceRoughness: 96, surfaceScale: 26, surfaceTextureAmount: 84 },
  },
  {
    category: 'Composite',
    description: 'A tight 2×2 carbon twill alternates raised bundles under a controlled resin sheen.',
    id: 'carbon-twill-satin',
    name: 'Carbon twill',
    settings: { colorA: '#030405', colorB: '#171B20', colorC: '#68717A', gradient: 'linear', grain: 3, style: 'gradient', surfaceAngle: 45, surfaceDepth: 38, surfaceIrregularity: 12, surfaceMaterial: 'carbon-twill', surfaceMetallic: 48, surfaceOpenArea: 10, surfaceRoughness: 26, surfaceScale: 30, surfaceTextureAmount: 92 },
  },
  {
    category: 'Static shaders',
    description: 'A deterministic, non-moving translation of the soft Sea mesh vocabulary from the shader library.',
    id: 'static-mesh-sea',
    name: 'Static mesh · Sea',
    settings: { colorA: '#06131D', colorB: '#1B7181', colorC: '#9EF0DB', focalX: 38, focalY: 34, gradient: 'bloom', grain: 3, relief: 20, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'The original static mesh family rebuilt as a portable three-color SVG field.',
    id: 'static-mesh-default',
    name: 'Static mesh · Default',
    settings: { colorA: '#17151F', colorB: '#6C5CE7', colorC: '#E8E2FF', focalX: 44, focalY: 38, gradient: 'bloom', grain: 3, relief: 22, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'Warm period color and broad mesh falloff translated into a still SVG recipe.',
    id: 'static-mesh-1960s',
    name: 'Static mesh · 1960s',
    settings: { angle: 28, colorA: '#4A1814', colorB: '#E86A33', colorC: '#F4D27A', focalX: 35, focalY: 42, gradient: 'orbit', grain: 8, relief: 16, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'Coral, violet, and gold hold a sunset mesh without a render loop.',
    id: 'static-mesh-sunset',
    name: 'Static mesh · Sunset',
    settings: { angle: 142, colorA: '#251239', colorB: '#F45D63', colorC: '#FFCF70', focalX: 62, focalY: 32, gradient: 'bloom', grain: 6, relief: 30, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'A portable cross-section radial field with no playback or GPU dependency.',
    id: 'static-radial-cross-section',
    name: 'Static radial · Cross section',
    settings: { angle: 72, colorA: '#09090B', colorB: '#8874FF', colorC: '#F8EFDD', focalX: 28, focalY: 48, gradient: 'radial', grain: 2, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'The base radial shader composition recast as a focused, editable SVG aperture.',
    id: 'static-radial-default',
    name: 'Static radial · Default',
    settings: { angle: 28, colorA: '#0D1017', colorB: '#5D6BFF', colorC: '#F7FAFF', focalX: 42, focalY: 38, gradient: 'radial', grain: 2, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'Low-resolution color steps, restrained noise, and a deliberately graphic radial falloff.',
    id: 'static-radial-lofi',
    name: 'Static radial · Lo-Fi',
    settings: { angle: 15, colorA: '#19121F', colorB: '#CE5A67', colorC: '#F1D7A0', ditherMatrix: 8, ditherShape: 'squares', focalX: 34, focalY: 42, gradient: 'radial', grain: 14, spacing: 18, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'A centered halo with clean concentric light and portable vector construction.',
    id: 'static-radial-radial',
    name: 'Static radial · Radial',
    settings: { colorA: '#030A13', colorB: '#1686A2', colorC: '#E6FFF8', focalX: 50, focalY: 50, gradient: 'radial', grain: 4, style: 'grain-gradient' },
  },
  {
    category: 'Static shaders',
    description: 'Cardboard fibers and particulate grain rebuilt as a deterministic SVG paper recipe.',
    id: 'static-paper-cardboard',
    name: 'Paper texture · Cardboard',
    settings: { angle: 12, colorA: '#5C3F26', colorB: '#9A7047', colorC: '#D1AD7A', gradient: 'linear', grain: 26, pattern: 'fibers', patternOpacity: 30, spacing: 22, style: 'grain-gradient', surfaceDepth: 18, surfaceMaterial: 'embossed-paper', surfaceRoughness: 94, surfaceScale: 34 },
  },
] as const satisfies ReadonlyArray<{
  category: 'Gradient' | 'Paper' | 'Print' | 'Film' | 'Wood' | 'Architecture' | 'Metal' | 'Polymer' | 'Natural' | 'Glass' | 'Textile' | 'Leather' | 'Ceramic' | 'Mineral' | 'Composite' | 'Static shaders';
  description: string;
  id: string;
  name: string;
  settings: Partial<BackgroundSettings>;
}>;

const BAYER_2 = [0, 2, 3, 1] as const;
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

function bayerValue(x: number, y: number, size: 2 | 4 | 8): number {
  if (size === 2) return BAYER_2[(y % 2) * 2 + (x % 2)]! / 4;
  if (size === 4) return BAYER_4[(y % 4) * 4 + (x % 4)]! / 16;
  const coarse = BAYER_4[(y % 4) * 4 + (x % 4)]!;
  const fine = BAYER_2[(Math.floor(y / 4) % 2) * 2 + (Math.floor(x / 4) % 2)]!;
  return (coarse * 4 + fine) / 64;
}

function patternDefinition(settings: BackgroundSettings): string {
  const spacing = Math.max(8, settings.spacing);
  const stroke = settings.colorB;

  if (settings.pattern === 'dots') {
    return `<pattern id="pattern-dots" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><circle cx="${spacing / 2}" cy="${spacing / 2}" r="1.6" fill="${stroke}"/></pattern>`;
  }
  if (settings.pattern === 'lines') {
    return `<pattern id="pattern-lines" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${settings.angle})"><path d="M0 0V${spacing}" stroke="${stroke}" stroke-width="1"/></pattern>`;
  }
  if (settings.pattern === 'grid') {
    return `<pattern id="pattern-grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><path d="M${spacing} 0H0V${spacing}" fill="none" stroke="${stroke}" stroke-width="1"/></pattern>`;
  }
  if (settings.pattern === 'fibers') {
    return `<pattern id="pattern-fibers" width="${spacing * 2}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${settings.angle * 0.24})"><path d="M-${spacing} ${spacing * 0.3} C${spacing * 0.2} ${spacing * 0.08},${spacing * 0.7} ${spacing * 0.58},${spacing * 2} ${spacing * 0.26}" fill="none" stroke="${stroke}" stroke-width=".75"/><path d="M0 ${spacing * 0.76} C${spacing * 0.5} ${spacing * 0.55},${spacing * 1.2} ${spacing * 0.98},${spacing * 2} ${spacing * 0.7}" fill="none" stroke="${settings.colorC}" stroke-width=".5"/></pattern>`;
  }
  if (settings.pattern === 'speckles') {
    return `<pattern id="pattern-speckles" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><circle cx="${spacing * 0.18}" cy="${spacing * 0.28}" r=".8" fill="${stroke}"/><circle cx="${spacing * 0.73}" cy="${spacing * 0.66}" r="1.1" fill="${stroke}"/><circle cx="${spacing * 0.48}" cy="${spacing * 0.12}" r=".45" fill="${settings.colorC}"/></pattern>`;
  }
  if (settings.pattern === 'topographic') {
    return `<pattern id="pattern-topographic" width="${spacing * 2}" height="${spacing * 1.5}" patternUnits="userSpaceOnUse"><path d="M-${spacing} ${spacing} C${spacing * 0.15} ${spacing * 0.05},${spacing * 0.8} ${spacing * 1.55},${spacing * 2.2} ${spacing * 0.45} S${spacing * 3.2} ${spacing * 1.3},${spacing * 4} ${spacing * 0.35}" fill="none" stroke="${stroke}" stroke-width=".8"/><path d="M-${spacing} ${spacing * 1.28} C${spacing * 0.25} ${spacing * 0.38},${spacing * 0.95} ${spacing * 1.8},${spacing * 2.35} ${spacing * 0.72} S${spacing * 3.25} ${spacing * 1.58},${spacing * 4} ${spacing * 0.62}" fill="none" stroke="${stroke}" stroke-width=".55"/></pattern>`;
  }
  if (settings.pattern === 'crosshatch') {
    return `<pattern id="pattern-crosshatch" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><path d="M-${spacing} ${spacing}L${spacing} -${spacing}M0 ${spacing * 2}L${spacing * 2} 0M-${spacing} 0L${spacing} ${spacing * 2}M0 -${spacing}L${spacing * 2} ${spacing}" fill="none" stroke="${stroke}" stroke-width=".55"/></pattern>`;
  }
  return '';
}

function ditherField(settings: BackgroundSettings): string {
  const cell = Math.max(10, Math.round(settings.spacing * 0.72));
  const columns = Math.ceil(settings.width / cell);
  const rows = Math.ceil(settings.height / cell);
  const circles: string[] = [];
  const radians = (settings.angle * Math.PI) / 180;
  const directionX = Math.cos(radians);
  const directionY = Math.sin(radians);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const normalizedX = (column + 0.5) / Math.max(columns, 1) - 0.5;
      const normalizedY = (row + 0.5) / Math.max(rows, 1) - 0.5;
      const progress = Math.max(0, Math.min(1, 0.5 + normalizedX * directionX + normalizedY * directionY));
      const threshold = bayerValue(column, row, settings.ditherMatrix);
      const active = progress > threshold;
      const size = active ? cell * 0.84 : cell * 0.16;
      const color = progress > 0.62 ? settings.colorC : settings.colorB;
      if (settings.ditherShape === 'squares') {
        circles.push(`<rect x="${(column * cell + (cell - size) / 2).toFixed(2)}" y="${(row * cell + (cell - size) / 2).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="${color}"/>`);
      } else {
        circles.push(`<circle cx="${column * cell + cell / 2}" cy="${row * cell + cell / 2}" r="${(size / 2).toFixed(2)}" fill="${color}"/>`);
      }
    }
  }

  return `<g data-dither-matrix="${settings.ditherMatrix}" data-dither-shape="${settings.ditherShape}">${circles.join('')}</g>`;
}

function smoothGradientStops(start: string, middle: string, end: string): string {
  return Array.from({ length: 33 }, (_, index) => {
    const offset = index / 32;
    const color = offset <= 0.5
      ? mixHexColors(start, middle, offset * 2)
      : mixHexColors(middle, end, (offset - 0.5) * 2);

    return `<stop offset="${offset}" stop-color="${color}"/>`;
  })
    .join('');
}

function gradientDefinition(settings: BackgroundSettings): string {
  const radians = (settings.angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(radians) * 50;
  const y1 = 50 - Math.sin(radians) * 50;
  const x2 = 50 + Math.cos(radians) * 50;
  const y2 = 50 + Math.sin(radians) * 50;
  const forwardStops = smoothGradientStops(settings.colorA, settings.colorB, settings.colorC);
  const reverseStops = smoothGradientStops(settings.colorC, settings.colorB, settings.colorA);

  if (settings.gradient === 'radial') {
    return `<radialGradient id="radial-aperture" cx="${settings.focalX}%" cy="${settings.focalY}%" fx="${settings.focalX}%" fy="${settings.focalY}%" r="76%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .72)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorC}"/><stop offset=".34" stop-color="${mixHexColors(settings.colorC, settings.colorB, 0.5)}"/><stop offset=".62" stop-color="${settings.colorB}"/><stop offset="1" stop-color="${settings.colorA}"/></radialGradient><radialGradient id="radial-vignette" cx="${100 - settings.focalX}%" cy="${100 - settings.focalY}%" r="88%" color-interpolation="sRGB"><stop offset=".42" stop-color="${settings.colorA}" stop-opacity="0"/><stop offset="1" stop-color="${settings.colorB}" stop-opacity=".22"/></radialGradient>`;
  }
  if (settings.gradient === 'mesh') {
    return '';
  }
  if (settings.gradient === 'orbit') {
    return `<radialGradient id="orbit-primary" cx="${settings.focalX}%" cy="${settings.focalY}%" r="84%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .68)" color-interpolation="sRGB">${forwardStops}</radialGradient><radialGradient id="orbit-secondary" cx="${100 - settings.focalX}%" cy="${100 - settings.focalY}%" r="78%" gradientTransform="rotate(${settings.angle + 90} .5 .5) scale(1 .74)" color-interpolation="sRGB">${reverseStops}</radialGradient>`;
  }
  if (settings.gradient === 'bloom') {
    return `<radialGradient id="bloom-a" cx="${settings.focalX}%" cy="${settings.focalY}%" r="72%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .7)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorC}"/><stop offset=".48" stop-color="${settings.colorB}" stop-opacity=".82"/><stop offset="1" stop-color="${settings.colorA}" stop-opacity="0"/></radialGradient><radialGradient id="bloom-b" cx="${100 - settings.focalX}%" cy="${Math.min(92, 100 - settings.focalY * 0.62)}%" r="68%" gradientTransform="rotate(${settings.angle + 86} .5 .5) scale(1 .64)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorB}"/><stop offset=".42" stop-color="${settings.colorC}" stop-opacity=".64"/><stop offset="1" stop-color="${settings.colorA}" stop-opacity="0"/></radialGradient>`;
  }
  if (settings.gradient === 'wave') {
    return `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" color-interpolation="sRGB">${forwardStops}</linearGradient><linearGradient id="wave-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${settings.width}" y2="${settings.height}" color-interpolation="sRGB">${reverseStops}</linearGradient>`;
  }
  return `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" color-interpolation="sRGB">${forwardStops}</linearGradient>`;
}

function bandSurface(settings: BackgroundSettings): string {
  const count = Math.max(3, Math.min(24, Math.round(settings.bandCount)));
  const segmentWidth = settings.width / count;
  const gap = Math.max(0, Math.min(segmentWidth * 0.8, settings.bandGap));
  const depth = Math.max(0.28, Math.min(1, settings.bandDepth / 100));
  const split = Math.max(0.18, Math.min(0.82, settings.focalX / 100));
  const bars = Array.from({ length: count }, (_, index) => {
    const x = index * segmentWidth + gap / 2;
    const width = Math.max(0.5, segmentWidth - gap);
    const progress = count === 1 ? 0 : index / (count - 1);
    const tone = progress <= split
      ? mixHexColors(settings.colorA, settings.colorB, progress / split)
      : mixHexColors(settings.colorB, settings.colorC, (progress - split) / (1 - split));
    const lowerTone = mixHexColors(tone, settings.colorC, 0.22);
    const gradientId = `band-strip-${index}`;
    const definition = settings.lightingEnabled
      ? `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${settings.colorA}"/><stop offset="${(1 - depth).toFixed(2)}" stop-color="${settings.colorA}"/><stop offset=".78" stop-color="${tone}"/><stop offset="1" stop-color="${lowerTone}"/></linearGradient>`
      : '';
    const fill = settings.lightingEnabled ? `url(#${gradientId})` : tone;
    return {
      definition,
      rect: `<rect data-band-index="${index}" x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${settings.height}" fill="${fill}"/>`,
    };
  });

  return `<rect width="100%" height="100%" fill="${settings.colorA}"/><g data-gradient-layout="bands" data-band-count="${count}" data-band-geometry="full-height"><defs>${bars.map(({ definition }) => definition).join('')}</defs>${bars.map(({ rect }) => rect).join('')}</g>`;
}

function gradientSurface(settings: BackgroundSettings): string {
  if (settings.gradient === 'mesh') {
    return bandSurface(settings);
  }
  if (settings.gradient === 'orbit') {
    return `<g data-gradient-layout="orbit"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#orbit-primary)"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#orbit-secondary)" opacity=".34"/></g>`;
  }
  if (settings.gradient === 'bloom') {
    const glow = Math.max(0.18, Math.min(0.78, 0.28 + settings.relief / 160));
    return `<g data-gradient-layout="bloom"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-10%" y="-10%" width="120%" height="120%" fill="url(#bloom-a)"/><rect x="-10%" y="-10%" width="120%" height="120%" fill="url(#bloom-b)" opacity="${glow.toFixed(2)}"/></g>`;
  }
  if (settings.gradient === 'wave') {
    const amplitude = settings.height * (0.12 + Math.max(0, Math.min(100, settings.relief)) / 420);
    const centerY = settings.height * (settings.focalY / 100);
    const overscan = settings.width * 0.12;
    const wavePath = `M ${-overscan.toFixed(2)} ${centerY.toFixed(2)} C ${(settings.width * 0.16).toFixed(2)} ${(centerY - amplitude).toFixed(2)}, ${(settings.width * 0.34).toFixed(2)} ${(centerY + amplitude).toFixed(2)}, ${(settings.width * 0.52).toFixed(2)} ${centerY.toFixed(2)} S ${(settings.width * 0.84).toFixed(2)} ${(centerY - amplitude).toFixed(2)}, ${(settings.width + overscan).toFixed(2)} ${centerY.toFixed(2)}`;
    const secondCenterY = centerY + settings.height * 0.24;
    const secondWavePath = `M ${-overscan.toFixed(2)} ${secondCenterY.toFixed(2)} C ${(settings.width * 0.18).toFixed(2)} ${(secondCenterY + amplitude * 0.72).toFixed(2)}, ${(settings.width * 0.38).toFixed(2)} ${(secondCenterY - amplitude * 0.72).toFixed(2)}, ${(settings.width * 0.56).toFixed(2)} ${secondCenterY.toFixed(2)} S ${(settings.width * 0.86).toFixed(2)} ${(secondCenterY + amplitude * 0.62).toFixed(2)}, ${(settings.width + overscan).toFixed(2)} ${secondCenterY.toFixed(2)}`;
    const strokeWidth = Math.min(settings.width, settings.height) * 0.34;
    const normalizedAngle = ((settings.angle % 180) + 180) % 180;
    const waveTilt = (normalizedAngle - 90) * 0.28;
    return `<g data-gradient-layout="wave"><rect x="-4%" y="-4%" width="108%" height="108%" fill="url(#surface-gradient)"/><g transform="rotate(${waveTilt.toFixed(2)} ${settings.width / 2} ${settings.height / 2})" filter="url(#wave-soften)" opacity=".72"><path d="${wavePath}" fill="none" stroke="url(#wave-gradient)" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round"/><path d="${secondWavePath}" fill="none" stroke="${settings.colorC}" stroke-opacity=".28" stroke-width="${(strokeWidth * 0.58).toFixed(2)}" stroke-linecap="round"/></g></g>`;
  }
  if (settings.gradient === 'radial') {
    return `<g data-gradient-layout="radial"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#radial-aperture)"/><rect width="100%" height="100%" fill="url(#radial-vignette)"/></g>`;
  }
  return `<rect data-gradient-layout="${settings.gradient}" x="-4%" y="-4%" width="108%" height="108%" fill="url(#surface-gradient)"/>`;
}

function physicalSurfaceDefinition(settings: BackgroundSettings): { definitions: string; layer: string } {
  if (settings.surfaceMaterial === 'none') return { definitions: '', layer: '' };

  const scale = Math.max(12, Math.min(140, settings.surfaceScale));
  const depth = Math.max(0, Math.min(100, settings.surfaceDepth));
  const roughness = Math.max(0, Math.min(100, settings.surfaceRoughness));
  const metallic = Math.max(0, Math.min(100, settings.surfaceMetallic));
  const openArea = Math.max(0, Math.min(92, settings.surfaceOpenArea));
  const textureAmount = Math.max(0, Math.min(100, settings.surfaceTextureAmount));
  const irregularity = Math.max(0, Math.min(100, settings.surfaceIrregularity));
  const angle = settings.surfaceAngle;
  const elevation = Math.max(18, 76 - depth * 0.32);
  const surfaceScale = (0.4 + depth * 0.1 + textureAmount * 0.025).toFixed(2);
  const blur = (0.14 + roughness * 0.009 + irregularity * 0.003).toFixed(2);
  const specularConstant = (0.04 + metallic * 0.012).toFixed(2);
  const specularExponent = Math.max(3, Math.round(72 - roughness * 0.64));
  const layerOpacity = Math.min(0.96, 0.08 + textureAmount / 145 + depth / 360 + metallic / 620).toFixed(2);
  const patternTransform = `rotate(${angle} ${scale / 2} ${scale / 2})`;
  let pattern = '';

  if (settings.surfaceMaterial === 'kerf-wood') {
    const width = scale * 4;
    const cut = Math.max(1.2, scale * (0.045 + (100 - openArea) / 2200));
    pattern = `<pattern id="physical-surface-pattern" width="${width}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M-${scale} ${scale * 0.22} C${scale * 0.35} ${scale * 0.02},${scale * 0.75} ${scale * 0.58},${scale * 1.65} ${scale * 0.28} S${scale * 3.1} ${scale * 0.5},${scale * 5} ${scale * 0.18}" fill="none" stroke="${settings.colorC}" stroke-opacity=".72" stroke-width="${Math.max(0.8, scale * 0.025)}"/><path d="M-${scale} ${scale * 0.62} C${scale * 0.4} ${scale * 0.38},${scale * 1.1} ${scale * 0.94},${scale * 2.1} ${scale * 0.57} S${scale * 3.35} ${scale * 0.82},${scale * 5} ${scale * 0.52}" fill="none" stroke="${settings.colorB}" stroke-opacity=".8" stroke-width="${Math.max(0.7, scale * 0.018)}"/><path d="M${scale * 0.72} -${scale * 0.2}L${scale * 0.5} ${scale * 1.2}M${scale * 2.7} -${scale * 0.2}L${scale * 2.48} ${scale * 1.2}" stroke="${settings.colorA}" stroke-width="${cut}" stroke-linecap="square"/></pattern>`;
  } else if (settings.surfaceMaterial === 'woven-wire') {
    const wire = Math.max(1.2, scale * (0.045 + (92 - openArea) / 720));
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M-${scale / 2} ${scale}L${scale} -${scale / 2}M0 ${scale * 1.5}L${scale * 1.5} 0" stroke="${settings.colorC}" stroke-opacity=".9" stroke-width="${wire}"/><path d="M-${scale / 2} 0L${scale} ${scale * 1.5}M0 -${scale / 2}L${scale * 1.5} ${scale}" stroke="${settings.colorB}" stroke-opacity=".8" stroke-width="${wire}"/><circle cx="${scale / 2}" cy="${scale / 2}" r="${wire * 0.74}" fill="${settings.colorC}"/></pattern>`;
  } else if (settings.surfaceMaterial === 'perforated-metal') {
    const hole = scale * (0.12 + openArea / 210);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale * 0.866}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><rect width="100%" height="100%" fill="${settings.colorB}" fill-opacity=".48"/><circle cx="${scale * 0.25}" cy="${scale * 0.22}" r="${hole}" fill="${settings.colorA}"/><circle cx="${scale * 0.75}" cy="${scale * 0.65}" r="${hole}" fill="${settings.colorA}"/><circle cx="${scale * 0.25 - hole * 0.22}" cy="${scale * 0.22 - hole * 0.22}" r="${Math.max(0.7, hole * 0.08)}" fill="${settings.colorC}" fill-opacity=".72"/></pattern>`;
  } else if (settings.surfaceMaterial === 'carved-stone') {
    const width = scale * 3;
    pattern = `<pattern id="physical-surface-pattern" width="${width}" height="${scale * 2}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M-${scale * 0.2} ${scale * 0.35}L${scale * 0.62} ${scale * 0.18}L${scale * 1.08} ${scale * 0.78}L${scale * 1.84} ${scale * 0.62}L${scale * 2.5} ${scale * 1.36}L${scale * 3.2} ${scale * 1.08}" fill="none" stroke="${settings.colorA}" stroke-width="${Math.max(1.3, scale * 0.052)}"/><path d="M${scale * 0.9} ${scale * 0.72}L${scale * 0.72} ${scale * 1.42}L${scale * 1.22} ${scale * 1.92}M${scale * 2.46} ${scale * 1.3}L${scale * 2.18} ${scale * 1.88}" fill="none" stroke="${settings.colorC}" stroke-opacity=".68" stroke-width="${Math.max(0.8, scale * 0.022)}"/></pattern>`;
  } else if (settings.surfaceMaterial === 'embossed-paper') {
    const radius = scale * (0.12 + openArea / 520);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><circle cx="${scale / 2}" cy="${scale / 2}" r="${radius}" fill="none" stroke="${settings.colorC}" stroke-opacity=".7" stroke-width="${Math.max(1, scale * 0.045)}"/><circle cx="${scale / 2}" cy="${scale / 2}" r="${radius * 0.56}" fill="${settings.colorC}" fill-opacity=".2"/></pattern>`;
  } else if (settings.surfaceMaterial === 'brushed-metal') {
    const gap = Math.max(3, scale * 0.14);
    pattern = `<pattern id="physical-surface-pattern" width="${gap}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M1 0V${scale}" stroke="${settings.colorC}" stroke-opacity=".82" stroke-width=".8"/><path d="M${gap * 0.58} 0V${scale}" stroke="${settings.colorA}" stroke-opacity=".62" stroke-width=".45"/></pattern>`;
  } else if (settings.surfaceMaterial === 'hammered-foil') {
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 2}" height="${scale * 1.6}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><circle cx="${scale * 0.28}" cy="${scale * 0.36}" r="${scale * 0.22}" fill="${settings.colorC}" fill-opacity=".58"/><circle cx="${scale * 0.88}" cy="${scale * 0.72}" r="${scale * 0.34}" fill="${settings.colorB}" fill-opacity=".72"/><circle cx="${scale * 1.56}" cy="${scale * 0.32}" r="${scale * 0.28}" fill="${settings.colorC}" fill-opacity=".44"/><circle cx="${scale * 1.48}" cy="${scale * 1.26}" r="${scale * 0.4}" fill="${settings.colorA}" fill-opacity=".34"/><circle cx="${scale * 0.42}" cy="${scale * 1.28}" r="${scale * 0.24}" fill="${settings.colorB}" fill-opacity=".52"/></pattern>`;
  } else if (settings.surfaceMaterial === 'corrugated-polymer') {
    const ridge = scale * (0.18 + (100 - openArea) / 560);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><rect x="${scale * 0.14}" width="${ridge}" height="100%" rx="${ridge / 2}" fill="${settings.colorC}" fill-opacity=".72"/><rect x="${scale * 0.14 + ridge * 0.34}" width="${Math.max(1, ridge * 0.16)}" height="100%" fill="#FFFFFF" fill-opacity=".42"/><rect x="${scale * 0.14 + ridge}" width="${scale * 0.18}" height="100%" fill="${settings.colorA}" fill-opacity=".48"/></pattern>`;
  } else if (settings.surfaceMaterial === 'cork-composite') {
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 1.8}" height="${scale * 1.4}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><ellipse cx="${scale * 0.28}" cy="${scale * 0.3}" rx="${scale * 0.22}" ry="${scale * 0.14}" fill="${settings.colorA}" fill-opacity=".7"/><ellipse cx="${scale * 0.92}" cy="${scale * 0.62}" rx="${scale * 0.3}" ry="${scale * 0.18}" fill="${settings.colorC}" fill-opacity=".46"/><ellipse cx="${scale * 1.52}" cy="${scale * 0.28}" rx="${scale * 0.19}" ry="${scale * 0.26}" fill="${settings.colorA}" fill-opacity=".56"/><ellipse cx="${scale * 1.42}" cy="${scale * 1.14}" rx="${scale * 0.28}" ry="${scale * 0.16}" fill="${settings.colorB}" fill-opacity=".68"/><circle cx="${scale * 0.4}" cy="${scale * 1.08}" r="${scale * 0.13}" fill="${settings.colorC}" fill-opacity=".38"/></pattern>`;
  } else if (settings.surfaceMaterial === 'linen-weave') {
    const thread = Math.max(1, scale * (0.045 + (100 - openArea) / 1800));
    const slub = (0.8 + irregularity / 100 * 1.8).toFixed(2);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M${scale * 0.18} 0C${scale * 0.12} ${scale * 0.24},${scale * 0.25} ${scale * 0.66},${scale * 0.18} ${scale}M${scale * 0.68} 0C${scale * 0.76} ${scale * 0.34},${scale * 0.61} ${scale * 0.72},${scale * 0.68} ${scale}" fill="none" stroke="${settings.colorC}" stroke-opacity=".8" stroke-width="${thread * Number(slub)}"/><path d="M0 ${scale * 0.34}C${scale * 0.28} ${scale * 0.25},${scale * 0.7} ${scale * 0.42},${scale} ${scale * 0.34}M0 ${scale * 0.82}C${scale * 0.34} ${scale * 0.92},${scale * 0.68} ${scale * 0.73},${scale} ${scale * 0.82}" fill="none" stroke="${settings.colorB}" stroke-opacity=".74" stroke-width="${thread}"/><circle cx="${scale * 0.18}" cy="${scale * 0.34}" r="${thread * 0.64}" fill="${settings.colorC}"/></pattern>`;
  } else if (settings.surfaceMaterial === 'felted-wool') {
    const fiber = Math.max(0.55, scale * 0.026);
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 1.4}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M0 ${scale * 0.18}q${scale * 0.24} ${scale * 0.18} ${scale * 0.52} -.02t${scale * 0.72} .08M-${scale * 0.18} ${scale * 0.62}q${scale * 0.3} -.22 ${scale * 0.68} .02t${scale * 0.78} -.08M${scale * 0.2} ${scale * 0.9}q${scale * 0.22} -.14 ${scale * 0.54} .02" fill="none" stroke="${settings.colorC}" stroke-opacity="${(0.22 + irregularity / 220).toFixed(2)}" stroke-width="${fiber}"/><path d="M${scale * 0.12} ${scale * 0.05}l${scale * 0.22} ${scale * 0.28}m${scale * 0.38} -.18l${scale * 0.3} ${scale * 0.24}m${scale * 0.06} ${scale * 0.3}l${scale * 0.22} ${scale * 0.24}" stroke="${settings.colorA}" stroke-opacity=".58" stroke-width="${fiber * 0.72}"/></pattern>`;
  } else if (settings.surfaceMaterial === 'pebbled-leather') {
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 1.7}" height="${scale * 1.35}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><path d="M${scale * 0.08} ${scale * 0.42}C${scale * 0.18} ${scale * 0.05},${scale * 0.72} ${scale * 0.02},${scale * 0.82} ${scale * 0.34}S${scale * 0.58} ${scale * 0.92},${scale * 0.2} ${scale * 0.84}S${scale * 0.01} ${scale * 0.62},${scale * 0.08} ${scale * 0.42}ZM${scale * 0.92} ${scale * 0.22}C${scale * 1.08} -.04,${scale * 1.58} ${scale * 0.08},${scale * 1.62} ${scale * 0.42}S${scale * 1.42} ${scale * 0.9},${scale * 1.04} ${scale * 0.78}S${scale * 0.82} ${scale * 0.42},${scale * 0.92} ${scale * 0.22}Z" fill="${settings.colorC}" fill-opacity=".32" stroke="${settings.colorA}" stroke-opacity=".72" stroke-width="${Math.max(0.8, scale * 0.035)}"/><ellipse cx="${scale * 0.82}" cy="${scale * 1.12}" rx="${scale * 0.42}" ry="${scale * 0.2}" fill="${settings.colorB}" fill-opacity=".52"/></pattern>`;
  } else if (settings.surfaceMaterial === 'crackle-glaze') {
    const crack = Math.max(0.6, scale * (0.018 + textureAmount / 6200));
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 1.8}" height="${scale * 1.5}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><rect width="100%" height="100%" fill="${settings.colorC}" fill-opacity=".14"/><path d="M0 ${scale * 0.38}L${scale * 0.42} ${scale * 0.56}L${scale * 0.68} ${scale * 0.18}L${scale * 1.02} ${scale * 0.42}L${scale * 1.42} ${scale * 0.16}L${scale * 1.8} ${scale * 0.52}M${scale * 0.42} ${scale * 0.56}L${scale * 0.32} ${scale * 1.08}L${scale * 0.84} ${scale * 1.46}M${scale * 1.02} ${scale * 0.42}L${scale * 1.18} ${scale * 0.96}L${scale * 1.72} ${scale * 1.28}" fill="none" stroke="${settings.colorA}" stroke-opacity="${(0.42 + irregularity / 190).toFixed(2)}" stroke-width="${crack}"/><path d="M${scale * 0.68} ${scale * 0.18}L${scale * 0.58} 0M${scale * 1.18} ${scale * 0.96}L${scale * 0.86} ${scale * 1.18}" stroke="${settings.colorB}" stroke-width="${crack * 0.62}"/></pattern>`;
  } else if (settings.surfaceMaterial === 'sandblasted-plaster') {
    const pit = scale * (0.025 + openArea / 1000);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><circle cx="${scale * 0.14}" cy="${scale * 0.24}" r="${pit}" fill="${settings.colorA}" fill-opacity=".72"/><circle cx="${scale * 0.52}" cy="${scale * 0.16}" r="${pit * 0.62}" fill="${settings.colorC}" fill-opacity=".52"/><circle cx="${scale * 0.78}" cy="${scale * 0.48}" r="${pit * 1.2}" fill="${settings.colorA}" fill-opacity=".56"/><circle cx="${scale * 0.34}" cy="${scale * 0.72}" r="${pit * 0.82}" fill="${settings.colorB}" fill-opacity=".74"/><circle cx="${scale * 0.88}" cy="${scale * 0.9}" r="${pit * 0.48}" fill="${settings.colorC}" fill-opacity=".48"/></pattern>`;
  } else if (settings.surfaceMaterial === 'carbon-twill') {
    const bundle = scale * 0.48;
    pattern = `<pattern id="physical-surface-pattern" width="${scale * 2}" height="${scale * 2}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><rect width="100%" height="100%" fill="${settings.colorA}" fill-opacity=".48"/><path d="M-${bundle} ${bundle}L${bundle} -${bundle}M0 ${scale}L${scale} 0M${scale * 0.5} ${scale * 1.5}L${scale * 1.5} ${scale * 0.5}M${scale} ${scale * 2}L${scale * 2} ${scale}M${scale * 1.5} ${scale * 2.5}L${scale * 2.5} ${scale * 1.5}" stroke="${settings.colorC}" stroke-opacity=".62" stroke-width="${bundle}"/><path d="M0 0L${scale * 2} ${scale * 2}M-${scale} 0L${scale} ${scale * 2}M${scale} 0L${scale * 3} ${scale * 2}" stroke="${settings.colorB}" stroke-opacity=".68" stroke-width="${bundle * 0.72}"/></pattern>`;
  } else {
    const dot = Math.max(0.8, scale * 0.045);
    pattern = `<pattern id="physical-surface-pattern" width="${scale}" height="${scale}" patternUnits="userSpaceOnUse" patternTransform="${patternTransform}"><rect width="100%" height="100%" fill="#FFFFFF" fill-opacity=".08"/><circle cx="${scale * 0.18}" cy="${scale * 0.24}" r="${dot}" fill="#FFFFFF" fill-opacity=".8"/><circle cx="${scale * 0.68}" cy="${scale * 0.58}" r="${dot * 1.4}" fill="${settings.colorC}" fill-opacity=".52"/><circle cx="${scale * 0.42}" cy="${scale * 0.84}" r="${dot * 0.72}" fill="${settings.colorA}" fill-opacity=".42"/></pattern>`;
  }

  const lighting = `<filter id="physical-surface-light" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="${blur}" result="surface-height"/><feDiffuseLighting in="surface-height" surfaceScale="${surfaceScale}" diffuseConstant=".78" lighting-color="#FFFFFF" result="surface-diffuse"><feDistantLight azimuth="${(angle + 315) % 360}" elevation="${elevation}"/></feDiffuseLighting><feComposite in="surface-diffuse" in2="SourceAlpha" operator="in" result="surface-diffuse-cut"/><feSpecularLighting in="surface-height" surfaceScale="${surfaceScale}" specularConstant="${specularConstant}" specularExponent="${specularExponent}" lighting-color="#FFFFFF" result="surface-specular"><feDistantLight azimuth="${(angle + 315) % 360}" elevation="${elevation}"/></feSpecularLighting><feComposite in="surface-specular" in2="SourceAlpha" operator="in" result="surface-specular-cut"/><feBlend in="SourceGraphic" in2="surface-diffuse-cut" mode="multiply" result="surface-lit"/><feBlend in="surface-lit" in2="surface-specular-cut" mode="screen"/></filter>`;
  const blendMode = metallic >= 55 ? 'screen' : 'soft-light';
  const layer = `<g data-surface-material="${settings.surfaceMaterial}" data-surface-depth="${depth}" data-surface-roughness="${roughness}" data-surface-metallic="${metallic}" data-surface-open-area="${openArea}" data-surface-texture-amount="${textureAmount}" data-surface-irregularity="${irregularity}" opacity="${layerOpacity}" style="mix-blend-mode:${blendMode}"><rect x="-4%" y="-4%" width="108%" height="108%" fill="url(#physical-surface-pattern)" filter="url(#physical-surface-light)"/></g>`;

  return { definitions: `${pattern}${lighting}`, layer };
}

export function buildBackgroundSvg(
  settings: BackgroundSettings,
  identity?: {
    asset?: string;
    assetFit?: 'contain' | 'cover';
    assetOpacity?: number;
    logo?: string;
    logoAppearance?: LogoAppearanceSettings;
    name: string;
    showLogo?: boolean;
  }
): string {
  const gradient = gradientDefinition(settings);
  const pattern = patternDefinition(settings);
  const physicalSurface = physicalSurfaceDefinition(settings);
  const grain = `<filter id="surface-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".52" numOctaves="2" seed="12" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${Math.max(0, Math.min(0.45, settings.grain / 180))}"/></feComponentTransfer></filter>`;
  const waveBlur = Math.max(18, Math.min(settings.width, settings.height) * 0.045);
  const smoothFilters = `<filter id="wave-soften" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${waveBlur.toFixed(2)}"/></filter>`;
  const patternLayer =
    settings.pattern === 'none'
      ? ''
      : `<rect width="100%" height="100%" fill="url(#pattern-${settings.pattern})" opacity="${(settings.patternOpacity / 100).toFixed(2)}"/>`;
  const surface =
    settings.style === 'dither'
      ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>${ditherField(settings)}`
      : settings.style === 'pattern'
        ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>`
        : gradientSurface(settings);
  const grainLayer =
    settings.style === 'grain-gradient' && settings.grain > 0
      ? `<rect width="100%" height="100%" fill="#FFFFFF" filter="url(#surface-grain)" style="mix-blend-mode:soft-light"/>`
      : '';
  const markSize = Math.min(settings.width, settings.height) * (settings.logoScale / 100);
  const markX = (settings.width - markSize) / 2 + (settings.logoX / 100) * settings.width;
  const markY = (settings.height - markSize) / 2 + (settings.logoY / 100) * settings.height;
  const logoAppearance = { ...DEFAULT_LOGO_APPEARANCE, ...identity?.logoAppearance };
  const logoFilter = identity && identity.showLogo !== false
    ? buildLogoSvgFilter(logoAppearance, settings.logoColor, 'background-logo')
    : '';
  const mark = identity?.showLogo === false
    ? ''
    : identity?.logo
    ? `<image href="${identity.logo.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" opacity="${settings.logoOpacity / 100}"/>`
    : identity
      ? `<text x="${settings.width / 2 + (settings.logoX / 100) * settings.width}" y="${settings.height * 0.52 + (settings.logoY / 100) * settings.height}" text-anchor="middle" dominant-baseline="middle" fill="${settings.logoColor}" opacity="${settings.logoOpacity / 100}" font-family="Switzer,sans-serif" font-size="${markSize * 0.42}" font-weight="550" letter-spacing="-.02em">${identity.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text>`
      : '';
  const brandAsset = identity?.asset
    ? `<image href="${identity.asset.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" width="100%" height="100%" preserveAspectRatio="xMidYMid ${identity.assetFit === 'contain' ? 'meet' : 'slice'}" opacity="${Math.max(0, Math.min(1, (identity.assetOpacity ?? 100) / 100))}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}"><defs>${gradient}${grain}${smoothFilters}${pattern}${physicalSurface.definitions}${logoFilter}</defs>${surface}${grainLayer}${patternLayer}${physicalSurface.layer}${brandAsset}${mark ? `<g filter="url(#background-logo)">${mark}</g>` : ''}</svg>`;
}
