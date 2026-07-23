import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { GT_BRAND_IDENTITY, STARTER_BRAND_IDENTITY } from '@/lib/brandIdentity';

export function GET() {
  return Response.json(
    {
      agentPresetField: 'identity.preset',
      identities: [STARTER_BRAND_IDENTITY, GT_BRAND_IDENTITY],
      localIdentityPersistence: 'browser-localStorage',
      schemaVersion: 1,
    },
    { headers: AGENT_CORS_HEADERS }
  );
}
