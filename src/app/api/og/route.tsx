import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, { OPEN_GRAPH_SIZE } from '@/components/BrandOpenGraphImage';
import { getOpenGraphFonts } from '@/lib/openGraphFonts';

export const revalidate = false;
export const runtime = 'nodejs';

function valueFromSearchParams(searchParams: URLSearchParams, key: string, fallback: string, maxLength: number) {
  return (searchParams.get(key)?.trim() || fallback).slice(0, maxLength);
}

function accentFromSearchParams(searchParams: URLSearchParams) {
  const accent = searchParams.get('accent')?.trim();
  return accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : '#20bfae';
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  return new ImageResponse(
    <BrandOpenGraphImage
      accent={accentFromSearchParams(searchParams)}
      description={valueFromSearchParams(
        searchParams,
        'description',
        'Build, tune, and export a connected brand system with Glyphfield.',
        180
      )}
      index={valueFromSearchParams(searchParams, 'index', 'GF', 8)}
      kicker={valueFromSearchParams(searchParams, 'kicker', 'Brand studio', 42)}
      title={valueFromSearchParams(searchParams, 'title', 'Make the identity visible.', 84)}
    />,
    { ...OPEN_GRAPH_SIZE, fonts: await getOpenGraphFonts() }
  );
}
