'use client';

import { Check, Copy } from 'lucide-react';
import { T } from 'gt-next';
import { useRef, useState } from 'react';

const AGENT_STUDIO_PROMPT =
  'Use Glyphfield Studio to create the requested brand artifact. Start at /studio, read /llms.txt and /docs/agents, inspect the active brand identity before editing, and use its approved logos, fonts, colors, assets, motion, and export settings. Preserve the target aspect ratio, export at high quality, and return a concise summary of the changes with the artifact path.';

export default function MarketingCopyPromptButton() {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AGENT_STUDIO_PROMPT);
      setCopied(true);

      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className='marketing-v5-secondary-link marketing-v5-copy-prompt'
      onClick={copyPrompt}
      type='button'
    >
      {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
      <span aria-live='polite'>{copied ? <T>Copied</T> : <T>Copy prompt</T>}</span>
    </button>
  );
}
