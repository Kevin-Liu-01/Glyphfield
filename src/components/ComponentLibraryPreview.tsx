'use client';

import { useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { T, useGT } from 'gt-next';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  Upload,
  X,
} from '@/components/ui/SolidIcons';

import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { ComponentPatternId } from '@/lib/componentLibrary';

const COMPONENT_ICON_BUTTONS = [
  { icon: Plus, label: 'Create' },
  { icon: Search, label: 'Search' },
  { icon: Copy, label: 'Copy' },
  { icon: Download, label: 'Download' },
  { icon: Settings, label: 'Settings' },
  { icon: MoreHorizontal, label: 'More' },
] as const;

const COMPONENT_SIDEBAR_ITEMS = ['Overview', 'Assets', 'Templates', 'Settings'] as const;
const COMPONENT_TAB_ITEMS = ['Overview', 'Assets', 'History'] as const;
const COMPONENT_INBOX_ITEMS = ['Product launch', 'Your export is ready', 'Community update'] as const;


type ComponentLibraryPreviewProps = {
  disabled: boolean;
  identity: BrandIdentity;
  label: string;
  pattern: ComponentPatternId;
  size: 'sm' | 'default' | 'lg';
  supportingCopy: string;
};

type PatternPreviewProps = ComponentLibraryPreviewProps & {
  activeIndex: number;
  checked: boolean;
  dismissed: boolean;
  progress: number;
  setActiveIndex: Dispatch<SetStateAction<number>>;
  setChecked: Dispatch<SetStateAction<boolean>>;
  setDismissed: Dispatch<SetStateAction<boolean>>;
  setProgress: Dispatch<SetStateAction<number>>;
  setToggleStates: Dispatch<SetStateAction<boolean[]>>;
  spacing: string;
  toggleStates: boolean[];
};

function PreviewSurface({ children, disabled }: { children: ReactNode; disabled: boolean }) {
  return (
    <fieldset
      aria-disabled={disabled}
      className={`component-library-preview-surface min-h-[420px] min-w-0 border-0 p-0 ${disabled ? 'pointer-events-none opacity-45 grayscale' : ''}`}
      disabled={disabled}
    >
      {children}
    </fieldset>
  );
}

function ActionPatternPreview({ activeIndex, disabled, label, pattern, setActiveIndex, size, spacing }: PatternPreviewProps) {
  const gt = useGT();
  if (pattern === 'buttons') {
    return (
      <PreviewSurface disabled={disabled}>
        <div className={`grid min-h-[420px] gap-px bg-border md:grid-cols-2 ${spacing}`}>
          <section className='flex flex-col justify-between gap-10 bg-background p-6'>
            <p className='font-mono text-xs uppercase tracking-widest text-muted-foreground'><T>Core actions</T></p>
            <div className='flex flex-wrap items-center gap-3'>
              <Button size={size}>{label}</Button>
              <Button size={size} variant='rainbow'>{label}</Button>
              <Button size={size} variant='outline'>{label}</Button>
              <Button size={size} variant='secondary'>{label}</Button>
              <Button size={size} variant='ghost'>{label}</Button>
              <Button size={size} variant='destructive'><T>Delete</T></Button>
            </div>
          </section>
          <section className='flex flex-col justify-between gap-10 bg-foreground p-6 text-background'>
            <p className='font-mono text-xs uppercase tracking-widest opacity-50'><T>Reversed</T></p>
            <div className='flex flex-wrap gap-3'>
              <Button size={size} variant='secondary'>{label}</Button>
              <Button className='!border-background/30 !bg-transparent !text-background hover:!bg-background hover:!text-foreground' size={size} variant='outline'><T>Learn more</T></Button>
            </div>
          </section>
        </div>
      </PreviewSurface>
    );
  }
  if (pattern === 'icon-buttons') {
    return (
      <PreviewSurface disabled={disabled}>
        <div className={`flex min-h-[420px] flex-wrap content-center justify-center gap-4 ${spacing}`}>
          {COMPONENT_ICON_BUTTONS.map(({ icon: Icon, label: iconLabel }, index) => (
            <Button aria-label={gt(iconLabel)} key={iconLabel} onClick={() => setActiveIndex(index)} size={size === 'sm' ? 'icon-sm' : 'icon'} variant={activeIndex === index ? 'default' : 'outline'}>
              <Icon aria-hidden='true' />
            </Button>
          ))}
        </div>
      </PreviewSurface>
    );
  }
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`grid min-h-[420px] place-items-center ${spacing}`}>
        <div className='flex flex-col items-center gap-8'>
          <div className='flex overflow-hidden rounded-md border border-border'>
            {['Design', 'Preview', 'Code'].map((item, index) => (
              <Button className='rounded-none border-0 border-r last:border-r-0' key={item} onClick={() => setActiveIndex(index)} size={size} variant={activeIndex === index ? 'default' : 'secondary'}>{gt(item)}</Button>
            ))}
          </div>
          <div className='flex gap-2'>
            <Button aria-label={gt('Previous')} size='icon-sm' variant='outline'><ChevronLeft /></Button>
            <Button size={size}>{label}</Button>
            <Button aria-label={gt('Next')} size='icon-sm' variant='outline'><ChevronRight /></Button>
          </div>
        </div>
      </div>
    </PreviewSurface>
  );
}

