'use client';

import { useState } from 'react';
import { Check, ImageOff, ScanSearch, TriangleAlert } from 'lucide-react';
import { T, useGT } from 'gt-next';

import BrandIdentityPreview from '@/components/BrandIdentityPreview';
import { Button } from '@/components/ui/Button';
import { auditBrandIdentities } from '@/lib/brandAudit';
import {
  brandAssetPath,
  BUILT_IN_BRAND_IDENTITIES,
  type BrandIdentity,
} from '@/lib/brandIdentity';

type RuntimeVisualResult = {
  imagesLoaded: boolean;
  layoutFits: boolean;
  titleFits: boolean;
};

export default function BrandVisualAudit({ identity }: { identity: BrandIdentity }) {
  const gt = useGT();
  const [runtimeResults, setRuntimeResults] = useState<Record<string, RuntimeVisualResult>>({});
  const identities = identity.builtIn
    ? BUILT_IN_BRAND_IDENTITIES.map((candidate) => candidate.id === identity.id ? identity : candidate)
    : [identity, ...BUILT_IN_BRAND_IDENTITIES];
  const reports = auditBrandIdentities(identities);
  const passing = reports.filter((report) => report.status === 'pass').length;
  const average = Math.round(reports.reduce((total, report) => total + report.score, 0) / reports.length);

  function runVisualChecks() {
    const nextResults: Record<string, RuntimeVisualResult> = {};
    document.querySelectorAll<HTMLElement>('[data-brand-audit-card]').forEach((card) => {
      const id = card.dataset.brandAuditCard;
      const title = card.querySelector<HTMLElement>('[data-preview-title]');
      const preview = card.querySelector<HTMLElement>('.brand-art-preview');
      const images = [...card.querySelectorAll<HTMLImageElement>('.brand-art-preview img')];
      if (!id) return;
      const titleStyles = title ? window.getComputedStyle(title) : null;
      const lineHeight = titleStyles ? Number.parseFloat(titleStyles.lineHeight) : 0;
      const lineCount = title && lineHeight > 0 ? Math.round(title.scrollHeight / lineHeight) : Number.POSITIVE_INFINITY;
      nextResults[id] = {
        imagesLoaded: images.length > 0 && images.every((image) => image.complete && image.naturalWidth > 0),
        layoutFits: Boolean(preview && preview.scrollHeight <= preview.clientHeight + 1 && preview.scrollWidth <= preview.clientWidth + 1),
        titleFits: Boolean(title && lineCount <= 2 && title.scrollWidth <= title.clientWidth + 1),
      };
    });
    setRuntimeResults(nextResults);
  }

  return (
    <div className='brand-visual-audit'>
      <section className='brand-audit-summary'>
        <div>
          <ScanSearch aria-hidden='true' />
          <span><strong>{average}</strong><small><T>Average score</T></small></span>
        </div>
        <div><strong>{passing}/{reports.length}</strong><small><T>Structurally clean</T></small></div>
        <div><strong>{reports.reduce((total, report) => total + report.summary.visualAssets, 0)}</strong><small><T>Visual files</T></small></div>
        <Button onClick={runVisualChecks} size='sm' type='button' variant='outline'><ScanSearch aria-hidden='true' /><T>Run visual checks</T></Button>
      </section>

      <div className='brand-audit-grid'>
        {identities.map((candidate) => {
          const report = reports.find((item) => item.id === candidate.id);
          const runtime = runtimeResults[candidate.id];
          if (!report) return null;
          return (
            <article data-brand-audit-card={candidate.id} key={candidate.id}>
              <header>
                <div><strong>{candidate.name}</strong><span data-status={report.status}>{report.score}</span></div>
                <p>{report.summary.assets} assets · {report.summary.visualAssets} visual · {report.summary.references} references</p>
              </header>
              <BrandIdentityPreview
                darkMark={brandAssetPath(candidate, 'mark-dark')}
                identity={candidate}
                lightMark={brandAssetPath(candidate, 'mark-light')}
              />
              <div className='brand-audit-checks'>
                {report.checks.map((item) => (
                  <span data-passed={item.passed ? 'true' : 'false'} key={item.id} title={item.message}>
                    {item.passed ? <Check aria-hidden='true' /> : <TriangleAlert aria-hidden='true' />}
                    {gt(item.label)}
                    <small>{item.actual}/{item.minimum}</small>
                  </span>
                ))}
                {runtime ? (
                  <>
                    <span data-passed={runtime.titleFits ? 'true' : 'false'}>{runtime.titleFits ? <Check aria-hidden='true' /> : <TriangleAlert aria-hidden='true' />}<T>Title fit</T></span>
                    <span data-passed={runtime.layoutFits ? 'true' : 'false'}>{runtime.layoutFits ? <Check aria-hidden='true' /> : <TriangleAlert aria-hidden='true' />}<T>Layout fit</T></span>
                    <span data-passed={runtime.imagesLoaded ? 'true' : 'false'}>{runtime.imagesLoaded ? <Check aria-hidden='true' /> : <ImageOff aria-hidden='true' />}<T>Images loaded</T></span>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
