'use client';

import { useState } from 'react';
import { T, useGT } from 'gt-next';

import { Panel } from '@/components/BrandIdentityFields';
import { Button } from '@/components/ui/Button';
import { Copy, Download, FileJson, FileText, Package } from '@/components/ui/SolidIcons';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { BRAND_KIT_FILE_NAMES, brandKitArtworkAssets, brandKitIncludedFonts, brandKitTextFile, type BrandKitFormat } from '@/lib/brandKit';

import styles from './BrandIdentityStudio.module.css';

type TextFormat = Exclude<BrandKitFormat, 'logos' | 'zip'>;

const OUTPUTS: readonly { description: string; format: BrandKitFormat; icon: typeof Package; label: string }[] = [
  { description: 'Everything below in one archive: brand.md, tokens, identity.json, logos, and redistributable artwork and fonts.', format: 'zip', icon: Package, label: 'Brand kit (.zip)' },
  { description: 'Guidelines written for coding agents: rules, voice, tokens, contrast pairs, type and logo use.', format: 'markdown', icon: FileText, label: 'brand.md' },
  { description: 'W3C Design Tokens (DTCG 2025.10) for Style Dictionary, Tokens Studio and other tools.', format: 'dtcg', icon: FileJson, label: 'Design tokens (JSON)' },
  { description: 'CSS custom properties prefixed --brand-, with @font-face rules for the kit fonts.', format: 'css', icon: FileText, label: 'CSS variables' },
  { description: 'A Tailwind CSS v4 @theme block: bg-paper, text-ink, font-display, text-display.', format: 'tailwind', icon: FileText, label: 'Tailwind v4 theme' },
  { description: 'Every logo asset, named by slot, in its original format.', format: 'logos', icon: Package, label: 'Logo pack (.zip)' },
];

const PREVIEWS: readonly { format: TextFormat; label: string }[] = [
  { format: 'markdown', label: BRAND_KIT_FILE_NAMES.markdown },
  { format: 'dtcg', label: BRAND_KIT_FILE_NAMES.dtcg },
  { format: 'css', label: BRAND_KIT_FILE_NAMES.css },
  { format: 'tailwind', label: BRAND_KIT_FILE_NAMES.tailwind },
];

export default function BrandIdentityKitPanel({
  busyFormat,
  identity,
  onCopy,
  onExport,
}: {
  busyFormat: BrandKitFormat | null;
  identity: BrandIdentity;
  onCopy: (text: string, confirmation: string) => void;
  onExport: (format: BrandKitFormat) => void;
}) {
  const gt = useGT();
  const [preview, setPreview] = useState<TextFormat>('markdown');
  const previewText = new TextDecoder().decode(brandKitTextFile(identity, preview).bytes);
  const logos = identity.assets.filter(({ type }) => type === 'logo').length;
  const fonts = brandKitIncludedFonts(identity).length;
  const artwork = brandKitArtworkAssets(identity).length;

  return (
    <div className={styles.sectionStack}>
      <Panel description={gt('{logos} logo files, {artwork} artwork files and {fonts} font files are packaged. Artwork is included only when it is original or bundled, and fonts only when uploaded by you or under an open font license.', { artwork, fonts, logos })} title={<T>Files</T>}>
        <ul className={styles.kitList}>
          {OUTPUTS.map((output) => {
            const Icon = output.icon;
            return (
              <li key={output.format}>
                <Icon aria-hidden='true' />
                <span><strong>{gt(output.label)}</strong><small>{gt(output.description)}</small></span>
                <Button
                  aria-label={gt('Download {label}', { label: output.label })}
                  disabled={busyFormat !== null}
                  loading={busyFormat === output.format}
                  onClick={() => onExport(output.format)}
                  size='sm'
                  type='button'
                  variant={output.format === 'zip' ? 'default' : 'outline'}
                >
                  <Download aria-hidden='true' /><T>Download</T>
                </Button>
              </li>
            );
          })}
        </ul>
      </Panel>
      <Panel
        actions={(
          <Button onClick={() => onCopy(previewText, gt('Copied.'))} size='sm' type='button' variant='outline'>
            <Copy aria-hidden='true' /><T>Copy</T>
          </Button>
        )}
        description={<T>Generated live from the identity. Paste it into a repository or hand it to an agent.</T>}
        title={<T>Preview</T>}
      >
        <div aria-label={gt('Kit file preview')} className={styles.segmented} role='group'>
          {PREVIEWS.map((item) => (
            <button aria-pressed={preview === item.format} key={item.format} onClick={() => setPreview(item.format)} type='button'>{item.label}</button>
          ))}
        </div>
        <pre aria-label={gt('Kit file contents')} className={`studio-scroll-area ${styles.codeBlock}`} tabIndex={0}>{previewText}</pre>
      </Panel>
    </div>
  );
}
