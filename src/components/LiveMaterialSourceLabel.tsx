import { liveMaterialSourceName, type LiveMaterialOption } from '@/lib/liveMaterials';

function SourceMark({
  source,
}: {
  source: string;
}) {
  const className = 'live-material-source-mark';

  if (source === 'Glyphfield') {
    return (
      <svg aria-hidden='true' className={className} viewBox='0 0 64 64'>
        <path d='M6 6H56V16H16V48H48V58H6V6Z' fill='currentColor' />
        <path d='M46 16H56V26H46V16Z' fill='currentColor' />
        <path d='M28 27H46L41 32H58L40 45L45 37H27L32 32H22L28 27Z' fill='currentColor' />
      </svg>
    );
  }

  if (source === 'Paper') {
    return (
      <svg aria-hidden='true' className={className} viewBox='0 0 26 40'>
        <path d='M15.987 7H3.997v3.997h11.99v11.99H3.997v-11.99H0v21.983h3.997v-.001h11.99v-9.992h9.993v-15.987h-9.993Z' fill='currentColor' />
      </svg>
    );
  }

  if (source === 'Shaders.com') {
    return (
      <svg aria-hidden='true' className={className} viewBox='0 0 167 169'>
        <path d='M152.239 56.149H99.268c-10.474 0-18.963-8.603-18.963-19.216V14.729C80.305 6.591 73.797 0 65.771 0H14.534C6.508 0 0 6.596 0 14.729v51.915c0 8.138 6.508 14.729 14.534 14.729h21.91c10.473 0 18.962 8.603 18.962 19.217v53.681c0 8.138 6.509 14.729 14.535 14.729h82.294c8.03 0 14.534-6.596 14.534-14.729V70.874c0-8.138-6.508-14.729-14.534-14.729Z' fill='currentColor' />
      </svg>
    );
  }

  if (source === 'WebGL') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <path d='M2.25 10c0-3.65 3.47-6.6 7.75-6.6 2.67 0 5.02 1.15 6.41 2.9M17.75 10c0 3.65-3.47 6.6-7.75 6.6-2.67 0-5.02-1.15-6.41-2.9' fill='none' stroke='currentColor' strokeLinecap='round' strokeWidth='2.1' />
      <path d='m5.2 7.1 1.4 5.7 1.7-4.15L10 12.8l1.55-5.7M12.9 7.1v5.7h3.1' fill='none' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.15' />
    </svg>
  );

  if (source === 'ShaderGradient') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <rect height='16' rx='4' width='16' x='2' y='2' fill='none' stroke='currentColor' strokeWidth='1.5' />
      <path d='M4.5 12.6c2.2-5.7 4.2 1.2 6.3-4.2 1.2-3 2.5-2.8 4.7-.8' fill='none' stroke='currentColor' strokeLinecap='round' strokeWidth='2' />
    </svg>
  );

  if (source === 'HoloCloth') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <path d='M3 4.5c4-2 5.5 2 9.5 0 1.9-.95 3.15-.52 4.5.2v10.8c-4 2-5.5-2-9.5 0-1.9.95-3.15.52-4.5-.2V4.5Z' fill='none' stroke='currentColor' strokeWidth='1.5' />
      <path d='M6 3.8v11.8M10 4.4v10.8M14 4v11.4' opacity='.55' stroke='currentColor' strokeWidth='.8' />
    </svg>
  );

  if (source === 'Grainient') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <circle cx='10' cy='10' fill='none' r='6.5' stroke='currentColor' strokeWidth='1.5' />
      <path d='M13.9 6.9a5 5 0 1 0 .15 6.05H10.4v-2.3h6.1' fill='none' stroke='currentColor' strokeWidth='1.55' />
      <circle cx='5' cy='5.3' fill='currentColor' r='.75' /><circle cx='15.3' cy='15.1' fill='currentColor' r='.55' />
    </svg>
  );

  if (source === 'Gradientool') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <path d='M3 3h14v14H3z' fill='none' stroke='currentColor' strokeWidth='1.4' />
      <path d='m4.8 14.6 9.8-9.2M7 16l9-8.6' opacity='.8' stroke='currentColor' strokeWidth='2.1' />
    </svg>
  );

  if (source === 'EvilRabbit') return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <path d='M7.8 7.2 6.4 2.5c-.3-1 1.1-1.5 1.7-.7l2 3.4 2-3.4c.6-.8 2-.3 1.7.7l-1.5 4.8a5.3 5.3 0 1 1-4.5-.1Z' fill='none' stroke='currentColor' strokeLinejoin='round' strokeWidth='1.5' />
      <circle cx='8.2' cy='10.8' fill='currentColor' r='.75' /><circle cx='12' cy='10.8' fill='currentColor' r='.75' />
    </svg>
  );

  return (
    <svg aria-hidden='true' className={className} viewBox='0 0 20 20'>
      <path d='M3 6.5 6.5 3M3 13.5 6.5 17M17 6.5 13.5 3M17 13.5 13.5 17M8 15l4-10' fill='none' stroke='currentColor' strokeLinecap='square' strokeWidth='1.6' />
    </svg>
  );
}

function LiveMaterialSourceBadge({
  className = '',
  engine,
  sourceLabel,
}: {
  className?: string;
  engine: LiveMaterialOption['engine'];
  sourceLabel?: string;
}) {
  const source = liveMaterialSourceName({ engine, sourceLabel });
  return (
    <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[10px] font-medium tracking-wide opacity-60 ${className}`}>
      <SourceMark source={source} />
      <span>{source}</span>
    </span>
  );
}

function LiveMaterialSourceTag({
  className = '',
  material,
}: {
  className?: string;
  material: Pick<LiveMaterialOption, 'engine' | 'sourceLabel'>;
}) {
  const source = liveMaterialSourceName(material);
  return (
    <span className={`live-material-source-tag ${className}`} title={source}>
      <SourceMark source={source} />
      <span className='live-material-source-tag-label'>{source}</span>
    </span>
  );
}

function LiveMaterialOptionLabel({ material }: { material: Pick<LiveMaterialOption, 'engine' | 'name' | 'sourceLabel'> }) {
  return (
    <span className='flex min-w-0 w-full items-center justify-between gap-4' data-live-material-label>
      <span className='truncate'>{material.name}</span>
      <LiveMaterialSourceBadge engine={material.engine} sourceLabel={material.sourceLabel} />
    </span>
  );
}

export { LiveMaterialOptionLabel, LiveMaterialSourceBadge, LiveMaterialSourceTag };
