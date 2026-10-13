'use client';

// Canvas content for Design Lab layers: masked media, sticker finishes and
// editable text. Shared by the live stage, inactive artboard previews and the
// image crop editor so every surface renders a layer the same way.
import type { CSSProperties, ReactNode } from 'react';

import CanvasEditableText from '@/components/CanvasEditableText';
import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { brandTypographyFamily, resolveBrandTypographyWeight, type BrandIdentity } from '@/lib/brandIdentity';
import { canvasTextTypography } from '@/lib/canvasTextLayout';
import {
  resolvedLogoAppearance,
  resolvedTextAppearance,
  resolveTextRunStyle,
  textShadowStyle,
  type CompositionTextLayer,
  type ShaderApplication,
  type ShaderBlendMode,
} from '@/lib/designLabModel';
import { designLabTextDecorationLine, resolveDesignLabFontSize } from '@/lib/designLabTypography';
import { normalizeImageCropSettings, type ImageCropSettings } from '@/lib/imagePlacement';
import type { LogoAppearanceSettings } from '@/lib/logoAppearance';
import type { TextSelectionRange, TextStyleRun } from '@/lib/richText';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import { normalizeStickerFinish, stickerFinishSwatch, type StickerFinishSettings } from '@/lib/surfaceSticker';
import { textEffectCssStyle } from '@/lib/textEffects';

export function shaderBlendStyle(blendMode: ShaderBlendMode): CSSProperties['mixBlendMode'] {
  return blendMode === 'normal' ? 'normal' : blendMode;
}

export type RenderLiveMaterial = (application: ShaderApplication, instanceKey: string) => ReactNode;

export function imageCropPosition(cropInput?: Partial<ImageCropSettings>): string {
  const crop = normalizeImageCropSettings(cropInput);
  return `${crop.focalPointX * 100}% ${crop.focalPointY * 100}%`;
}

export function imageCropTransformStyle(cropInput?: Partial<ImageCropSettings>): CSSProperties {
  const crop = normalizeImageCropSettings(cropInput);
  if (!crop.enabled) return {};
  const transformOrigin = imageCropPosition(crop);
  return {
    transform: `scale(${crop.zoom})`,
    transformOrigin,
  };
}

export function imageCropMaterialStyle(cropInput?: Partial<ImageCropSettings>): CSSProperties {
  const crop = normalizeImageCropSettings(cropInput);
  if (!crop.enabled) return {};
  return {
    transform: `scale(${1 / crop.zoom})`,
    transformOrigin: imageCropPosition(crop),
  };
}

export function imageCropElementStyle(cropInput?: Partial<ImageCropSettings>): CSSProperties {
  const crop = normalizeImageCropSettings(cropInput);
  if (!crop.enabled) return {};
  return {
    objectFit: 'cover',
    objectPosition: imageCropPosition(crop),
    ...imageCropTransformStyle(crop),
  };
}

export function applyImageCropPreviewStyles(layer: HTMLElement, cropInput?: Partial<ImageCropSettings>) {
  const crop = normalizeImageCropSettings(cropInput);
  const position = imageCropPosition(crop);
  layer.querySelectorAll<HTMLElement>('[data-image-crop-enabled]')
    .forEach((frame) => {
      if (frame.closest('[data-image-crop-source]')) return;
      frame.dataset.imageCropEnabled = String(crop.enabled);
    });
  layer.querySelectorAll<HTMLElement>('[data-image-crop-media="image"]')
    .forEach((image) => {
      if (image.closest('[data-image-crop-source]')) return;
      image.style.objectFit = crop.enabled ? 'cover' : '';
      image.style.objectPosition = crop.enabled ? position : '';
      image.style.transform = crop.enabled ? `scale(${crop.zoom})` : '';
      image.style.transformOrigin = crop.enabled ? position : '';
    });
  layer.querySelectorAll<HTMLElement>('[data-image-crop-media="mask"], [data-image-crop-media="sticker"]')
    .forEach((mask) => {
      if (mask.closest('[data-image-crop-source]')) return;
      const size = crop.enabled ? 'cover' : '100% 100%';
      mask.style.maskPosition = crop.enabled ? position : 'center';
      mask.style.maskSize = size;
      mask.style.webkitMaskPosition = crop.enabled ? position : 'center';
      mask.style.webkitMaskSize = size;
      mask.style.transform = crop.enabled ? `scale(${crop.zoom})` : '';
      mask.style.transformOrigin = crop.enabled ? position : '';
    });
  layer.querySelectorAll<HTMLElement>('[data-image-crop-material]')
    .forEach((material) => {
      if (material.closest('[data-image-crop-source]')) return;
      material.style.transform = crop.enabled ? `scale(${1 / crop.zoom})` : '';
      material.style.transformOrigin = crop.enabled ? position : '';
    });
}

