'use client';

// Design Lab chrome: the title bar, artboard toolbar, preview quality toggle
// and the shader motion strip. Each is memoized on its own state and stable
// handlers, so canvas edits do not re-render them.
import {
  CircleGauge,
  Clapperboard,
  Clock3,
  Download,
  ExternalLink,
  FileImage,
  Film,
  Frame,
  Gauge,
  ImageDown,
  Info,
  MonitorUp,
  Move,
  Pause,
  Play,
  Repeat2,
  Ruler,
  Sparkles,
  X,
  Zap,
} from '@/components/ui/SolidIcons';
import { memo, type ReactNode } from 'react';
import ShaderTimeExplorer from '@/components/ShaderTimeExplorer';
import { DesignVersionHeaderControls } from '@/components/DesignVersionControls';
import StudioArtboardBar from '@/components/StudioArtboardBar';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import StudioFileMenu from '@/components/StudioFileMenu';
import StudioToolHeader, { StudioToolbarGroup } from '@/components/StudioToolHeader';
import StudioErrorNotice from '@/components/ui/StudioErrorNotice';
import { Button } from '@/components/ui/Button';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioSelect from '@/components/ui/StudioSelect';
import { studioRenderQualityStore } from '@/lib/landingRenderQuality';
import { resolveExportDimensions, resolveSeamlessLoopOverlapFrames } from '@/lib/canvasExport';
import type { StudioArtboardDimensions } from '@/lib/artboardSizes';
import { getLiveMaterial, type LiveMaterialId } from '@/lib/liveMaterials';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import {
  EXPORT_QUALITY_OPTIONS,
  EXPORT_WIDTH_PRESETS,
  type DesignArtboardId,
  type DesignExportFormat,
  type DesignExportSettings,
  type DesignRatioOption,
  type DesignShaderSequenceSettings,
  type ShaderLayerId,
} from '@/lib/designLabModel';
import type { StudioToolId } from '@/lib/studioCatalog';
import type { ProjectFileControlsProps } from '@/components/ProjectFileControls';
import type { ShaderMotionCapabilities } from '@/lib/shaderMotionCapabilities';

