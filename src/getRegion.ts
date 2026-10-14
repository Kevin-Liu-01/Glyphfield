// The site has no region-specific content. A fixed region keeps gt-next from
// reading the region cookie, which would make every route render on demand.
export default async function getRegion(): Promise<string | undefined> {
  return undefined;
}
