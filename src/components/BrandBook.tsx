'use client';

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Grid2X2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from '@/components/ui/SolidIcons';
import { T, useGT } from 'gt-next';
import {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';

import { brandTypographyFamily, brandTypographyRole, type BrandIdentity } from '@/lib/brandIdentity';
import {
  BOOK_SECTION_IDS,
  BOOK_SOURCE_SCHEMA,
  BOOK_VARIANT_LABELS,
  bookImageAssetIds,
  bookSource,
  parseBookSource,
  resetBookPage,
  resolveBook,
  sanitizeBookOverrides,
  sectionOrder,
  updateBookPage,
  updateBookSection,
  visibleBookPages,
  type BookOverrides,
  type BookPage,
  type BookSection,
  type BookSectionId,
} from '@/lib/brandBookModel';
import { BRAND_SURFACE_TONE_LABELS, BRAND_SURFACE_TONES, brandPalette, trackingFor, type BrandSurfaceTone } from '@/lib/brandOutputKit';
import { parseSourceObject, stringifySource } from '@/lib/sourceCode';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { registerStudioAutomation } from '@/lib/studioAutomation';
import { capVisibleFontWeight } from '@/lib/typography';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useStudioDraft } from '@/hooks/usePersistentState';

import { BookPageView, type BookPageContext } from './brandBookPages';
import { LabInspectorSection, StudioSidebar } from './LabWorkspace';
import SourceCodeDrawer from './LazySourceCodeDrawer';
import StudioFileMenu from './StudioFileMenu';
import StudioToolHeader from './StudioToolHeader';
import ThemeAwareBrandMark from './ThemeAwareBrandMark';
import { Button } from './ui/Button';
import StudioCheckbox from './ui/StudioCheckbox';
import StudioRange from './ui/StudioRange';
import StudioSelect from './ui/StudioSelect';

import styles from './BrandBook.module.css';

type BookMode = 'overview' | 'reader';

type ReaderEntry = { page: BookPage; section: BookSection };

function sectionNumbers(sections: readonly BookSection[]): Map<string, string> {
  const numbers = new Map<string, string>();
  let index = 0;
  for (const section of sections) {
    if (section.id === 'intro' || section.id === 'closing' || section.hidden) continue;
    index += 1;
    numbers.set(section.id, String(index).padStart(2, '0'));
  }
  return numbers;
}

function rootStyle(identity: BrandIdentity, thumbnailWidth: number): CSSProperties {
  const palette = brandPalette(identity);
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const code = brandTypographyRole(identity, 'Code');
  const accent = brandTypographyRole(identity, 'Accent');
  return {
    '--book-accent': palette.accent,
    '--book-accent-font': `'${brandTypographyFamily(identity, 'Accent')}', var(--book-display)`,
    '--book-accent-weight': capVisibleFontWeight(accent.weight ?? 400),
    '--book-body': `'${brandTypographyFamily(identity, 'Body')}', sans-serif`,
    '--book-body-weight': capVisibleFontWeight(body.weight ?? 400),
    '--book-code': `'${brandTypographyFamily(identity, 'Code')}', monospace`,
    '--book-code-weight': capVisibleFontWeight(code.weight ?? 400),
    '--book-deep': palette.deep,
    '--book-display': `'${brandTypographyFamily(identity, 'Display')}', sans-serif`,
    '--book-display-leading': Math.min(1.08, Math.max(0.9, display.lineHeight ?? 1)),
    '--book-display-tracking': `${trackingFor(100, display.letterSpacing) / 100}em`,
    '--book-display-weight': capVisibleFontWeight(display.weight ?? 500),
    '--book-ink': palette.ink,
    '--book-muted': palette.muted,
    '--book-paper': palette.paper,
    '--book-radius': `${Math.min(identity.style?.borderRadius ?? 6, 12) / 16}cqi`,
    '--book-thumb-width': `${thumbnailWidth}px`,
  } as CSSProperties;
}

