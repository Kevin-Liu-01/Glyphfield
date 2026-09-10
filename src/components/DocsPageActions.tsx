'use client';

import {
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { T, useGT } from 'gt-next';

type DocsPageActionsProps = {
  markdownUrl: string;
  sourceUrl: string;
};

export default function DocsPageActions({ markdownUrl, sourceUrl }: DocsPageActionsProps) {
  const gt = useGT();

  return (
    <div className='docs-page-actions'>
      <MarkdownCopyButton
        className='docs-page-actions__copy'
        markdownUrl={markdownUrl}
      >
        <T>Copy page</T>
      </MarkdownCopyButton>
      <ViewOptionsPopover
        aria-label={gt('More ways to use this page')}
        className='docs-page-actions__options'
        githubUrl={sourceUrl}
        markdownUrl={markdownUrl}
      >
        <span className='sr-only'><T>More ways to use this page</T></span>
      </ViewOptionsPopover>
    </div>
  );
}
