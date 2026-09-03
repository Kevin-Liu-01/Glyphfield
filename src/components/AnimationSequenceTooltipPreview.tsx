'use client';

import { type ReactNode } from 'react';
import { T } from 'gt-next';

type AnimationSequenceTooltipPreviewProps = {
  children: ReactNode;
  count: number;
  index: number;
  kind: 'background' | 'frame' | 'sequence-background' | 'transition';
};

export default function AnimationSequenceTooltipPreview({
  children,
  count,
  index,
  kind,
}: AnimationSequenceTooltipPreviewProps) {
  const laneColumns = Math.max(1, count * 2 - 1);
  const gridColumn = kind === 'sequence-background'
    ? '1 / -1'
    : kind === 'transition'
      ? Math.min(laneColumns, index * 2 + 2)
      : index * 2 + 1;

  return (
    <div className='animation-sequence-tooltip-preview'>
      <div className='animation-sequence-tooltip-preview__scene'>{children}</div>
      <div className='animation-sequence-tooltip-preview__position'>
        <span><T>Sequence</T></span>
        <div
          aria-hidden='true'
          className='animation-sequence-tooltip-preview__track'
          style={{ gridTemplateColumns: `repeat(${laneColumns}, minmax(3px, 1fr))` }}
        >
          <i data-kind={kind} style={{ gridColumn }} />
        </div>
      </div>
    </div>
  );
}