export function canvasMediaMaskStyle(
  url: string,
  fillFrame = false,
  cropInput?: Partial<ImageCropSettings>
): CSSProperties {
  const crop = normalizeImageCropSettings(cropInput);
  const maskSize = crop.enabled ? 'cover' : fillFrame ? '100% 100%' : 'contain';
  const maskPosition = crop.enabled ? imageCropPosition(crop) : 'center';
  return {
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskPosition: maskPosition,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: maskSize,
    maskImage: `url("${url}")`,
    maskMode: 'alpha',
    maskPosition,
    maskRepeat: 'no-repeat',
    maskSize,
    ...imageCropTransformStyle(crop),
  };
}

export function ShaderMaskedMediaContent({
  application,
  appearance: appearanceSettings,
  fallbackColor,
  imageCrop,
  instanceKey,
  label,
  opacity,
  preserveColors = false,
  renderMaterial,
  url,
}: {
  application?: ShaderApplication;
  appearance?: LogoAppearanceSettings;
  fallbackColor: string;
  imageCrop?: ImageCropSettings;
  instanceKey: string;
  label: string;
  opacity: number;
  preserveColors?: boolean;
  renderMaterial: RenderLiveMaterial;
  url: string;
}) {
  const appearance = resolvedLogoAppearance(appearanceSettings);
  if (!application && preserveColors) {
    return (
      <AppearanceFilteredContent
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview shader-lab-v2-asset-preview'
        opacity={opacity}
        settings={appearance}
      >
        <div className='shader-lab-v2-image-crop-frame' data-image-crop-enabled={normalizeImageCropSettings(imageCrop).enabled}>
          <img
            alt=''
            className='shader-lab-v2-layer-image'
            data-image-crop-media='image'
            draggable={false}
            src={url}
            style={imageCropElementStyle(imageCrop)}
          />
        </div>
      </AppearanceFilteredContent>
    );
  }
  if (!application) {
    return (
      <LogoAppearancePreview
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview'
        color={fallbackColor}
        logoPath={url}
        opacity={opacity}
        preserveColors={preserveColors}
        settings={appearance}
      />
    );
  }
  return (
    <div
      className='shader-lab-v2-appearance-preview shader-lab-v2-appearance-stack'
      style={{
        mixBlendMode: shaderBlendStyle(application.blendMode),
        opacity: opacity * application.opacity,
      }}
    >
      <AppearanceFilteredContent
        ariaLabel={`${label} material`}
        className='shader-lab-v2-appearance-stack-layer'
        settings={appearance}
      >
        <div className='shader-lab-v2-image-crop-frame' data-image-crop-enabled={normalizeImageCropSettings(imageCrop).enabled}>
          <div
            className='shader-lab-v2-layer-logo-mask'
            data-image-crop-media='mask'
            data-shader-instance={instanceKey}
            style={canvasMediaMaskStyle(url, preserveColors, imageCrop)}
          >
            <div className='shader-lab-v2-image-crop-material' data-image-crop-material style={imageCropMaterialStyle(imageCrop)}>
              {renderMaterial(application, instanceKey)}
            </div>
          </div>
        </div>
      </AppearanceFilteredContent>
    </div>
  );
}

export function stickerFinishCssVariables(value?: Partial<StickerFinishSettings>): Record<string, string> {
  const finish = normalizeStickerFinish(value);
  return {
    '--design-sticker-finish': stickerFinishSwatch(finish),
    '--design-sticker-finish-contrast': String(1 + finish.relief / 420),
    '--design-sticker-finish-glint': `${finish.glintAngle}deg`,
    '--design-sticker-finish-glint-opacity': String(0.18 + finish.relief / 128),
    '--design-sticker-finish-opacity': String(Math.max(0, Math.min(0.82, finish.intensity / 122))),
    '--design-sticker-finish-saturation': String(1 + finish.depth / 240),
    '--design-sticker-finish-texture': String(finish.texture / 260),
  };
}

