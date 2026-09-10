/** Defaults for new text and editing controls, not limits on existing source. */
export const DEFAULT_DESIGN_LAB_FONT_SIZE = 48;
export const MIN_DESIGN_LAB_FONT_SIZE = 1;
export const MAX_DESIGN_LAB_FONT_SIZE = 2048;

export type DesignLabTextTypography = {
  /** Base artboard pixels, before transform.scale; omitted by legacy documents. */
  fontSize?: number;
  fontStyle?: 'normal' | 'italic';
  strikethrough?: boolean;
  underline?: boolean;
};

export type DesignLabTextDecorationLine = 'line-through' | 'none' | 'underline' | 'underline line-through';

export type DesignLabTypographyTransform = {
  heightScale?: number;
  scale: number;
  widthScale?: number;
  x: number;
  y: number;
};

export type DesignLabTypographyLayer = DesignLabTextTypography & {
  transform: DesignLabTypographyTransform;
};

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Resolves artboard pixels only; viewport zoom must not change document sizing. */
export function resolveDesignLabFontSize(layer: DesignLabTypographyLayer, artboardHeight: number): number {
  const baseSize = isPositiveFiniteNumber(layer.fontSize) ? layer.fontSize : artboardHeight * 0.17;
  return baseSize * layer.transform.scale;
}

export function resolveDesignLabFontSizeCqw(
  layer: DesignLabTypographyLayer,
  dimensions: { width: number; height: number },
): number {
  return resolveDesignLabFontSize(layer, dimensions.height) / dimensions.width * 100;
}

/** A layer patch: changing font size does not change the position or text box. */
export function designLabFontSizeUpdate(layer: DesignLabTypographyLayer, size: number): {
  fontSize: number;
  transform: DesignLabTypographyTransform;
} {
  if (!isPositiveFiniteNumber(size)) throw new TypeError('Text fontSize must be a positive finite number.');
  return {
    fontSize: size,
    transform: {
      ...layer.transform,
      heightScale: layer.transform.heightScale ?? 1,
      widthScale: layer.transform.widthScale ?? 1,
      scale: 1,
    },
  };
}

export function designLabTextDecorationLine(
  typography: Pick<DesignLabTextTypography, 'strikethrough' | 'underline'>
): DesignLabTextDecorationLine {
  if (typography.underline && typography.strikethrough) return 'underline line-through';
  if (typography.underline) return 'underline';
  if (typography.strikethrough) return 'line-through';
  return 'none';
}

/** Validates optional typography without migrating or clamping legacy documents. */
export function validateDesignLabTextTypography(value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Text typography must be an object.');
  const typography = value as Record<string, unknown>;
  if (typography.fontSize !== undefined && !isPositiveFiniteNumber(typography.fontSize)) {
    throw new TypeError('Text fontSize must be a positive finite number.');
  }
  if (typography.fontStyle !== undefined && typography.fontStyle !== 'normal' && typography.fontStyle !== 'italic') {
    throw new TypeError('Text fontStyle must be normal or italic.');
  }
  if (typography.underline !== undefined && typeof typography.underline !== 'boolean') {
    throw new TypeError('Text underline must be Boolean.');
  }
  if (typography.strikethrough !== undefined && typeof typography.strikethrough !== 'boolean') {
    throw new TypeError('Text strikethrough must be Boolean.');
  }
}
