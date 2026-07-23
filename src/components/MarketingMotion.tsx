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

        gsap.to('.marketing-v5-field-arc--one', {
          duration: 18,
          ease: 'sine.inOut',
          repeat: -1,
          rotate: 3,
          scale: 1.045,
          xPercent: 1.5,
          yPercent: -1,
          yoyo: true,
        });
        gsap.to('.marketing-v5-field-arc--two', {
          duration: 12,
          ease: 'sine.inOut',
          repeat: -1,
          opacity: 0.58,
          scale: 1.06,
          yoyo: true,
        });
        gsap.to('.marketing-v5-product-window', {
          ease: 'none',
          scrollTrigger: {
            end: 'bottom top',
            scrub: 0.6,
            start: 'top bottom',
            trigger: '.marketing-v5-hero-field',
          },
          yPercent: -7,
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
