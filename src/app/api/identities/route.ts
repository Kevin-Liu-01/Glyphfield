import { GT_BRAND_IDENTITY, STARTER_BRAND_IDENTITY } from '@/lib/brandIdentity';

export function GET() {
  return Response.json({
    identities: [STARTER_BRAND_IDENTITY, GT_BRAND_IDENTITY],
    localIdentityPersistence: 'browser-localStorage',
    schemaVersion: 1,
  });
}
