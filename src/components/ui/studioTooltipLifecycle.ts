const INACTIVE_OWNER_SELECTOR = '[hidden], [inert], [aria-hidden="true"], .studio-workspace-layer[data-active="false"], .studio-project-workspace-layer[data-active="false"]';

/**
 * Attribute checks only, so pointer handlers never force a style recalculation
 * while the DOM is changing (a tool or project switch, for example).
 */
export function tooltipAnchorIsEligible(anchor: HTMLElement): boolean {
  return anchor.isConnected && !anchor.closest(INACTIVE_OWNER_SELECTOR) && anchor.getAttribute('aria-expanded') !== 'true';
}

/** Eligible and rendered. Reads computed style, so call it just before revealing a hint. */
export function tooltipAnchorIsAvailable(anchor: HTMLElement): boolean {
  if (!tooltipAnchorIsEligible(anchor)) return false;
  if (typeof anchor.checkVisibility === 'function') return anchor.checkVisibility({ visibilityProperty: true });
  for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
  }
  return true;
}

/** Direct ancestors only: no subtree scan or permanent body observer. */
export function observeTooltipAnchor(anchor: HTMLElement, onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  for (let element: HTMLElement | null = anchor; element; element = element.parentElement) {
    observer.observe(element, {
      attributeFilter: ['hidden', 'inert', 'aria-hidden', 'aria-expanded', 'data-active', 'class', 'style', 'title', 'aria-label'],
      attributes: true,
      childList: true,
    });
  }
  return () => observer.disconnect();
}
