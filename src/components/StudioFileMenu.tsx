'use client';

import { useGT } from 'gt-next';
import { useProjectFileDownload, useProjectFileOpen, type ProjectFileControlsProps } from '@/components/ProjectFileControls';
import StudioActionMenu from '@/components/ui/StudioActionMenu';
import StudioErrorNotice from '@/components/ui/StudioErrorNotice';
import { Code2, Download, FileJson, Upload } from '@/components/ui/SolidIcons';
import type { StudioContextMenuSection } from '@/components/ui/StudioContextMenu';

type StudioFileMenuProps = {
  sourceDisabled?: boolean;
  onSource: () => void;
  sections?: readonly StudioContextMenuSection[];
  project?: ProjectFileControlsProps;
};

/** File operations and the technical source editor, without crowding Export. */
export default function StudioFileMenu(props: StudioFileMenuProps) {
  // Isolate file hooks so source-only tools never allocate a file workflow.
  return props.project ? <ProjectMenu {...props} project={props.project} /> : <FileMenu {...props} />;
}

function FileMenu({ sourceDisabled, onSource, sections = [], pending = false }: StudioFileMenuProps & { pending?: boolean }) {
  const gt = useGT();
  return <StudioActionMenu icon={<FileJson aria-hidden='true' />} label={gt('File')} loading={pending} sections={[
    ...sections,
    { label: gt('Advanced'), items: [{ id: 'source', label: gt('Edit source code'), description: gt('Inspect or edit the portable source.'), disabled: sourceDisabled, icon: <Code2 />, onSelect: onSource }] },
  ]} />;
}

function ProjectMenu({ project, sections = [], ...props }: StudioFileMenuProps & { project: ProjectFileControlsProps }) {
  const gt = useGT();
  const download = useProjectFileDownload(project);
  const upload = useProjectFileOpen({ ...project, onOpen: project.open });
  const pending = download.pending || upload.pending;
  return <>
    <FileMenu {...props} pending={pending} sections={[
      { label: gt('Editable project'), items: [
        { id: 'open', label: gt('Open project file'), description: gt('Replace this workspace. Saved checkpoints stay available.'), icon: <Upload />, disabled: project.disabled || pending, onSelect: upload.choose },
        { id: 'download', label: gt('Download project file'), description: gt('Keep an editable copy with embedded assets.'), icon: <Download />, disabled: project.disabled || pending, onSelect: () => { void download.save(); } },
      ] },
      ...sections,
    ]} />
    {upload.input}
    <StudioErrorNotice error={upload.error} onDismiss={upload.dismissError} title='Could not open project' />
    <StudioErrorNotice error={download.error} onDismiss={download.dismissError} title='Project download failed' />
    <span className='sr-only' role='status'>{upload.pending ? gt('Opening project file…') : upload.message}</span>
    <span className='sr-only' role='status'>{download.pending ? gt('Preparing project file…') : download.message}</span>
  </>;
}
