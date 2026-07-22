import {
  BRAND_ELEMENT_CATEGORIES,
  BRAND_ELEMENTS,
} from '@/lib/brandElements';

export function GET() {
  return Response.json({
    categories: BRAND_ELEMENT_CATEGORIES,
    count: BRAND_ELEMENTS.length,
    elements: BRAND_ELEMENTS,
    schemaVersion: 1,
  });
}