export function StickerFinishOverlay({
  finish,
  imageCrop,
  url,
}: {
  finish?: Partial<StickerFinishSettings>;
  imageCrop?: ImageCropSettings;
  url: string;
}) {
  const normalized = normalizeStickerFinish(finish);
  const maskImage = `url("${url.replaceAll('"', '%22')}")`;
  const crop = normalizeImageCropSettings(imageCrop);
  const maskPosition = crop.enabled ? imageCropPosition(crop) : 'center';
  return (
    <span
      aria-hidden='true'
      className='shader-lab-v2-sticker-finish-overlay'
      data-sticker-finish={normalized.presetId}
      style={stickerFinishCssVariables(normalized) as CSSProperties}
    >
      <span
        className='shader-lab-v2-sticker-finish-media'
        data-image-crop-media='sticker'
        style={{
          maskImage,
          maskPosition,
          maskRepeat: 'no-repeat',
          maskSize: crop.enabled ? 'cover' : '100% 100%',
          WebkitMaskImage: maskImage,
          WebkitMaskPosition: maskPosition,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskSize: crop.enabled ? 'cover' : '100% 100%',
          ...imageCropTransformStyle(crop),
        }}
      />
    </span>
  );
}

export function CanvasTextLayerContent({
  application,
  canvasHeight,
  fontSizeCqw,
  identity,
  layer,
  onChange,
  onFocus,
  onRichChange,
  onSelectionChange,
  onFormat,
  onUndoRedo,
  renderMaterial,
}: {
  application?: ShaderApplication;
  canvasHeight: number;
  fontSizeCqw: number;
  identity: BrandIdentity;
  layer: CompositionTextLayer;
  onChange: (value: string) => void;
  onFocus: () => void;
  onRichChange?: (value: string, runs: TextStyleRun[] | undefined) => void;
  onSelectionChange?: (selection: TextSelectionRange) => void;
  onFormat?: (format: 'bold' | 'italic' | 'underline') => void;
  onUndoRedo?: (redo: boolean) => void;
  renderMaterial: RenderLiveMaterial;
}) {
  const appearance = resolvedTextAppearance(layer);
  const instanceKey = `content-${layer.id}`;
  const materialImage = application ? `url("${shaderPreviewAssetPath(application.materialId)}")` : undefined;
  return (
    <>
      {application ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 opacity-0'
          data-shader-instance={instanceKey}
        >
          {renderMaterial(application, instanceKey)}
        </div>
      ) : null}
      <CanvasEditableText
        className={`shader-lab-v2-layer-text ${application ? 'shader-lab-v2-layer-text-material' : ''}`}
        label={`Edit ${layer.name}`}
        onChange={onChange}
        onFocus={onFocus}
        onRichChange={onRichChange}
        onSelectionChange={onSelectionChange}
        onFormat={onFormat}
        onUndoRedo={onUndoRedo}
        runs={layer.runs}
        resolveRunStyle={(style) => {
          const resolved = resolveTextRunStyle(layer, identity, canvasHeight, style);
          return {
            color: application || appearance.textEffect.kind !== 'solid' || !style.color ? 'inherit' : resolved.color,
            fontFamily: style.fontRole ? resolved.fontFamily : 'inherit',
            fontSize: style.fontSize === undefined ? 'inherit' : `${fontSizeCqw * resolved.fontSize / resolveDesignLabFontSize(layer, canvasHeight)}cqw`,
            fontWeight: style.weight !== undefined || style.fontRole ? String(resolved.fontWeight) : 'inherit', fontStyle: style.fontStyle ?? 'inherit',
            letterSpacing: style.tracking === undefined ? 'inherit' : `${resolved.tracking}em`,
            textDecorationLine: designLabTextDecorationLine(resolved),
            textDecorationColor: 'currentColor', textDecorationThickness: 'from-font', textUnderlineOffset: '0.12em',
          };
        }}
        style={{
          display: layer.runs?.length ? 'block' : 'flex',
          caretColor: appearance.color,
          color: appearance.color,
          ...canvasTextTypography({
            align: layer.align,
            fontFamily: `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, Arial, sans-serif`,
            fontSize: `${fontSizeCqw}cqw`,
            fontStyle: layer.fontStyle ?? 'normal',
            fontWeight: resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight),
            lineHeight: layer.lineHeight,
            tracking: layer.tracking,
            wrap: layer.wrap,
          }),
          mixBlendMode: application ? shaderBlendStyle(application.blendMode) : undefined,
          opacity: appearance.opacity * (application?.opacity ?? 1),
          textDecorationColor: appearance.color,
          textDecorationLine: layer.runs?.length ? 'none' : designLabTextDecorationLine(layer),
          textDecorationThickness: 'from-font',
          textShadow: textShadowStyle(appearance),
          textUnderlineOffset: '0.12em',
          WebkitTextStroke: appearance.outlineEnabled
            ? `${appearance.outlineWidth}px ${appearance.outlineColor}`
            : undefined,
          ...textEffectCssStyle(appearance.textEffect, appearance.color, materialImage),
        }}
        value={layer.value}
      />
    </>
  );
}
