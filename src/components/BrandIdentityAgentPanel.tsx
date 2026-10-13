'use client';

import { useState } from 'react';
import { T, useGT } from 'gt-next';

import { Panel } from '@/components/BrandIdentityFields';
import { Button } from '@/components/ui/Button';
import { Copy } from '@/components/ui/SolidIcons';
import {
  brandAgentSetupPrompt,
  brandProjectUrl,
  brandSetupMode,
  type BrandSetupMode,
} from '@/lib/brandAgentSetup';
import type { BrandHealthReport } from '@/lib/brandHealth';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { STUDIO_TOOL_ACTION_CONTRACTS } from '@/lib/studioAgentCapabilities';

import styles from './BrandIdentityStudio.module.css';

const IDENTITY_ACTIONS = Object.entries(STUDIO_TOOL_ACTION_CONTRACTS.identity);

export default function BrandIdentityAgentPanel({
  identity,
  onCopy,
  origin,
  report,
}: {
  identity: BrandIdentity;
  onCopy: (text: string, confirmation: string) => void;
  origin: string;
  report: BrandHealthReport;
}) {
  const gt = useGT();
  const [mode, setMode] = useState<BrandSetupMode>(() => brandSetupMode(identity));
  const prompt = brandAgentSetupPrompt({ identity, mode, origin, report });
  const resources = [
    { label: gt('This project'), value: brandProjectUrl(identity, origin) },
    { label: gt('Workflow guide'), value: `${origin}/docs/agents/brand-setup.md` },
    { label: gt('Identity schema'), value: `${origin}/api/brand/validate` },
    { label: gt('Agent skill'), value: 'skills/glyphfield-brand/SKILL.md' },
  ];

  return (
    <div className={styles.sectionStack}>
      <section className={styles.agentIntro}>
        <h2><T>Let your coding agent build the brand from its real sources.</T></h2>
        <p><T>Give this prompt to Claude Code, Codex or Cursor. The agent reads your website, repository or design files, then fills every section here through the Brand identity Browser API, adds your logo and font files, runs the health audit and exports the brand kit.</T></p>
        <ol className={styles.agentSteps}>
          <li><span>01</span><strong><T>Open this project</T></strong><small><T>in a browser your agent can drive, such as Playwright.</T></small></li>
          <li><span>02</span><strong><T>Paste the prompt</T></strong><small><T>and point the agent at your website, repository or brand folder.</T></small></li>
          <li><span>03</span><strong><T>Review and keep</T></strong><small><T>the audit score, the sources it cites and the saved identity.</T></small></li>
        </ol>
      </section>

      <Panel
        actions={(
          <Button onClick={() => onCopy(prompt, gt('Agent prompt copied.'))} size='sm' type='button'>
            <Copy aria-hidden='true' /><T>Copy prompt</T>
          </Button>
        )}
        description={<T>Works with any agent that can run browser automation. It never needs your passwords: the project lives in this browser.</T>}
        title={<T>Prompt</T>}
      >
        <div aria-label={gt('Setup mode')} className={styles.segmented} role='group'>
          <button aria-pressed={mode === 'new'} onClick={() => setMode('new')} type='button'><T>New brand</T></button>
          <button aria-pressed={mode === 'improve'} onClick={() => setMode('improve')} type='button'><T>Improve this brand</T></button>
        </div>
        <pre aria-label={gt('Agent setup prompt')} className={`studio-scroll-area ${styles.promptBlock}`} tabIndex={0}>{prompt}</pre>
      </Panel>

      <div className={styles.twoColumn}>
        <Panel description={<T>Links the prompt refers to.</T>} title={<T>Resources</T>}>
          <dl className={styles.resourceList}>
            {resources.map((resource) => (
              <div key={resource.label}>
                <dt>{resource.label}</dt>
                <dd>
                  <code>{resource.value}</code>
                  <Button aria-label={gt('Copy {label}', { label: resource.label })} onClick={() => onCopy(resource.value, gt('Copied.'))} size='icon-xs' type='button' variant='ghost'>
                    <Copy aria-hidden='true' />
                  </Button>
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel description={<T>Every call goes through window.glyphfield.studio.invoke(action, input) and validates before it changes anything.</T>} title={<T>What your agent can call</T>}>
          <dl className={styles.actionList}>
            {IDENTITY_ACTIONS.map(([action, contract]) => (
              <div key={action}>
                <dt><code>{action}</code></dt>
                <dd>{contract.description}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
