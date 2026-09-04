'use client';

import {
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';

type DocsPageActionsProps = {
  markdownUrl: string;
  sourceUrl: string;
};

export default function DocsPageActions({ markdownUrl, sourceUrl }: DocsPageActionsProps) {
  return (
    <div className='docs-page-actions'>
      <MarkdownCopyButton
        className='docs-page-actions__copy'
        markdownUrl={markdownUrl}
      />
      <ViewOptionsPopover
        className='docs-page-actions__options'
        githubUrl={sourceUrl}
        markdownUrl={markdownUrl}
      />
    </div>
  );
}
