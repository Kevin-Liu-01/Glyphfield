'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useGT } from 'gt-next';
import { StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import StudioFileMenu from '@/components/StudioFileMenu';
import StudioToolHeader from '@/components/StudioToolHeader';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import type { StudioTool } from '@/lib/studioCatalog';
import { registerStudioAutomation, type StudioAutomationAdapter } from '@/lib/studioAutomation';

export function ToolShell({
  actions,
  versions,
  automation,
  children,
  inspector,
  library,
  sourceCode,
  tool,
}: {
  actions?: ReactNode;
  versions?: ReactNode;
  automation?: Pick<StudioAutomationAdapter, 'actions' | 'invoke'>;
  children: ReactNode;
  inspector: ReactNode;
  library?: ReactNode;
  sourceCode?: {
    format: string;
    onApply: (source: string) => Promise<void> | void;
    source: string | null;
    title?: string;
  };
  tool: StudioTool;
}) {
  const gt = useGT();
  const shellRef = useRef<HTMLDivElement>(null);
  const sourceCodeRef = useCommittedRef(sourceCode);
  const automationRef = useCommittedRef(automation);
  const [sourceOpen, setSourceOpen] = useState(false);

  const sourceReady = sourceCode?.source !== null && sourceCode?.source !== undefined;
  const automationActionKey = automation?.actions?.join('\u0000') ?? '';
  const automationInvokable = Boolean(automation?.invoke);

  useEffect(() => registerStudioAutomation({
    actions: automationRef.current?.actions,
    // Drawers delegate to this owner. Source updates must refresh its data, not
    // dispose an otherwise active adapter every time the parent renders.
    applySource: sourceReady ? (source) => sourceCodeRef.current!.onApply(source) : undefined,
    getSource: sourceReady ? () => sourceCodeRef.current!.source! : undefined,
    invoke: automationInvokable ? (action, input) => automationRef.current!.invoke!(action, input) : undefined,
    toolId: tool.id,
  }, shellRef.current), [automationActionKey, automationInvokable, automationRef, sourceCodeRef, sourceReady, tool.id]);

  return (
    <div className='tool-shell h-full min-h-0' ref={shellRef}>
      <StudioToolHeader
        status={versions}
        actions={actions || sourceCode ? (
          <>
            {sourceCode ? <StudioFileMenu sourceDisabled={!sourceReady} onSource={() => setSourceOpen(true)} /> : null}
            {actions}
          </>
        ) : undefined}
        metadata={gt(tool.description)}
        title={gt(tool.name)}
        toolId={tool.id}
      />
      <div className={`tool-body${library ? ' tool-lab-body lab-workspace' : ''}`}>
        {library ? (
          <StudioSidebar
            className='tool-library min-h-0'
            kind='library'
            label={gt(`${tool.name} library`)}
            storageKey={`tool-${tool.id}-library`}
          >
            {library}
          </StudioSidebar>
        ) : (
          <StudioSidebar
            className='tool-inspector min-h-0'
            label={gt(`${tool.name} controls`)}
            storageKey={`tool-${tool.id}`}
          >
            {inspector}
          </StudioSidebar>
        )}
        <div className='tool-canvas studio-scroll-area min-h-0 overflow-auto'>{children}</div>
        {library ? (
          <StudioSidebar
            className='tool-inspector min-h-0'
            label={gt(`${tool.name} controls`)}
            side='right'
            storageKey={`tool-${tool.id}-inspector`}
          >
            {inspector}
          </StudioSidebar>
        ) : null}
        {sourceCode && sourceReady && sourceOpen ? (
          <SourceCodeDrawer
            format={sourceCode.format}
            key={tool.id}
            onApply={sourceCode.onApply}
            onClose={() => setSourceOpen(false)}
            source={sourceCode.source!}
            title={sourceCode.title ?? gt(`${tool.name} source`)}
          />
        ) : null}
      </div>
    </div>
  );
}
