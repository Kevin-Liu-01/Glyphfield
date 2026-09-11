'use client';

import { type ReactNode } from 'react';

import { STUDIO_TOOL_ICONS } from '@/components/StudioToolIcons';
import type { StudioToolId } from '@/lib/studioCatalog';

import styles from './StudioToolHeader.module.css';

export type StudioToolHeaderProps = {
  actions?: ReactNode;
  ariaLabel?: string;
  context?: ReactNode;
  headingLevel?: 1 | 2;
  icon?: ReactNode;
  layout?: 'default' | 'balanced';
  metadata?: ReactNode;
  navigation?: ReactNode;
  navigationLabel?: string;
  status?: ReactNode;
  title: ReactNode;
  toolId?: StudioToolId;
};

export default function StudioToolHeader({
  actions,
  ariaLabel,
  context,
  headingLevel = 1,
  icon,
  layout = 'default',
  metadata,
  navigation,
  navigationLabel,
  status,
  title,
  toolId,
}: StudioToolHeaderProps) {
  const ToolIcon = toolId ? STUDIO_TOOL_ICONS[toolId] : null;
  const resolvedIcon = icon ?? (ToolIcon ? <ToolIcon aria-hidden='true' /> : null);
  const Heading = headingLevel === 2 ? 'h2' : 'h1';

  return (
    <header aria-label={ariaLabel} className={styles.root} data-layout={layout} data-studio-tool-header>
      <div className={styles.identity} data-slot='identity'>
        {resolvedIcon ? <span className={styles.icon}>{resolvedIcon}</span> : null}
        <Heading>{title}</Heading>
        {metadata ? <span className={styles.metadata}>{metadata}</span> : null}
      </div>

      <div className={styles.middle} data-slot='middle'>
        {context ? <div className={styles.context} data-slot='context' data-canvas-selection-preserve>{context}</div> : null}
        {navigation ? <nav aria-label={navigationLabel} className={styles.navigation} data-slot='navigation'>{navigation}</nav> : null}
      </div>

      <div className={styles.trailing} data-slot='trailing' data-canvas-selection-preserve>
        {status ? <div className={styles.status} data-slot='status'>{status}</div> : null}
        {actions ? <div className={styles.actions} data-slot='actions'>{actions}</div> : null}
      </div>
    </header>
  );
}

export function StudioToolbarGroup({ children, label }: { children: ReactNode; label: string }) {
  return <div aria-label={label} className={styles.actionGroup} role='group'>{children}</div>;
}
