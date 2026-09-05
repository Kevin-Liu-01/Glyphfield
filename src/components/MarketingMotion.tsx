'use client';

import { useMountEffect } from '@/hooks/useMountEffect';

type NavigatorConnection = {
  saveData?: boolean;
};

const MOTION_REVEAL_SETTLE_MS = 180;

export default function MarketingMotion() {
  useMountEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
    const sections = [...document.querySelectorAll<HTMLElement>('[data-motion-reveal]')];
    const footer = document.querySelector<HTMLElement>('[data-motion-footer]');
    const intersectingSections = new Set<HTMLElement>();
    let revealTimer = 0;

    function reveal(section: HTMLElement) {
      section.dataset.motionState = 'visible';
    }

    if (prefersReducedMotion || connection?.saveData || !('IntersectionObserver' in window)) {
      sections.forEach(reveal);
      if (footer) footer.dataset.footerState = 'visible';
      return;
    }

    const revealSettledSections = () => {
      revealTimer = 0;
      intersectingSections.forEach((section) => {
        if (section.hasAttribute('data-motion-footer')) section.dataset.footerState = 'visible';
        else reveal(section);
        observer.unobserve(section);
      });
      intersectingSections.clear();
    };
    const scheduleSettledReveal = () => {
      window.clearTimeout(revealTimer);
      revealTimer = window.setTimeout(revealSettledSections, MOTION_REVEAL_SETTLE_MS);
    };
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target as HTMLElement;
          if (entry.isIntersecting) intersectingSections.add(section);
          else intersectingSections.delete(section);
        });
        if (intersectingSections.size > 0) scheduleSettledReveal();
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
    );

    sections.forEach((section) => {
      section.querySelectorAll<HTMLElement>('[data-motion-item]').forEach((item, index) => {
        item.style.setProperty('--marketing-motion-delay', `${Math.min(index, 5) * 45}ms`);
      });
      if (section.getBoundingClientRect().top < window.innerHeight * 0.92) reveal(section);
      else {
        section.dataset.motionState = 'waiting';
        observer.observe(section);
      }
    });

    if (footer) {
      footer.dataset.footerState = 'waiting';
      observer.observe(footer);
    }
    window.addEventListener('scroll', scheduleSettledReveal, { passive: true });

    return () => {
      window.clearTimeout(revealTimer);
      window.removeEventListener('scroll', scheduleSettledReveal);
      observer.disconnect();
    };
  });

  return null;
}
