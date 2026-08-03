'use client';

import {
  Asterisk,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Grid2X2,
  Layers3,
  Maximize2,
  Minus,
  MoveUpRight,
  Plus,
  Rows3,
  Sparkles,
  Square,
  Target,
  Triangle,
  X,
} from 'lucide-react';
import { T, useGT } from 'gt-next';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import {
  brandAssetPath,
  brandTypographyFamily,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { mixHexColors } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';

import styles from './BrandBook.module.css';

type BookTone = 'accent' | 'dark' | 'muted' | 'paper';
type BookMode = 'overview' | 'reader';

type BookSection = {
  description: string;
  id: number;
  name: string;
};

type BookPageSpec = {
  content: ReactNode;
  id: string;
  section: number;
  showChrome?: boolean;
  title: string;
  tone?: BookTone;
};

const BOOK_SECTIONS: readonly BookSection[] = [
  { id: 0, name: 'Foundations', description: 'The premise, strategy, audience, personality, and voice.' },
  { id: 1, name: 'Logo', description: 'The primary mark, family, clear space, surfaces, and discipline.' },
  { id: 2, name: 'Typography', description: 'Typefaces, hierarchy, roles, scale, and editorial rhythm.' },
  { id: 3, name: 'Color', description: 'Core palette, tonal ranges, pairings, and contrast behavior.' },
  { id: 4, name: 'Illustration', description: 'Image direction, the graphic device, patterns, and motion.' },
  { id: 5, name: 'Iconography', description: 'Construction, optical character, scale, and usage rules.' },
  { id: 6, name: 'Composition', description: 'Grid, hierarchy, pacing, density, and application logic.' },
  { id: 7, name: 'Showcase', description: 'The complete identity behaving across real touchpoints.' },
];

const INTRO_SECTION = -1;

function colorById(identity: BrandIdentity, id: string, fallbackIndex: number): string {
  return identity.colors.find((color) => color.id === id)?.hex
    ?? identity.colors[fallbackIndex]?.hex
    ?? '#181818';
}

function hexChannels(value: string): [number, number, number] {
  const normalized = value.replace('#', '');
  const hex = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized;
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as [number, number, number];
}

function relativeLuminance(value: string): number {
  const channels = hexChannels(value).map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastText(background: string, dark = '#121212', light = '#FFFFFF'): string {
  return contrastRatio(background, light) >= contrastRatio(background, dark) ? light : dark;
}

function sectionLabel(sectionId: number): string {
  const section = BOOK_SECTIONS.find(({ id }) => id === sectionId);
  return section ? `${section.id}.0 ${section.name}` : 'Brand book';
}

function BookImage({ asset, identity, position = 'center' }: {
  asset?: BrandAsset;
  identity: BrandIdentity;
  position?: string;
}) {
  if (!asset) {
    return (
      <div className={styles.patternField} data-pattern={identity.graphicSystem.pattern}>
        <span>{identity.shortName}</span>
      </div>
    );
  }

  return (
    <img
      alt={asset.alt ?? asset.label}
      className={styles.bookImage}
      data-treatment={identity.style.imageTreatment}
      src={asset.path}
      style={{ objectPosition: position }}
    />
  );
}

function PageFrame({
  identity,
  pageNumber,
  spec,
}: {
  identity: BrandIdentity;
  pageNumber: number;
  spec: BookPageSpec;
}) {
  const lightMark = brandAssetPath(identity, 'mark-light') ?? brandAssetPath(identity, 'mark-dark');
  const darkMark = brandAssetPath(identity, 'mark-dark') ?? lightMark;
  const logo = spec.tone === 'dark' ? lightMark : darkMark;

  return (
    <article
      aria-label={`${pageNumber}. ${spec.title}`}
      className={styles.page}
      data-book-page={spec.id}
      data-chrome={spec.showChrome === false ? 'false' : 'true'}
      data-tone={spec.tone ?? 'paper'}
    >
      {spec.showChrome === false ? null : (
        <header className={styles.pageHeader}>
          <span>{identity.name} / Brand book</span>
          <span>{sectionLabel(spec.section)}</span>
        </header>
      )}
      <div className={styles.pageContent}>{spec.content}</div>
      {spec.showChrome === false ? null : (
        <footer className={styles.pageFooter}>
          <span>{String(pageNumber).padStart(2, '0')}</span>
          {logo ? <img alt='' aria-hidden='true' src={logo} /> : <span>{identity.shortName}</span>}
        </footer>
      )}
    </article>
  );
}

function SectionCover({ identity, section }: { identity: BrandIdentity; section: BookSection }) {
  const mark = brandAssetPath(identity, 'mark-light') ?? brandAssetPath(identity, 'mark-dark');
  return (
    <div className={styles.sectionCover}>
      <div className={styles.sectionCoverMeta}>
        <span>{identity.name}</span>
        <span>Identity standards / {String(section.id + 1).padStart(2, '0')}</span>
      </div>
      <div className={styles.sectionCoverTitle}>
        <strong>{section.id}.0</strong>
        <h2>{section.name}</h2>
      </div>
      {mark ? <img alt='' aria-hidden='true' src={mark} /> : null}
    </div>
  );
}

function SectionIntroduction({ identity, section, text }: {
  identity: BrandIdentity;
  section: BookSection;
  text: string;
}) {
  const mark = brandAssetPath(identity, 'mark-dark');
  return (
    <div className={styles.sectionIntroduction}>
      <span className={styles.sectionNumeral}>{section.id}.0</span>
      <p>{text}</p>
      <div className={styles.sectionIntroductionFooter}>
        <span>{section.description}</span>
        {mark ? <img alt='' aria-hidden='true' src={mark} /> : null}
      </div>
    </div>
  );
}

function buildBrandBookPages(identity: BrandIdentity): BookPageSpec[] {
  const pages: BookPageSpec[] = [];
  const paper = colorById(identity, 'paper', 1);
  const ink = colorById(identity, 'ink', 0);
  const accent = colorById(identity, 'emphasis', 3);
  const muted = colorById(identity, 'muted', 2);
  const darkMark = brandAssetPath(identity, 'mark-dark');
  const lightMark = brandAssetPath(identity, 'mark-light') ?? darkMark;
  const wordmark = brandAssetPath(identity, 'wordmark') ?? darkMark;
  const wordmarkLight = brandAssetPath(identity, 'wordmark-light') ?? lightMark;
  const visualAssets = identity.assets.filter((asset) =>
    ['background', 'image', 'motion', 'product', 'texture'].includes(asset.type)
  );
  const allVisualAssets = visualAssets.length > 0
    ? visualAssets
    : identity.assets.filter((asset) => asset.type !== 'logo');
  const image = (index: number) => allVisualAssets[index % Math.max(1, allVisualAssets.length)];
  const section = (id: number) => BOOK_SECTIONS.find((candidate) => candidate.id === id)!;
  const add = (spec: BookPageSpec) => pages.push(spec);
  const addSectionStart = (id: number, introduction: string) => {
    const activeSection = section(id);
    add({
      id: `${id}-cover`,
      section: id,
      showChrome: false,
      title: activeSection.name,
      tone: 'dark',
      content: <SectionCover identity={identity} section={activeSection} />,
    });
    add({
      id: `${id}-introduction`,
      section: id,
      showChrome: false,
      title: `${activeSection.name} introduction`,
      tone: 'accent',
      content: <SectionIntroduction identity={identity} section={activeSection} text={introduction} />,
    });
  };

  add({
    id: 'cover',
    section: INTRO_SECTION,
    showChrome: false,
    title: 'Brand book',
    tone: 'dark',
    content: (
      <div className={styles.bookCover}>
        <div className={styles.coverSignal} aria-hidden='true'>
          <span />
          <span />
          <span />
        </div>
        <div className={styles.coverTopline}>
          <span>{identity.name}</span>
          <span>Edition {new Date().getFullYear()}</span>
        </div>
        <div className={styles.coverTitle}>
          <span>Brand</span>
          <span>Book</span>
        </div>
        <div className={styles.coverBottom}>
          <p>{identity.tagline}</p>
          {lightMark ? <img alt={`${identity.name} mark`} src={lightMark} /> : null}
        </div>
      </div>
    ),
  });
  add({
    id: 'foreword',
    section: INTRO_SECTION,
    showChrome: false,
    title: 'Using this book',
    tone: 'accent',
    content: (
      <div className={styles.foreword}>
        <span className={styles.microLabel}>Introduction / {identity.shortName}</span>
        <blockquote>{identity.description}</blockquote>
        <p>This document defines the ideas and repeatable choices that make {identity.name} recognizable. Use it as a shared standard—not a collection of decoration.</p>
        <div className={styles.forewordMeta}>
          <span>Built for {identity.audiences.slice(0, 2).join(' and ').toLocaleLowerCase()}.</span>
          <span>Revision {identity.revision}</span>
        </div>
      </div>
    ),
  });
  add({
    id: 'contents',
    section: INTRO_SECTION,
    title: 'Table of contents',
    content: (
      <div className={styles.contentsPage}>
        <h1>Table of Contents</h1>
        <div className={styles.contentsList}>
          {BOOK_SECTIONS.map((item) => (
            <div key={item.id}>
              <span>{item.id}.0</span>
              <strong>{item.name}</strong>
              <span>{String(item.id * 6 + 4).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  });

  addSectionStart(0, identity.dossier.premise);
  add({
    id: '0-premise',
    section: 0,
    title: 'Brand premise',
    content: (
      <div className={styles.statementPage}>
        <span className={styles.microLabel}>Premise</span>
        <h1>{identity.strategy.concept}</h1>
        <div className={styles.statementAside}>
          <p>{identity.positioning}</p>
          <span>{identity.website}</span>
        </div>
      </div>
    ),
  });
  add({
    id: '0-strategy',
    section: 0,
    title: 'Strategy',
    content: (
      <div className={styles.strategyPage}>
        <span className={styles.microLabel}>Strategy / from challenge to outcome</span>
        <div className={styles.strategyFlow}>
          <article><span>01</span><h2>Challenge</h2><p>{identity.strategy.challenge}</p></article>
          <i aria-hidden='true' />
          <article><span>02</span><h2>Promise</h2><p>{identity.strategy.promise}</p></article>
          <i aria-hidden='true' />
          <article><span>03</span><h2>Outcome</h2><p>{identity.strategy.outcome}</p></article>
        </div>
      </div>
    ),
  });
  add({
    id: '0-mission',
    section: 0,
    title: 'Mission and position',
    tone: 'muted',
    content: (
      <div className={styles.splitStatementPage}>
        <div><span className={styles.microLabel}>Mission</span><h2>{identity.mission}</h2></div>
        <div><span className={styles.microLabel}>Position</span><p>{identity.positioning}</p></div>
      </div>
    ),
  });
  add({
    id: '0-audience',
    section: 0,
    title: 'Audience and personality',
    content: (
      <div className={styles.matrixPage}>
        <span className={styles.microLabel}>Audience × personality</span>
        <div className={styles.matrixGrid}>
          {identity.audiences.slice(0, 4).map((audience, index) => (
            <article key={audience}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{audience}</strong>
              <p>{identity.strategy.personality[index % identity.strategy.personality.length]}</p>
            </article>
          ))}
        </div>
      </div>
    ),
  });
  add({
    id: '0-voice',
    section: 0,
    title: 'Voice and character',
    content: (
      <div className={styles.voicePage}>
        <blockquote>“{identity.voice.phrases[0] ?? identity.tagline}”</blockquote>
        <div className={styles.voiceColumns}>
          <div><span className={styles.microLabel}>Sound like</span>{identity.voice.principles.map((item) => <p key={item}><Check />{item}</p>)}</div>
          <div><span className={styles.microLabel}>Never sound like</span>{identity.voice.avoid.map((item) => <p key={item}><X />{item}</p>)}</div>
        </div>
      </div>
    ),
  });

  addSectionStart(1, identity.dossier.logo);
  add({
    id: '1-primary',
    section: 1,
    title: 'Primary mark',
    content: (
      <div className={styles.logoHeroPage}>
        <span className={styles.microLabel}>Primary mark</span>
        {darkMark ? <img alt={`${identity.name} primary mark`} src={darkMark} /> : <strong>{identity.shortName}</strong>}
        <p>The mark is a signature, not a decoration. Give it enough quiet space to remain exact and immediately recognizable.</p>
      </div>
    ),
  });
  add({
    id: '1-family',
    section: 1,
    title: 'Logo family',
    content: (
      <div className={styles.logoFamilyPage}>
        <span className={styles.microLabel}>Responsive logo family</span>
        <div className={styles.logoFamilyGrid}>
          <div>{darkMark ? <img alt='Primary mark on light' src={darkMark} /> : null}<span>Mark / light</span></div>
          <div>{wordmark ? <img alt='Primary wordmark on light' src={wordmark} /> : null}<span>Wordmark / light</span></div>
          <div data-inverse='true'>{lightMark ? <img alt='Primary mark on dark' src={lightMark} /> : null}<span>Mark / dark</span></div>
          <div data-inverse='true'>{wordmarkLight ? <img alt='Primary wordmark on dark' src={wordmarkLight} /> : null}<span>Wordmark / dark</span></div>
        </div>
      </div>
    ),
  });
  add({
    id: '1-clearspace',
    section: 1,
    title: 'Clear space',
    tone: 'muted',
    content: (
      <div className={styles.clearspacePage}>
        <span className={styles.microLabel}>Clear space / minimum field</span>
        <div className={styles.clearspaceDiagram}>
          <span className={styles.measureTop}>1×</span><span className={styles.measureSide}>1×</span>
          {darkMark ? <img alt={`${identity.name} mark clear-space diagram`} src={darkMark} /> : null}
        </div>
        <p>Use one mark-width around the signature whenever possible. At small sizes, protect recognition before adding information.</p>
      </div>
    ),
  });
  add({
    id: '1-colorways',
    section: 1,
    title: 'Logo colorways',
    content: (
      <div className={styles.colorwayPage}>
        <span className={styles.microLabel}>Approved surface behavior</span>
        <div className={styles.colorwayGrid}>
          {[paper, muted, accent, ink].map((color, index) => {
            const isDark = contrastText(color) === '#FFFFFF';
            const activeLogo = isDark ? lightMark : darkMark;
            return <div key={`${color}-${index}`} style={{ background: color, color: contrastText(color) }}>{activeLogo ? <img alt='' aria-hidden='true' src={activeLogo} /> : null}<span>{color}</span></div>;
          })}
        </div>
      </div>
    ),
  });
  add({
    id: '1-discipline',
    section: 1,
    title: 'Logo discipline',
    content: (
      <div className={styles.disciplinePage}>
        <div><span className={styles.ruleIcon}><Check /></span><h2>Keep it intact</h2><p>{identity.graphicSystem.rules.find((rule) => rule.toLocaleLowerCase().includes('logo') || rule.toLocaleLowerCase().includes('mark')) ?? 'Use the approved artwork without altering its proportions.'}</p></div>
        <div><span className={styles.ruleIcon}><X /></span><h2>Avoid invention</h2><p>{identity.dossier.prohibited.find((rule) => rule.toLocaleLowerCase().includes('logo') || rule.toLocaleLowerCase().includes('mark')) ?? 'Do not stretch, outline, rotate, shadow, or decorate the signature.'}</p></div>
      </div>
    ),
  });

  addSectionStart(2, identity.dossier.typography);
  const displayType = identity.typography.find((font) => font.role === 'Display') ?? identity.typography[0];
  const bodyType = identity.typography.find((font) => font.role === 'Body') ?? identity.typography[1] ?? displayType;
  add({
    id: '2-display',
    section: 2,
    title: 'Display typeface',
    content: (
      <div className={styles.typefacePage}>
        <span className={styles.microLabel}>Primary / display</span>
        <h1>{displayType?.family ?? 'Display'}</h1>
        <div className={styles.typefaceAlphabet}>Aa Bb Cc Dd<br />0123456789</div>
        <p>{displayType?.usage}</p>
      </div>
    ),
  });
  add({
    id: '2-body',
    section: 2,
    title: 'Body typeface',
    content: (
      <div className={styles.bodyTypefacePage}>
        <span className={styles.microLabel}>Secondary / body</span>
        <h1 style={{ fontFamily: bodyType?.family }}>{bodyType?.family ?? 'Body'}</h1>
        <div>
          <p style={{ fontFamily: bodyType?.family }}>{identity.description}</p>
          <span>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br />abcdefghijklmnopqrstuvwxyz<br />0123456789 — ?!@#%&amp;</span>
        </div>
      </div>
    ),
  });
  add({
    id: '2-roles',
    section: 2,
    title: 'Typographic roles',
    content: (
      <div className={styles.typeRolesPage}>
        <span className={styles.microLabel}>System roles</span>
        <div className={styles.typeRolesGrid}>
          {identity.typography.map((type) => (
            <article key={type.role} style={{ fontFamily: type.family }}>
              <span>{type.role}</span><strong>Aa.</strong><p>{type.family}<br />{type.weight ?? 400} weight</p>
            </article>
          ))}
        </div>
      </div>
    ),
  });
  add({
    id: '2-hierarchy',
    section: 2,
    title: 'Type hierarchy',
    tone: 'muted',
    content: (
      <div className={styles.typeScalePage}>
        <span className={styles.microLabel}>Recommended hierarchy</span>
        <div className={styles.typeScaleRows}>
          <div><span>Display / 96</span><strong>{identity.tagline}</strong></div>
          <div><span>Heading / 48</span><strong>{identity.strategy.promise}</strong></div>
          <div><span>Body / 18</span><p>{identity.mission}</p></div>
          <div><span>Metadata / 12</span><code>{identity.socialHandle} · {identity.website}</code></div>
        </div>
      </div>
    ),
  });
  add({
    id: '2-specimen',
    section: 2,
    title: 'Type specimen',
    tone: 'dark',
    content: (
      <div className={styles.typeSpecimenPage}>
        <span>{identity.greetings[0] ?? identity.shortName}</span>
        <span>{identity.greetings[1] ?? identity.tagline}</span>
        <span>{identity.greetings[2] ?? identity.strategy.concept}</span>
      </div>
    ),
  });

  addSectionStart(3, identity.dossier.color);
  add({
    id: '3-palette',
    section: 3,
    title: 'Core palette',
    content: (
      <div className={styles.palettePage}>
        <span className={styles.microLabel}>Core palette / semantic roles</span>
        <div className={styles.paletteGrid}>
          {identity.colors.map((color) => (
            <article key={color.id} style={{ background: color.hex, color: contrastText(color.hex) }}>
              <strong>{color.name}</strong><span>{color.hex}</span><p>{color.role}</p>
            </article>
          ))}
        </div>
      </div>
    ),
  });
  add({
    id: '3-primary',
    section: 3,
    title: 'Primary colors',
    content: (
      <div className={styles.primaryColorPage}>
        {identity.colors.slice(0, 4).map((color, index) => (
          <article key={color.id} style={{ background: color.hex, color: contrastText(color.hex) }}>
            <span>0{index + 1} / {color.id}</span><strong>{color.name}</strong><code>{color.hex}</code>
          </article>
        ))}
      </div>
    ),
  });
  add({
    id: '3-spectrum',
    section: 3,
    title: 'Tonal spectrum',
    content: (
      <div className={styles.spectrumPage}>
        <span className={styles.microLabel}>Tonal range / {identity.colors[3]?.name}</span>
        <div className={styles.spectrumBars}>
          {Array.from({ length: 11 }, (_, index) => {
            const color = mixHexColors(index < 5 ? ink : accent, index < 5 ? accent : paper, index < 5 ? index / 5 : (index - 5) / 5);
            return <div key={index} style={{ background: color, color: contrastText(color) }}><span>{index * 10}</span></div>;
          })}
        </div>
        <p>Use the core colors first. Tonal steps support information hierarchy, interaction states, and depth without fragmenting the identity.</p>
      </div>
    ),
  });
  add({
    id: '3-contrast',
    section: 3,
    title: 'Contrast pairings',
    content: (
      <div className={styles.contrastPage}>
        <span className={styles.microLabel}>Contrast / WCAG reference</span>
        <div className={styles.contrastGrid}>
          {[[ink, paper], [ink, muted], [accent, paper], [accent, ink]].map(([foreground, background], index) => {
            const ratio = contrastRatio(foreground, background);
            return <article key={index} style={{ background, color: foreground }}><strong>Aa</strong><span>{ratio.toFixed(1)}:1</span><small>{ratio >= 4.5 ? 'AA normal text' : ratio >= 3 ? 'AA large text' : 'Display only'}</small></article>;
          })}
        </div>
      </div>
    ),
  });

  addSectionStart(4, identity.dossier.imagery);
  add({
    id: '4-device',
    section: 4,
    title: 'Graphic device',
    tone: 'dark',
    content: (
      <div className={styles.devicePage}>
        <BookImage asset={image(0)} identity={identity} />
        <div><span className={styles.microLabel}>Graphic device</span><h1>{identity.graphicSystem.device}</h1><p>{identity.graphicSystem.description}</p></div>
      </div>
    ),
  });
  add({
    id: '4-library',
    section: 4,
    title: 'Image library',
    content: (
      <div className={styles.imageLibraryPage}>
        <span className={styles.microLabel}>Image direction / selected field</span>
        <div className={styles.imageLibraryGrid}>{[1, 2, 3, 4].map((index) => <div key={index}><BookImage asset={image(index)} identity={identity} /></div>)}</div>
      </div>
    ),
  });
  add({
    id: '4-direction',
    section: 4,
    title: 'Image direction',
    content: (
      <div className={styles.imageDirectionPage}>
        <div><BookImage asset={image(5)} identity={identity} /></div>
        <div><span className={styles.microLabel}>Direction</span><h2>{identity.graphicSystem.imageDirection}</h2><p>{identity.dossier.renderingRecipe.join(' · ')}</p></div>
      </div>
    ),
  });
  add({
    id: '4-pattern',
    section: 4,
    title: 'Pattern construction',
    tone: 'muted',
    content: (
      <div className={styles.patternPage}>
        <span className={styles.microLabel}>Pattern / {identity.graphicSystem.pattern}</span>
        <div className={styles.patternStudy} data-pattern={identity.graphicSystem.pattern}><span>{identity.shortName}</span></div>
        <p>{identity.graphicSystem.composition}</p>
      </div>
    ),
  });
  add({
    id: '4-motion',
    section: 4,
    title: 'Motion behavior',
    content: (
      <div className={styles.motionPage}>
        <span className={styles.microLabel}>Motion principles</span>
        <div className={styles.motionTrack} aria-hidden='true'><span /><span /><span /><span /></div>
        <div className={styles.motionCards}>
          {(identity.motion.length > 0 ? identity.motion.slice(0, 3) : [{ id: 'default', name: 'Brand cadence', durationMs: 900, curve: 'cubic-bezier(.22, 1, .36, 1)', description: identity.dossier.motion, previewPath: '' }]).map((motion) => <article key={motion.id}><strong>{motion.name}</strong><span>{motion.durationMs} ms</span><code>{motion.curve}</code><p>{motion.description}</p></article>)}
        </div>
      </div>
    ),
  });

  addSectionStart(5, `Icons extend ${identity.name} into moments where the full signature would be too loud. They inherit the identity’s geometry, weight, and sense of motion.`);
  const iconSet = [Asterisk, ArrowUpRight, Circle, Grid2X2, Layers3, Maximize2, MoveUpRight, Sparkles, Square, Target, Triangle, Rows3];
  add({
    id: '5-system',
    section: 5,
    title: 'Icon system',
    content: (
      <div className={styles.iconSystemPage}>
        <span className={styles.microLabel}>Core set / optical 24</span>
        <div className={styles.iconGrid}>{iconSet.map((Icon, index) => <div key={index}><Icon strokeWidth={identity.style.density === 'compact' ? 2.2 : 1.65} /></div>)}</div>
      </div>
    ),
  });
  add({
    id: '5-construction',
    section: 5,
    title: 'Icon construction',
    tone: 'muted',
    content: (
      <div className={styles.iconConstructionPage}>
        <span className={styles.microLabel}>Construction / 24 × 24</span>
        <div className={styles.iconConstructionGrid}><MoveUpRight /><i /><i /><i /><i /></div>
        <div className={styles.iconMetrics}><span><strong>24</strong>Unit field</span><span><strong>1.5</strong>Base stroke</span><span><strong>{identity.style.borderRadius}</strong>Corner character</span></div>
      </div>
    ),
  });
  add({
    id: '5-rules',
    section: 5,
    title: 'Icon rules',
    content: (
      <div className={styles.iconRulesPage}>
        {['Keep one optical weight across a set', 'Use simple geometry before adding detail', 'Align to the same underlying field', 'Let the icon support—not replace—the message'].map((rule, index) => {
          const RuleIcon = iconSet[index];
          return <article key={rule}><span>{String(index + 1).padStart(2, '0')}</span><div><RuleIcon aria-hidden='true' strokeWidth={1.6} /></div><p>{rule}</p></article>;
        })}
      </div>
    ),
  });

  addSectionStart(6, identity.dossier.layout);
  add({
    id: '6-principles',
    section: 6,
    title: 'Composition principles',
    content: (
      <div className={styles.compositionPage}>
        <span className={styles.microLabel}>Composition / repeatable rules</span>
        <div className={styles.compositionRules}>{identity.graphicSystem.rules.slice(0, 6).map((rule, index) => <article key={rule}><span>0{index + 1}</span><p>{rule}</p></article>)}</div>
      </div>
    ),
  });
  add({
    id: '6-system',
    section: 6,
    title: 'Visual system',
    content: (
      <div className={styles.visualSystemPage}>
        <span className={styles.microLabel}>One system / multiple densities</span>
        <div className={styles.visualSystemGrid}><div><BookImage asset={image(6)} identity={identity} /></div><div><BookImage asset={image(7)} identity={identity} /></div><div><BookImage asset={image(8)} identity={identity} /></div></div>
      </div>
    ),
  });
  add({
    id: '6-grid',
    section: 6,
    title: 'Layout grid',
    tone: 'muted',
    content: (
      <div className={styles.layoutGridPage}>
        <span className={styles.microLabel}>Grid / 12 columns</span>
        <div className={styles.layoutGrid}><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /><strong>{identity.tagline}</strong><p>{identity.graphicSystem.composition}</p></div>
      </div>
    ),
  });
  add({
    id: '6-applications',
    section: 6,
    title: 'Application logic',
    content: (
      <div className={styles.applicationLogicPage}>
        <span className={styles.microLabel}>System adapts / identity remains</span>
        <div className={styles.applicationLogicGrid}>{identity.applications.slice(0, 6).map((application) => <article key={application.id}><span>{application.category}</span><strong>{application.name}</strong><p>{application.format}</p></article>)}</div>
      </div>
    ),
  });

  addSectionStart(7, `The ${identity.name} system is complete only when it remains recognizable in use—across product, story, motion, and physical space.`);
  identity.applications.slice(0, 7).forEach((application, index) => {
    add({
      id: `7-${application.id}`,
      section: 7,
      title: application.name,
      tone: index % 3 === 2 ? 'dark' : 'paper',
      content: (
        <div className={styles.showcasePage} data-layout={index % 3}>
          <div className={styles.showcaseImage}><BookImage asset={image(index + 2)} identity={identity} position={index % 2 ? 'center 35%' : 'center'} /></div>
          <div className={styles.showcaseCopy}>
            <span className={styles.microLabel}>{application.category} / {application.format}</span>
            <h1>{application.name}</h1>
            <p>{application.description}</p>
          </div>
        </div>
      ),
    });
  });
  add({
    id: '7-contact-sheet',
    section: 7,
    title: 'Identity in use',
    tone: 'dark',
    content: (
      <div className={styles.contactSheetPage}>
        <span className={styles.microLabel}>Identity in use / contact sheet</span>
        <div className={styles.contactSheetGrid}>{[0, 1, 2, 3, 4, 5].map((index) => <div key={index}><BookImage asset={image(index)} identity={identity} /></div>)}</div>
      </div>
    ),
  });
  add({
    id: 'closing',
    section: 7,
    showChrome: false,
    title: 'Closing',
    tone: 'accent',
    content: (
      <div className={styles.closingPage}>
        {darkMark ? <img alt={`${identity.name} mark`} src={darkMark} /> : null}
        <h1>{identity.tagline}</h1>
        <div><span>{identity.website}</span><span>{identity.socialHandle}</span><span>{identity.contactEmail}</span></div>
      </div>
    ),
  });

  return pages;
}

export default function BrandBook({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [mode, setMode] = useState<BookMode>('overview');
  const [currentPage, setCurrentPage] = useState(0);
  const [thumbnailWidth, setThumbnailWidth] = useState(272);
  const pages = useMemo(() => buildBrandBookPages(identity), [identity]);
  const displayFont = brandTypographyFamily(identity, 'Display');
  const bodyFont = brandTypographyFamily(identity, 'Body');
  const accentFont = brandTypographyFamily(identity, 'Accent');
  const codeFont = brandTypographyFamily(identity, 'Code');
  const ink = colorById(identity, 'ink', 0);
  const paper = colorById(identity, 'paper', 1);
  const muted = colorById(identity, 'muted', 2);
  const accent = colorById(identity, 'emphasis', 3);
  const deep = colorById(identity, 'error', 0);
  const pageGroups = useMemo(() => [INTRO_SECTION, ...BOOK_SECTIONS.map(({ id }) => id)].map((sectionId) => ({
    pages: pages.map((page, index) => ({ page, index })).filter(({ page }) => page.section === sectionId),
    sectionId,
  })), [pages]);
  const rootStyle = {
    '--book-accent': accent,
    '--book-accent-ink': contrastText(accent, ink, paper),
    '--book-accent-soft': mixHexColors(accent, paper, 0.66),
    '--book-body': bodyFont,
    '--book-code': codeFont,
    '--book-deep': deep,
    '--book-display': displayFont,
    '--book-ink': ink,
    '--book-muted': muted,
    '--book-paper': paper,
    '--book-paper-ink': contrastText(paper, ink, '#FFFFFF'),
    '--book-serif': accentFont,
    '--book-thumb-width': `${thumbnailWidth}px`,
    '--book-radius': `${Math.min(identity.style.borderRadius, 12)}px`,
  } as CSSProperties;

  useEffect(() => {
    if (mode !== 'reader') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setCurrentPage((page) => Math.max(0, page - 1));
      if (event.key === 'ArrowRight') setCurrentPage((page) => Math.min(pages.length - 1, page + 1));
      if (event.key === 'Escape') setMode('overview');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, pages.length]);

  function openPage(index: number) {
    setCurrentPage(index);
    setMode('reader');
  }

  function jumpToSection(sectionId: number) {
    const nextPage = pages.findIndex((page) => page.section === sectionId);
    if (mode === 'reader') {
      if (nextPage >= 0) setCurrentPage(nextPage);
      return;
    }
    document.getElementById(`brand-book-${identity.id}-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' });
  }

  function printBook() {
    const previousMode = mode;
    setMode('overview');
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      window.print();
      setMode(previousMode);
    }));
  }

  return (
    <div className={styles.root} data-mode={mode} style={rootStyle}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <BookOpen aria-hidden='true' />
          <div><strong>{gt(tool.name)}</strong><span>{identity.name} · {pages.length} pages</span></div>
        </div>
        <div className={styles.toolbarActions}>
          {mode === 'overview' ? (
            <label className={styles.zoomControl}>
              <Minus aria-hidden='true' />
              <input aria-label={gt('Page thumbnail size')} max='360' min='210' onChange={(event) => setThumbnailWidth(Number(event.target.value))} type='range' value={thumbnailWidth} />
              <Plus aria-hidden='true' />
            </label>
          ) : (
            <span className={styles.pageCounter}>{currentPage + 1} / {pages.length}</span>
          )}
          <div className={styles.modeSwitch}>
            <button aria-pressed={mode === 'overview'} onClick={() => setMode('overview')} type='button'><Grid2X2 aria-hidden='true' /><span><T>Overview</T></span></button>
            <button aria-pressed={mode === 'reader'} onClick={() => setMode('reader')} type='button'><Maximize2 aria-hidden='true' /><span><T>Read</T></span></button>
          </div>
          <button className={styles.exportButton} onClick={printBook} type='button'><Download aria-hidden='true' /><span><T>Export PDF</T></span></button>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.navigator}>
          <div className={styles.navigatorIdentity}>
            <div>{brandAssetPath(identity, 'mark-dark') ? <img alt='' aria-hidden='true' src={brandAssetPath(identity, 'mark-dark')} /> : identity.shortName}</div>
            <span><strong>{identity.name}</strong><small>Brand book / rev. {identity.revision}</small></span>
          </div>
          <button className={styles.navIntroduction} onClick={() => jumpToSection(INTRO_SECTION)} type='button'><span>—</span><strong>Introduction</strong><small>03</small></button>
          <nav aria-label={gt('Brand book sections')}>
            {BOOK_SECTIONS.map((item) => {
              const count = pages.filter((page) => page.section === item.id).length;
              const active = mode === 'reader' && pages[currentPage]?.section === item.id;
              return (
                <button aria-current={active ? 'page' : undefined} key={item.id} onClick={() => jumpToSection(item.id)} type='button'>
                  <span>{item.id}.0</span><strong>{item.name}</strong><small>{String(count).padStart(2, '0')}</small>
                </button>
              );
            })}
          </nav>
          <div className={styles.navigatorPalette}>{identity.colors.slice(0, 8).map((color) => <span key={color.id} style={{ background: color.hex }} title={`${color.name} ${color.hex}`} />)}</div>
        </aside>

        <main className={styles.canvas}>
          {mode === 'overview' ? (
            <div className={styles.overviewBoard}>
              {pageGroups.map((group) => (
                <section className={styles.overviewRow} id={`brand-book-${identity.id}-${group.sectionId}`} key={group.sectionId}>
                  {group.pages.map(({ page, index }) => (
                    <button className={styles.pageButton} key={page.id} onClick={() => openPage(index)} type='button'>
                      <PageFrame identity={identity} pageNumber={index + 1} spec={page} />
                      <span className={styles.thumbnailCaption}><strong>{String(index + 1).padStart(2, '0')}</strong>{page.title}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          ) : (
            <div className={styles.reader}>
              <button aria-label={gt('Previous page')} className={styles.readerArrow} disabled={currentPage === 0} onClick={() => setCurrentPage((page) => Math.max(0, page - 1))} type='button'><ChevronLeft aria-hidden='true' /></button>
              <div className={styles.readerPage} key={pages[currentPage].id}><PageFrame identity={identity} pageNumber={currentPage + 1} spec={pages[currentPage]} /></div>
              <button aria-label={gt('Next page')} className={styles.readerArrow} disabled={currentPage === pages.length - 1} onClick={() => setCurrentPage((page) => Math.min(pages.length - 1, page + 1))} type='button'><ChevronRight aria-hidden='true' /></button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
