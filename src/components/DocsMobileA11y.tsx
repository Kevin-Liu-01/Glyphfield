'use client';

import { useEffect } from 'react';
import { useSidebar } from 'fumadocs-ui/layouts/docs/slots/sidebar';

const CLOSE_SELECTOR = '#nd-sidebar-mobile button[aria-label="Open Sidebar"]';
const TRIGGER_SELECTOR = '#nd-subnav .glyphfield-docs-sidebar-trigger';

export default function DocsMobileA11y() {
  const { open } = useSidebar();

  useEffect(() => {
    const trigger = document.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR);
    trigger?.setAttribute('aria-haspopup', 'dialog');
    trigger?.setAttribute('aria-expanded', String(open));

    if (!open) return;

    let frame = 0;
    let tries = 0;
    const nameDrawerClose = () => {
      const button = document.querySelector<HTMLButtonElement>(CLOSE_SELECTOR);
      if (button) {
        button.setAttribute('aria-label', 'Close documentation navigation');
        return;
      }
      if (tries++ < 10) frame = requestAnimationFrame(nameDrawerClose);
    };
    frame = requestAnimationFrame(nameDrawerClose);

    return () => cancelAnimationFrame(frame);
  }, [open]);

  return null;
}