export default function BrandBook({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const scope = `bb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const studioRootRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<BookMode>('overview');
  const [currentPageId, setCurrentPageId] = useState<string>('cover');
  const [thumbnailWidth, setThumbnailWidth] = useState(272);
  const [sourceOpen, setSourceOpen] = useState(false);
  // Overview rows far from the viewport render placeholders; printing renders every page.
  const [printing, setPrinting] = useState(false);
  const canvasRef = useRef<HTMLElement>(null);
  const [storedOverrides, setStoredOverrides] = useStudioDraft<BookOverrides>(identity.id, tool.id, 'book', {});
  const overrides = useMemo(() => sanitizeBookOverrides(identity, storedOverrides), [identity, storedOverrides]);
  const sections = useMemo(() => resolveBook(identity, overrides), [identity, overrides]);
  const palette = useMemo(() => brandPalette(identity), [identity]);
  const visible = useMemo(() => visibleBookPages(sections), [sections]);
  const folios = useMemo(() => new Map(visible.map((page) => [page.id, page.folio])), [visible]);
  const numbers = useMemo(() => sectionNumbers(sections), [sections]);
  const readerPages = useMemo<ReaderEntry[]>(() => sections.flatMap((section) => section.pages.map((page) => ({ page, section }))), [sections]);
  const currentIndex = Math.max(0, readerPages.findIndex(({ page }) => page.id === currentPageId));
  const current = readerPages[currentIndex]!;
  const imageOptions = useMemo(() => {
    const labels = new Map(identity.assets.map((asset) => [asset.id, asset.label]));
    return bookImageAssetIds(identity).map((id) => ({ label: labels.get(id) ?? id, value: id }));
  }, [identity]);
  const style = rootStyle(identity, thumbnailWidth);

  function commit(next: BookOverrides) {
    setStoredOverrides(next);
  }

  function onCopy(pageId: string, slot: string, value: string) {
    commit(updateBookPage(identity, overrides, pageId, { copy: { [slot]: value } }));
  }

  // Stable callback identity keeps memoized pages from re-rendering on unrelated edits.
  const onCopyRef = useCommittedRef(onCopy);
  const stableOnCopy = useMemo(() => (pageId: string, slot: string, value: string) => onCopyRef.current(pageId, slot, value), [onCopyRef]);

  const overviewBase = useMemo(() => ({
    editable: false,
    folios,
    identity,
    onCopy: stableOnCopy,
    palette,
    scope,
    sections,
  }), [folios, identity, palette, scope, sections, stableOnCopy]);

  function pageContext(entry: ReaderEntry, editable: boolean): BookPageContext {
    return {
      editable,
      folios,
      identity,
      onCopy: stableOnCopy,
      page: entry.page,
      palette,
      scope,
      sectionNumber: numbers.get(entry.section.id) ?? '',
      sections,
    };
  }

  useEffect(() => {
    if (mode !== 'reader') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'ArrowLeft') setCurrentPageId(readerPages[Math.max(0, currentIndex - 1)]!.page.id);
      if (event.key === 'ArrowRight') setCurrentPageId(readerPages[Math.min(readerPages.length - 1, currentIndex + 1)]!.page.id);
      if (event.key === 'Escape') setMode('overview');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, mode, readerPages]);

  const openPage = useMemo(() => (pageId: string) => {
    setCurrentPageId(pageId);
    setMode('reader');
  }, []);

  function jumpToSection(sectionId: string) {
    const section = sections.find(({ id }) => id === sectionId);
    if (mode === 'reader') {
      if (section?.pages[0]) setCurrentPageId(section.pages[0].id);
      return;
    }
    document.getElementById(`brand-book-${identity.id}-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
  }

  function printBook() {
    const previousMode = mode;
    flushSync(() => {
      setPrinting(true);
      setMode('overview');
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      window.print();
      setPrinting(false);
      setMode(previousMode);
    }));
  }

  useEffect(() => {
    // Browser print (Cmd+P) and print emulation also need every page rendered.
    const query = window.matchMedia('print');
    const start = () => flushSync(() => setPrinting(true));
    const end = () => setPrinting(false);
    const change = (event: MediaQueryListEvent) => (event.matches ? start() : end());
    window.addEventListener('beforeprint', start);
    window.addEventListener('afterprint', end);
    query.addEventListener('change', change);
    return () => {
      window.removeEventListener('beforeprint', start);
      window.removeEventListener('afterprint', end);
      query.removeEventListener('change', change);
    };
  }, []);

  function readSource(): string {
    return stringifySource(bookSource(identity, overrides));
  }

  function applySource(source: string) {
    const parsed = parseSourceObject(source);
    if (parsed.schema !== undefined && parsed.schema !== BOOK_SOURCE_SCHEMA) throw new RangeError(`Brand book source schema must be ${BOOK_SOURCE_SCHEMA}.`);
    commit(parseBookSource(identity, parsed, overrides));
  }

  const automationRef = useCommittedRef({ applySource, printBook, readSource });
  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('brand-book'),
    applySource: (source) => automationRef.current.applySource(source),
    getSource: () => automationRef.current.readSource(),
    invoke: (action) => {
      if (action !== 'brand-book.print') throw new RangeError(`Unknown Brand book action: ${action}.`);
      automationRef.current.printBook();
      return null;
    },
    toolId: 'brand-book',
  }, studioRootRef.current), [automationRef]);

  return (
    <div className={styles.root} data-brand={identity.id} data-flavor={identity.artDirection.preview} data-mode={mode} ref={studioRootRef} style={style}>
      <StudioToolHeader
        actions={(
          <>
            <StudioFileMenu onSource={() => setSourceOpen(true)} />
            <button className={styles.exportButton} onClick={printBook} type='button'><Download aria-hidden='true' /><span><T>Export PDF</T></span></button>
          </>
        )}
        context={mode === 'overview' ? (
          <label className={styles.zoomControl}>
            <Minus aria-hidden='true' />
            <StudioRange aria-label={gt('Page thumbnail size')} max='420' min='200' onChange={(event) => setThumbnailWidth(Number(event.target.value))} value={thumbnailWidth} />
            <Plus aria-hidden='true' />
          </label>
        ) : (
          <span className={styles.pageCounter}>{currentIndex + 1} / {readerPages.length}</span>
        )}
        metadata={`${identity.name} · ${visible.length} pages`}
        navigation={<div className={styles.modeSwitch}>
          <button aria-pressed={mode === 'overview'} onClick={() => setMode('overview')} type='button'><Grid2X2 aria-hidden='true' /><span><T>Overview</T></span></button>
          <button aria-pressed={mode === 'reader'} onClick={() => setMode('reader')} type='button'><Maximize2 aria-hidden='true' /><span><T>Read</T></span></button>
        </div>}
        navigationLabel={gt('Brand book view')}
        title={gt(tool.name)}
        toolId={tool.id}
      />

      <div className={styles.body} data-inspector={mode === 'reader' || undefined}>
        <aside className={styles.navigator}>
          <div className={styles.navigatorIdentity}>
            <div><ThemeAwareBrandMark className={styles.navigatorMark} identity={identity} /></div>
            <span><strong>{identity.name}</strong><small>Brand book / rev. {identity.revision}</small></span>
          </div>
          <button className={styles.navIntroduction} onClick={() => jumpToSection('intro')} type='button'><span>—</span><strong>Introduction</strong><small>03</small></button>
          <nav aria-label={gt('Brand book sections')}>
            {sectionOrder(overrides).map((sectionId, index, order) => {
              const section = sections.find(({ id }) => id === sectionId)!;
              const active = mode === 'reader' && current.section.id === sectionId;
              const count = section.pages.filter((page) => !page.hidden).length;
              return (
                <div className={styles.navRow} data-hidden={section.hidden || undefined} key={sectionId}>
                  <button aria-current={active ? 'page' : undefined} className={styles.navSection} onClick={() => jumpToSection(sectionId)} type='button'>
                    <span>{numbers.get(sectionId) ?? '··'}</span><strong>{section.name}</strong><small>{String(count).padStart(2, '0')}</small>
                  </button>
                  <span className={styles.navActions}>
                    <button aria-label={`${section.hidden ? 'Show' : 'Hide'} ${section.name} section`} onClick={() => commit(updateBookSection(overrides, sectionId, { hidden: !section.hidden }))} title={section.hidden ? 'Show section' : 'Hide section'} type='button'>{section.hidden ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}</button>
                    <button aria-label={`Move ${section.name} section earlier`} disabled={index === 0} onClick={() => commit(updateBookSection(overrides, sectionId, { move: -1 }))} type='button'><ArrowUp aria-hidden='true' /></button>
                    <button aria-label={`Move ${section.name} section later`} disabled={index === order.length - 1} onClick={() => commit(updateBookSection(overrides, sectionId, { move: 1 }))} type='button'><ArrowDown aria-hidden='true' /></button>
                  </span>
                </div>
              );
            })}
          </nav>
          <div className={styles.navigatorPalette}>{identity.colors.slice(0, 8).map((color) => <span key={color.id} style={{ background: color.hex }} title={`${color.name} ${color.hex}`} />)}</div>
        </aside>

        <main className={styles.canvas} ref={canvasRef}>
          {mode === 'overview' ? (
            <div className={styles.overviewBoard}>
              {sections.map((section, index) => (
                <OverviewRow
                  base={overviewBase}
                  eager={printing || index < 3}
                  folios={folios}
                  id={`brand-book-${identity.id}-${section.id}`}
                  key={section.id}
                  onOpen={openPage}
                  root={canvasRef}
                  section={section}
                  sectionNumber={numbers.get(section.id) ?? ''}
                />
              ))}
            </div>
          ) : (
            <div className={styles.reader}>
              <button aria-label={gt('Previous page')} className={styles.readerArrow} disabled={currentIndex === 0} onClick={() => setCurrentPageId(readerPages[currentIndex - 1]!.page.id)} type='button'><ChevronLeft aria-hidden='true' /></button>
              <div className={styles.readerPage} key={current.page.id}>
                <BookPageView context={pageContext(current, true)} folio={folios.get(current.page.id)} sectionName={current.section.name} />
              </div>
              <button aria-label={gt('Next page')} className={styles.readerArrow} disabled={currentIndex === readerPages.length - 1} onClick={() => setCurrentPageId(readerPages[currentIndex + 1]!.page.id)} type='button'><ChevronRight aria-hidden='true' /></button>
            </div>
          )}
        </main>

        {mode === 'reader' ? (
          <PageInspector
            imageOptions={imageOptions}
            onPage={(patch) => commit(updateBookPage(identity, overrides, current.page.id, patch))}
            onReset={() => commit(resetBookPage(overrides, current.page.id))}
            onSection={(patch) => commit(updateBookSection(overrides, current.section.id as BookSectionId, patch))}
            entry={current}
          />
        ) : null}
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · brand book sections, pages, layouts, surfaces, images, and copy'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={readSource()}
          title={`${identity.name} brand book source`}
        />
      ) : null}
    </div>
  );
}

