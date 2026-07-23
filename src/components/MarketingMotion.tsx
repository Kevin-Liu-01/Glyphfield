'use client';

import { useMountEffect } from '@/hooks/useMountEffect';

type NavigatorConnection = {
  saveData?: boolean;
};

export default function MarketingMotion() {
  useMountEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const connection = (navigator as Navigator & { connection?: NavigatorConnection }).connection;
    if (prefersReducedMotion || connection?.saveData) return;

    let cancelled = false;
    let cleanupMotion: (() => void) | undefined;
    let cancelSchedule = () => {};

    async function initializeMotion() {
      const [{ gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('lenis'),
      ]);
      if (cancelled) return;

      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({
        anchors: true,
        duration: 1.05,
        easing: (time) => Math.min(1, 1.001 - 2 ** (-10 * time)),
        prevent: (node) => node.closest('[data-lenis-prevent]') !== null,
        smoothWheel: true,
        stopInertiaOnNavigate: true,
      });
      const updateLenis = (time: number) => lenis.raf(time * 1000);

      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(updateLenis);
      gsap.ticker.lagSmoothing(0);

      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>('[data-motion-reveal]').forEach((section) => {
          const items = section.querySelectorAll<HTMLElement>('[data-motion-item]');
          const targets = items.length > 0 ? items : section;
          gsap.fromTo(
            targets,
            { opacity: 0, y: 26 },
            {
              duration: 0.72,
              ease: 'power3.out',
              opacity: 1,
              stagger: 0.065,
              scrollTrigger: {
                once: true,
                start: 'top 84%',
                trigger: section,
              },
              y: 0,
            }
          );
        });

        gsap.to('.marketing-vibrant-orb--one', {
          duration: 13,
          ease: 'sine.inOut',
          repeat: -1,
          rotate: 16,
          xPercent: 9,
          yPercent: -7,
          yoyo: true,
        });
        gsap.to('.marketing-vibrant-orb--two', {
          duration: 17,
          ease: 'sine.inOut',
          repeat: -1,
          rotate: -12,
          xPercent: -8,
          yPercent: 10,
          yoyo: true,
        });
        gsap.to('.marketing-footer-halo', {
          duration: 28,
          ease: 'none',
          repeat: -1,
          rotate: 360,
        });
        gsap.fromTo(
          '[data-footer-wordmark]',
          { letterSpacing: '-0.1em', opacity: 0.15, y: 44 },
          {
            ease: 'power3.out',
            letterSpacing: '-0.075em',
            opacity: 1,
            scrollTrigger: {
              once: true,
              start: 'top 92%',
              trigger: '[data-motion-footer]',
            },
            y: 0,
          }
        );
      });

      ScrollTrigger.refresh();
      cleanupMotion = () => {
        context.revert();
        lenis.destroy();
        gsap.ticker.remove(updateLenis);
        gsap.ticker.lagSmoothing(500, 33);
      };
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(() => void initializeMotion(), { timeout: 1800 });
      cancelSchedule = () => window.cancelIdleCallback(idleId);
    } else {
      const timeoutId = globalThis.setTimeout(() => void initializeMotion(), 900);
      cancelSchedule = () => globalThis.clearTimeout(timeoutId);
    }

    return () => {
      cancelled = true;
      cancelSchedule();
      cleanupMotion?.();
    };
  });

  return null;
}
