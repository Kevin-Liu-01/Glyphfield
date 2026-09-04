import { docsSource } from '@/lib/docsSource';
import { AGENT_CORS_HEADERS } from '@/lib/agentApi';

export async function GET() {
  const pages = docsSource.getPages();
  const sections = await Promise.all(pages.map(async (page) => {
    const body = (await page.data.getText('processed')).trim();
    return [
      `# ${page.data.title}`,
      page.data.description,
      `Canonical page: ${page.url}`,
      `Markdown endpoint: /api/docs/${page.slugs.join('/')}`,
      body,
    ].filter(Boolean).join('\n\n');
  }));

  const introduction = [
    '# Glyphfield complete documentation corpus',
    'This file is generated at request time from the same processed MDX collection as the human documentation. Use /llms.txt as the concise router and this file when the task needs complete product and operating context.',
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
