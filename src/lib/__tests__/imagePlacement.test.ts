import { describe, expect, it } from 'vitest';

import {
  fitImageLayerToCanvas,
  imageLayerName,
  previewContainedImageBounds,
} from '../imagePlacement';

describe('Design Lab image placement', () => {
  it('removes file extensions from human-facing layer names', () => {
    expect(imageLayerName('Campaign hero.final.png')).toBe('Campaign hero.final');
    expect(imageLayerName('.png')).toBe('Image');
  });

  it('centers a landscape image at its natural ratio inside the canvas', () => {
    const placement = fitImageLayerToCanvas({
      baseHeight: 342,
      baseWidth: 544,
      canvasHeight: 900,
      canvasWidth: 1_600,
      imageHeight: 1_000,
      imageWidth: 2_000,
    });

    expect(placement.x).toBe(0);
    expect(placement.y).toBe(0);
    expect(placement.widthScale * 544 / (placement.heightScale * 342)).toBeCloseTo(2);
    expect(placement.widthScale * 544).toBeCloseTo(992);
  });

  it('fits portrait images by height and preserves a supplied batch offset', () => {
    const placement = fitImageLayerToCanvas({
      baseHeight: 342,
      baseWidth: 544,
      canvasHeight: 900,
      canvasWidth: 1_600,
      imageHeight: 2_000,
      imageWidth: 1_000,
      x: 36,
      y: 24,
    });

    expect(placement).toMatchObject({ scale: 1, x: 36, y: 24 });
    expect(placement.heightScale * 342).toBeCloseTo(558);
    expect(placement.widthScale * 544 / (placement.heightScale * 342)).toBeCloseTo(0.5);
  });

  it('matches the centered square viewport used by image previews during export', () => {
    const bounds = previewContainedImageBounds({
      boxHeight: 342 * 3.0326694786975477,
      boxWidth: 544 * 10.200138502156074,
      imageHeight: 80,
      imageWidth: 428,
    });

    expect(bounds.width).toBeCloseTo(bounds.viewportSize);
    expect(bounds.width / bounds.height).toBeCloseTo(428 / 80);
    expect(bounds.x).toBeCloseTo((bounds.boxWidth - bounds.width) / 2);
    expect(bounds.y).toBeCloseTo((bounds.boxHeight - bounds.height) / 2);
    expect(bounds.width).toBeLessThan(bounds.boxWidth / 5);
  });
});