function FormPatternPreview({
  activeIndex,
  checked,
  disabled,
  identity,
  pattern,
  setActiveIndex,
  setChecked,
  setToggleStates,
  spacing,
  supportingCopy,
  toggleStates,
}: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`mx-auto grid min-h-[420px] max-w-2xl content-center gap-5 ${spacing}`}>
        {pattern === 'inputs' ? (
          <>
            <label className='flex flex-col gap-2 text-sm'><span className='text-muted-foreground'><T>Workspace name</T></span><input className='h-10 rounded-md border border-input bg-background px-3 outline-none focus:border-foreground' defaultValue={identity.name} /></label>
            <label className='flex flex-col gap-2 text-sm'><span className='text-muted-foreground'><T>Email</T></span><input className='h-10 rounded-md border border-input bg-background px-3 outline-none focus:border-foreground' defaultValue={identity.contactEmail} type='email' /></label>
          </>
        ) : null}
        {pattern === 'textareas' ? <label className='flex flex-col gap-2 text-sm'><span className='text-muted-foreground'><T>Description</T></span><textarea className='min-h-40 resize-y rounded-md border border-input bg-background p-3 leading-6 outline-none focus:border-foreground' defaultValue={supportingCopy} /></label> : null}
        {pattern === 'selects' ? <label className='flex flex-col gap-2 text-sm'><span className='text-muted-foreground'><T>Role</T></span><StudioSelect ariaLabel='Role' defaultValue='admin' options={[{ label: 'Administrator', value: 'admin' }, { label: 'Member', value: 'member' }, { label: 'Viewer', value: 'viewer' }]} /></label> : null}
        {pattern === 'checkboxes' ? ['Automatic updates', 'Product announcements', 'Weekly summary'].map((item, index) => <label className='flex items-center gap-3 border border-border p-4 text-sm' key={item}><input checked={index === 0 ? checked : index === 1} onChange={index === 0 ? (event) => setChecked(event.target.checked) : undefined} readOnly={index !== 0} type='checkbox' />{gt(item)}</label>) : null}
        {pattern === 'radios' ? ['Public', 'Team only', 'Private'].map((item, index) => <label className='flex items-center gap-3 border border-border p-4 text-sm' key={item}><input checked={activeIndex === index} name='visibility' onChange={() => setActiveIndex(index)} type='radio' />{gt(item)}</label>) : null}
        {pattern === 'toggles' ? ['Sync brand assets', 'Notify collaborators', 'Auto-publish'].map((item, index) => <button aria-checked={toggleStates[index]} className='flex items-center justify-between border border-border p-4 text-left text-sm' key={item} onClick={() => { setActiveIndex(index); setToggleStates((current) => current.map((value, stateIndex) => stateIndex === index ? !value : value)); }} role='switch' type='button'><span>{gt(item)}</span><span aria-hidden='true' className={`relative h-6 w-11 rounded-full transition-colors ${toggleStates[index] ? 'bg-primary' : 'bg-muted'}`}><span className={`absolute top-1 size-4 rounded-full transition-transform ${toggleStates[index] ? 'translate-x-6 bg-primary-foreground' : 'translate-x-1 bg-foreground/45'}`} /></span></button>) : null}
        {pattern === 'uploaders' ? <label className='grid min-h-56 cursor-pointer place-items-center rounded-md border border-dashed border-input p-8 text-center hover:bg-muted'><span><Upload className='mx-auto mb-4 size-6' /><strong className='block text-sm'><T>Drop a source asset</T></strong><small className='mt-2 block text-muted-foreground'><T>SVG, PNG, JPG, or GIF</T></small></span><input className='sr-only' type='file' /></label> : null}
      </div>
    </PreviewSurface>
  );
}

