import { describe, expect, it } from 'vitest';

import {
  DEFAULT_IMAGE_CROP,
  fitImageLayerToCanvas,
  imageCropAfterDrag,
  imageCropRenderedBounds,
  imageCropSourceBounds,
  imageLayerName,
  normalizeImageCropSettings,
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

  it('matches rectangular CSS contain geometry during export', () => {
    const bounds = previewContainedImageBounds({
      boxHeight: 342 * 3.0326694786975477,
      boxWidth: 544 * 10.200138502156074,
      imageHeight: 80,
      imageWidth: 428,
    });

    expect(bounds.height).toBeCloseTo(bounds.boxHeight);
    expect(bounds.width / bounds.height).toBeCloseTo(428 / 80);
    expect(bounds.x).toBeCloseTo((bounds.boxWidth - bounds.width) / 2);
    expect(bounds.y).toBeCloseTo((bounds.boxHeight - bounds.height) / 2);
    expect(bounds.width).toBeGreaterThan(bounds.boxWidth / 2);
  });

  it('crops without squeezing and follows the authored focal point', () => {
    const centered = imageCropSourceBounds({
      boxHeight: 100,
      boxWidth: 100,
      crop: { ...DEFAULT_IMAGE_CROP, enabled: true },
      imageHeight: 100,
      imageWidth: 200,
    });
    const focused = imageCropSourceBounds({
      boxHeight: 100,
      boxWidth: 100,
      crop: { enabled: true, focalPointX: 1, focalPointY: 0.5, zoom: 2 },
      imageHeight: 100,
      imageWidth: 200,
    });

    expect(centered).toEqual({ height: 100, width: 100, x: 50, y: 0 });
    expect(focused).toEqual({ height: 50, width: 50, x: 150, y: 25 });
  });

  it('normalizes malformed crop ranges before preview or export consumes them', () => {
    expect(normalizeImageCropSettings({
      enabled: true,
      focalPointX: -4,
      focalPointY: 8,
      zoom: 20,
    })).toEqual({ enabled: true, focalPointX: 0, focalPointY: 1, zoom: 4 });
    expect(normalizeImageCropSettings()).toEqual(DEFAULT_IMAGE_CROP);
  });

  it('reveals the complete source around the authored crop frame', () => {
    expect(imageCropRenderedBounds({
      boxHeight: 100,
      boxWidth: 100,
      crop: { enabled: true, focalPointX: 0.5, focalPointY: 0.5, zoom: 1 },
      imageHeight: 100,
      imageWidth: 200,
    })).toEqual({ height: 100, left: -50, top: 0, width: 200 });
  });

  it('moves the source inside the frame without moving the frame itself', () => {
    const next = imageCropAfterDrag({
      boxHeight: 100,
      boxWidth: 100,
      crop: { enabled: true, focalPointX: 0.5, focalPointY: 0.5, zoom: 1 },
      deltaX: 25,
      deltaY: 40,
      imageHeight: 100,
      imageWidth: 200,
    });

    expect(next.focalPointX).toBeCloseTo(0.25);
    expect(next.focalPointY).toBe(0.5);
  });
});