function DesignExportControls({
  format,
  onChange,
  ratioOption,
  settings,
}: {
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  ratioOption: DesignRatioOption;
  settings: DesignExportSettings;
}) {
  const dimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: settings.width,
  });
  const frameCount = Math.max(2, Math.round(settings.durationMs / (1_000 / settings.fps)));
  const loopOverlapFrames = resolveSeamlessLoopOverlapFrames({
    durationMs: settings.durationMs,
    fps: settings.fps,
    height: dimensions.height,
    width: dimensions.width,
  });
  const motion = format === 'gif' || format === 'mp4';

  return (
    <div className='shader-lab-v2-output-controls'>
      <div className='shader-lab-v2-export-overview' aria-label='Current output settings'>
        <div>
          <MonitorUp aria-hidden='true' />
          <span><small>Output size</small><strong>{dimensions.width} × {dimensions.height}</strong></span>
        </div>
        <div>
          {motion ? <Film aria-hidden='true' /> : <FileImage aria-hidden='true' />}
          {motion
            ? <span><small>Animation · {frameCount} frames</small><strong>{settings.durationMs / 1_000}s · {settings.fps} FPS</strong></span>
            : <span><small>Static image</small><strong>{format.toUpperCase()} · {settings.quality}</strong></span>}
        </div>
      </div>
      <div className='shader-lab-v2-export-presets' aria-label='Export size presets'>
        {EXPORT_WIDTH_PRESETS.map((preset) => {
          const presetDimensions = resolveExportDimensions({
            aspectHeight: ratioOption.height,
            aspectWidth: ratioOption.width,
            width: preset.width,
          });
          return (
            <button
              aria-pressed={dimensions.width === presetDimensions.width}
              key={preset.width}
              onClick={() => onChange({ width: preset.width })}
              type='button'
            >
              <strong>{preset.label}</strong>
              <small>{presetDimensions.width}×{presetDimensions.height}</small>
            </button>
          );
        })}
      </div>
      <label className='shader-lab-v2-export-width'>
        <span><Ruler aria-hidden='true' />Custom width</span>
        <span>
          <input
            aria-label='Export width in pixels'
            max={3_840}
            min={320}
            onBlur={() => onChange({ width: dimensions.width })}
            onChange={(event) => {
              const width = event.currentTarget.valueAsNumber;
              if (Number.isFinite(width)) onChange({ width });
            }}
            step={2}
            type='number'
            value={settings.width}
          />
          <i>px</i>
        </span>
      </label>
      <div className='shader-lab-v2-export-quality'>
        <span><CircleGauge aria-hidden='true' />Quality</span>
        <div>
          {EXPORT_QUALITY_OPTIONS.map((option) => {
            const QualityIcon = option.value === 'fast' ? Zap : option.value === 'balanced' ? CircleGauge : Sparkles;
            return (
              <button
                aria-pressed={settings.quality === option.value}
                key={option.value}
                onClick={() => onChange({ quality: option.value })}
                title={option.description}
                type='button'
              >
                <QualityIcon aria-hidden='true' />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      {motion ? (
        <div className='shader-lab-v2-export-motion'>
          <label>
            <span><Clock3 aria-hidden='true' />Duration</span>
            <StudioSelect
              ariaLabel='Export duration'
              onValueChange={(value) => onChange({ durationMs: Number(value) })}
              options={[
                { label: '1.2 seconds', value: '1200' },
                { label: '1.6 seconds', value: '1600' },
                { label: '2.4 seconds', value: '2400' },
                { label: '4 seconds', value: '4000' },
              ]}
              value={String(settings.durationMs)}
            />
          </label>
          <label>
            <span><Film aria-hidden='true' />Frame rate</span>
            <StudioSelect
              ariaLabel='Export frame rate'
              onValueChange={(value) => onChange({ fps: Number(value) })}
              options={[12, 15, 24, 30, 60].map((fps) => ({ label: `${fps} FPS`, value: String(fps) }))}
              value={String(settings.fps)}
            />
          </label>
        </div>
      ) : null}
      {format === 'gif' ? (
        <div className='shader-lab-v2-export-quality shader-lab-v2-export-loop'>
          <span><Repeat2 aria-hidden='true' />GIF loop</span>
          <div>
            <button
              aria-pressed={settings.gifLoop === 'seamless'}
              onClick={() => onChange({ gifLoop: 'seamless' })}
              title='Blend and verify the closing frame for a smooth loop.'
              type='button'
            >Blended loop</button>
            <button
              aria-pressed={settings.gifLoop === 'raw'}
              onClick={() => onChange({ gifLoop: 'raw' })}
              title='Repeat captured frames without correcting the seam.'
              type='button'
            >Raw motion</button>
          </div>
          <small>{settings.gifLoop === 'seamless'
            ? `Crossfade close · ${loopOverlapFrames}-frame overlap; not a native shader period`
            : 'Unmodified clip · repeating it may show a visible seam'}</small>
        </div>
      ) : null}
    </div>
  );
}

export function DesignExportWorkspace({
  disabled,
  format,
  onChange,
  onFormatChange,
  ratioOption,
  settings,
}: {
  disabled: boolean;
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  onFormatChange: (format: DesignExportFormat) => void;
  ratioOption: DesignRatioOption;
  settings: DesignExportSettings;
}) {
  const formats: readonly { description: string; icon: typeof ImageDown; label: string; value: DesignExportFormat }[] = [
    { description: 'Transparent image', icon: ImageDown, label: 'PNG', value: 'png' },
    { description: 'Smaller image', icon: FileImage, label: 'JPG', value: 'jpg' },
    { description: 'Looping motion', icon: Film, label: 'GIF', value: 'gif' },
    { description: 'Video', icon: Clapperboard, label: 'MP4', value: 'mp4' },
  ];

  return (
    <div className='shader-export-workspace' aria-busy={disabled}>
      <div className='shader-export-format' aria-label='Export format'>
        {formats.map((option) => {
          const FormatIcon = option.icon;
          return (
            <button
              aria-pressed={format === option.value}
              disabled={disabled}
              key={option.value}
              onClick={() => onFormatChange(option.value)}
              type='button'
            >
              <FormatIcon aria-hidden='true' />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </button>
          );
        })}
      </div>
      <DesignExportControls
        format={format}
        onChange={onChange}
        ratioOption={ratioOption}
        settings={settings}
      />
    </div>
  );
}

export const ShaderSequenceControls = memo(function ShaderSequenceControls({
  disabled,
  durationMs,
  materialIds,
  onChange,
  onExport,
  onPreview,
  onShuffle,
  previewing,
  settings,
  targetOptions,
}: {
  disabled: boolean;
  durationMs: number;
  materialIds: readonly LiveMaterialId[];
  onChange: (patch: Partial<DesignShaderSequenceSettings>) => void;
  onExport: () => void;
  onPreview: () => void;
  onShuffle: () => void;
  previewing: boolean;
  settings: DesignShaderSequenceSettings;
  targetOptions: readonly { label: string; value: ShaderLayerId }[];
}) {
  const introCount = Math.max(0, materialIds.length - 1);
  const occurrences = new Map<LiveMaterialId, number>();
  const sequenceItems = materialIds.map((materialId) => {
    const occurrence = (occurrences.get(materialId) ?? 0) + 1;
    occurrences.set(materialId, occurrence);
    return { key: `${materialId}:${occurrence}`, materialId };
  });
  return (
    <div className='shader-lab-v2-sequence-builder'>
      <div className='shader-lab-v2-sequence-summary'>
        <span><Clapperboard aria-hidden='true' /><strong>Shader cuts</strong></span>
        <code>{(durationMs / 1_000).toFixed(1)}s</code>
      </div>
      <p>Keep the composition locked while one background runs through {introCount} cuts and lands on its current shader.</p>
      <div className='shader-lab-v2-sequence-strip studio-scroll-area' aria-label='Shader cut sequence' role='list'>
        {sequenceItems.map(({ key, materialId }, index) => {
          const material = getLiveMaterial(materialId);
          const final = index === materialIds.length - 1;
          return (
            <StudioPreviewTooltip
              description={final
                ? `The sequence lands on ${material.name} and holds for ${(settings.finalHoldMs / 1_000).toFixed(1)} seconds.`
                : `${material.name} appears as cut ${index + 1} in the ${settings.pace} shader progression.`}
              eyebrow={final ? 'Final hold' : `Shader cut ${String(index + 1).padStart(2, '0')}`}
              key={key}
              meta={`${index + 1} of ${materialIds.length} · ${settings.pace} pacing`}
              preview={<img alt='' src={shaderPreviewAssetPath(materialId)} />}
              title={material.name}
            >
              <span aria-label={`${index + 1}. ${material.name}${final ? ', final hold' : ''}`} data-final={final ? 'true' : 'false'} role='listitem' tabIndex={0}>
                <img alt='' src={shaderPreviewAssetPath(materialId)} />
                <i>{final ? 'Hold' : String(index + 1).padStart(2, '0')}</i>
              </span>
            </StudioPreviewTooltip>
          );
        })}
      </div>
      <label className='shader-lab-v2-sequence-field'>
        <span>Background layer</span>
        <StudioSelect
          ariaLabel='Shader sequence background layer'
          disabled={targetOptions.length === 0}
          onValueChange={(value) => onChange({ targetLayerId: value as ShaderLayerId })}
          options={targetOptions}
          value={settings.targetLayerId ?? targetOptions[0]?.value ?? ''}
        />
      </label>
      <div className='shader-lab-v2-export-motion'>
        <label>
          <span><Film aria-hidden='true' />Cuts</span>
          <StudioSelect
            ariaLabel='Shader sequence cut count'
            onValueChange={(value) => onChange({ cutCount: Number(value) })}
            options={[8, 9, 10, 11, 12].map((count) => ({ label: `${count} shaders`, value: String(count) }))}
            value={String(settings.cutCount)}
          />
        </label>
        <label>
          <span><Clock3 aria-hidden='true' />Final hold</span>
          <StudioSelect
            ariaLabel='Shader sequence final hold'
            onValueChange={(value) => onChange({ finalHoldMs: Number(value) })}
            options={[3_000, 4_000, 5_000, 6_000].map((holdMs) => ({ label: `${holdMs / 1_000} seconds`, value: String(holdMs) }))}
            value={String(settings.finalHoldMs)}
          />
        </label>
      </div>
      <div className='shader-lab-v2-sequence-pace' aria-label='Shader cut pacing'>
        {([
          { label: 'Accelerating', value: 'accelerating' },
          { label: 'Even', value: 'even' },
        ] as const).map((option) => (
          <button aria-pressed={settings.pace === option.value} key={option.value} onClick={() => onChange({ pace: option.value })} type='button'>{option.label}</button>
        ))}
      </div>
      <div className='shader-lab-v2-sequence-actions'>
        <button disabled={disabled || targetOptions.length === 0} onClick={onShuffle} type='button'>
          <Repeat2 aria-hidden='true' />
          <span>New cuts</span>
        </button>
        <button disabled={disabled || targetOptions.length === 0} onClick={onPreview} type='button'>
          {previewing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          <span>{previewing ? 'Stop preview' : 'Preview cuts'}</span>
        </button>
        <button disabled={disabled || targetOptions.length === 0} onClick={onExport} type='button'>
          <Download aria-hidden='true' />
          <span>Export MP4</span>
        </button>
      </div>
    </div>
  );
});

export type DesignLabHeaderActions = {
  applyCompositionSource: (source: string) => Promise<void>;
  dismissExportError: () => void;
  exportPng: () => void;
  openSource: () => void;
  prepareProjectFile: ProjectFileControlsProps['prepare'];
  previewExportFormat: (format: DesignExportFormat) => void;
  refreshExportPreview: () => void;
  updateExportSettings: (patch: Partial<DesignExportSettings>) => void;
};

/** Design Lab title bar: saving, project files, export size and export. */
export const DesignLabHeader = memo(function DesignLabHeader({
  actions,
  currentExportSettingsSignature,
  exportError,
  exporting,
  frameCapturePending,
  lastExport,
  lastExportFormat,
  navigation,
  normalizedExportSettings,
  previewNeedsRefresh,
  ratioOption,
  sourceAvailable,
  title,
  toolId,
}: {
  actions: DesignLabHeaderActions;
  currentExportSettingsSignature: string;
  exportError: string | null;
  exporting: DesignExportFormat | null;
  frameCapturePending: boolean;
  lastExport: ExportPreviewAsset | null;
  lastExportFormat: DesignExportFormat | null;
  navigation?: ReactNode;
  normalizedExportSettings: DesignExportSettings;
  previewNeedsRefresh: boolean;
  ratioOption: DesignRatioOption;
  sourceAvailable: boolean;
  title: string;
  toolId: StudioToolId;
}) {
  const { applyCompositionSource, prepareProjectFile, previewExportFormat, refreshExportPreview, updateExportSettings } = actions;
  return (
    <StudioToolHeader
      layout='balanced'
      actions={(
        <>
          <StudioToolbarGroup label='Design saving and versions'>
            <DesignVersionHeaderControls />
          </StudioToolbarGroup>
          <StudioToolbarGroup label='Project files, code, and export'>
            <StudioFileMenu sourceDisabled={!sourceAvailable} onSource={actions.openSource}
              project={{ disabled: Boolean(exporting) || frameCapturePending, open: applyCompositionSource, prepare: prepareProjectFile }} />
          <StudioSelect
            ariaLabel='Export size preset'
            className='studio-export-preset'
            disabled={Boolean(exporting) || frameCapturePending}
            leadingIcon={<Frame aria-hidden='true' />}
            onValueChange={(value) => updateExportSettings({ width: Number(value) })}
            options={[
              ...EXPORT_WIDTH_PRESETS.map(({ label, width }) => ({
                label, value: String(width),
              })),
              ...(!EXPORT_WIDTH_PRESETS.some(({ width }) => width === normalizedExportSettings.width)
                ? [{ label: 'Custom', value: String(normalizedExportSettings.width) }]
                : []),
            ]}
            value={String(normalizedExportSettings.width)}
          />
          {lastExport ? (
            <ExportPreview
              asset={lastExport}
              configuration={(
                <DesignExportWorkspace
                  disabled={Boolean(exporting)}
                  format={exporting ?? lastExportFormat ?? 'png'}
                  onChange={updateExportSettings}
                  onFormatChange={previewExportFormat}
                  ratioOption={ratioOption}
                  settings={normalizedExportSettings}
                />
              )}
              needsRefresh={previewNeedsRefresh}
              projectFile={{ prepare: prepareProjectFile, open: applyCompositionSource, disabled: Boolean(exporting) || frameCapturePending }}
              onRefresh={refreshExportPreview}
              refreshKey={currentExportSettingsSignature}
              refreshing={Boolean(exporting)}
              triggerLabel='Export'
            />
          ) : (
            <Button aria-label='Open export settings' disabled={Boolean(exporting)} loading={exporting === 'png'} onClick={actions.exportPng} type='button'>
              <Download aria-hidden='true' /><span className='responsive-toolbar-label'>Export</span>
            </Button>
          )}
          <StudioErrorNotice error={exportError} onDismiss={actions.dismissExportError} title='Design action failed' />
          </StudioToolbarGroup>
        </>
      )}
      navigation={navigation}
      navigationLabel='Design Lab view'
      title={title}
      toolId={toolId}
    />
  );
});

export type DesignLabArtboardToolbarActions = {
  addArtboard: (duplicate: boolean) => void;
  editLooseCanvas: () => void;
  frameCanvasSelection: () => void;
  removeActiveArtboard: () => void;
  renameActiveArtboard: (name: string) => void;
  selectArtboardFromPicker: (id: string) => void;
  toggleWorkspaceTour: () => void;
  updateActiveArtboardDimensions: (dimensions: StudioArtboardDimensions) => void;
};

/** Artboard picker, size, add, duplicate and delete above the canvas. */
export const DesignLabArtboardToolbar = memo(function DesignLabArtboardToolbar({
  actions,
  activeArtboardId,
  artboards,
  canFrameSelection,
  canvasDimensions,
  editingCanvas,
  summary,
  workspaceTourOpen,
}: {
  actions: DesignLabArtboardToolbarActions;
  activeArtboardId: string;
  artboards: readonly { id: string; name: string }[];
  canFrameSelection: boolean;
  canvasDimensions: StudioArtboardDimensions;
  editingCanvas: boolean;
  summary: string;
  workspaceTourOpen: boolean;
}) {
  const { selectArtboardFromPicker, updateActiveArtboardDimensions } = actions;
  return (
    <StudioArtboardBar
      activeArtboardId={activeArtboardId}
      addLabel='Add blank artboard'
      ariaLabel='Artboard workspace controls'
      artboards={artboards}
      className='design-lab-artboard-bar'
      dimensions={canvasDimensions}
      unframed={editingCanvas}
      duplicateLabel='Duplicate active artboard'
      extraActions={(
        <>
          {canFrameSelection ? <Button aria-label='Create artboard from selection' onClick={actions.frameCanvasSelection} size='sm' type='button' variant='outline'><Frame aria-hidden='true' /><span>Frame selection</span></Button> : null}
          <Button aria-label='Edit loose canvas layers' aria-pressed={editingCanvas} onClick={actions.editLooseCanvas} size='sm' title='Add ideas anywhere outside your artboards' type='button' variant='ghost'><Move aria-hidden='true' /><span>Canvas</span></Button>
          <Button aria-label='Artboard tutorial' aria-pressed={workspaceTourOpen} onClick={actions.toggleWorkspaceTour} size='icon-sm' title='Artboard tutorial' type='button' variant='ghost'><Info aria-hidden='true' /></Button>
        </>
      )}
      onAdd={() => actions.addArtboard(false)}
      onDimensionsChange={updateActiveArtboardDimensions}
      onDuplicate={() => actions.addArtboard(true)}
      onRemove={actions.removeActiveArtboard}
      onRename={actions.renameActiveArtboard}
      onSelect={(id) => selectArtboardFromPicker(id as DesignArtboardId)}
      removeLabel='Delete active artboard'
      selectLabel='Active design artboard'
      summary={<span aria-live='polite'>{summary}</span>}
    />
  );
});

export const DESIGN_LAB_PREVIEW_QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'High', value: 'high' },
  { label: 'Draft', value: 'low' },
] as const;

/** Auto / High / Draft live shader preview resolution. Exports ignore it. */
export const DesignLabPreviewQualityToggle = memo(function DesignLabPreviewQualityToggle({
  automaticallyReduced,
  mode,
  quality,
}: {
  automaticallyReduced: boolean;
  mode: string;
  quality: string;
}) {
  const index = DESIGN_LAB_PREVIEW_QUALITY_OPTIONS.findIndex(({ value }) => value === mode);
  const current = DESIGN_LAB_PREVIEW_QUALITY_OPTIONS[Math.max(0, index)]!;
  const next = DESIGN_LAB_PREVIEW_QUALITY_OPTIONS[(index + 1) % DESIGN_LAB_PREVIEW_QUALITY_OPTIONS.length]!;
  const detail = automaticallyReduced ? 'Auto lowered resolution after slow frames.' : 'Exports always render at full size.';
  return (
    <Button
      aria-label='Live shader preview quality'
      className='gap-1 px-2 text-xs'
      data-preview-quality={quality}
      onClick={() => studioRenderQualityStore.setMode(next.value)}
      size='sm'
      title={`Preview quality: ${current.label}. ${detail} Click for ${next.label}.`}
      type='button'
      variant='ghost'
    >
      <Gauge aria-hidden='true' />
      <span>{current.label}</span>
    </Button>
  );
});

export type DesignLabMotionStripActions = {
  beginShaderTimeScrub: () => void;
  closeMotionWorkspace: () => void;
  exportShaderSequence: () => void;
  freezeCurrentShaderFrame: () => void;
  previewShaderSequence: () => void;
  previewTime: (timeMs: number) => void;
  rememberLiveTime: (timeMs: number) => void;
  saveCurrentShaderFrame: () => void;
  seekShaderTime: (timeMs: number) => void;
  playShaderHistory: () => void;
  shuffleShaderSequence: () => void;
  toggleMotionWorkspace: () => void;
  updateShaderSequenceSettings: (patch: Partial<DesignShaderSequenceSettings>) => void;
};

/** Shader time explorer, shader sequence workspace and the Animation link. */
export const DesignLabMotionStrip = memo(function DesignLabMotionStrip({
  actions,
  busy,
  canSeek,
  capabilities,
  exporting,
  motionWorkspaceOpen,
  playing,
  sequenceDurationMs,
  sequenceMaterialIds,
  sequencePreviewing,
  sequenceSettings,
  sequenceTargetOptions,
  timeMs,
}: {
  actions: DesignLabMotionStripActions;
  busy: boolean;
  canSeek: boolean;
  capabilities?: ShaderMotionCapabilities;
  exporting: boolean;
  motionWorkspaceOpen: boolean;
  playing: boolean;
  sequenceDurationMs: number;
  sequenceMaterialIds: readonly LiveMaterialId[];
  sequencePreviewing: boolean;
  sequenceSettings: DesignShaderSequenceSettings;
  sequenceTargetOptions: readonly { label: string; value: ShaderLayerId }[];
  timeMs: number;
}) {
  return (
    <>
      <div className='design-motion-strip' data-canvas-selection-preserve>
        <ShaderTimeExplorer
          timeMs={timeMs}
          busy={busy}
          canSeek={canSeek}
          capabilities={capabilities}
          onLiveTime={actions.rememberLiveTime}
          onFreeze={actions.freezeCurrentShaderFrame}
          onCapture={actions.saveCurrentShaderFrame}
          onPlay={actions.playShaderHistory}
          onTimeChange={actions.seekShaderTime}
          onScrubStart={actions.beginShaderTimeScrub}
          onTimePreview={actions.previewTime}
          playing={playing}
        />
        <button aria-expanded={motionWorkspaceOpen} aria-label='Shader sequence' onClick={actions.toggleMotionWorkspace} title='Shader sequence' type='button'><Clapperboard aria-hidden='true' /><span>Shader sequence</span></button>
        <a aria-label='Open Animation Studio' href='/studio?tool=animation' title='Open Animation Studio'><ExternalLink aria-hidden='true' /><span>Animation</span></a>
      </div>
      {motionWorkspaceOpen ? (
        <aside className='design-motion-workspace' data-canvas-selection-preserve>
          <header><span><Clapperboard aria-hidden='true' /><strong>Shader sequence</strong></span><button aria-label='Close shader sequence' onClick={actions.closeMotionWorkspace} type='button'><X aria-hidden='true' /></button></header>
          <p>Build and preview a cut sequence for this artboard. Animation Studio opens a separate workspace for keyframe animation.</p>
          <ShaderSequenceControls
            disabled={exporting}
            durationMs={sequenceDurationMs}
            materialIds={sequenceMaterialIds}
            onChange={actions.updateShaderSequenceSettings}
            onExport={actions.exportShaderSequence}
            onPreview={actions.previewShaderSequence}
            onShuffle={actions.shuffleShaderSequence}
            previewing={sequencePreviewing}
            settings={sequenceSettings}
            targetOptions={sequenceTargetOptions}
          />
          <a href='/studio?tool=animation'><ExternalLink aria-hidden='true' />Open Animation Studio</a>
        </aside>
      ) : null}
    </>
  );
});
