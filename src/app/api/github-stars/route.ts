import { parseGitHubStarCount } from '@/lib/githubRepository';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const FIVE_MINUTES = 300;

export async function GET() {
  try {
    const response = await fetch(PRODUCT_BRAND.repository.apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      next: { revalidate: FIVE_MINUTES },
    });

    if (!response.ok) throw new Error(`GitHub responded with ${response.status}`);
    const stars = parseGitHubStarCount(await response.json());
    if (stars === null) throw new TypeError('GitHub returned an invalid star count.');

    return Response.json(
      { stars, updatedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': `public, s-maxage=${FIVE_MINUTES}, stale-while-revalidate=3600`,
        },
      }
    );
  } catch {
    return Response.json(
      { error: 'Star count is temporarily unavailable.', stars: null },
      { headers: { 'Cache-Control': 'no-store' }, status: 503 }
    );
  }
}