type OverviewRowProps = {
  base: Omit<BookPageContext, 'page' | 'sectionNumber'>;
  eager: boolean;
  folios: ReadonlyMap<string, number>;
  id: string;
  onOpen: (pageId: string) => void;
  root: RefObject<HTMLElement | null>;
  section: BookSection;
  sectionNumber: string;
};

/** A section row that only builds its pages once it nears the viewport. */
const OverviewRow = memo(function OverviewRow({ base, eager, folios, id, onOpen, root, section, sectionNumber }: OverviewRowProps) {
  const rowRef = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || near) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true);
    }, { root: root.current, rootMargin: '600px 0px' });
    observer.observe(row);
    return () => observer.disconnect();
  }, [near, root]);

  const render = eager || near;
  return (
    <section className={styles.overviewRow} data-hidden={section.hidden || undefined} id={id} ref={rowRef}>
      {section.pages.map((page) => (
        <button className={styles.pageButton} data-hidden={page.hidden || section.hidden || undefined} key={page.id} onClick={() => onOpen(page.id)} type='button'>
          {render
            ? <BookPageView context={{ ...base, page, sectionNumber }} folio={folios.get(page.id)} sectionName={section.name} />
            : <span aria-label={page.title} className={styles.pagePlaceholder} role='img' />}
          <span className={styles.thumbnailCaption}><strong>{folios.has(page.id) ? String(folios.get(page.id)).padStart(2, '0') : 'Hidden'}</strong>{page.title}</span>
        </button>
      ))}
    </section>
  );
});

