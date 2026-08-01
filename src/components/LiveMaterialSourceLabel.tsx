import type { LiveMaterialOption } from '@/lib/liveMaterials';

function SourceMark({ engine }: { engine: LiveMaterialOption['engine'] }) {
  if (engine === 'Glyphfield') {
    return (
      <svg aria-hidden='true' className='size-3.5' viewBox='0 0 64 64'>
        <path d='M6 6H56V16H16V48H48V58H6V6Z' fill='currentColor' />
        <path d='M46 16H56V26H46V16Z' fill='currentColor' />
        <path d='M28 27H46L41 32H58L40 45L45 37H27L32 32H22L28 27Z' fill='currentColor' />
      </svg>
    );
  }

  if (engine === 'ShaderGradient') {
    return (
      <span
        aria-hidden='true'
        className='size-3.5 rounded-full border border-current/25 bg-[conic-gradient(from_210deg,#73bfc4,#8da0ce,#ff810a,#73bfc4)]'
      />
    );
  }

  if (engine === 'Paper Shaders') {
    return (
      <span aria-hidden='true' className='grid size-3.5 place-items-center border border-current/30 font-mono text-[8px] font-semibold'>P</span>
    );
  }

  return (
    <svg aria-hidden='true' className='size-3.5' viewBox='0 0 16 16'>
      <path d='M2 5.25 5.25 2M2 10.75 5.25 14M14 5.25 10.75 2M14 10.75 10.75 14' fill='none' stroke='currentColor' strokeLinecap='square' strokeWidth='1.4' />
      <path d='M6.25 11.5 9.75 4.5' fill='none' stroke='currentColor' strokeLinecap='square' strokeWidth='1.4' />
    </svg>
  );
}

function sourceName(engine: LiveMaterialOption['engine']) {
  if (engine === 'Shaders.com study') return 'Shaders.com';
  if (engine === 'WebGL Fluid') return 'PavelDoGreat';
  if (engine === 'Paper Shaders') return 'Paper';
  if (engine === 'Design study') return 'Study';
  return engine;
}

function LiveMaterialSourceBadge({
  className = '',
  engine,
}: {
  className?: string;
  engine: LiveMaterialOption['engine'];
}) {
  return (
    <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium tracking-wide opacity-60 ${className}`}>
      <SourceMark engine={engine} />
      <span>{sourceName(engine)}</span>
    </span>
  );
}

function LiveMaterialOptionLabel({ material }: { material: Pick<LiveMaterialOption, 'engine' | 'name'> }) {
  return (
    <span className='flex min-w-0 w-full items-center justify-between gap-4' data-live-material-label>
      <span className='truncate'>{material.name}</span>
      <LiveMaterialSourceBadge engine={material.engine} />
    </span>
  );
}

export { LiveMaterialOptionLabel, LiveMaterialSourceBadge };
