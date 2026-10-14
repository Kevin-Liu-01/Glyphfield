'use client';

import { T, useGT } from 'gt-next';

import { HEALTH_SECTION_TARGET, type BrandIdentitySectionId } from '@/components/BrandIdentityFrontPage';
import { Meter, Panel } from '@/components/BrandIdentityFields';
import { Button } from '@/components/ui/Button';
import { Copy, WandSparkles } from '@/components/ui/SolidIcons';
import type { BrandHealthFinding, BrandHealthReport, BrandHealthSeverity } from '@/lib/brandHealth';

import styles from './BrandIdentityStudio.module.css';

const GROUPS: readonly { label: string; severity: BrandHealthSeverity }[] = [
  { label: 'Errors', severity: 'error' },
  { label: 'Warnings', severity: 'warning' },
  { label: 'Suggestions', severity: 'info' },
];

function allFindingsPrompt(report: BrandHealthReport): string {
  const actionable = report.findings.filter(({ severity }) => severity !== 'info');
  return [
    `In Glyphfield, the "${report.name}" brand scores ${report.score}/100 on the brand health audit. Fix these findings in order, using only facts from the brand's own website, repository or design files.`,
    '',
    ...actionable.map((finding, index) => `${index + 1}. [${finding.severity}] ${finding.id} — ${finding.title}. ${finding.detail}${finding.fix ? ` One-click fix: identity.fix { fixId: '${finding.fix.id}' }.` : ''}`),
    '',
    'Read the identity with identity.read, change it with identity.apply { identity: patch } (merge mode keeps every other field), add files with identity.asset.add or identity.font.add, then run identity.audit until no errors remain and call identity.save.',
  ].join('\n');
}

function FindingRow({
  finding,
  onCopy,
  onFix,
  onNavigate,
}: {
  finding: BrandHealthFinding;
  onCopy: (text: string, confirmation: string) => void;
  onFix: (fixId: string) => void;
  onNavigate: (section: BrandIdentitySectionId) => void;
}) {
  const gt = useGT();
  return (
    <li className={styles.finding} data-severity={finding.severity}>
      <span aria-hidden='true' className={styles.severityDot} />
      <div>
        <strong>{finding.title}</strong>
        <p>{finding.detail}</p>
        <code>{finding.id}</code>
      </div>
      <div className={styles.findingActions}>
        {finding.fix ? (
          <Button onClick={() => onFix(finding.fix!.id)} size='sm' type='button' variant='outline'>
            <WandSparkles aria-hidden='true' />{finding.fix.label}
          </Button>
        ) : null}
        <Button aria-label={gt('Copy agent prompt for {title}', { title: finding.title })} onClick={() => onCopy(finding.agentPrompt, gt('Agent prompt copied.'))} size='sm' type='button' variant='ghost'>
          <Copy aria-hidden='true' /><T>Agent prompt</T>
        </Button>
        <Button aria-label={gt('Edit {title}', { title: finding.title })} onClick={() => onNavigate(HEALTH_SECTION_TARGET[finding.section])} size='sm' type='button' variant='ghost'><T>Edit</T></Button>
      </div>
    </li>
  );
}

export default function BrandIdentityHealthPanel({
  onCopy,
  onFix,
  onNavigate,
  report,
}: {
  onCopy: (text: string, confirmation: string) => void;
  onFix: (fixId: string) => void;
  onNavigate: (section: BrandIdentitySectionId) => void;
  report: BrandHealthReport;
}) {
  const gt = useGT();
  return (
    <div className={styles.sectionStack}>
      <section aria-label={gt('Brand health score')} className={styles.healthHeader}>
        <div className={styles.score}>
          <strong>{report.score}</strong>
          <span>/100</span>
        </div>
        <div>
          <p><strong>{report.grade}.</strong> {gt('{errors} errors, {warnings} warnings and {info} suggestions across {sections} sections.', {
            errors: report.counts.error,
            info: report.counts.info,
            sections: report.sections.length,
            warnings: report.counts.warning,
          })}</p>
        </div>
        <Button disabled={!report.findings.length} onClick={() => onCopy(allFindingsPrompt(report), gt('Prompt for every finding copied.'))} size='sm' type='button' variant='outline'>
          <Copy aria-hidden='true' /><T>Copy prompt for all findings</T>
        </Button>
      </section>

      <div className={styles.sectionScores}>
        {report.sections.map((section) => (
          <button key={section.id} onClick={() => onNavigate(HEALTH_SECTION_TARGET[section.id])} type='button'>
            <span>{gt(section.label)}</span>
            <Meter label={gt('{label} {percent}% complete', { label: section.label, percent: Math.round(section.score * 100) })} tone={section.status} value={section.score} />
            <small>{section.passed}/{section.checks}</small>
          </button>
        ))}
      </div>

      {report.contrast.length ? (
        <Panel description={<T>Every text pair the brand uses, measured against WCAG 2.2 AA.</T>} title={<T>Contrast pairs</T>}>
          <ul className={styles.contrastList}>
            {report.contrast.map((pair) => (
              <li data-passes={pair.passes ? 'true' : 'false'} key={`${pair.foreground}-${pair.background}`}>
                <span className={styles.contrastSample} style={{ background: pair.backgroundHex, color: pair.foregroundHex }}>Aa</span>
                <span><strong>{pair.foreground} / {pair.background}</strong><small>{pair.usage}</small></span>
                <span className={styles.contrastRatio}>{pair.ratio.toFixed(2)}:1</span>
                <span className={styles.contrastVerdict}>{pair.passes ? gt('{level} pass', { level: pair.level }) : gt('{level} fail', { level: pair.level })}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {report.findings.length === 0 ? (
        <p className={styles.emptyState}><T>No findings. Every check passes.</T></p>
      ) : GROUPS.map((group) => {
        const findings = report.findings.filter(({ severity }) => severity === group.severity);
        if (!findings.length) return null;
        return (
          <Panel key={group.severity} title={`${gt(group.label)} · ${findings.length}`}>
            <ul className={styles.findingList}>
              {findings.map((finding) => <FindingRow finding={finding} key={finding.id} onCopy={onCopy} onFix={onFix} onNavigate={onNavigate} />)}
            </ul>
          </Panel>
        );
      })}
    </div>
  );
}
