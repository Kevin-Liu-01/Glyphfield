'use client';

import dynamic from 'next/dynamic';
import { Fragment, memo, type ReactNode } from 'react';
import { T } from 'gt-next';
import { FileImage } from '@/components/ui/SolidIcons';
import { ToolShell } from '@/components/tools/ToolShell';
import { ControlSection, UploadField } from '@/components/tools/ToolFields';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';

export { ToolShell };

const BackgroundStudio = dynamic(() => import('@/components/BackgroundStudio'), {
  loading: ToolModuleLoading,
  ssr: false,
});
const BrandBook = dynamic(() => import('@/components/BrandBook'), {
  loading: ToolModuleLoading,
});
const BrandElementsStudio = dynamic(() => import('@/components/BrandElementsStudio'), {
  loading: ToolModuleLoading,
});
const BrandSettingsStudio = dynamic(() => import('@/components/BrandSettingsStudio'), {
  loading: ToolModuleLoading,
});
const ColorTool = dynamic(() => import('@/components/tools/ColorTool'), {
  loading: ToolModuleLoading,
});
const ComponentLibraryTool = dynamic(() => import('@/components/tools/ComponentLibraryTool'), {
  loading: ToolModuleLoading,
});
const DesignBoard = dynamic(() => import('@/components/DesignBoard'), {
  loading: ToolModuleLoading,
});
const LogoShaderStudio = dynamic(() => import('@/components/LogoShaderStudio'), {
  loading: ToolModuleLoading,
  ssr: false,
});
const OpenGraphTool = dynamic(() => import('@/components/tools/OpenGraphTool'), {
  loading: ToolModuleLoading,
});
const TemplateTool = dynamic(() => import('@/components/tools/TemplateTool'), {
  loading: ToolModuleLoading,
});
const TerminalTool = dynamic(() => import('@/components/tools/TerminalTool'), {
  loading: ToolModuleLoading,
});
const TypographyTool = dynamic(() => import('@/components/tools/TypographyTool'), {
  loading: ToolModuleLoading,
});

// Hover/focus prefetch for the per-tool chunks above (see StudioApp's preloadStudioTool).
const TOOL_MODULE_LOADERS: Partial<Record<StudioToolId, () => Promise<unknown>>> = {
  blog: () => import('@/components/tools/TemplateTool'),
  buttons: () => import('@/components/tools/ComponentLibraryTool'),
  colors: () => import('@/components/tools/ColorTool'),
  opengraph: () => import('@/components/tools/OpenGraphTool'),
  partnership: () => import('@/components/tools/TemplateTool'),
  slides: () => import('@/components/tools/TemplateTool'),
  terminal: () => import('@/components/tools/TerminalTool'),
  typography: () => import('@/components/tools/TypographyTool'),
};

export function preloadToolModule(toolId: StudioToolId) {
  return TOOL_MODULE_LOADERS[toolId]?.();
}

function ToolModuleLoading() {
  return (
    <div aria-busy='true' aria-label='Loading tool' className='studio-workspace-loading'>
      <span />
    </div>
  );
}

function SurfaceTool({ active, identity, tool }: { active: boolean; identity: BrandIdentity; tool: StudioTool }) {
  return <BackgroundStudio active={active} identity={identity} tool={{ ...tool, id: 'backgrounds' }} />;
}

function MaterialTool({ active, identity, onIdentitySave, tool }: { active: boolean; identity: BrandIdentity; onIdentitySave: (identity: BrandIdentity) => void; tool: StudioTool }) {
  return <LogoShaderStudio active={active} automationToolId={tool.id} identity={identity} onIdentitySave={onIdentitySave} tool={{ ...tool, id: 'logo-shader' }} />;
}

function ToolPlaceholder({ tool }: { tool: StudioTool }) {
  return (
    <ToolShell inspector={<ControlSection title={<T>Asset inputs</T>}><UploadField accept='image/*' label='Add source asset' onFile={() => {}} /></ControlSection>} tool={tool}>
      <div className='grid min-h-full place-items-center p-8'>
        <div className='flex max-w-md flex-col items-center gap-4 text-center'>
          <FileImage className='size-8 text-muted-foreground' aria-hidden='true' />
          <h2 className='text-xl font-semibold'><T>Start with a source asset</T></h2>
          <p className='text-sm leading-6 text-muted-foreground'>{tool.description}</p>
        </div>
      </div>
    </ToolShell>
  );
}

function StudioToolWorkspace({
  active = true,
  hasPendingIdentityChanges,
  identity,
  onIdentityChange,
  onIdentitySave,
  tool,
}: {
  active?: boolean;
  hasPendingIdentityChanges: boolean;
  identity: BrandIdentity;
  onIdentityChange: (identity: BrandIdentity) => void;
  onIdentitySave: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const renderers: Partial<Record<StudioToolId, ReactNode>> = {
    blog: <TemplateTool identity={identity} kind='blog' tool={tool} />,
    'brand-book': <BrandBook identity={identity} tool={tool} />,
    'brand-elements': <BrandElementsStudio identity={identity} tool={tool} />,
    buttons: <ComponentLibraryTool identity={identity} tool={tool} />,
    colors: <ColorTool identity={identity} onIdentityChange={onIdentityChange} tool={tool} />,
    'design-board': <DesignBoard identity={identity} tool={tool} />,
    identity: <BrandSettingsStudio hasPendingChanges={hasPendingIdentityChanges} identity={identity} onChange={onIdentityChange} onSave={onIdentitySave} tool={tool} />,
    material: <MaterialTool active={active} identity={identity} onIdentitySave={onIdentitySave} tool={tool} />,
    opengraph: <OpenGraphTool key={`${identity.id}:${tool.id}`} identity={identity} tool={tool} />,
    partnership: <TemplateTool identity={identity} kind='partnership' tool={tool} />,
    slides: <TemplateTool identity={identity} kind='slides' tool={tool} />,
    surface: <SurfaceTool active={active} identity={identity} tool={tool} />,
    terminal: <TerminalTool identity={identity} tool={tool} />,
    typography: <TypographyTool identity={identity} onIdentityChange={onIdentityChange} tool={tool} />,
  };

  return (
    <Fragment key={`${identity.id}:${tool.id}`}>
      {renderers[tool.id] ?? <ToolPlaceholder tool={tool} />}
    </Fragment>
  );
}

export default memo(StudioToolWorkspace);
