import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { orderedDocsPages } from '@/lib/docsSeo';
import { docsSource } from '@/lib/docsSource';
import { HOME_DESCRIPTION, SITE_URL, absoluteUrl } from '@/lib/seo';

// Prerendered at build time from the compiled MDX collection, so no request reads content/ from disk.
export const dynamic = 'force-static';

export async function GET() {
  // docsSource.getPages() in sidebar order; orderedDocsPages() appends pages hidden from the sidebar.
  const pages = orderedDocsPages();
  const sections = await Promise.all(pages.map(async (page) => {
    const body = (await page.data.getText('processed')).trim();
    return [
      `# ${page.data.title}`,
      page.data.description,
      `Canonical page: ${absoluteUrl(page.url)}`,
      `Markdown: ${absoluteUrl(`${page.url}.md`)}`,
      body,
    ].filter(Boolean).join('\n\n');
  }));

  const introduction = [
    '# Glyphfield complete documentation',
    HOME_DESCRIPTION,
    `This file contains all ${docsSource.getPages().length} pages of the Glyphfield documentation at ${SITE_URL}/docs, built from the same MDX source as the human documentation. ${absoluteUrl('/llms.txt')} is the short index. Each page is also available as Markdown by adding .md to its URL.`,
  ].join('\n\n');
  const document = [
    introduction,
    ...sections,
  ].join('\n\n---\n\n');

  return new Response(`${document}\n`, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
