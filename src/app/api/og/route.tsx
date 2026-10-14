import { ImageResponse } from 'next/og';

import BrandOpenGraphImage, {
  DEFAULT_OPEN_GRAPH_ACCENT,
  HOME_OPEN_GRAPH_CARD,
  OPEN_GRAPH_IMAGE_SIZE,
  getBrandOpenGraphFonts,
  truncateAtWord,
} from '@/components/BrandOpenGraphImage';

export const revalidate = false;
export const runtime = 'nodejs';

function valueFromSearchParams(searchParams: URLSearchParams, key: string, fallback: string, maxLength: number) {
  return (searchParams.get(key)?.trim() || fallback).slice(0, maxLength);
}

function textFromSearchParams(searchParams: URLSearchParams, key: string, fallback: string, maxLength: number) {
  return truncateAtWord(searchParams.get(key)?.trim() || fallback, maxLength);
}

function accentFromSearchParams(searchParams: URLSearchParams) {
  const accent = searchParams.get('accent')?.trim();
  return accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : DEFAULT_OPEN_GRAPH_ACCENT;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;

  return new ImageResponse(
    <BrandOpenGraphImage
      accent={accentFromSearchParams(searchParams)}
      description={textFromSearchParams(searchParams, 'description', HOME_OPEN_GRAPH_CARD.description, 180)}
      title={textFromSearchParams(searchParams, 'title', HOME_OPEN_GRAPH_CARD.title, 84)}
      url={valueFromSearchParams(searchParams, 'url', HOME_OPEN_GRAPH_CARD.url, 80)}
    />,
    { ...OPEN_GRAPH_IMAGE_SIZE, fonts: await getBrandOpenGraphFonts() }
  );
}