function PageInspector({
  entry,
  imageOptions,
  onPage,
  onReset,
  onSection,
}: {
  entry: ReaderEntry;
  imageOptions: ReadonlyArray<{ label: string; value: string }>;
  onPage: (patch: { assetId?: string; copy?: Record<string, string>; hidden?: boolean; tone?: BrandSurfaceTone; variant?: string }) => void;
  onReset: () => void;
  onSection: (patch: { hidden?: boolean; move?: -1 | 1 }) => void;
}) {
  const gt = useGT();
  const { page, section } = entry;
  const reorderable = BOOK_SECTION_IDS.includes(section.id as BookSectionId);
  return (
    <StudioSidebar className={styles.inspector} label={gt('Brand book page controls')} side='right' storageKey='brand-book-inspector'>
      <LabInspectorSection action={(
        <Button aria-label={gt('Reset page')} onClick={onReset} size='icon-xs' title={gt('Reset page')} type='button' variant='ghost'>
          <RotateCcw aria-hidden='true' />
        </Button>
      )} meta={page.id} title={page.title}>
        <label className='element-editor-toggle'>
          <span><T>Show page</T></span>
          <StudioCheckbox aria-label='Show page' checked={!page.hidden} onChange={(event) => onPage({ hidden: !event.target.checked })} variant='switch' />
        </label>
        <div className='element-editor-field'>
          <span><T>Layout</T></span>
          <StudioSelect ariaLabel='Page layout' onValueChange={(variant) => onPage({ variant })} options={page.variants.map((variant) => ({ label: BOOK_VARIANT_LABELS[variant] ?? variant, value: variant }))} value={page.variant} />
        </div>
        <div className='element-editor-field'>
          <span><T>Surface</T></span>
          <StudioSelect ariaLabel='Page surface' onValueChange={(tone) => onPage({ tone: tone as BrandSurfaceTone })} options={BRAND_SURFACE_TONES.map((tone) => ({ label: BRAND_SURFACE_TONE_LABELS[tone], value: tone }))} value={page.tone} />
        </div>
        {page.image ? (
          <div className='element-editor-field'>
            <span><T>Image</T></span>
            <StudioSelect ariaLabel='Page image' onValueChange={(assetId) => onPage({ assetId: assetId === 'none' ? '' : assetId })} options={[{ label: 'Graphic device', value: 'none' }, ...imageOptions]} value={page.assetId || 'none'} />
          </div>
        ) : null}
      </LabInspectorSection>
      <LabInspectorSection title={<T>Copy</T>}>
        <p className='text-xs leading-5 text-muted-foreground'><T>Click any text on the page to edit it in place.</T></p>
        {Object.entries(page.copy).map(([slot, value]) => (
          <label className='element-editor-field' key={slot}>
            <span className='capitalize'>{slot}</span>
            <textarea aria-label={`Page ${slot} copy`} className='min-h-16 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none focus:border-foreground' maxLength={1200} onChange={(event) => onPage({ copy: { [slot]: event.target.value } })} value={value} />
          </label>
        ))}
      </LabInspectorSection>
      {reorderable ? (
        <LabInspectorSection meta={section.hidden ? 'Hidden' : undefined} title={section.name}>
          <label className='element-editor-toggle'>
            <span><T>Show section</T></span>
            <StudioCheckbox aria-label='Show section' checked={!section.hidden} onChange={(event) => onSection({ hidden: !event.target.checked })} variant='switch' />
          </label>
          <div className='grid grid-cols-2 gap-2'>
            <Button onClick={() => onSection({ move: -1 })} size='sm' type='button' variant='outline'><ArrowUp aria-hidden='true' /><T>Earlier</T></Button>
            <Button onClick={() => onSection({ move: 1 })} size='sm' type='button' variant='outline'><ArrowDown aria-hidden='true' /><T>Later</T></Button>
          </div>
        </LabInspectorSection>
      ) : null}
    </StudioSidebar>
  );
}
