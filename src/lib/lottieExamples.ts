export type LottieDocument = Record<string, unknown>;

export type LottieExample = {
  data: LottieDocument;
  description: string;
  id: string;
  name: string;
};

const EASE_IN = { x: [0.42], y: [0] };
const EASE_OUT = { x: [0.58], y: [1] };

function transform(position: [number, number, number]) {
  return {
    a: { a: 0, k: [0, 0, 0] },
    o: { a: 0, k: 100 },
    p: { a: 0, k: position },
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100, 100] },
  };
}

function fill(color: [number, number, number, number]) {
  return { c: { a: 0, k: color }, nm: 'Color', o: { a: 0, k: 100 }, r: 1, ty: 'fl' };
}

function baseDocument(name: string, layers: unknown[]): LottieDocument {
  return {
    assets: [],
    ddd: 0,
    fr: 60,
    h: 720,
    ip: 0,
    layers,
    markers: [],
    nm: name,
    op: 120,
    v: '5.12.2',
    w: 960,
  };
}

function orbitDocument(): LottieDocument {
  return baseDocument('Orbit system', [
    {
      ao: 0,
      bm: 0,
      ddd: 0,
      ind: 1,
      ip: 0,
      ks: {
        ...transform([480, 360, 0]),
        r: {
          a: 1,
          k: [
            { i: EASE_IN, o: EASE_OUT, s: [0], t: 0 },
            { s: [360], t: 120 },
          ],
        },
      },
      nm: 'Orbit',
      op: 120,
      shapes: [
        {
          it: [
            { d: 1, nm: 'Outer ring', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [360, 360] }, ty: 'el' },
            { c: { a: 0, k: [0.08, 0.08, 0.08, 1] }, lc: 1, lj: 1, ml: 4, nm: 'Ring', o: { a: 0, k: 100 }, ty: 'st', w: { a: 0, k: 12 } },
            { a: { a: 0, k: [0, 0] }, nm: 'Transform', o: { a: 0, k: 100 }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, s: { a: 0, k: [100, 100] }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 }, ty: 'tr' },
          ],
          nm: 'Ring group',
          np: 3,
          ty: 'gr',
        },
        {
          it: [
            { d: 1, nm: 'Satellite', p: { a: 0, k: [0, -180] }, s: { a: 0, k: [64, 64] }, ty: 'el' },
            fill([0.08, 0.08, 0.08, 1]),
            { a: { a: 0, k: [0, 0] }, nm: 'Transform', o: { a: 0, k: 100 }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 0 }, s: { a: 0, k: [100, 100] }, sk: { a: 0, k: 0 }, sa: { a: 0, k: 0 }, ty: 'tr' },
          ],
          nm: 'Satellite group',
          np: 3,
          ty: 'gr',
        },
      ],
      sr: 1,
      st: 0,
      ty: 4,
    },
    {
      ao: 0,
      bm: 0,
      ddd: 0,
      ind: 2,
      ip: 0,
      ks: transform([480, 360, 0]),
      nm: 'Center',
      op: 120,
      shapes: [
        { d: 1, nm: 'Center circle', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [132, 132] }, ty: 'el' },
        fill([0.08, 0.08, 0.08, 1]),
      ],
      sr: 1,
      st: 0,
      ty: 4,
    },
  ]);
}

function pulseDocument(): LottieDocument {
  const bars = [300, 480, 660].map((x, index) => ({
    ao: 0,
    bm: 0,
    ddd: 0,
    ind: index + 1,
    ip: 0,
    ks: {
      ...transform([x, 360, 0]),
      s: {
        a: 1,
        k: [
          { i: EASE_IN, o: EASE_OUT, s: [100, 28 + index * 12, 100], t: 0 },
          { i: EASE_IN, o: EASE_OUT, s: [100, 100 - index * 10, 100], t: 30 + index * 8 },
          { i: EASE_IN, o: EASE_OUT, s: [100, 42 + index * 8, 100], t: 72 + index * 8 },
          { s: [100, 28 + index * 12, 100], t: 120 },
        ],
      },
    },
    nm: `Signal ${index + 1}`,
    op: 120,
    shapes: [
      { d: 3, nm: 'Signal bar', p: { a: 0, k: [0, 0] }, r: { a: 0, k: 28 }, s: { a: 0, k: [116, 420] }, ty: 'rc' },
      fill([0.08, 0.08, 0.08, 1]),
    ],
    sr: 1,
    st: 0,
    ty: 4,
  }));
  return baseDocument('Signal pulse', bars);
}

function foldDocument(): LottieDocument {
  return baseDocument('Geometric fold', [
    {
      ao: 0,
      bm: 0,
      ddd: 0,
      ind: 1,
      ip: 0,
      ks: {
        ...transform([480, 360, 0]),
        r: {
          a: 1,
          k: [
            { i: EASE_IN, o: EASE_OUT, s: [0], t: 0 },
            { i: EASE_IN, o: EASE_OUT, s: [45], t: 60 },
            { s: [90], t: 120 },
          ],
        },
        s: {
          a: 1,
          k: [
            { i: EASE_IN, o: EASE_OUT, s: [52, 52, 100], t: 0 },
            { i: EASE_IN, o: EASE_OUT, s: [100, 100, 100], t: 60 },
            { s: [52, 52, 100], t: 120 },
          ],
        },
      },
      nm: 'Fold',
      op: 120,
      shapes: [
        { d: 3, nm: 'Square', p: { a: 0, k: [0, 0] }, r: { a: 0, k: 18 }, s: { a: 0, k: [310, 310] }, ty: 'rc' },
        fill([0.08, 0.08, 0.08, 1]),
      ],
      sr: 1,
      st: 0,
      ty: 4,
    },
  ]);
}

export const LOTTIE_EXAMPLES: readonly LottieExample[] = [
  {
    data: orbitDocument(),
    description: 'A precise looping orbit for systems, loading, or connected states.',
    id: 'orbit',
    name: 'Orbit system',
  },
  {
    data: pulseDocument(),
    description: 'Three staggered bars for audio, activity, or live status.',
    id: 'signal',
    name: 'Signal pulse',
  },
  {
    data: foldDocument(),
    description: 'A restrained geometric turn for marks and transitions.',
    id: 'fold',
    name: 'Geometric fold',
  },
] as const;

export function recolorLottieDocument(document: LottieDocument, hex: string): LottieDocument {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const color = [red, green, blue, 1];

  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, visit(child)]));
    if ((record.ty === 'fl' || record.ty === 'st') && record.c && typeof record.c === 'object') {
      const colorProperty = record.c as Record<string, unknown>;
      if (colorProperty.a === 0 && Array.isArray(colorProperty.k)) {
        next.c = { ...colorProperty, k: color };
      }
    }
    return next;
  }

  return visit(document) as LottieDocument;
}
