'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Badge,
  BriefcaseBusiness,
  Download,
  FileText,
  Mail,
  Presentation,
  Search,
  Share2,
  TerminalSquare,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  BRAND_ELEMENT_CATEGORIES,
  BRAND_ELEMENTS,
  filterBrandElements,
  type BrandElement,
  type BrandElementCategory,
} from '@/lib/brandElements';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import type { StudioTool } from '@/lib/studioCatalog';

const CATEGORY_ICONS: Record<BrandElementCategory, typeof Mail> = {
  Developer: TerminalSquare,
  Digital: Mail,
  Editorial: Presentation,
  Event: Badge,
  Physical: BriefcaseBusiness,
  Social: Share2,
};

function downloadElementBrief(identity: BrandIdentity, element: BrandElement) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          element,
          identity: {
            colors: identity.colors,
            id: identity.id,
            name: identity.name,
            shortName: identity.shortName,
            tagline: identity.tagline,
            typography: identity.typography,
            voice: identity.voice,
            website: identity.website,
          },
          schemaVersion: 1,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${identity.id}-${element.id}-brief.json`;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function IdentityMark({
  className,
  identity,
  inverted = false,
}: {
  className: string;
  identity: BrandIdentity;
  inverted?: boolean;
}) {
  const path = brandAssetPath(identity, inverted ? 'mark-light' : 'mark-dark');
  if (path) return <img alt='' className={className} src={path} />;
  return (
    <span className={`${className} grid place-items-center font-semibold tracking-[-0.06em]`}>
      {identity.shortName}
    </span>
  );
}

function ElementFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className='flex w-full max-w-5xl flex-col'>
      <div className='min-h-0 overflow-auto border border-border bg-muted/30 p-5 sm:p-8'>
        {children}
      </div>
      <div className='flex items-center justify-between gap-4 border-x border-b border-border bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
        <span>{label}</span>
        <span>LIVE IDENTITY PREVIEW</span>
      </div>
    </div>
  );
}

function WelcomeEmailPreview({ identity }: { identity: BrandIdentity }) {
  const motion = identity.motion.find(({ id }) => id === 'morph-1250')?.previewPath;
  const cards = [
    ['Add to your stack', 'Connect the identity to the product and its implementation.', '文'],
    ['Join the community', 'Carry the same voice into support, conversation, and events.', 'ع'],
    ['Ship the work', 'Keep product, documentation, and communication moving together.', 'A'],
  ];

  return (
    <div className='mx-auto w-full max-w-[640px] bg-white p-6 text-[#18181B] shadow-sm sm:p-8'>
      <IdentityMark className='mb-7 size-10 object-contain text-lg' identity={identity} />
      <div className='mb-8 grid aspect-[10/3] place-items-center overflow-hidden bg-black'>
        {motion ? (
          <img alt='' className='size-full object-cover' src={motion} />
        ) : (
          <p className='max-w-[85%] text-center text-2xl font-semibold tracking-[-0.04em] text-white sm:text-4xl'>
            {identity.greetings.join(' · ')}
          </p>
        )}
      </div>
      <h2 className='text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl'>
        Welcome to {identity.name}!
      </h2>
      <p className='mt-4 text-sm text-[#31312E]'>Hi Alex,</p>
      <p className='mt-2 max-w-xl text-base leading-7 text-[#565650]'>{identity.positioning}</p>
      <span className='mt-6 w-fit bg-[#18181B] px-5 py-3 text-sm font-semibold text-white'>
        Get started →
      </span>
      <div className='mt-10 flex flex-col gap-3'>
        {cards.map(([title, body, letter]) => (
          <div className='grid min-h-28 grid-cols-[1fr_112px] overflow-hidden bg-[#F4F4F2]' key={title}>
            <div className='p-5'>
              <p className='text-base font-semibold'>{identity.shortName} / {title}</p>
              <p className='mt-2 text-sm leading-5 text-[#5F5F59]'>{body}</p>
              <p className='mt-3 text-xs font-semibold'>Open element →</p>
            </div>
            <div className='grid place-items-center overflow-hidden bg-black/[0.035] text-7xl font-semibold text-black/[0.08]'>
              {letter}
            </div>
          </div>
        ))}
      </div>
      <p className='mt-6 text-xs leading-5 text-[#73736D]'>
        Questions? Reply to this email and the {identity.name} team will help.
      </p>
    </div>
  );
}

function TransactionalEmailPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  const isSignature = element.id === 'email-signature';
  if (isSignature) {
    return (
      <div className='mx-auto flex w-full max-w-xl items-center gap-5 bg-white p-8 shadow-sm'>
        <IdentityMark className='size-14 object-contain text-xl' identity={identity} />
        <div className='border-l border-black/15 pl-5 text-sm'>
          <p className='font-semibold'>Alex Morgan</p>
          <p className='mt-1 text-black/55'>Design Engineer · {identity.name}</p>
          <p className='mt-2 font-mono text-xs text-black/45'>{identity.website}</p>
        </div>
      </div>
    );
  }
  return (
    <div className='mx-auto w-full max-w-xl bg-white p-8 shadow-sm'>
      <IdentityMark className='size-9 object-contain text-sm' identity={identity} />
      <p className='mt-12 font-mono text-xs uppercase tracking-widest text-black/40'>ACCOUNT / VERIFIED</p>
      <h2 className='mt-4 text-3xl font-semibold tracking-[-0.04em]'>Your workspace is ready.</h2>
      <p className='mt-4 text-base leading-7 text-black/55'>{identity.description}</p>
      <span className='mt-7 inline-block bg-black px-5 py-3 text-sm font-semibold text-white'>Open workspace →</span>
      <p className='mt-12 border-t border-black/10 pt-5 text-xs text-black/40'>{identity.website}</p>
    </div>
  );
}

function EmailPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  return element.id === 'welcome-email' ? (
    <WelcomeEmailPreview identity={identity} />
  ) : (
    <TransactionalEmailPreview element={element} identity={identity} />
  );
}

function DeveloperPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  const ascii = (
    identity.shortName === 'GT'
      ? [
          ' ██████╗ ████████╗',
          '██╔════╝ ╚══██╔══╝',
          '██║  ███╗   ██║   ',
          '██║   ██║   ██║   ',
          '╚██████╔╝   ██║   ',
          ' ╚═════╝    ╚═╝   ',
        ]
      : identity.shortName === 'ST'
        ? [
            '███████╗████████╗',
            '██╔════╝╚══██╔══╝',
            '███████╗   ██║   ',
            '╚════██║   ██║   ',
            '███████║   ██║   ',
            '╚══════╝   ╚═╝   ',
          ]
        : [
            '┏━━━━━━━━━━━━━━━━━━━━━━┓',
            `┃      ${identity.shortName.padEnd(10, ' ')}      ┃`,
            '┣━━━━━━━━━━━━━━━━━━━━━━┫',
            '┃  ███  BRAND  ███     ┃',
            '┗━━━━━━━━━━━━━━━━━━━━━━┛',
          ]
  ).join('\n');
  return (
    <div className='mx-auto w-full max-w-4xl overflow-hidden bg-[#101010] text-white shadow-xl'>
      <div className='flex items-center justify-between border-b border-white/10 px-5 py-4'>
        <span className='font-mono text-xs text-white/50'>{identity.id} — {element.id}</span>
        <span className='size-2 rounded-full bg-status-success' />
      </div>
      <div className='p-6 sm:p-10'>
        <pre className='overflow-x-auto font-mono text-xs leading-5 text-emphasis sm:text-sm'>{ascii}</pre>
        <p className='mt-8 font-mono text-sm text-white/45'>$ npx {identity.id} init</p>
        <p className='mt-3 font-mono text-sm text-white'>✓ {identity.name} installed</p>
        <p className='mt-2 font-mono text-sm text-status-success'>✓ Brand context loaded</p>
        <p className='mt-8 max-w-xl text-2xl font-semibold tracking-[-0.035em]'>{identity.tagline}</p>
      </div>
    </div>
  );
}

function SocialPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  return (
    <div className='mx-auto grid aspect-[16/9] w-full max-w-4xl grid-cols-[1fr_0.72fr] overflow-hidden bg-white shadow-sm'>
      <div className='flex flex-col justify-between p-8 sm:p-12'>
        <div className='flex items-center gap-3'>
          <div className='grid size-11 place-items-center bg-black p-2'>
            <IdentityMark className='size-full object-contain text-xs text-white' identity={identity} inverted />
          </div>
          <div>
            <p className='text-sm font-semibold'>{identity.name}</p>
            <p className='font-mono text-xs text-black/40'>@{identity.id} · now</p>
          </div>
        </div>
        <p className='max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-5xl'>{identity.tagline}</p>
        <div className='flex gap-6 font-mono text-xs text-black/35'>
          <span>↗ LAUNCH</span><span>◌ 24</span><span>◇ 128</span>
        </div>
      </div>
      <div className='relative grid place-items-center overflow-hidden bg-black text-white'>
        <div className='absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:32px_32px]' />
        <IdentityMark className='relative size-36 object-contain text-5xl' identity={identity} inverted />
        <p className='absolute right-5 bottom-5 font-mono text-[10px] uppercase tracking-widest text-white/40'>{element.name}</p>
      </div>
    </div>
  );
}

function EditorialPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  return (
    <div className='mx-auto flex aspect-[16/9] w-full max-w-5xl flex-col justify-between overflow-hidden bg-white p-8 shadow-sm sm:p-14'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <IdentityMark className='size-9 object-contain text-sm' identity={identity} />
          <span className='text-sm font-semibold'>{identity.shortName}</span>
        </div>
        <span className='font-mono text-xs text-black/35'>{element.name.toLocaleUpperCase()} / 01</span>
      </div>
      <div className='max-w-4xl'>
        <p className='font-mono text-xs uppercase tracking-[0.18em] text-black/40'>BRAND SYSTEM / JULY 2026</p>
        <h2 className='mt-5 text-4xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-7xl'>{identity.tagline}</h2>
      </div>
      <div className='flex items-center justify-between border-t border-black/15 pt-4 font-mono text-xs text-black/40'>
        <span>{identity.website}</span><span>{identity.name}</span>
      </div>
    </div>
  );
}

function EventPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  const isLockup = element.id === 'partnership-lockup';
  if (isLockup) {
    return (
      <div className='mx-auto flex aspect-[16/9] w-full max-w-4xl items-center justify-center gap-10 bg-white p-12 shadow-sm'>
        <IdentityMark className='size-32 object-contain text-4xl' identity={identity} />
        <span className='h-28 w-px bg-black/20' />
        <div className='grid size-32 place-items-center border border-black/20 font-mono text-sm text-black/45'>PARTNER</div>
      </div>
    );
  }
  return (
    <div className='mx-auto flex min-h-[560px] w-full max-w-3xl items-start justify-center overflow-hidden bg-[#ECECE8] p-8'>
      <div className='flex flex-col items-center'>
        <div className='h-24 w-8 bg-black' />
        <div className='w-72 bg-white shadow-xl'>
          <div className='flex h-32 items-center justify-center bg-black'>
            <IdentityMark className='size-20 object-contain text-2xl text-white' identity={identity} inverted />
          </div>
          <div className='p-6'>
            <p className='font-mono text-xs uppercase tracking-widest text-black/35'>ATTENDEE / 0248</p>
            <p className='mt-10 text-3xl font-semibold tracking-[-0.04em]'>Alex<br />Morgan</p>
            <p className='mt-4 text-sm text-black/50'>{identity.name}</p>
            <div className='mt-10 flex items-end justify-between'>
              <span className='font-mono text-[10px] text-black/35'>{element.name.toLocaleUpperCase()}</span>
              <div className='grid size-14 grid-cols-4 gap-0.5 bg-black p-1' aria-hidden='true'>
                {Array.from({ length: 16 }, (_, index) => <span className={index % 3 === 0 ? 'bg-white' : 'bg-black'} key={index} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhysicalPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  return (
    <div className='mx-auto grid min-h-[520px] w-full max-w-5xl place-items-center bg-[#E9E9E5] p-8 sm:p-14'>
      <div className='grid w-full max-w-4xl gap-8 md:grid-cols-2'>
        <div className='flex aspect-[1.75/1] flex-col justify-between bg-black p-7 text-white shadow-xl'>
          <IdentityMark className='size-16 object-contain text-xl' identity={identity} inverted />
          <p className='font-mono text-xs uppercase tracking-widest text-white/45'>{element.name}</p>
        </div>
        <div className='flex aspect-[1.75/1] flex-col justify-between bg-white p-7 shadow-xl'>
          <div>
            <p className='text-xl font-semibold'>Alex Morgan</p>
            <p className='mt-1 text-sm text-black/50'>Design Engineer</p>
          </div>
          <div className='flex items-end justify-between gap-4 font-mono text-xs text-black/45'>
            <span>{identity.website}<br />hello@{identity.website}</span>
            <IdentityMark className='size-10 object-contain text-xs' identity={identity} />
          </div>
        </div>
      </div>
    </div>
  );
}

function WebPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  return (
    <div className='mx-auto grid aspect-[16/10] w-full max-w-4xl overflow-hidden bg-white shadow-sm md:grid-cols-[1.2fr_0.8fr]'>
      <div className='flex flex-col justify-between p-8 sm:p-12'>
        <IdentityMark className='size-10 object-contain text-sm' identity={identity} />
        <div>
          <p className='font-mono text-xs uppercase tracking-widest text-black/35'>{element.name}</p>
          <h2 className='mt-4 text-4xl font-semibold leading-tight tracking-[-0.05em] sm:text-6xl'>{identity.tagline}</h2>
          <span className='mt-7 inline-block bg-black px-5 py-3 text-sm font-semibold text-white'>Explore →</span>
        </div>
        <p className='font-mono text-xs text-black/35'>{identity.website}</p>
      </div>
      <div className='relative grid place-items-center bg-black p-10 text-white'>
        <div className='absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_center,#fff_1px,transparent_1.5px)] [background-size:18px_18px]' />
        <IdentityMark className='relative size-44 object-contain text-6xl' identity={identity} inverted />
      </div>
    </div>
  );
}

function LogoPreview({ identity }: { identity: BrandIdentity }) {
  return (
    <div className='mx-auto grid aspect-[16/10] w-full max-w-4xl grid-cols-2 overflow-hidden shadow-sm'>
      <div className='grid place-items-center bg-white p-10'><IdentityMark className='size-44 object-contain text-6xl' identity={identity} /></div>
      <div className='grid place-items-center bg-black p-10 text-white'><IdentityMark className='size-44 object-contain text-6xl' identity={identity} inverted /></div>
    </div>
  );
}

function IconPreview({ identity }: { identity: BrandIdentity }) {
  return (
    <div className='mx-auto grid w-full max-w-3xl grid-cols-2 gap-px bg-border shadow-sm sm:grid-cols-4'>
      {[32, 64, 128, 256, 512, 1024, 64, 128].map((size, index) => (
        <div className={`grid aspect-square place-items-center p-6 ${index % 3 === 0 ? 'bg-black text-white' : 'bg-white'}`} key={`${size}-${index}`}>
          <IdentityMark className='size-2/3 object-contain text-2xl' identity={identity} inverted={index % 3 === 0} />
          <span className='mt-3 font-mono text-[10px] opacity-40'>{size} PX</span>
        </div>
      ))}
    </div>
  );
}

function ElementPreview({ element, identity }: { element: BrandElement; identity: BrandIdentity }) {
  switch (element.preview) {
    case 'email':
      return <EmailPreview element={element} identity={identity} />;
    case 'developer':
      return <DeveloperPreview element={element} identity={identity} />;
    case 'social':
      return <SocialPreview element={element} identity={identity} />;
    case 'editorial':
      return <EditorialPreview element={element} identity={identity} />;
    case 'event':
      return <EventPreview element={element} identity={identity} />;
    case 'physical':
      return <PhysicalPreview element={element} identity={identity} />;
    case 'logo':
      return <LogoPreview identity={identity} />;
    case 'icon':
      return <IconPreview identity={identity} />;
    case 'web':
      return <WebPreview element={element} identity={identity} />;
  }
}

export default function BrandElementsStudio({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const gt = useGT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useStudioDraft<BrandElementCategory | 'All'>(
    identity.id,
    tool.id,
    'category',
    'All'
  );
  const [selectedElementId, setSelectedElementId] = useStudioDraft(
    identity.id,
    tool.id,
    'selected-element',
    'welcome-email'
  );
  const filteredElements = useMemo(
    () =>
      filterBrandElements(BRAND_ELEMENTS, query).filter(
        (element) => category === 'All' || element.category === category
      ),
    [category, query]
  );
  const selectedElement =
    BRAND_ELEMENTS.find(({ id }) => id === selectedElementId) ?? BRAND_ELEMENTS[0]!;

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <Button onClick={() => downloadElementBrief(identity, selectedElement)} type='button' variant='outline'>
          <Download aria-hidden='true' />
          <T>Element brief</T>
        </Button>
      </header>

      <div className='brand-elements-body tool-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <div className='flex flex-col gap-3 border-b border-border p-4'>
            <label className='flex h-9 items-center gap-2 rounded-md border border-input px-3 focus-within:border-foreground'>
              <Search className='size-4 text-muted-foreground' aria-hidden='true' />
              <input
                aria-label={gt('Search brand elements')}
                className='min-w-0 flex-1 bg-transparent text-sm outline-none'
                onChange={(event) => setQuery(event.target.value)}
                placeholder={gt('Email, ASCII, lanyard…')}
                value={query}
              />
            </label>
            <select
              aria-label={gt('Brand element category')}
              className='h-9 rounded-md border border-input bg-background px-3 text-sm outline-none'
              onChange={(event) => setCategory(event.target.value as BrandElementCategory | 'All')}
              value={category}
            >
              <option value='All'>{gt('All elements')}</option>
              {BRAND_ELEMENT_CATEGORIES.map((item) => <option key={item} value={item}>{gt(item)}</option>)}
            </select>
          </div>
          <div className='flex flex-col py-2'>
            {BRAND_ELEMENT_CATEGORIES.map((elementCategory) => {
              const elements = filteredElements.filter((element) => element.category === elementCategory);
              if (elements.length === 0) return null;
              const Icon = CATEGORY_ICONS[elementCategory];
              return (
                <section className='flex flex-col gap-1 px-2 py-2' key={elementCategory}>
                  <div className='flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground'>
                    <Icon className='size-3.5' aria-hidden='true' />
                    <span>{gt(elementCategory)}</span>
                    <span className='ml-auto font-mono'>{elements.length}</span>
                  </div>
                  {elements.map((element) => (
                    <Button
                      className='relative h-auto min-h-11 w-full justify-start overflow-hidden rounded-none px-2 py-2 text-left'
                      key={element.id}
                      onClick={() => setSelectedElementId(element.id)}
                      type='button'
                      variant={selectedElement.id === element.id ? 'default' : 'ghost'}
                    >
                      <span className='relative z-10 min-w-0 flex-1 pr-14'>
                        <span className='block truncate text-sm'>{gt(element.name)}</span>
                        <span className={`block truncate font-mono text-[10px] ${selectedElement.id === element.id ? 'text-primary-foreground/55' : 'text-muted-foreground'}`}>
                          {element.dimensions}
                        </span>
                      </span>
                      <span
                        aria-hidden='true'
                        className={`pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 font-mono text-[28px] font-semibold leading-none tracking-[-0.08em] ${
                          selectedElement.id === element.id
                            ? 'text-primary-foreground/12'
                            : 'text-foreground/7'
                        }`}
                      >
                        {element.symbol}
                      </span>
                    </Button>
                  ))}
                </section>
              );
            })}
            {filteredElements.length === 0 ? (
              <div className='flex flex-col items-center gap-3 px-5 py-12 text-center'>
                <FileText className='size-5 text-muted-foreground' aria-hidden='true' />
                <p className='text-sm font-medium'><T>No elements found</T></p>
                <p className='text-xs leading-5 text-muted-foreground'><T>Try a medium, format, or application.</T></p>
              </div>
            ) : null}
          </div>
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto'>
          <div className='flex min-h-full flex-col'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3'>
              <select
                aria-label={gt('Active brand element')}
                className='brand-elements-mobile-select hidden h-9 rounded-md border border-input bg-background px-3 text-sm outline-none'
                onChange={(event) => setSelectedElementId(event.target.value)}
                value={selectedElement.id}
              >
                {BRAND_ELEMENT_CATEGORIES.map((elementCategory) => (
                  <optgroup key={elementCategory} label={gt(elementCategory)}>
                    {BRAND_ELEMENTS.filter((element) => element.category === elementCategory).map((element) => (
                      <option key={element.id} value={element.id}>{gt(element.name)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div>
                <p className='text-sm font-semibold'>{selectedElement.name}</p>
                <p className='mt-0.5 text-xs text-muted-foreground'>{selectedElement.description}</p>
              </div>
              <div className='flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.dimensions}</span>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.format}</span>
              </div>
            </div>
            <div className='grid min-h-[560px] flex-1 place-items-center p-5 sm:p-8'>
              <ElementFrame label={`${selectedElement.category} / ${selectedElement.id}`}>
                <ElementPreview element={selectedElement} identity={identity} />
              </ElementFrame>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
