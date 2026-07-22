import type { CubicBezier } from './animation';
import type { GifExportConfig } from './exportGif';

export type SourceMode = 'text' | 'images';

export type ImportedImage = {
  height: number;
  id: string;
  image: HTMLImageElement;
  name: string;
  url: string;
  width: number;
};

export type StudioSettings = GifExportConfig;

export const DEFAULT_TEXT_FRAMES = [
  'Welcome',
  'Bienvenidos',
  '你好',
  'ようこそ',
  'أهلاً وسهلاً',
  'स्वागत है',
  'Bienvenue',
  '환영합니다',
].join('\n');

export const DEFAULT_SETTINGS: StudioSettings = {
  alignX: 0,
  alignY: 0,
  background: '#000000',
  bezier: [0.4, 0, 0.2, 1],
  blur: 8,
  colors: 64,
  fit: 'contain',
  fontSize: 108,
  fontWeight: 700,
  foreground: '#ffffff',
  fps: 20,
  height: 300,
  holdMs: 1250,
  loop: true,
  packageId: 'morph-fade',
  scale: 1,
  transitionMs: 240,
  width: 1000,
};

export const EASING_PRESETS: Record<string, CubicBezier> = {
  material: [0.4, 0, 0.2, 1],
  snappy: [0.2, 0.8, 0.2, 1],
  soft: [0.45, 0, 0.55, 1],
  dramatic: [0.76, 0, 0.24, 1],
};
