'use client';

import { T, useGT } from 'gt-next';

import { Button } from '@/components/ui/Button';
import { Code2 } from '@/components/ui/SolidIcons';

/** The source trigger must not import the editor or its syntax grammars. */
export default function SourceCodeButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  const gt = useGT();
  return (
    <Button
      aria-label={gt('Edit source code')}
      disabled={disabled}
      onClick={onClick}
      title={gt(disabled ? 'Preparing portable source' : 'Edit source code')}
      type='button'
      variant='outline'
    >
      <Code2 aria-hidden='true' />
      <span className='responsive-toolbar-label'><T>Code</T></span>
    </Button>
  );
}
