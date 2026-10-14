import type { Node, Root } from 'fumadocs-core/page-tree';

import { docsSource } from '@/lib/docsSource';
import { gitLastModified } from '@/lib/gitLastModified';
import type { DocsSection } from '@/lib/seo';

type DocsPage = ReturnType<typeof docsSource.getPages>[number];

export type DocsNavigationEntry = {
  /** Sidebar folders that contain the page, outermost first, each linked to its index page if it has one. */
  sections: readonly DocsSection[];
  url: string;
};

const DOCS_CONTENT_DIRECTORY = 'content/docs';

function nodeName(name: unknown) {
  return typeof name === 'string' && name.trim() ? name : undefined;
}

/**
 * A folder's landing page: its `index` node, or, when meta.json lists `index` as an ordinary page,
 * the child page whose URL is the parent path of the folder's other pages.
 */
function folderUrl(folder: Extract<Node, { type: 'folder' }>): string | undefined {
  if (folder.index) return folder.index.url;
  const urls = folder.children.flatMap((child) => (child.type === 'page' && !child.external ? [child.url] : []));
  return urls.find((url) => urls.some((other) => other.startsWith(`${url}/`)));
}

function collectEntries(nodes: readonly Node[], sections: readonly DocsSection[], entries: DocsNavigationEntry[]) {
  for (const node of nodes) {
    if (node.type === 'page') {
      if (!node.external) entries.push({ sections, url: node.url });
    } else if (node.type === 'folder') {
      const name = nodeName(node.name);
      // The folder's own index page is its link, so a page listed outside its URL folder still links correctly.
      const folderSections = name ? [...sections, { name, url: folderUrl(node) }] : sections;
      if (node.index) entries.push({ sections: folderSections, url: node.index.url });
      collectEntries(node.children, folderSections, entries);
    }
  }
  return entries;
}

/** Pages reachable from the docs sidebar, in sidebar order, with the folders that contain them. */
export function docsNavigationEntries(tree: Root = docsSource.getPageTree()): DocsNavigationEntry[] {
  return collectEntries(tree.children, [], []);
}

export function docsSections(url: string): readonly DocsSection[] {
  const entry = docsNavigationEntries().find((candidate) => candidate.url === url);
  // A folder's index page is not its own section.
  return entry ? entry.sections.filter((section) => section.url !== url) : [];
}

/** Every docs page: sidebar pages first in sidebar order, then pages that are not in the sidebar. */
export function orderedDocsPages(): DocsPage[] {
  const pages = docsSource.getPages();
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const ordered = docsNavigationEntries()
    .map(({ url }) => byUrl.get(url))
    .filter((page): page is DocsPage => Boolean(page));
  const listed = new Set(ordered.map((page) => page.url));
  return [...ordered, ...pages.filter((page) => !listed.has(page.url))];
}

/** Date of the newest commit that changed this page's MDX file, or undefined when history cannot prove it. */
export function docsPageLastModified(page: { data: { info: { path: string } } }): Date | undefined {
  const sourcePath = page.data.info.path.replaceAll('\\', '/');
  return gitLastModified(`${DOCS_CONTENT_DIRECTORY}/${sourcePath}`, DOCS_CONTENT_DIRECTORY);
}
