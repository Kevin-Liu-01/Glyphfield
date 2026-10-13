'use client';

import { useMemo, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasArtboard from '@/components/CanvasArtboard';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  ControlSection,
  Field,
  RangeField,
} from '@/components/tools/ToolFields';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  canvasElementAssetSource,
  canvasRevisionFromSignature,
  isCanvasDocumentEnvelope,
} from '@/lib/canvasDocument';
import { CODE_THEME, type CodeLanguage } from '@/lib/codeHighlight';
import { resolveSvgRasterDimensions, svgToPngBlob } from '@/lib/download';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import {
  createStudioCanvasDocument,
  parseStudioCanvasDocument,
} from '@/lib/studioCanvasDocument';
import {
  STUDIO_ARTIFACT_FRAME_CLASS,
  STUDIO_ARTIFACT_PLANE_CLASS,
  STUDIO_ARTIFACT_STAGE_CLASS,
} from '@/lib/studioCanvasPresentation';
import { buildTerminalSvg } from '@/lib/terminalSvg';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import { parseSourceObject, sourceNumber, sourceObject, sourceString } from '@/lib/sourceCode';

const CODE_SAMPLES = {
  bash: `$ gt translate --locales es,ja,ar\n✓ 42 strings translated\n✓ 3 locale files written`,
  python: `from gt import translate\n\nresult = translate(\n    "Hello, world",\n    locales=["es", "ja", "ar"],\n)`,
  typescript: `import { tx } from 'gt-next';\n\nexport function Greeting() {\n  return <h1>{tx('Hello, world')}</h1>;\n}`,
} as const;

function TerminalTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:terminal`);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const [language, setLanguage] = useStudioDraft<CodeLanguage>(identity.id, tool.id, 'language', 'typescript');
  const [code, setCode] = useStudioDraft<string>(
    identity.id,
    tool.id,
    'code',
    CODE_SAMPLES.typescript
  );
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    identity.voice.phrases[0] ?? identity.tagline
  );
  const [titleFontRole, setTitleFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'title-font-role', 'Display');
  const [titleFontWeight, setTitleFontWeight] = useStudioDraft(identity.id, tool.id, 'title-font-weight', brandTypographyRole(identity, 'Display').weight ?? MAX_VISIBLE_FONT_WEIGHT);
  const [codeFontRole, setCodeFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'code-font-role', 'Code');
  const [codeFontWeight, setCodeFontWeight] = useStudioDraft(identity.id, tool.id, 'code-font-weight', brandTypographyRole(identity, 'Code').weight ?? 450);
  const terminalAssets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf'));
  const [terminalAssetId, setTerminalAssetId] = useStudioDraft(
    identity.id,
    tool.id,
    'background-asset-id-v2',
    'none'
  );
  const [terminalAssetOpacity, setTerminalAssetOpacity] = useStudioDraft(identity.id, tool.id, 'asset-opacity', 14);
  const terminalAsset = terminalAssets.find(({ id }) => id === terminalAssetId);
  const titleTypography = brandTypographyRole(identity, titleFontRole);
  const codeTypography = brandTypographyRole(identity, codeFontRole);
  const titleFont = brandFontAssets(identity).find(({ id }) => id === titleTypography.fontId);
  const codeFont = brandFontAssets(identity).find(({ id }) => id === codeTypography.fontId);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [restoredAssetSources, setRestoredAssetSources] = useState<Record<string, string>>({});
  const terminalState = useMemo(() => ({
    background: { assetId: terminalAssetId, opacity: terminalAssetOpacity },
    code,
    codeTypography: { role: codeFontRole, weight: codeFontWeight },
    language,
    title,
    titleTypography: { role: titleFontRole, weight: titleFontWeight },
  }), [
    code,
    codeFontRole,
    codeFontWeight,
    language,
    terminalAssetId,
    terminalAssetOpacity,
    title,
    titleFontRole,
    titleFontWeight,
  ]);
  const terminalRevision = useMemo(() => JSON.stringify(terminalState), [terminalState]);
  const terminalDocument = useMemo(() => createStudioCanvasDocument({
    background: CODE_THEME.background,
    brandId: identity.id,
    createdAt: documentCreatedAt,
    height: 630,
    id: `${identity.id}:${tool.id}:terminal`,
    layers: [
      ...(terminalAsset || restoredAssetSources.background ? [{
        asset: {
          name: terminalAsset?.label ?? 'Imported terminal background',
          source: restoredAssetSources.background ?? terminalAsset!.path,
        },
        bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 },
        id: 'terminal-background',
        kind: 'image' as const,
        name: 'Background image',
        opacity: terminalAssetOpacity / 100,
      }] : []),
      {
        bounds: { height: 56, rotation: 0, width: 1056, x: 72, y: 48 },
        content: title,
        id: 'terminal-title',
        kind: 'text' as const,
        name: 'Card title',
      },
      {
        bounds: { height: 388, rotation: 0, width: 1056, x: 72, y: 174 },
        content: code,
        id: 'terminal-code',
        kind: 'text' as const,
        name: 'Source code',
      },
      ...(titleFont || restoredAssetSources.titleFont ? [{
        asset: {
          kind: 'font' as const,
          name: titleFont?.label ?? 'Imported title font',
          source: restoredAssetSources.titleFont ?? titleFont!.path,
        },
        bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
        hidden: true,
        id: 'terminal-title-font',
        kind: 'component' as const,
        name: 'Title font',
      }] : []),
      ...(codeFont || restoredAssetSources.codeFont ? [{
        asset: {
          kind: 'font' as const,
          name: codeFont?.label ?? 'Imported code font',
          source: restoredAssetSources.codeFont ?? codeFont!.path,
        },
        bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
        hidden: true,
        id: 'terminal-code-font',
        kind: 'component' as const,
        name: 'Code font',
      }] : []),
    ],
    revision: canvasRevisionFromSignature(terminalRevision),
    state: terminalState,
    title: `${identity.name} ${tool.name}`,
    toolId: tool.id,
    updatedAt: documentCreatedAt,
    width: 1200,
  }), [
    code,
    codeFont,
    documentCreatedAt,
    identity.id,
    identity.name,
    restoredAssetSources,
    terminalAsset,
    terminalAssetOpacity,
    terminalRevision,
    terminalState,
    title,
    titleFont,
    tool.id,
    tool.name,
  ]);
  const terminalWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const portableTerminal = usePortableCanvasWorkspace({
    applySource: applySourceCode,
    document: terminalDocument,
    workspaceKey: terminalWorkspaceKey,
  });
  const sourceCode = portableTerminal.source;
  const portableTerminalDocument = portableTerminal.document;
  const terminalBackgroundSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-background',
    restoredAssetSources.background ?? terminalAsset?.path ?? null
  );
  const terminalTitleFontSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-title-font',
    restoredAssetSources.titleFont ?? titleFont?.path ?? null
  );
  const terminalCodeFontSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-code-font',
    restoredAssetSources.codeFont ?? codeFont?.path ?? null
  );
  const previewSvg = useMemo(() => buildTerminalSvg({
    assetData: terminalBackgroundSource,
    assetOpacity: terminalAssetOpacity,
    code,
    codeFontData: terminalCodeFontSource,
    codeFontFamily: brandTypographyFamily(identity, codeFontRole),
    codeFontWeight,
    language,
    title,
    titleFontData: terminalTitleFontSource,
    titleFontFamily: brandTypographyFamily(identity, titleFontRole),
    titleFontWeight,
  }), [
    code,
    codeFontRole,
    codeFontWeight,
    identity,
    language,
    terminalAssetOpacity,
    terminalBackgroundSource,
    terminalCodeFontSource,
    terminalTitleFontSource,
    title,
    titleFontRole,
    titleFontWeight,
  ]);
  const terminalAutosaveState = portableTerminal.autosaveState;

  function applySourceCode(source: string) {
    const sourceRoot = parseSourceObject(source);
    const parsed = isCanvasDocumentEnvelope(sourceRoot)
      ? parseStudioCanvasDocument(source, tool.id)
      : null;
    const value = parsed?.state ?? sourceRoot;
    const nextLanguage = sourceString(value, 'language', language);
    if (!Object.hasOwn(CODE_SAMPLES, nextLanguage)) throw new TypeError('language must be typescript, python, or bash.');
    setLanguage(nextLanguage as CodeLanguage);
    setCode(sourceString(value, 'code', code));
    setTitle(sourceString(value, 'title', title));
    const titleType = sourceObject(value, 'titleTypography');
    const codeType = sourceObject(value, 'codeTypography');
    const backgroundConfig = sourceObject(value, 'background');
    if (titleType) {
      setTitleFontRole(sourceString(titleType, 'role', titleFontRole) as BrandTypography['role']);
      setTitleFontWeight(sourceNumber(titleType, 'weight', titleFontWeight));
    }
    if (codeType) {
      setCodeFontRole(sourceString(codeType, 'role', codeFontRole) as BrandTypography['role']);
      setCodeFontWeight(sourceNumber(codeType, 'weight', codeFontWeight));
    }
    if (backgroundConfig) {
      setTerminalAssetId(sourceString(backgroundConfig, 'assetId', terminalAssetId));
      setTerminalAssetOpacity(sourceNumber(backgroundConfig, 'opacity', terminalAssetOpacity));
    }
    if (parsed) {
      setRestoredAssetSources({
        ...(canvasElementAssetSource(parsed.document, 'terminal-background')
          ? { background: canvasElementAssetSource(parsed.document, 'terminal-background')! }
          : {}),
        ...(canvasElementAssetSource(parsed.document, 'terminal-code-font')
          ? { codeFont: canvasElementAssetSource(parsed.document, 'terminal-code-font')! }
          : {}),
        ...(canvasElementAssetSource(parsed.document, 'terminal-title-font')
          ? { titleFont: canvasElementAssetSource(parsed.document, 'terminal-title-font')! }
          : {}),
      });
    }
  }

  function changeLanguage(nextLanguage: CodeLanguage) {
    setLanguage(nextLanguage);
    setCode(CODE_SAMPLES[nextLanguage]);
  }

  async function exportTerminal() {
    if (!portableTerminalDocument) throw new Error('Portable terminal assets are still being prepared.');
    setExporting(true);
    studioExport.start('Rendering terminal PNG preview');
    try {
      const raster = resolveSvgRasterDimensions(1200, 630);
      const blob = await svgToPngBlob(previewSvg, 1200, 630);
      const asset: ExportPreviewAsset = { blob, fileName: 'studio-terminal.png', format: 'PNG', height: raster.height, width: raster.width };
      setLastExport(asset);
      return asset;
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Card title</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        <Field label={<T>Language</T>}>
          <StudioSelect ariaLabel='Language' onValueChange={(value) => changeLanguage(value as CodeLanguage)} options={[
            { label: 'TypeScript', value: 'typescript' },
            { label: 'Python', value: 'python' },
            { label: 'Bash', value: 'bash' },
          ]} value={language} />
        </Field>
      </ControlSection>
      <ControlSection title={<T>Source</T>}>
        <textarea aria-label='Terminal source code' className={`${TEXTAREA_CLASS} min-h-56 font-mono`} onChange={(event) => setCode(event.target.value)} spellCheck={false} value={code} />
      </ControlSection>
      <ControlSection title={<T>Typography</T>}>
        <Field label={<T>Title font</T>}><StudioSelect ariaLabel='Terminal title font' onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredAssetSources((current) => { const { titleFont: _titleFont, ...next } = current; return next; }); setTitleFontRole(role); setTitleFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={titleFontRole} /></Field>
        <RangeField label={<T>Title weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setTitleFontWeight} step={50} value={titleFontWeight} />
        <Field label={<T>Code font</T>}><StudioSelect ariaLabel='Terminal code font' onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredAssetSources((current) => { const { codeFont: _codeFont, ...next } = current; return next; }); setCodeFontRole(role); setCodeFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={codeFontRole} /></Field>
        <RangeField label={<T>Code weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setCodeFontWeight} step={50} value={codeFontWeight} />
      </ControlSection>
      <ControlSection title={<T>Brand asset</T>}>
        <Field label={<T>Card background</T>}><StudioSelect ariaLabel='Terminal card background' onValueChange={(value) => { setRestoredAssetSources((current) => { const { background: _background, ...next } = current; return next; }); setTerminalAssetId(value); }} options={[{ label: 'None', value: 'none' }, ...terminalAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={terminalAsset?.id ?? 'none'} /></Field>
        {terminalAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setTerminalAssetOpacity} value={terminalAssetOpacity} /> : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      automation={{
        actions: studioToolActionNames('terminal'),
        invoke: (action) => {
          if (action === 'terminal.export.png') return exportTerminal();
          throw new RangeError(`Unknown Terminal action: ${action}.`);
        },
      }}
      versions={<DesignVersionControls
            autosaveState={terminalAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(terminalDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />}
      actions={
        <>
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting || !portableTerminalDocument} onClick={exportTerminal} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Terminal source') }}
      tool={tool}
    >
      <CanvasViewport identityId={identity.id} stageClassName={STUDIO_ARTIFACT_STAGE_CLASS} toolId={tool.id}>
        <CanvasArtboard
          aria-label={gt('Terminal card canvas')}
          className={`${STUDIO_ARTIFACT_PLANE_CLASS} bg-[#0D1117]`}
          frameClassName={STUDIO_ARTIFACT_FRAME_CLASS}
          height={630}
          role='group'
          width={1200}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 [&>svg]:size-full'
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        </CanvasArtboard>
      </CanvasViewport>
    </ToolShell>
  );
}

export default TerminalTool;
