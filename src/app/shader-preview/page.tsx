import ShaderPreviewCapture from '@/components/ShaderPreviewCapture';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Shader preview capture',
};

export default async function ShaderPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ materialId?: string }>;
}) {
  const { materialId = 'holo-cloth-silk' } = await searchParams;
  return <ShaderPreviewCapture materialId={materialId} />;
}
