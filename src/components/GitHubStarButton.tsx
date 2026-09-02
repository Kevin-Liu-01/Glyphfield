'use client';

import { T, useGT } from 'gt-next';
import { Github, Star } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ReactNode } from 'react';

import { formatGitHubStarCount, type GitHubRepositoryStats } from '@/lib/githubRepository';
import { PRODUCT_BRAND } from '@/lib/productBrand';

type GitHubStarButtonProps = {
  className?: string;
  label?: ReactNode;
  showLabel?: boolean;
};

type LoadState = 'error' | 'loading' | 'ready';

const FIVE_MINUTES = 300_000;
let cachedStats: GitHubRepositoryStats | null = null;
let cachedAt = 0;
let statsRequest: Promise<GitHubRepositoryStats> | null = null;

async function loadRepositoryStats(force = false): Promise<GitHubRepositoryStats> {
  if (!force && cachedStats && Date.now() - cachedAt < FIVE_MINUTES) return cachedStats;
  if (statsRequest) return statsRequest;

  statsRequest = fetch('/api/github-stars', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Star count request failed with ${response.status}`);
      const result = await response.json() as GitHubRepositoryStats;
      if (!Number.isFinite(result.stars)) throw new TypeError('Invalid star count.');
      cachedStats = result;
      cachedAt = Date.now();
      return result;
    })
    .finally(() => {
      statsRequest = null;
    });

  return statsRequest;
}

export default function GitHubStarButton({
  className = '',
  label,
  showLabel = true,
}: GitHubStarButtonProps) {
  const gt = useGT();
  const [stars, setStars] = useState<number | null>(() => cachedStats?.stars ?? null);
  const [loadState, setLoadState] = useState<LoadState>(() => cachedStats ? 'ready' : 'loading');

  useEffect(() => {
    let cancelled = false;

    async function refresh(force = false) {
      try {
        const result = await loadRepositoryStats(force);
        if (cancelled) return;
        setStars(result.stars);
        setLoadState('ready');
      } catch {
        if (cancelled || cachedStats) return;
        setLoadState('error');
      }
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, FIVE_MINUTES);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const formattedStars = stars === null ? '—' : formatGitHubStarCount(stars);
  const title = stars === null
    ? gt('View Glyphfield on GitHub')
    : gt('View Glyphfield on GitHub · {count} stars', { count: formattedStars });

  return (
    <a
      aria-label={title}
      aria-busy={loadState === 'loading'}
      className={`github-star-button ${className}`.trim()}
      data-state={loadState}
      href={PRODUCT_BRAND.repository.url}
      rel='noreferrer'
      target='_blank'
      title={title}
    >
      <Github aria-hidden='true' className='github-star-button__mark' />
      {showLabel ? (
        <span className='github-star-button__label'>{label ?? <T>GitHub</T>}</span>
      ) : null}
      <span aria-live='polite' className='github-star-button__count'>
        <Star aria-hidden='true' />
        <span>{formattedStars}</span>
      </span>
    </a>
  );
}
