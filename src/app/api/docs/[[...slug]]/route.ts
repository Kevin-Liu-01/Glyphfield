import { docsSource } from '@/lib/docsSource';
import { AGENT_CORS_HEADERS } from '@/lib/agentApi';

type MarkdownRouteProps = {
  params: Promise<{ slug?: string[] }>;
};

// Every page's Markdown is built with the site; an unknown slug still reaches the handler for its text 404.
export const dynamic = 'force-static';

export function generateStaticParams() {
  return docsSource.generateParams();
}

export async function GET(_request: Request, { params }: MarkdownRouteProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);

  if (!page) {
    return new Response('Documentation page not found.\n', {
      headers: {
        ...AGENT_CORS_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      status: 404,
    });
  }

  const markdownBody = await page.data.getText('processed');
  const markdown = `# ${page.data.title}\n\n${page.data.description}\n\n${markdownBody.trimStart()}`;

  return new Response(markdown, {
    headers: {
      ...AGENT_CORS_HEADERS,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