function NavigationPatternPreview({ activeIndex, disabled, identity, label, pattern, setActiveIndex, spacing }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`min-h-[420px] ${spacing}`}>
        {pattern === 'navigation' ? <nav className='flex items-center justify-between border border-border p-3'><span className='font-semibold'>{identity.shortName}</span><div className='hidden gap-6 text-sm text-muted-foreground sm:flex'>{['Product', 'Docs', 'Customers'].map((item) => <a href={`#${item.toLocaleLowerCase()}`} key={item}>{gt(item)}</a>)}</div><Button size='sm'>{label}</Button></nav> : null}
        {pattern === 'sidebars' ? <div className='grid min-h-80 grid-cols-[180px_1fr] overflow-hidden border border-border'><aside className='border-r border-border p-3'><strong className='px-2 text-sm'>{identity.shortName}</strong><div className='mt-5 flex flex-col gap-1'>{COMPONENT_SIDEBAR_ITEMS.map((item, index) => <button className={`rounded-md px-2 py-2 text-left text-sm ${activeIndex === index ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'}`} key={item} onClick={() => setActiveIndex(index)} type='button'>{gt(item)}</button>)}</div></aside><main className='grid place-items-center text-sm text-muted-foreground'>{gt(COMPONENT_SIDEBAR_ITEMS[activeIndex])}</main></div> : null}
        {pattern === 'tabs' ? <div><div className='flex border-b border-border'>{COMPONENT_TAB_ITEMS.map((item, index) => <button className={`border-b-2 px-4 py-3 text-sm ${activeIndex === index ? 'border-foreground font-medium' : 'border-transparent text-muted-foreground'}`} key={item} onClick={() => setActiveIndex(index)} type='button'>{gt(item)}</button>)}</div><div className='grid min-h-64 place-items-center text-sm text-muted-foreground'>{gt(['Overview content', 'Asset library', 'Revision history'][activeIndex])}</div></div> : null}
        {pattern === 'breadcrumbs' ? <nav aria-label={gt('Breadcrumb')} className='flex items-center gap-2 text-sm'>{['Settings', 'Brand', 'Components'].map((item, index) => <span className='flex items-center gap-2' key={item}><a className={index === 2 ? 'font-medium text-foreground' : 'text-muted-foreground'} href={`#${item.toLocaleLowerCase()}`}>{gt(item)}</a>{index < 2 ? <ChevronRight className='size-3 opacity-40' /> : null}</span>)}</nav> : null}
        {pattern === 'pagination' ? <div className='grid min-h-72 place-items-center'><div className='flex items-center gap-1'><Button aria-label={gt('Previous page')} onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))} size='icon-sm' variant='outline'><ChevronLeft /></Button>{[1, 2, 3, 4].map((page, index) => <Button key={page} onClick={() => setActiveIndex(index)} size='icon-sm' variant={activeIndex === index ? 'default' : 'ghost'}>{page}</Button>)}<Button aria-label={gt('Next page')} onClick={() => setActiveIndex(Math.min(3, activeIndex + 1))} size='icon-sm' variant='outline'><ChevronRight /></Button></div></div> : null}
      </div>
    </PreviewSurface>
  );
}

