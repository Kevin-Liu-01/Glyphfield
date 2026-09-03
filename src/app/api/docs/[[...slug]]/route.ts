import { docsSource } from '@/lib/docsSource';

type MarkdownRouteProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function GET(_request: Request, { params }: MarkdownRouteProps) {
  const { slug } = await params;
  const page = docsSource.getPage(slug);

  if (!page) {
    return new Response('Documentation page not found.\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      status: 404,
    });
  }

  const markdownBody = await page.data.getText('processed');
  const markdown = `# ${page.data.title}\n\n${page.data.description}\n\n${markdownBody.trimStart()}`;

  return new Response(markdown, {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
