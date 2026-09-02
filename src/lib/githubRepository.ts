export type GitHubRepositoryStats = {
  stars: number;
  updatedAt: string;
};

const GITHUB_COUNT_FORMATTER = new Intl.NumberFormat('en-US');
const GITHUB_COMPACT_COUNT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  notation: 'compact',
});

export function parseGitHubStarCount(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const count = (value as { stargazers_count?: unknown }).stargazers_count;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return null;
  return Math.floor(count);
}

export function formatGitHubStarCount(count: number): string {
  return count < 1000
    ? GITHUB_COUNT_FORMATTER.format(count)
    : GITHUB_COMPACT_COUNT_FORMATTER.format(count);
}
