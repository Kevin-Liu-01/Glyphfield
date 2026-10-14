'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import {
  BookOpenText,
  Bot,
  Check,
  Download,
  Files,
  Layers3,
  MessageSquareText,
  Package,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Type,
} from '@/components/ui/SolidIcons';

import BrandIdentityAgentPanel from '@/components/BrandIdentityAgentPanel';
import {
  AssetsSection,
  ColorSection,
  DirectionSection,
  StrategyVoiceSection,
  SystemSection,
  TypographySection,
} from '@/components/BrandIdentityEditors';
import BrandIdentityFrontPage, { type BrandIdentitySectionId } from '@/components/BrandIdentityFrontPage';
import BrandIdentityHealthPanel from '@/components/BrandIdentityHealthPanel';
import BrandIdentityKitPanel from '@/components/BrandIdentityKitPanel';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import StudioFileMenu from '@/components/StudioFileMenu';
import StudioToolHeader from '@/components/StudioToolHeader';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { brandAgentSetupPrompt, brandProjectUrl, brandSetupMode } from '@/lib/brandAgentSetup';
import { applyBrandHealthFix, auditBrandHealth } from '@/lib/brandHealth';
import {
  isEditedBuiltInIdentity,
  renameBrandIdentity,
  restoreBuiltInBrandIdentity,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { brandProjectHost, parseBrandProjectCreateInput, prepareBrandProject } from '@/lib/brandProjectHost';
import {
  addBrandAssetFromFile,
  addBrandFontFromFile,
  applyBrandIdentityInput,
  createBrandKitArtifact,
  parseBrandApplyInput,
} from '@/lib/brandIdentityActions';
import { BRAND_KIT_FORMATS, type BrandKitFormat } from '@/lib/brandKit';
import { applyBrandIdentitySource, BrandSourceValidationError, validateBrandIdentitySource, type BrandLogoSlot } from '@/lib/brandSource';
import { copyTextToClipboard } from '@/lib/clipboard';
import { downloadBlob } from '@/lib/download';
import { parseSourceObject, stringifySource } from '@/lib/sourceCode';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { registerStudioAutomation } from '@/lib/studioAutomation';

import styles from './BrandIdentityStudio.module.css';

const SECTIONS: readonly { group: 'brand' | 'edit'; icon: typeof Layers3; id: BrandIdentitySectionId; label: string }[] = [
  { group: 'brand', icon: Layers3, id: 'overview', label: 'Overview' },
  { group: 'brand', icon: Bot, id: 'agent', label: 'Set up with agent' },
  { group: 'brand', icon: ShieldCheck, id: 'health', label: 'Brand health' },
  { group: 'brand', icon: Package, id: 'kit', label: 'Brand kit' },
  { group: 'edit', icon: MessageSquareText, id: 'strategy', label: 'Voice & strategy' },
  { group: 'edit', icon: Files, id: 'assets', label: 'Logos & assets' },
  { group: 'edit', icon: Palette, id: 'colors', label: 'Color system' },
  { group: 'edit', icon: Type, id: 'typography', label: 'Typography' },
  { group: 'edit', icon: SlidersHorizontal, id: 'system', label: 'System defaults' },
  { group: 'edit', icon: BookOpenText, id: 'direction', label: 'Direction & references' },
];

function identityExport(identity: BrandIdentity): ExportPreviewAsset {
  const previewText = JSON.stringify(identity, null, 2);
  return {
    blob: new Blob([previewText], { type: 'application/json' }),
    fileName: `${identity.id}-brand-identity.json`,
    format: 'JSON',
    previewText,
  };
}

function kitPreviewAsset(format: BrandKitFormat, artifact: { blob: Blob; fileName: string; previewText?: string }): ExportPreviewAsset {
  return {
    ...artifact,
    description: format === 'zip' ? 'Brand kit archive' : undefined,
    format: format === 'dtcg' ? 'JSON' : 'FILE',
    previewKind: artifact.previewText === undefined ? 'file' : 'text',
  };
}

function waitForCommit(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Resolve once the new project's Brand identity workspace owns window.glyphfield.studio. */
async function waitForActiveIdentityProject(id: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await waitForCommit();
    try {
      const studio = window.glyphfield?.studio;
      if (studio?.activeTool() === 'identity' && (JSON.parse(studio.readSource()) as { id?: unknown }).id === id) return;
    } catch {
      // The new workspace is still mounting.
    }
  }
  throw new Error(`Project ${id} was created but its Brand identity workspace did not open in time; read window.glyphfield.studio again.`);
}

function inputObject(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function studioOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost:3012' : window.location.origin;
}

type IdentityActionHost = {
  addAsset: (input: unknown) => Promise<unknown>;
  createProject: (input: unknown) => Promise<unknown>;
  addFont: (input: unknown) => Promise<unknown>;
  apply: (input: unknown) => Promise<unknown>;
  current: () => BrandIdentity;
  exportJson: () => ExportPreviewAsset;
  exportKit: (format: BrandKitFormat, download: boolean) => Promise<ExportPreviewAsset>;
  fix: (input: unknown) => Promise<unknown>;
  save: () => Promise<{ saved: true }>;
};

function kitFormat(input: unknown): BrandKitFormat {
  const format = inputObject(input).format ?? 'zip';
  if (typeof format !== 'string' || !(BRAND_KIT_FORMATS as readonly string[]).includes(format)) {
    throw new TypeError(`identity.export.kit format must be one of ${BRAND_KIT_FORMATS.join(', ')}.`);
  }
  return format as BrandKitFormat;
}

/** Browser API dispatch for the Brand identity tool; unknown names throw RangeError. */
function invokeIdentityAction(action: string, input: unknown, host: IdentityActionHost): unknown {
  switch (action) {
    case 'identity.export.json': return host.exportJson();
    case 'identity.read': return JSON.parse(JSON.stringify(host.current())) as BrandIdentity;
    case 'identity.validate': {
      const { identity, mode } = inputObject(input);
      if (identity === undefined) throw new TypeError('identity.validate requires { identity, mode? }.');
      if (mode === 'full') return validateBrandIdentitySource(identity, 'full');
      // A patch is checked against the active identity exactly as identity.apply merges it,
      // so references that only break after the merge are reported here too.
      try {
        return { issues: applyBrandIdentitySource(host.current(), identity).warnings, ok: true };
      } catch (error) {
        if (error instanceof BrandSourceValidationError) return { issues: error.issues, ok: false };
        throw error;
      }
    }
    case 'identity.apply': return host.apply(input);
    case 'identity.asset.add': return host.addAsset(input);
    case 'identity.font.add': return host.addFont(input);
    case 'identity.audit': return auditBrandHealth(host.current());
    case 'identity.fix': return host.fix(input);
    case 'identity.save': return host.save();
    case 'identity.export.kit': return host.exportKit(kitFormat(input), inputObject(input).download === true);
    case 'identity.project.create': return host.createProject(input);
    case 'identity.setup.prompt': {
      const identity = host.current();
      const requested = inputObject(input).mode;
      const mode = requested === 'new' || requested === 'improve' ? requested : brandSetupMode(identity);
      return { mode, prompt: brandAgentSetupPrompt({ identity, mode, origin: studioOrigin(), report: auditBrandHealth(identity) }) };
    }
    default: throw new RangeError(`Unknown Brand identity action: ${action}.`);
  }
}

function SectionNav({ active, healthScore, onSelect }: { active: BrandIdentitySectionId; healthScore: number; onSelect: (id: BrandIdentitySectionId) => void }) {
  const gt = useGT();
  return (
    <nav aria-label={gt('Brand identity sections')} className='app-navbar brand-identity-nav'>
      {(['brand', 'edit'] as const).map((group) => (
        <div className={styles.navGroup} key={group}>
          <div className='brand-identity-nav-title'>{group === 'brand' ? <T>Brand</T> : <T>Edit identity</T>}</div>
          {SECTIONS.filter((section) => section.group === group).map((section) => {
            const Icon = section.icon;
            return (
              <button aria-current={active === section.id ? 'page' : undefined} key={section.id} onClick={() => onSelect(section.id)} type='button'>
                <Icon aria-hidden='true' />
                <span>{gt(section.label)}</span>
                {section.id === 'health' ? <small className={styles.navBadge}>{healthScore}</small> : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function BrandSettingsStudio({
  hasPendingChanges,
  identity,
  onChange,
  onSave,
  tool,
}: {
  hasPendingChanges: boolean;
  identity: BrandIdentity;
  onChange: (identity: BrandIdentity) => void;
  onSave?: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const gt = useGT();
  const studioRootRef = useRef<HTMLDivElement>(null);
  const pendingIdentityRef = useRef<BrandIdentity | null>(null);
  const [activeSection, setActiveSection] = useState<BrandIdentitySectionId>('overview');
  const [assetType, setAssetType] = useState<BrandAsset['type']>('image');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [kitBusy, setKitBusy] = useState<BrandKitFormat | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const report = useMemo(() => auditBrandHealth(identity), [identity]);
  const edited = useMemo(() => isEditedBuiltInIdentity(identity), [identity]);
  const identityRef = useCommittedRef(identity);
  const onChangeRef = useCommittedRef(onChange);
  const onSaveRef = useCommittedRef(onSave);

  // The prop catches up with a committed change; later reads use it again.
  useEffect(() => {
    pendingIdentityRef.current = null;
  }, [identity]);

  function current(): BrandIdentity {
    return pendingIdentityRef.current ?? identityRef.current;
  }

  function commit(next: BrandIdentity) {
    pendingIdentityRef.current = next;
    onChangeRef.current(next);
  }

  function update(patch: Partial<BrandIdentity>) {
    commit({ ...current(), ...patch });
  }

  async function save(): Promise<{ saved: true }> {
    const save = onSaveRef.current;
    if (!save) throw new Error('Saving is unavailable here; use the Save changes notice.');
    save(current());
    await waitForCommit();
    return { saved: true };
  }

  async function settle(saveAfter: unknown) {
    if (saveAfter === true) await save();
    else await waitForCommit();
  }

  function applySource(source: string) {
    commit(applyBrandIdentitySource(current(), parseSourceObject(source), { mode: 'replace' }).identity);
  }

  async function addAsset(input: unknown) {
    const result = await addBrandAssetFromFile(current(), input);
    commit(result.identity);
    await settle(inputObject(input).save);
    return { asset: result.asset };
  }

  async function addFont(input: unknown) {
    const result = await addBrandFontFromFile(current(), input);
    commit(result.identity);
    await settle(inputObject(input).save);
    return { font: result.font };
  }

  async function apply(input: unknown) {
    const parsed = parseBrandApplyInput(input);
    const result = applyBrandIdentityInput(current(), parsed);
    commit(result.identity);
    await settle(parsed.save);
    const health = auditBrandHealth(result.identity);
    return {
      health: { counts: health.counts, grade: health.grade, score: health.score },
      identity: JSON.parse(JSON.stringify(result.identity)) as BrandIdentity,
      saved: parsed.save === true,
      warnings: result.warnings,
    };
  }

  async function fix(input: unknown) {
    const { fixId, save: saveAfter } = inputObject(input);
    if (typeof fixId !== 'string') throw new TypeError('identity.fix requires { fixId } from an identity.audit finding.');
    commit(applyBrandHealthFix(current(), fixId));
    await settle(saveAfter);
    return auditBrandHealth(current());
  }

  function exportJson() {
    const asset = identityExport(current());
    setLastExport(asset);
    return asset;
  }

  async function exportKit(format: BrandKitFormat, download: boolean): Promise<ExportPreviewAsset> {
    setKitBusy(format);
    try {
      // The Brand kit section previews its files itself; no export overlay.
      const asset = kitPreviewAsset(format, await createBrandKitArtifact(current(), format));
      if (download) downloadBlob(asset.blob, asset.fileName);
      return asset;
    } finally {
      setKitBusy(null);
    }
  }

  function notify(message: string) {
    setFeedback(message);
  }

  function failure(error: unknown, fallback: string) {
    notify(error instanceof Error ? error.message : gt(fallback));
  }

  async function createProject(input: unknown) {
    const host = brandProjectHost();
    if (!host) throw new Error('identity.project.create needs the Glyphfield Studio; open /studio.');
    const parsed = parseBrandProjectCreateInput(input);
    const identities = host.identities();
    const prepared = prepareBrandProject(parsed, identities);
    let created = prepared.source === 'project'
      ? await host.duplicate(prepared.target, identities.map(({ name }) => name))
      : prepared.identity;
    if (prepared.source === 'project' && parsed.name) created = renameBrandIdentity(created, parsed.name);
    host.activate(created);
    await waitForActiveIdentityProject(created.id);
    return { from: parsed.from, id: created.id, kind: created.kind, name: created.name, url: brandProjectUrl(created, studioOrigin()) };
  }

  const automationRef = useCommittedRef<IdentityActionHost & { applySource: (source: string) => void }>({
    addAsset, addFont, apply, applySource, createProject, current, exportJson, exportKit, fix, save,
  });
  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('identity'),
    applySource: (source) => automationRef.current.applySource(source),
    getSource: () => stringifySource(automationRef.current.current()),
    invoke: (action, input) => invokeIdentityAction(action, input, automationRef.current),
    toolId: 'identity',
  }, studioRootRef.current), [automationRef]);

  function copy(text: string, confirmation: string) {
    void copyTextToClipboard(text).then(() => notify(confirmation), (error: unknown) => failure(error, 'Copy failed.'));
  }

  function addLogo(file: File, slot: BrandLogoSlot) {
    addAsset({ file, slot }).then(() => notify(gt('Logo saved to its slot.')), (error: unknown) => failure(error, 'That logo could not be loaded.'));
  }

  function uploadAsset(file: File) {
    addAsset({ file, type: assetType }).then(() => notify(gt('Asset added to the shared library.')), (error: unknown) => failure(error, 'That asset could not be loaded.'));
  }

  function uploadFont(file: File) {
    addFont({ file }).then(() => notify(gt('Font added. Assign it to any typography role below.')), (error: unknown) => failure(error, 'That font file could not be loaded.'));
  }

  function runFix(fixId: string) {
    try {
      commit(applyBrandHealthFix(current(), fixId));
      notify(gt('Fix applied. Save changes to keep it.'));
    } catch (error) {
      failure(error, 'That fix could not be applied.');
    }
  }

  function downloadKit(format: BrandKitFormat) {
    exportKit(format, true).catch((error: unknown) => failure(error, 'The brand kit could not be exported.'));
  }

  function restore() {
    const shipped = restoreBuiltInBrandIdentity(identity.id);
    if (shipped) commit(shipped);
  }

  function renderSection() {
    switch (activeSection) {
      case 'agent': return <BrandIdentityAgentPanel identity={identity} onCopy={copy} origin={studioOrigin()} report={report} />;
      case 'health': return <BrandIdentityHealthPanel onCopy={copy} onFix={runFix} onNavigate={setActiveSection} report={report} />;
      case 'kit': return <BrandIdentityKitPanel busyFormat={kitBusy} identity={identity} onCopy={copy} onExport={downloadKit} />;
      case 'strategy': return <StrategyVoiceSection identity={identity} update={update} />;
      case 'assets': return <AssetsSection assetType={assetType} identity={identity} onAddAsset={uploadAsset} onAddLogo={addLogo} setAssetType={setAssetType} update={update} />;
      case 'colors': return <ColorSection identity={identity} update={update} />;
      case 'typography': return <TypographySection identity={identity} onAddFont={uploadFont} update={update} />;
      case 'system': return <SystemSection identity={identity} update={update} />;
      case 'direction': return <DirectionSection identity={identity} update={update} />;
      default: return <BrandIdentityFrontPage edited={edited} identity={identity} onExportKit={() => downloadKit('zip')} onNavigate={setActiveSection} onOpenSource={() => setSourceOpen(true)} onRestore={restore} report={report} update={update} />;
    }
  }

  return (
    <div className='tool-shell brand-identity-shell h-full min-h-0' ref={studioRootRef}>
      <StudioToolHeader
        actions={(
          <>
            <StudioFileMenu onSource={() => setSourceOpen(true)} />
            <ExportPreview asset={lastExport} />
            <Button onClick={exportJson} size='sm' type='button' variant='outline'><Download aria-hidden='true' /><T>Identity JSON</T></Button>
          </>
        )}
        metadata={identity.name}
        status={(
          <span className='brand-identity-save-status' data-pending={hasPendingChanges ? 'true' : 'false'}>
            {hasPendingChanges ? <Save aria-hidden='true' /> : <Check aria-hidden='true' />}
            {hasPendingChanges ? <T>Changes pending</T> : <T>Saved locally</T>}
          </span>
        )}
        title={gt(tool.name)}
        toolId={tool.id}
      />

      <div className='brand-identity-body'>
        <StudioSidebar className='brand-identity-sidebar' kind='navigation' label={gt('Brand identity sections')} storageKey={`brand-identity-${identity.id}`}>
          <SectionNav active={activeSection} healthScore={report.score} onSelect={setActiveSection} />
        </StudioSidebar>

        <main className={`brand-identity-content ${styles.content}`} data-identity={identity.id} data-section={activeSection}>
          {activeSection === 'overview' ? null : (
            <header className={styles.sectionMasthead}>
              <ThemeAwareBrandMark className={styles.mastheadMark} identity={identity} />
              <h1>{gt(SECTIONS.find(({ id }) => id === activeSection)?.label ?? 'Overview')}</h1>
            </header>
          )}
          {feedback ? <div className={styles.feedback} role='status'>{feedback}<button aria-label={gt('Dismiss message')} onClick={() => setFeedback(null)} type='button'>×</button></div> : null}
          {renderSection()}
        </main>
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · complete brand identity'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={stringifySource(identity)}
          title={`${identity.name} identity source`}
        />
      ) : null}
    </div>
  );
}
