import { isValidElement, type ReactNode } from 'react';
import {
  Activity,
  Blend,
  Box,
  CircleDashed,
  Clock3,
  Gauge,
  Grid3X3,
  Layers3,
  Move,
  MoveDiagonal2,
  Palette,
  RotateCw,
  Rows3,
  ScanLine,
  SlidersHorizontal,
  Space,
  Sun,
  Waves,
  Weight,
  type LucideIcon,
} from '@/components/ui/SolidIcons';

type LabelRule = readonly [pattern: RegExp, icon: LucideIcon];

const LABEL_RULES: readonly LabelRule[] = [
  [/duration|delay|time|frame rate|playback|frame/i, Clock3],
  [/speed|fps|motion/i, Gauge],
  [/brightness|light|exposure|glow|shine|sparkle|highlight|reflection/i, Sun],
  [/rotation|angle|direction|tilt|orbit/i, RotateCw],
  [/opacity|transparen|blend|fade/i, Blend],
  [/line height|leading|row/i, Rows3],
  [/width|height|size|scale|zoom|diameter/i, MoveDiagonal2],
  [/position|offset|translate|horizontal|vertical|\bx\b|\by\b/i, Move],
  [/tracking|letter spacing|kerning|spacing|gap/i, Space],
  [/weight|thickness|stroke|outline|border|edge|seam|keyline/i, Weight],
  [/blur|radius|round|softness|feather/i, CircleDashed],
  [/frequency|wave|warp|drape|flow/i, Waves],
  [/detail|texture|grain|noise|dither|rough|irregular|weave|cell/i, ScanLine],
  [/density|count|bands|steps|columns|rows|segments/i, Grid3X3],
  [/depth|relief|layer|extrusion|metallic/i, Layers3],
  [/color|hue|saturation|temperature|tint/i, Palette],
  [/strength|intensity|amplitude|amount|foil/i, Activity],
  [/perspective|volume|surface/i, Box],
];

function reactNodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(reactNodeText).join(' ');
  if (isValidElement<{ children?: ReactNode }>(node)) return reactNodeText(node.props.children);
  return '';
}

function rangeIcon(label: ReactNode): LucideIcon {
  const text = reactNodeText(label);
  return LABEL_RULES.find(([pattern]) => pattern.test(text))?.[1] ?? SlidersHorizontal;
}

export default function StudioRangeLabel({
  className = '',
  label,
  value,
}: {
  className?: string;
  label: ReactNode;
  value?: ReactNode;
}) {
  const Icon = rangeIcon(label);
  return (
    <span className={`studio-range-label ${className}`.trim()}>
      <span className='studio-range-label-copy'>
        <span aria-hidden='true' className='studio-range-icon'><Icon /></span>
        <span>{label}</span>
      </span>
      {value}
    </span>
  );
}