function OverlayPatternPreview({ activeIndex, checked, disabled, dismissed, label, pattern, setActiveIndex, setChecked, setDismissed, spacing, supportingCopy }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`grid min-h-[500px] place-items-center bg-muted/50 ${spacing}`}>
        {pattern === 'command-menu' ? <div className='w-full max-w-xl rounded-md bg-background p-3 smooth-shadow-ring-2xl'><div className='flex h-12 items-center gap-3 border-b border-border px-3'><Search className='size-4' /><span className='text-sm text-muted-foreground'><T>Search Studio tools…</T></span><kbd className='ml-auto font-mono text-xs text-muted-foreground'>ESC</kbd></div>{['Open brand settings', 'Create a design board', 'Download current canvas'].map((item, index) => <button className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left text-sm ${activeIndex === index ? 'bg-muted' : ''}`} key={item} onMouseEnter={() => setActiveIndex(index)} type='button'><span>{gt(item)}</span><span className='font-mono text-xs opacity-35'>↵</span></button>)}</div> : null}
        {pattern === 'dialogs' ? <dialog aria-labelledby='component-dialog-title' className='relative m-0 w-full max-w-lg rounded-md border-0 bg-background p-6 text-foreground smooth-shadow-ring-2xl' open><div className='flex justify-between gap-6'><div><h3 className='text-lg font-semibold' id='component-dialog-title'>{label}</h3><p className='mt-2 text-sm leading-6 text-muted-foreground'>{supportingCopy}</p></div><Button aria-label={gt('Close')} onClick={() => setDismissed(true)} size='icon-xs' variant='ghost'><X /></Button></div>{dismissed ? <button className='mt-6 text-sm underline' onClick={() => setDismissed(false)} type='button'><T>Restore dialog</T></button> : <div className='mt-6 flex justify-end gap-2'><Button variant='ghost'><T>Cancel</T></Button><Button>{label}</Button></div>}</dialog> : null}
        {pattern === 'popovers' ? <div className='relative'><Button onClick={() => setChecked(!checked)} variant='outline'><Settings /> <T>Options</T></Button>{checked ? <div className='absolute top-12 right-0 w-64 rounded-md bg-background p-2 smooth-shadow-ring-xl'><button className='w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted' type='button'><T>Duplicate project</T></button><button className='w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted' type='button'><T>Share project</T></button><button className='w-full rounded-md px-3 py-2 text-left text-sm text-status-error hover:bg-muted' type='button'><T>Archive project</T></button></div> : null}</div> : null}
        {pattern === 'tooltips' ? <div className='flex gap-5'>{[{ icon: Copy, text: 'Copy' }, { icon: Download, text: 'Download' }, { icon: Settings, text: 'Settings' }].map(({ icon: Icon, text }) => <div className='group relative' key={text}><Button aria-label={gt(text)} size='icon' variant='outline'><Icon /></Button><span className='pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background opacity-0 transition-opacity group-hover:opacity-100'>{gt(text)}</span></div>)}</div> : null}
      </div>
    </PreviewSurface>
  );
}

function FeedbackPatternPreview({ disabled, dismissed, pattern, progress, setDismissed, setProgress, spacing, supportingCopy }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`mx-auto grid min-h-[420px] max-w-3xl content-center gap-4 ${spacing}`}>
        {pattern === 'alerts' ? <><div className='border border-status-success-border bg-status-success-background p-4 text-sm text-status-success'><strong><T>Brand updated</T></strong><p className='mt-1 opacity-75'><T>Every template now uses the latest settings.</T></p></div><div className='border border-status-error-border bg-status-error-background p-4 text-sm text-status-error'><strong><T>Export failed</T></strong><p className='mt-1 opacity-75'><T>Check the source asset and try again.</T></p></div></> : null}
        {pattern === 'toasts' ? (!dismissed ? <div className='ml-auto flex w-full max-w-sm items-start gap-3 rounded-md bg-background p-4 smooth-shadow-ring-xl'><Check className='mt-0.5 size-4 text-status-success' /><div><strong className='text-sm'><T>Export complete</T></strong><p className='mt-1 text-xs text-muted-foreground'>{supportingCopy}</p></div><Button aria-label={gt('Dismiss')} className='ml-auto' onClick={() => setDismissed(true)} size='icon-xs' variant='ghost'><X /></Button></div> : <Button className='mx-auto' onClick={() => setDismissed(false)} variant='outline'><T>Show toast</T></Button>) : null}
        {pattern === 'progress' ? <div className='border border-border p-6'><div className='flex justify-between text-sm'><span><T>Generating assets</T></span><span>{progress}%</span></div><div className='mt-4 h-2 overflow-hidden rounded-full bg-muted'><div className='h-full bg-foreground transition-[width]' style={{ width: `${progress}%` }} /></div><input aria-label={gt('Progress')} className='studio-range mt-6' max={100} min={0} onChange={(event) => setProgress(Number(event.target.value))} type='range' value={progress} /></div> : null}
      </div>
    </PreviewSurface>
  );
}

function DataPatternPreview({ activeIndex, disabled, pattern, setActiveIndex, spacing }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`min-h-[420px] ${spacing}`}>
        {pattern === 'tables' ? <div className='overflow-hidden rounded-md border border-border'><div className='grid grid-cols-3 bg-muted p-3 font-mono text-[10px] uppercase text-muted-foreground'><span><T>Project</T></span><span><T>Status</T></span><span><T>Updated</T></span></div>{['Product', 'Docs', 'Email'].map((item) => <div className='grid grid-cols-3 border-t border-border p-4 text-sm' key={item}><span>{gt(item)}</span><span><T>Ready</T></span><span className='text-muted-foreground'><T>Today</T></span></div>)}</div> : null}
        {pattern === 'stats' ? <div className='grid gap-px overflow-hidden rounded-md bg-border sm:grid-cols-3'>{[['42,851', 'Translations'], ['98.7%', 'Coverage'], ['18.4%', 'Growth']].map(([value, name]) => <div className='bg-background p-6' key={name}><p className='text-3xl font-semibold tracking-tight'>{value}</p><p className='mt-2 text-xs text-muted-foreground'>{gt(name)}</p></div>)}</div> : null}
        {pattern === 'charts' ? <div className='rounded-md border border-border p-6'><div className='flex items-center justify-between'><div><p className='text-sm font-semibold'><T>Asset exports</T></p><p className='mt-1 text-xs text-muted-foreground'><T>Last seven days</T></p></div><strong className='text-2xl'>1,284</strong></div><div className='mt-10 flex h-52 items-end gap-3 border-b border-border'>{[38, 56, 44, 72, 61, 86, 100].map((height, index) => <button aria-label={`${height}%`} className={`min-w-0 flex-1 rounded-t-sm transition-colors ${activeIndex === index ? 'bg-primary' : 'bg-foreground/20 hover:bg-foreground/45'}`} key={height} onClick={() => setActiveIndex(index)} style={{ height: `${height}%` }} type='button' />)}</div></div> : null}
      </div>
    </PreviewSurface>
  );
}

function CommercePatternPreview({ disabled, identity, label, pattern, size, spacing, supportingCopy }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`grid min-h-[460px] place-items-center ${spacing}`}>
        {pattern === 'pricing' ? <article className='flex min-h-80 w-full max-w-sm flex-col justify-between rounded-md border border-border p-7'><div><p className='font-mono text-xs text-muted-foreground'><T>PRO</T></p><h3 className='mt-6 text-5xl font-semibold'>$49</h3><p className='mt-3 text-sm text-muted-foreground'>{supportingCopy}</p><div className='mt-6 flex flex-col gap-3'>{identity.values.slice(0, 3).map((value) => <span className='flex items-center gap-2 text-sm' key={value}><Check className='size-4' />{value}</span>)}</div></div><Button className='mt-8 w-full' size={size}>{label}</Button></article> : null}
        {pattern === 'checkout' ? <div className='grid w-full max-w-3xl overflow-hidden rounded-md border border-border md:grid-cols-[1fr_0.72fr]'><div className='p-7'><p className='text-lg font-semibold'><T>Payment details</T></p><label className='mt-6 flex flex-col gap-2 text-sm'><span><T>Card number</T></span><input className='h-10 rounded-md border border-input bg-background px-3' defaultValue='4242 4242 4242 4242' /></label><div className='mt-4 grid grid-cols-2 gap-4'><input aria-label={gt('Expiration')} className='h-10 rounded-md border border-input bg-background px-3' defaultValue='12 / 28' /><input aria-label={gt('Security code')} className='h-10 rounded-md border border-input bg-background px-3' defaultValue='123' /></div></div><aside className='flex flex-col justify-between border-l border-border bg-muted/40 p-7'><div><p className='text-sm text-muted-foreground'><T>Due today</T></p><p className='mt-2 text-4xl font-semibold'>$49</p></div><Button size={size}>{label}</Button></aside></div> : null}
      </div>
    </PreviewSurface>
  );
}

function MessagingPatternPreview({ activeIndex, disabled, identity, pattern, setActiveIndex, spacing, supportingCopy }: PatternPreviewProps) {
  const gt = useGT();
  return (
    <PreviewSurface disabled={disabled}>
      <div className={`min-h-[460px] ${spacing}`}>
        {pattern === 'inbox' ? <div className='grid overflow-hidden rounded-md border border-border md:grid-cols-[0.8fr_1.2fr]'><div className='border-r border-border p-3'>{COMPONENT_INBOX_ITEMS.map((item, index) => <button className={`w-full rounded-md p-4 text-left ${activeIndex === index ? 'bg-muted' : ''}`} key={item} onClick={() => setActiveIndex(index)} type='button'><strong className='text-sm'>{gt(item)}</strong><p className='mt-2 truncate text-xs text-muted-foreground'>{supportingCopy}</p></button>)}</div><div className='flex min-h-80 flex-col p-6'><h3 className='text-xl font-semibold'>{gt(COMPONENT_INBOX_ITEMS[activeIndex])}</h3><p className='mt-6 text-sm leading-7 text-muted-foreground'>{supportingCopy}</p><Button className='mt-auto w-fit'><T>Reply</T></Button></div></div> : null}
        {pattern === 'comments' ? <div className='mx-auto max-w-2xl space-y-4'>{['Alex Morgan', 'Jamie Lee'].map((name, index) => <article className='rounded-md border border-border p-5' key={name}><div className='flex items-center gap-3'><span className='grid size-9 place-items-center rounded-full bg-foreground text-xs text-background'>{name.split(' ').map((part) => part[0]).join('')}</span><div><strong className='text-sm'>{name}</strong><p className='text-xs text-muted-foreground'>{index === 0 ? gt('Two minutes ago') : gt('Yesterday')}</p></div></div><p className='mt-4 text-sm leading-6'>{index === 0 ? supportingCopy : identity.positioning}</p></article>)}</div> : null}
      </div>
    </PreviewSurface>
  );
}

function ContentPatternPreview({ disabled, identity, label, pattern, spacing, supportingCopy }: PatternPreviewProps) {
  const gt = useGT();
  if (pattern === 'testimonials') {
    return <PreviewSurface disabled={disabled}><div className={`grid min-h-[420px] place-items-center ${spacing}`}><figure className='w-full max-w-2xl rounded-md bg-foreground p-8 text-background'><blockquote className='text-3xl font-semibold leading-tight'>“{supportingCopy}”</blockquote><figcaption className='mt-10'><strong>Alex Morgan</strong><span className='ml-2 text-sm opacity-55'><T>Design Engineer</T></span></figcaption></figure></div></PreviewSurface>;
  }
  if (pattern === 'metadata') {
    return <PreviewSurface disabled={disabled}><div className={`grid min-h-[420px] place-items-center ${spacing}`}><dl className='grid w-full max-w-2xl grid-cols-[140px_1fr] overflow-hidden rounded-md border border-border text-sm'>{[['Title', label], ['Description', supportingCopy], ['Author', identity.name], ['Canonical URL', identity.website]].map(([name, value]) => <div className='contents' key={name}><dt className='border-b border-r border-border bg-muted/50 p-4 font-mono text-xs text-muted-foreground'>{gt(name)}</dt><dd className='border-b border-border p-4 last:border-b-0'>{value}</dd></div>)}</dl></div></PreviewSurface>;
  }
  return (
    <PreviewSurface disabled={disabled}>
      <article className={`mx-auto max-w-3xl ${spacing}`}>
        <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{identity.name} / <T>Field notes</T></p>
        <h2 className='mt-6 text-5xl font-semibold leading-[0.98] tracking-[-0.055em]'>{label}</h2>
        <p className='mt-5 text-lg leading-8 opacity-60'>{supportingCopy}</p>
        <div className='mt-10 grid gap-8 border-y border-border py-8 sm:grid-cols-[0.65fr_1.35fr]'>
          <aside className='text-xs leading-6 opacity-50'>{identity.values.join(' · ')}</aside>
          <div className='space-y-5 text-base leading-8'><p>{identity.positioning}</p><p>{identity.mission}</p><blockquote className='border-l-2 border-foreground pl-5 text-xl font-medium leading-8'>{identity.voice.phrases[0] ?? identity.tagline}</blockquote></div>
        </div>
      </article>
    </PreviewSurface>
  );
}

export default function ComponentLibraryPreview({
  disabled,
  identity,
  label,
  pattern,
  size,
  supportingCopy,
}: ComponentLibraryPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [checked, setChecked] = useState(true);
  const [toggleStates, setToggleStates] = useState([true, false, true]);
  const [dismissed, setDismissed] = useState(false);
  const [progress, setProgress] = useState(68);
  const spacing = size === 'sm' ? 'p-5' : size === 'lg' ? 'p-10' : 'p-8';

  const previewProps: PatternPreviewProps = {
    activeIndex,
    checked,
    disabled,
    dismissed,
    identity,
    label,
    pattern,
    progress,
    setActiveIndex,
    setChecked,
    setDismissed,
    setProgress,
    setToggleStates,
    size,
    spacing,
    supportingCopy,
    toggleStates,
  };

  if (['buttons', 'icon-buttons', 'button-groups'].includes(pattern)) {
    return <ActionPatternPreview {...previewProps} />;
  }

  if (['inputs', 'textareas', 'selects', 'checkboxes', 'radios', 'toggles', 'uploaders'].includes(pattern)) {
    return <FormPatternPreview {...previewProps} />;
  }

  if (['navigation', 'sidebars', 'tabs', 'breadcrumbs', 'pagination'].includes(pattern)) {
    return <NavigationPatternPreview {...previewProps} />;
  }

  if (['command-menu', 'dialogs', 'popovers', 'tooltips'].includes(pattern)) {
    return <OverlayPatternPreview {...previewProps} />;
  }

  if (['alerts', 'toasts', 'progress'].includes(pattern)) {
    return <FeedbackPatternPreview {...previewProps} />;
  }

  if (['tables', 'stats', 'charts'].includes(pattern)) {
    return <DataPatternPreview {...previewProps} />;
  }

  if (['pricing', 'checkout'].includes(pattern)) {
    return <CommercePatternPreview {...previewProps} />;
  }

  if (pattern === 'testimonials') {
    return <ContentPatternPreview {...previewProps} />;
  }

  if (['inbox', 'comments'].includes(pattern)) {
    return <MessagingPatternPreview {...previewProps} />;
  }

  if (pattern === 'metadata') {
    return <ContentPatternPreview {...previewProps} />;
  }
  return <ContentPatternPreview {...previewProps} />;
}
