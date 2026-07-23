import defaultMdxComponents from 'fumadocs-ui/mdx';

import type { MDXComponents } from 'mdx/types';

export function getDocsMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    ...components,
  };
}
