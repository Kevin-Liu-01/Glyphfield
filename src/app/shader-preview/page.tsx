import ShaderPreviewCapture from '@/components/ShaderPreviewCapture';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Shader preview capture',
};

export default async function ShaderPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ diagnostics?: string; live?: string; materialId?: string }>;
}) {
  const { diagnostics, live, materialId = 'holo-cloth-silk' } = await searchParams;
  return <ShaderPreviewCapture diagnostics={diagnostics === '1'} livePlayback={live === '1'} materialId={materialId} />;
}
