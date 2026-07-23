import { AGENT_CORS_HEADERS } from '@/lib/agentApi';
import { BUILT_IN_BRAND_IDENTITIES } from '@/lib/brandIdentity';

export function GET() {
  return Response.json(
    {
      agentPresetField: 'identity.preset',
      identities: BUILT_IN_BRAND_IDENTITIES,
      localIdentityPersistence: 'browser-localStorage',
      schemaVersion: 2,
    },
    { headers: AGENT_CORS_HEADERS }
  );
}
