import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';

import { ArrowRight, BookOpen, Sparkles } from '@/components/ui/SolidIcons';
import { PRODUCT_BRAND } from '@/lib/productBrand';

import styles from './not-found.module.css';

const SELECTION_HANDLES = Array.from({ length: 8 }, (_, index) => index);

export default function NotFound() {
  return (
    <main className={styles.shell}>
      <a className={styles.skipLink} href='#not-found-content'>
        <T>Skip to content</T>
      </a>

      <div className={styles.page}>
        <header className={styles.header}>
          <Link className={styles.brand} href='/' aria-label='Glyphfield home'>
            <Image
              alt=''
              aria-hidden='true'
              className={styles.brandMark}
              height={30}
              priority
              src={PRODUCT_BRAND.markPath}
              width={30}
            />
            <span>{PRODUCT_BRAND.name}</span>
          </Link>

          <span className={styles.headerStatus} aria-hidden='true'>
            ERROR / 404
          </span>

          <div className={styles.headerActions}>
            <Link aria-label='Open Studio' className={styles.headerStudioLink} href='/studio'>
              <span><T>Open Studio</T></span>
              <ArrowRight aria-hidden='true' />
            </Link>
          </div>
        </header>

        <section className={styles.content} id='not-found-content' aria-labelledby='not-found-title'>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>
              <span aria-hidden='true'>04</span>
              <T>Missing layer</T>
            </span>

            <div>
              <h1 id='not-found-title'>
                <T>This page slipped outside the artboard.</T>
              </h1>
              <p>
                <T>
                  We could not find this route in the composition. Head home or open the Studio
                  and keep making.
                </T>
              </p>
            </div>

            <div className={styles.actions}>
              <Link className={styles.primaryAction} href='/'>
                <T>Back to home</T>
                <ArrowRight aria-hidden='true' />
              </Link>
              <Link className={styles.secondaryAction} href='/studio'>
                <Sparkles aria-hidden='true' />
                <T>Open Studio</T>
              </Link>
            </div>

            <Link className={styles.docsLink} href='/docs/getting-started'>
              <BookOpen aria-hidden='true' />
              <T>Read the getting started guide</T>
            </Link>
          </div>

          <div className={styles.artboardRegion} aria-hidden='true'>
            <div className={styles.canvasMeta}>
              <span>ARTBOARD / ROUTE</span>
              <span>W 404 · H 000</span>
            </div>

            <div className={styles.artboard}>
              <span className={styles.corner} data-corner='top-left' />
              <span className={styles.corner} data-corner='top-right' />
              <span className={styles.corner} data-corner='bottom-left' />
              <span className={styles.corner} data-corner='bottom-right' />

              <div className={styles.coordinateX}>X / 404</div>
              <div className={styles.coordinateY}>Y / OFF CANVAS</div>

              <div className={styles.selection}>
                <span className={styles.selectionLabel}>MISSING LAYER</span>
                <span className={styles.rotationHandle} />
                {SELECTION_HANDLES.map((handle) => (
                  <span className={styles.selectionHandle} data-handle={handle} key={handle} />
                ))}
                <span className={styles.errorCode}>404</span>
                <span className={styles.errorSlash} />
              </div>

              <div className={styles.layerStrip}>
                <span className={styles.layerIcon}><Sparkles /></span>
                <span>
                  <strong>Untitled route</strong>
                  <small>01 · NOT FOUND</small>
                </span>
                <b>OUTSIDE FRAME</b>
              </div>
            </div>
          </div>
        </section>

        <footer className={styles.statusBar}>
          <span>GLYPHFIELD / ROUTER</span>
          <span><i /> 404 · PAGE NOT FOUND</span>
          <span>NO LAYERS RENDERED</span>
        </footer>
      </div>
    </main>
  );
}
