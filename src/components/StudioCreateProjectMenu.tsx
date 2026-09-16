'use client';

import { useRef, useState } from 'react';
import { useGT } from 'gt-next';
import { Button } from '@/components/ui/Button';
import { Film, LayoutGrid, Palette, Plus, Upload } from '@/components/ui/SolidIcons';
import StudioErrorNotice from '@/components/ui/StudioErrorNotice';
import StudioContextMenu, { type StudioContextMenuPosition } from '@/components/ui/StudioContextMenu';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { duplicateBrandIdentity, type BrandIdentity } from '@/lib/brandIdentity';
import { STUDIO_PROJECT_FILE_ACCEPT } from '@/lib/projectFile';
import type { CreatedStudioProject, ProjectCreationTool } from '@/lib/studioProjectCreation';

export default function StudioCreateProjectMenu({ disabled, identities, onCreated }: {
  disabled: boolean;
  identities: readonly BrandIdentity[];
  onCreated: (project: CreatedStudioProject) => void;
}) {
  const gt = useGT();
  const [position, setPosition] = useState<StudioContextMenuPosition | null>(null);
  const [templatePosition, setTemplatePosition] = useState<StudioContextMenuPosition | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const onCreatedRef = useCommittedRef(onCreated);

  async function create(prepare: () => Promise<CreatedStudioProject>) {
    if (disabled || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      onCreatedRef.current(await prepare());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : gt('The project could not be opened.'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }

  function scratch(toolId: ProjectCreationTool, name: string) {
    void create(async () => {
      const { createScratchStudioProject } = await import('@/lib/studioProjectCreation');
      return createScratchStudioProject(toolId, name);
    });
  }

  return <>
    <Button
      aria-expanded={Boolean(position || templatePosition)}
      aria-haspopup='menu'
      aria-label={gt('Add brand project')}
      className='project-tab-add mb-1.5 shrink-0'
      disabled={disabled}
      loading={pending}
      onClick={(event) => {
        const anchor = event.currentTarget;
        const bounds = anchor.getBoundingClientRect();
        setTemplatePosition(null);
        setPosition({ anchor, x: bounds.left, y: bounds.bottom + 6 });
      }}
      size='icon-toolbar'
      title={gt('Create or import a project')}
      type='button'
      variant='outline'
    ><Plus aria-hidden='true' /></Button>
    <StudioContextMenu
      label={gt('New project')}
      onClose={() => setPosition(null)}
      position={position}
      sections={[
        { label: gt('Start from scratch'), items: [
          { id: 'design', icon: <LayoutGrid />, label: gt('Design Lab'), description: gt('An empty canvas for your ideas'), onSelect: () => scratch('material', gt('Untitled design')) },
          { id: 'animation', icon: <Film />, label: gt('Animation'), description: gt('A fresh timeline for motion'), onSelect: () => scratch('animation', gt('Untitled animation')) },
          { id: 'brand', icon: <Palette />, label: gt('Brand identity'), description: gt('Build your own brand system'), onSelect: () => scratch('identity', gt('Untitled brand')) },
        ] },
        { items: [
          { id: 'template', icon: <LayoutGrid />, label: gt('Use a template'), description: gt('Start with an existing brand system'), onSelect: () => setTemplatePosition(position) },
          { id: 'import', icon: <Upload />, label: gt('Import project…'), description: gt('Open a .glyphfield.json file in a new tab'), onSelect: () => inputRef.current?.click() },
        ] },
      ]}
    />
    <StudioContextMenu
      label={gt('Use a template')}
      detail={gt('Create your own copy')}
      onClose={() => setTemplatePosition(null)}
      position={templatePosition}
      sections={[{ items: identities.filter((identity) => identity.builtIn).map((identity) => ({
        id: identity.id,
        icon: <ThemeAwareBrandMark className='size-[14px]' identity={identity} />,
        label: identity.name,
        onSelect: () => onCreatedRef.current({
          identity: duplicateBrandIdentity(identity, undefined, identities.map(({ name }) => name)),
          toolId: 'identity',
        }),
      })) }]}
    />
    <input
      accept={STUDIO_PROJECT_FILE_ACCEPT}
      aria-label={gt('Import project file')}
      className='sr-only'
      disabled={disabled || pending}
      onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void create(async () => {
          const { importStudioProject } = await import('@/lib/studioProjectCreation');
          return importStudioProject(file);
        });
      }}
      ref={inputRef}
      tabIndex={-1}
      type='file'
    />
    {pending ? <span className='sr-only' role='status'>{gt('Preparing project…')}</span> : null}
    <StudioErrorNotice error={error} onDismiss={() => setError(null)} title={gt('Could not open project')} />
  </>;
}
