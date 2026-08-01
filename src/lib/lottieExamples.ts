export type LottieDocument = Record<string, unknown>;

export type LottieExample = {
  category: string;
  data: LottieDocument;
  description: string;
  id: string;
  name: string;
};

export type LottieAppearance = {
  brandLogo?: {
    dataUrl: string;
    height: number;
    label: string;
    width: number;
  };
  colors: readonly string[];
  cornerRadius: number;
  fontFamily?: string;
  strokeWidth: number;
};

type LottieColor = [number, number, number, number];
type Point = [number, number, number];
type Size = [number, number];
type EaseName = 'inCubic' | 'inOutCubic' | 'linear' | 'outCubic' | 'outQuart';
type TimedValue = {
  ease?: EaseName;
  t: number;
  value: number[];
};

type AnimatedProperty = ReturnType<typeof animated>;

const COMPOSITION_FRAMES = 240;
const FADE_OUT_START = 218;
const PALETTE: readonly LottieColor[] = [
  [0.96, 0.96, 0.96, 1],
  [0.42, 0.42, 0.46, 1],
  [0.34, 0.55, 1, 1],
];

const EASINGS = {
  inCubic: { i: { x: [0.67], y: [0] }, o: { x: [0.32], y: [0] } },
  inOutCubic: { i: { x: [0.35], y: [1] }, o: { x: [0.65], y: [0] } },
  linear: { i: { x: [0.667], y: [0.667] }, o: { x: [0.333], y: [0.333] } },
  outCubic: { i: { x: [0.68], y: [1] }, o: { x: [0.33], y: [1] } },
  outQuart: { i: { x: [0.5], y: [1] }, o: { x: [0.25], y: [1] } },
} as const;

function animated(values: readonly TimedValue[]) {
  return {
    a: 1,
    k: values.map(({ ease = 'inOutCubic', t, value }, index) => {
      if (index === values.length - 1) return { s: value, t };
      return { ...EASINGS[ease], s: value, t };
    }),
  };
}

function loopOpacity(start = 0, end = FADE_OUT_START, peak = 100) {
  return animated([
    { ease: 'linear', t: 0, value: [start === 0 ? peak : 0] },
    ...(start === 0
      ? []
      : [
          { ease: 'outQuart' as const, t: start, value: [0] },
          { ease: 'linear' as const, t: start + 18, value: [peak] },
        ]),
    { ease: 'inCubic', t: end, value: [peak] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [start === 0 ? peak : 0] },
  ]);
}

function phaseOpacity(start: number, end: number, idle = 22, peak = 100) {
  const fadeInEnd = Math.min(start + 12, end);
  const fadeOutStart = Math.max(fadeInEnd, end - 12);

  return animated([
    { ease: 'linear', t: 0, value: [idle] },
    { ease: 'outQuart', t: start, value: [idle] },
    { ease: 'linear', t: fadeInEnd, value: [peak] },
    { ease: 'inCubic', t: fadeOutStart, value: [peak] },
    { ease: 'linear', t: end, value: [idle] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [idle] },
  ]);
}

function revealScale(start: number, minimum = 92) {
  return animated([
    { ease: 'linear', t: 0, value: [minimum, minimum, 100] },
    { ease: 'outQuart', t: start, value: [minimum, minimum, 100] },
    { ease: 'linear', t: start + 30, value: [100, 100, 100] },
    { ease: 'inCubic', t: FADE_OUT_START, value: [100, 100, 100] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [minimum, minimum, 100] },
  ]);
}

function settlePosition(start: number, from: Point, to: Point, end = FADE_OUT_START) {
  return animated([
    { ease: 'linear', t: 0, value: from },
    { ease: 'outQuart', t: start, value: from },
    { ease: 'linear', t: start + 36, value: to },
    { ease: 'inCubic', t: end, value: to },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: from },
  ]);
}

function transform(position: Point) {
  return {
    a: { a: 0, k: [0, 0, 0] },
    o: { a: 0, k: 100 },
    p: { a: 0, k: position },
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100, 100] },
  };
}

function groupTransform(position: [number, number] = [0, 0]) {
  return {
    a: { a: 0, k: [0, 0] },
    nm: 'Transform',
    o: { a: 0, k: 100 },
    p: { a: 0, k: position },
    r: { a: 0, k: 0 },
    s: { a: 0, k: [100, 100] },
    sk: { a: 0, k: 0 },
    sa: { a: 0, k: 0 },
    ty: 'tr',
  };
}

function fill(slot: number, opacity = 100) {
  return {
    c: { a: 0, k: PALETTE[slot] ?? PALETTE[0] },
    nm: `Palette ${slot + 1}`,
    o: { a: 0, k: opacity },
    r: 1,
    ty: 'fl',
  };
}

function stroke(slot: number, width = 3, opacity = 100) {
  return {
    c: { a: 0, k: PALETTE[slot] ?? PALETTE[0] },
    lc: 2,
    lj: 2,
    ml: 4,
    nm: `Palette ${slot + 1}`,
    o: { a: 0, k: Math.min(opacity, 35) },
    ty: 'st',
    w: { a: 0, k: width },
  };
}

function lottieGradientStops(from: LottieColor, to: LottieColor) {
  return [
    0,
    from[0],
    from[1],
    from[2],
    1,
    to[0],
    to[1],
    to[2],
  ];
}

function gradientStops(fromSlot: number, toSlot: number) {
  const from = PALETTE[fromSlot] ?? PALETTE[0];
  const to = PALETTE[toSlot] ?? PALETTE[0];
  return lottieGradientStops(from, to);
}

function gradientFill(fromSlot: number, toSlot: number, opacity = 100) {
  return {
    e: { a: 0, k: [120, 120] },
    g: { p: 2, k: { a: 0, k: gradientStops(fromSlot, toSlot) } },
    h: { a: 0, k: 0 },
    nm: `Palette Gradient ${fromSlot + 1} ${toSlot + 1}`,
    o: { a: 0, k: opacity },
    r: 1,
    s: { a: 0, k: [-120, -120] },
    t: 1,
    ty: 'gf',
  };
}

function rectangleGroup(
  name: string,
  size: Size,
  slot: number,
  position: [number, number] = [0, 0],
  radius = 16,
  opacity = 100,
) {
  return {
    it: [
      { d: 3, nm: name, p: { a: 0, k: [0, 0] }, r: { a: 0, k: radius }, s: { a: 0, k: size }, ty: 'rc' },
      fill(slot, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

function outlinedRectangleGroup(
  name: string,
  size: Size,
  slot: number,
  position: [number, number] = [0, 0],
  radius = 16,
  width = 2,
  opacity = 100,
) {
  return {
    it: [
      { d: 3, nm: name, p: { a: 0, k: [0, 0] }, r: { a: 0, k: radius }, s: { a: 0, k: size }, ty: 'rc' },
      stroke(slot, width, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

function gradientRectangleGroup(
  name: string,
  size: Size,
  fromSlot: number,
  toSlot: number,
  position: [number, number] = [0, 0],
  radius = 16,
  opacity = 100,
) {
  return {
    it: [
      { d: 3, nm: name, p: { a: 0, k: [0, 0] }, r: { a: 0, k: radius }, s: { a: 0, k: size }, ty: 'rc' },
      gradientFill(fromSlot, toSlot, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

function ellipseGroup(
  name: string,
  size: Size,
  slot: number,
  position: [number, number] = [0, 0],
  opacity = 100,
) {
  return {
    it: [
      { d: 1, nm: name, p: { a: 0, k: [0, 0] }, s: { a: 0, k: size }, ty: 'el' },
      fill(slot, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

function ellipseOutlineGroup(
  name: string,
  size: Size,
  slot: number,
  position: [number, number] = [0, 0],
  width = 2,
  opacity = 100,
) {
  return {
    it: [
      { d: 1, nm: name, p: { a: 0, k: [0, 0] }, s: { a: 0, k: size }, ty: 'el' },
      stroke(slot, width, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

type PanelOptions = {
  accentOpacity?: number;
  accentSide?: 'bottom' | 'left' | 'right' | 'top';
  accentSlot?: number;
  fillOpacity?: number;
  fillSlot?: number;
  rimOpacity?: number;
  rimSlot?: number;
};

function sceneBackdrop(index: number, name: string, accentSlot = 2) {
  return shapeLayer({
    index,
    name: `${name} workspace`,
    opacity: loopOpacity(0, 224, 100),
    position: [480, 360, 0],
    shapes: [
      rectangleGroup('Workspace base', [900, 640], 1, [0, 0], 8, 5),
      outlinedRectangleGroup('Workspace rim', [900, 640], 0, [0, 0], 8, 1, 18),
      gradientRectangleGroup('Workspace header rule', [840, 1], 1, accentSlot, [0, -228], 0, 14),
    ],
  });
}

function panelGroups(
  name: string,
  size: Size,
  position: [number, number] = [0, 0],
  radius = 8,
  {
    accentOpacity = 72,
    accentSide,
    accentSlot = 2,
    fillOpacity = 10,
    fillSlot = 1,
    rimOpacity = 32,
    rimSlot = 0,
  }: PanelOptions = {},
) {
  const [width, height] = size;
  const [x, y] = position;
  const resolvedRadius = Math.min(radius, 8);
  const groups: Array<
    | ReturnType<typeof outlinedRectangleGroup>
    | ReturnType<typeof rectangleGroup>
  > = [
    rectangleGroup(`${name} base`, size, fillSlot, position, resolvedRadius, fillOpacity),
    outlinedRectangleGroup(`${name} rim`, size, rimSlot, position, resolvedRadius, 1, rimOpacity),
  ];

  if (accentSide) {
    const vertical = accentSide === 'left' || accentSide === 'right';
    const accentSize: Size = vertical ? [2, Math.max(20, height - 28)] : [Math.max(20, width - 28), 2];
    const accentPosition: [number, number] = accentSide === 'left'
      ? [x - width / 2 + 7, y]
      : accentSide === 'right'
        ? [x + width / 2 - 7, y]
        : accentSide === 'top'
          ? [x, y - height / 2 + 7]
          : [x, y + height / 2 - 7];
    groups.push(rectangleGroup(`${name} accent`, accentSize, accentSlot, accentPosition, 1, accentOpacity));
  }

  return groups;
}

function orbGroups(name: string, size: number, position: [number, number] = [0, 0], slot = 2) {
  return [
    ellipseGroup(`${name} halo`, [size + 12, size + 12], slot, position, 3),
    ellipseGroup(`${name} core`, [size, size], slot, position, 30),
    ellipseOutlineGroup(`${name} rim`, [size, size], 0, position, 1, 38),
    ellipseGroup(`${name} center`, [Math.max(8, size * 0.18), Math.max(8, size * 0.18)], slot, position, 86),
  ];
}

function shapeLayer({
  index,
  name,
  opacity,
  position,
  rotation,
  scale,
  shapes,
}: {
  index: number;
  name: string;
  opacity?: AnimatedProperty;
  position: Point | AnimatedProperty;
  rotation?: AnimatedProperty;
  scale?: AnimatedProperty;
  shapes: unknown[];
}) {
  const staticPosition: Point = Array.isArray(position) ? position as Point : [0, 0, 0];
  const base = transform(staticPosition);
  return {
    ao: 0,
    bm: 0,
    ddd: 0,
    ind: index,
    ip: 0,
    ks: {
      ...base,
      ...(Array.isArray(position) ? {} : { p: position }),
      ...(opacity ? { o: opacity } : {}),
      ...(rotation ? { r: rotation } : {}),
      ...(scale ? { s: scale } : {}),
    },
    nm: name,
    op: COMPOSITION_FRAMES,
    shapes,
    sr: 1,
    st: 0,
    ty: 4,
  };
}

function textLayer(
  index: number,
  name: string,
  text: string,
  position: Point | AnimatedProperty,
  fontSize: number,
  colorSlot = 0,
  weight: 400 | 500 | 600 = 400,
  opacity: AnimatedProperty = loopOpacity(0, FADE_OUT_START, 100),
  tracking = 0,
  justification: 0 | 1 | 2 = 0,
) {
  const fontStyle = weight === 600 ? 'Semibold' : weight === 500 ? 'Medium' : 'Regular';
  const staticPosition: Point = Array.isArray(position) ? position as Point : [0, 0, 0];
  const base = transform(staticPosition);

  return {
    ao: 0,
    bm: 0,
    ddd: 0,
    ind: index,
    ip: 0,
    ks: {
      ...base,
      ...(Array.isArray(position) ? {} : { p: position }),
      o: opacity,
    },
    nm: `Palette ${colorSlot + 1} Text | ${name}`,
    op: COMPOSITION_FRAMES,
    sr: 1,
    st: 0,
    t: {
      a: [],
      d: {
        k: [{
          s: {
            f: `GlyphfieldSans-${fontStyle}`,
            fc: (PALETTE[colorSlot] ?? PALETTE[0]).slice(0, 3),
            j: justification,
            lh: fontSize * 1.18,
            ls: 0,
            s: fontSize,
            t: text,
            tr: tracking,
          },
          t: 0,
        }],
      },
      m: { a: { a: 0, k: [0, 0] }, g: 1 },
      p: {},
    },
    ty: 5,
  };
}

function sceneDescriptionLayer(index: number, text: string) {
  return textLayer(
    index,
    'Scene description',
    text,
    [480, 92, 0],
    17,
    0,
    500,
    loopOpacity(0, FADE_OUT_START, 100),
    0,
    2,
  );
}

function baseDocument(name: string, layers: unknown[]): LottieDocument {
  return {
    assets: [],
    ddd: 0,
    fonts: {
      list: [
        { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Regular', fStyle: 'Regular' },
        { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Medium', fStyle: 'Medium' },
        { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Semibold', fStyle: 'Semibold' },
      ],
    },
    fr: 60,
    h: 720,
    ip: 0,
    layers,
    markers: [],
    nm: name,
    op: COMPOSITION_FRAMES,
    v: '5.12.2',
    w: 960,
  };
}

function brandLogoLayer(
  index: number,
  width: number,
  height: number,
) {
  const maximumWidth = 96;
  const maximumHeight = 48;
  const scale = Math.min(1, maximumWidth / width, maximumHeight / height);
  const renderedWidth = width * scale;
  const centerX = 60 + renderedWidth / 2;
  const centerY = 84;
  const scalePercent = scale * 100;

  return {
    ao: 0,
    bm: 0,
    ddd: 0,
    ind: index,
    ip: 0,
    ks: {
      a: { a: 0, k: [width / 2, height / 2, 0] },
      o: loopOpacity(6, FADE_OUT_START, 100),
      p: settlePosition(
        6,
        [centerX, centerY - 14, 0],
        [centerX, centerY, 0],
      ),
      r: { a: 0, k: 0 },
      s: animated([
        { ease: 'linear', t: 0, value: [scalePercent * 0.88, scalePercent * 0.88, 100] },
        { ease: 'outQuart', t: 6, value: [scalePercent * 0.88, scalePercent * 0.88, 100] },
        { ease: 'linear', t: 30, value: [scalePercent, scalePercent, 100] },
        { ease: 'inCubic', t: FADE_OUT_START, value: [scalePercent, scalePercent, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [scalePercent * 0.88, scalePercent * 0.88, 100] },
      ]),
    },
    nm: 'Brand logo',
    op: COMPOSITION_FRAMES,
    refId: 'glyphfield-brand-logo',
    sr: 1,
    st: 0,
    ty: 2,
  };
}

function dashboardLaunchDocument(): LottieDocument {
  const layers: unknown[] = [
    shapeLayer({
      index: 1,
      name: 'Dashboard shell',
      opacity: loopOpacity(6),
      position: [480, 400, 0],
      scale: revealScale(6, 96),
      shapes: [
        ...panelGroups('Shell', [810, 480], [0, 0], 8, { fillOpacity: 7, rimOpacity: 18 }),
        rectangleGroup('Sidebar divider', [1, 336], 0, [-236, 18], 0, 12),
      ],
    }),
    shapeLayer({
      index: 2,
      name: 'Navigation focus',
      position: animated([
        { ease: 'linear', t: 0, value: [191, 280, 0] },
        { ease: 'outQuart', t: 34, value: [191, 280, 0] },
        { ease: 'inOutCubic', t: 92, value: [191, 350, 0] },
        { ease: 'inOutCubic', t: 152, value: [191, 420, 0] },
        { ease: 'linear', t: 204, value: [191, 420, 0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [191, 280, 0] },
      ]),
      opacity: loopOpacity(24),
      shapes: [rectangleGroup('Active item', [74, 34], 2, [0, 0], 5, 62)],
    }),
    shapeLayer({
      index: 3,
      name: 'Metric one',
      opacity: loopOpacity(18),
      position: settlePosition(18, [390, 314, 0], [390, 286, 0]),
      scale: revealScale(18),
      shapes: [
        ...panelGroups('Metric card', [220, 112], [0, 0], 8, { accentSide: 'left', fillOpacity: 9, rimOpacity: 22 }),
      ],
    }),
    shapeLayer({
      index: 4,
      name: 'Metric two',
      opacity: loopOpacity(30),
      position: settlePosition(30, [642, 314, 0], [642, 286, 0]),
      scale: revealScale(30),
      shapes: [
        ...panelGroups('Metric card', [220, 112], [0, 0], 8, { accentOpacity: 42, accentSide: 'left', fillOpacity: 7, rimOpacity: 18 }),
      ],
    }),
    shapeLayer({
      index: 5,
      name: 'Activity panel',
      opacity: loopOpacity(38),
      position: [516, 474, 0],
      shapes: [
        ...panelGroups('Activity', [472, 184], [0, 0], 8, { fillOpacity: 6, rimOpacity: 18 }),
      ],
    }),
  ];

  const heights = [44, 78, 58, 112, 86, 132, 102];
  heights.forEach((height, index) => {
    const start = 50 + index * 5;
    layers.push(shapeLayer({
      index: 20 + index,
      name: `Activity bar ${index + 1}`,
      opacity: loopOpacity(start, 212),
      position: [354 + index * 54, 532 - height / 2, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [100, 0, 100] },
        { ease: 'outQuart', t: start, value: [100, 0, 100] },
        { ease: 'outCubic', t: start + 28, value: [100, 100, 100] },
        { ease: 'inOutCubic', t: 154, value: [100, 94 + (index % 3) * 3, 100] },
        { ease: 'inCubic', t: 212, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [100, 0, 100] },
      ]),
      shapes: [rectangleGroup('Bar', [28, height], index % 3 === 2 ? 2 : 0, [0, 0], 4, index % 3 === 2 ? 82 : 66)],
    }));
  });

  layers.unshift(
    sceneDescriptionLayer(40, 'Product overview'),
    textLayer(41, 'Metric one label', 'Locales', [306, 270, 0], 14, 1, 500, loopOpacity(18)),
    textLayer(42, 'Metric one value', '24', [306, 312, 0], 30, 0, 600, loopOpacity(18)),
    textLayer(43, 'Metric two label', 'Coverage', [558, 270, 0], 14, 1, 500, loopOpacity(30)),
    textLayer(44, 'Metric two value', '98%', [558, 312, 0], 30, 0, 600, loopOpacity(30)),
    textLayer(45, 'Activity label', 'Publishing activity', [318, 430, 0], 16, 0, 500, loopOpacity(38)),
  );

  layers.push(sceneBackdrop(90, 'Dashboard launch'));

  return baseDocument('Dashboard launch', layers);
}

function apiExchangeDocument(): LottieDocument {
  const layers: unknown[] = [
    shapeLayer({
      index: 1,
      name: 'Client endpoint',
      opacity: loopOpacity(8),
      position: settlePosition(8, [170, 360, 0], [220, 360, 0]),
      scale: revealScale(8),
      shapes: [
        ...panelGroups('Client', [220, 260], [0, 0], 22, { accentOpacity: 48, accentSide: 'right', fillOpacity: 7, rimOpacity: 22 }),
      ],
    }),
    shapeLayer({
      index: 2,
      name: 'API endpoint',
      opacity: loopOpacity(20),
      position: settlePosition(20, [790, 360, 0], [740, 360, 0]),
      scale: revealScale(20),
      shapes: [
        ...panelGroups('API', [220, 260], [0, 0], 22, { accentSide: 'left', fillOpacity: 9, rimOpacity: 30 }),
      ],
    }),
    shapeLayer({
      index: 3,
      name: 'Request rail',
      opacity: loopOpacity(0, 224, 30),
      position: [480, 322, 0],
      shapes: [rectangleGroup('Rail', [280, 2], 0, [0, 0], 1, 24)],
    }),
    shapeLayer({
      index: 4,
      name: 'Response rail',
      opacity: loopOpacity(0, 224, 30),
      position: [480, 410, 0],
      shapes: [rectangleGroup('Rail', [280, 2], 0, [0, 0], 1, 24)],
    }),
    shapeLayer({
      index: 5,
      name: 'Request packet',
      opacity: animated([
        { ease: 'linear', t: 0, value: [0] },
        { ease: 'outCubic', t: 38, value: [0] },
        { ease: 'linear', t: 48, value: [100] },
        { ease: 'linear', t: 96, value: [100] },
        { ease: 'inCubic', t: 108, value: [0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
      ]),
      position: animated([
        { ease: 'linear', t: 0, value: [340, 322, 0] },
        { ease: 'inOutCubic', t: 42, value: [340, 322, 0] },
        { ease: 'outQuart', t: 104, value: [620, 322, 0] },
        { ease: 'linear', t: 214, value: [620, 322, 0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [340, 322, 0] },
      ]),
      shapes: [rectangleGroup('Request', [64, 24], 2, [0, 0], 12, 90)],
    }),
    shapeLayer({
      index: 6,
      name: 'Response packet',
      opacity: animated([
        { ease: 'linear', t: 0, value: [0] },
        { ease: 'outCubic', t: 112, value: [0] },
        { ease: 'linear', t: 122, value: [100] },
        { ease: 'linear', t: 174, value: [100] },
        { ease: 'inCubic', t: 186, value: [0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
      ]),
      position: animated([
        { ease: 'linear', t: 0, value: [620, 410, 0] },
        { ease: 'inOutCubic', t: 116, value: [620, 410, 0] },
        { ease: 'outQuart', t: 182, value: [340, 410, 0] },
        { ease: 'linear', t: 214, value: [340, 410, 0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [620, 410, 0] },
      ]),
      shapes: [rectangleGroup('Response', [52, 20], 1, [0, 0], 10, 74)],
    }),
  ];

  [
    { index: 7, position: [740, 360, 0] as Point, start: 94 },
    { index: 8, position: [220, 360, 0] as Point, start: 174 },
  ].forEach(({ index, position, start }) => {
    layers.push(shapeLayer({
      index,
      name: `Endpoint pulse ${index}`,
      opacity: animated([
        { ease: 'linear', t: 0, value: [0] },
        { ease: 'outCubic', t: start, value: [0] },
        { ease: 'inCubic', t: start + 18, value: [32] },
        { ease: 'linear', t: start + 34, value: [0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
      ]),
      position,
      scale: animated([
        { ease: 'linear', t: 0, value: [72, 72, 100] },
        { ease: 'outQuart', t: start, value: [72, 72, 100] },
        { ease: 'linear', t: start + 34, value: [124, 124, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [72, 72, 100] },
      ]),
      shapes: [ellipseOutlineGroup('Pulse', [170, 170], 2, [0, 0], 2, 70)],
    }));
  });

  layers.unshift(
    sceneDescriptionLayer(40, 'API exchange'),
    textLayer(41, 'Client label', 'CLIENT', [146, 286, 0], 13, 1, 500, loopOpacity(8), 80),
    textLayer(42, 'Client value', 'POST /translate', [146, 344, 0], 20, 0, 500, loopOpacity(8)),
    textLayer(43, 'API label', 'TRANSLATION API', [666, 286, 0], 13, 1, 500, loopOpacity(20), 60),
    textLayer(44, 'API value', '200 OK', [666, 344, 0], 20, 2, 600, loopOpacity(20)),
    textLayer(45, 'Request direction', 'request', [438, 302, 0], 13, 1, 500, phaseOpacity(38, 108, 12, 100)),
    textLayer(46, 'Response direction', 'response', [430, 442, 0], 13, 1, 500, phaseOpacity(112, 186, 12, 100)),
  );

  layers.push(sceneBackdrop(90, 'API exchange'));

  return baseDocument('API exchange', layers);
}

function localeMatrixDocument(): LottieDocument {
  const layers: unknown[] = [];
  const localeCodes = ['EN', 'ES', 'FR', 'DE', 'JA', 'KO', 'ZH', 'AR', 'PT', 'IT', 'HI', 'NL'];
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      const index = row * 4 + column;
      const start = 18 + index * 13;
      const end = Math.min(start + 42, 210);
      const x = 300 + column * 120;
      const y = 258 + row * 104;
      layers.push(shapeLayer({
        index: index + 1,
        name: `Locale tile ${index + 1}`,
        opacity: phaseOpacity(start, end, 16, 100),
        position: [x, y, 0],
        scale: animated([
          { ease: 'linear', t: 0, value: [96, 96, 100] },
          { ease: 'outQuart', t: start, value: [96, 96, 100] },
          { ease: 'linear', t: start + 24, value: [100, 100, 100] },
          { ease: 'linear', t: 214, value: [100, 100, 100] },
          { ease: 'linear', t: COMPOSITION_FRAMES, value: [96, 96, 100] },
        ]),
        shapes: [
          ...panelGroups('Locale', [96, 72], [0, 0], 15, {
            accentOpacity: (row + column) % 3 === 0 ? 78 : 0,
            accentSide: (row + column) % 3 === 0 ? 'bottom' : undefined,
            fillOpacity: 6 + ((row + column) % 3) * 2,
            rimOpacity: 20,
          }),
        ],
      }));
      layers.unshift(textLayer(
        40 + index,
        `Locale code ${localeCodes[index]}`,
        localeCodes[index] ?? '--',
        [x - 15, y + 7, 0],
        18,
        (row + column) % 3 === 0 ? 2 : 0,
        600,
        phaseOpacity(start, end, 26, 100),
      ));
    }
  }

  layers.unshift(
    sceneDescriptionLayer(60, 'Locale coverage'),
  );

  layers.push(sceneBackdrop(90, 'Locale matrix'));

  return baseDocument('Locale matrix', layers);
}

function releaseStackDocument(): LottieDocument {
  const layers: unknown[] = [];
  const widths = [520, 560, 600, 640];
  widths.forEach((width, index) => {
    const start = 10 + index * 18;
    const y = 252 + index * 76;
    const initialX = index % 2 === 0 ? 330 : 630;
    layers.push(shapeLayer({
      index: index + 1,
      name: `Release layer ${index + 1}`,
      opacity: loopOpacity(start),
      position: animated([
        { ease: 'linear', t: 0, value: [initialX, y, 0] },
        { ease: 'outQuart', t: start, value: [initialX, y, 0] },
        { ease: 'outCubic', t: start + 28, value: [480, y, 0] },
        { ease: 'inOutCubic', t: 174, value: [480, y, 0] },
        { ease: 'inCubic', t: FADE_OUT_START, value: [480, y, 0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [initialX, y, 0] },
      ]),
      shapes: [
        ...panelGroups('Release plane', [width, 60], [0, 0], 14, {
          accentSide: index === 3 ? 'bottom' : undefined,
          fillOpacity: index === 3 ? 10 : 5 + index,
          rimOpacity: index === 3 ? 32 : 20,
        }),
        ...orbGroups('Lock', 18, [width / 2 - 44, 0], index === 3 ? 0 : 2),
      ],
    }));
  });

  layers.push(shapeLayer({
    index: 10,
    name: 'Release completion',
    opacity: loopOpacity(66, 208),
    position: [480, 568, 0],
    scale: animated([
      { ease: 'linear', t: 0, value: [0, 100, 100] },
      { ease: 'outQuart', t: 66, value: [0, 100, 100] },
      { ease: 'inOutCubic', t: 152, value: [100, 100, 100] },
      { ease: 'inCubic', t: 208, value: [100, 100, 100] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [0, 100, 100] },
    ]),
    shapes: [rectangleGroup('Completion rail', [640, 8], 2, [0, 0], 4, 82)],
  }));

  const releaseLabels = ['Content', 'Code', 'Assets', 'Locales'];
  releaseLabels.forEach((label, index) => {
    const start = 10 + index * 18;
    const y = 258 + index * 76;
    layers.unshift(textLayer(
      40 + index,
      `Release label ${label}`,
      label,
      [232, y, 0],
      17,
      index === 3 ? 2 : 0,
      500,
      loopOpacity(start),
    ));
  });
  layers.unshift(
    sceneDescriptionLayer(50, 'Release stack'),
    textLayer(51, 'Completion label', 'Ready to ship', [390, 548, 0], 18, 2, 600, loopOpacity(66, 208)),
  );

  layers.push(sceneBackdrop(90, 'Release stack'));

  return baseDocument('Release stack', layers);
}

function contentSyncDocument(): LottieDocument {
  const layers: unknown[] = [
    shapeLayer({
      index: 1,
      name: 'Source document',
      opacity: loopOpacity(8),
      position: [270, 360, 0],
      scale: revealScale(8),
      shapes: [
        ...panelGroups('Source', [284, 380], [0, 0], 22, { accentOpacity: 46, accentSide: 'right', fillOpacity: 7, rimOpacity: 22 }),
      ],
    }),
    shapeLayer({
      index: 2,
      name: 'Localized document',
      opacity: loopOpacity(24),
      position: [690, 360, 0],
      scale: revealScale(24),
      shapes: [
        ...panelGroups('Localized', [284, 380], [0, 0], 22, { accentSide: 'left', fillOpacity: 9, rimOpacity: 30 }),
      ],
    }),
    shapeLayer({
      index: 3,
      name: 'Sync axis',
      opacity: loopOpacity(0, 224, 28),
      position: [480, 360, 0],
      shapes: [rectangleGroup('Axis', [2, 310], 0, [0, 0], 1, 24)],
    }),
  ];

  const sourceWidths = [194, 154, 208, 126];
  const outputWidths = [164, 204, 144, 192];
  sourceWidths.forEach((width, index) => {
    const y = 292 + index * 48;
    const start = 38 + index * 24;
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Source row ${index + 1}`,
      opacity: animated([
        { ease: 'linear', t: 0, value: [46] },
        { ease: 'inOutCubic', t: start, value: [46] },
        { ease: 'inCubic', t: start + 32, value: [14] },
        { ease: 'linear', t: 214, value: [14] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [46] },
      ]),
      position: [270 - (194 - width) / 2, y, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [100, 100, 100] },
        { ease: 'inCubic', t: start, value: [100, 100, 100] },
        { ease: 'linear', t: start + 32, value: [18, 100, 100] },
        { ease: 'linear', t: 214, value: [18, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [100, 100, 100] },
      ]),
      shapes: [rectangleGroup('Source line', [width, 10], 1, [0, 0], 5, 78)],
    }));
    layers.push(shapeLayer({
      index: 20 + index,
      name: `Localized row ${index + 1}`,
      opacity: animated([
        { ease: 'linear', t: 0, value: [14] },
        { ease: 'outQuart', t: start + 20, value: [14] },
        { ease: 'inOutCubic', t: start + 44, value: [100] },
        { ease: 'linear', t: start + 62, value: [100] },
        { ease: 'inCubic', t: start + 76, value: [48] },
        { ease: 'linear', t: 214, value: [48] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [14] },
      ]),
      position: [690 - (204 - outputWidths[index]!) / 2, y, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [18, 100, 100] },
        { ease: 'outQuart', t: start + 20, value: [18, 100, 100] },
        { ease: 'inOutCubic', t: start + 50, value: [100, 100, 100] },
        { ease: 'linear', t: 214, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [18, 100, 100] },
      ]),
      shapes: [rectangleGroup('Localized line', [outputWidths[index]!, 10], index === 1 ? 2 : 1, [0, 0], 5, index === 1 ? 88 : 68)],
    }));
    layers.push(shapeLayer({
      index: 30 + index,
      name: `Sync packet ${index + 1}`,
      opacity: animated([
        { ease: 'linear', t: 0, value: [0] },
        { ease: 'outCubic', t: start, value: [0] },
        { ease: 'linear', t: start + 8, value: [100] },
        { ease: 'linear', t: start + 46, value: [100] },
        { ease: 'inCubic', t: start + 54, value: [0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
      ]),
      position: animated([
        { ease: 'linear', t: 0, value: [416, y, 0] },
        { ease: 'inOutCubic', t: start, value: [416, y, 0] },
        { ease: 'outQuart', t: start + 54, value: [544, y, 0] },
        { ease: 'linear', t: 214, value: [544, y, 0] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [416, y, 0] },
      ]),
      shapes: [rectangleGroup('Packet', [34, 8], 2, [0, 0], 4, 88)],
    }));
  });

  layers.unshift(
    sceneDescriptionLayer(50, 'Content sync'),
    textLayer(51, 'Source label', 'SOURCE', [164, 220, 0], 13, 1, 500, loopOpacity(8), 80),
    textLayer(52, 'Source value', 'product.json', [164, 250, 0], 18, 0, 500, loopOpacity(8)),
    textLayer(53, 'Localized label', 'LOCALIZED', [584, 220, 0], 13, 1, 500, loopOpacity(24), 80),
    textLayer(54, 'Localized value', '4 updates', [584, 250, 0], 18, 2, 600, loopOpacity(24)),
  );

  layers.push(sceneBackdrop(90, 'Content sync'));

  return baseDocument('Content sync', layers);
}

function conversionFlowDocument(): LottieDocument {
  const layers: unknown[] = [
    shapeLayer({
      index: 1,
      name: 'Flow rail',
      opacity: loopOpacity(0, 224, 28),
      position: [480, 360, 0],
      shapes: [rectangleGroup('Rail', [500, 2], 0, [0, 0], 1, 24)],
    }),
  ];
  const positions = [230, 480, 730];
  positions.forEach((x, index) => {
    const start = 24 + index * 60;
    const end = start + 52;
    layers.push(shapeLayer({
      index: index + 2,
      name: `Conversion step ${index + 1}`,
      opacity: phaseOpacity(start, end, 18, 100),
      position: [x, 360, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [92, 92, 100] },
        { ease: 'outQuart', t: start, value: [92, 92, 100] },
        { ease: 'outCubic', t: start + 28, value: [100, 100, 100] },
        { ease: 'inCubic', t: end - 10, value: [100, 100, 100] },
        { ease: 'linear', t: end, value: [94, 94, 100] },
        { ease: 'linear', t: 214, value: [94, 94, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [92, 92, 100] },
      ]),
      shapes: [
        ...orbGroups('Step node', 92, [0, 0], index === 1 ? 2 : 0),
        ellipseGroup('Step core', [30, 30], index === 1 ? 0 : 2, [0, 0], 92),
      ],
    }));
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Step detail ${index + 1}`,
      opacity: phaseOpacity(start, end, 18, 100),
      position: [x, 492, 0],
      shapes: [
        ...panelGroups('Detail', [174, 86], [0, 0], 16, { accentOpacity: 72, accentSide: 'top', fillOpacity: 7, rimOpacity: 22 }),
      ],
    }));
    layers.unshift(textLayer(
      60 + index,
      `Step number ${index + 1}`,
      `0${index + 1}`,
      [x - 12, 367, 0],
      18,
      index === 1 ? 0 : 2,
      600,
      phaseOpacity(start, end, 22, 100),
    ));
  });

  ['Connect', 'Configure', 'Ship'].forEach((label, index) => {
    layers.unshift(textLayer(
      40 + index,
      `Step label ${label}`,
      label,
      [positions[index]! - 47, 499, 0],
      17,
      0,
      500,
      phaseOpacity(24 + index * 60, 76 + index * 60, 18, 100),
    ));
  });
  layers.unshift(
    sceneDescriptionLayer(50, 'Onboarding'),
  );

  layers.push(sceneBackdrop(90, 'Conversion flow'));

  return baseDocument('Conversion flow', layers);
}

function agentQueueDocument(): LottieDocument {
  const layers: unknown[] = [
    shapeLayer({
      index: 1,
      name: 'Agent hub',
      opacity: loopOpacity(8),
      position: [500, 360, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [96, 96, 100] },
        { ease: 'outQuart', t: 8, value: [96, 96, 100] },
        { ease: 'linear', t: 36, value: [100, 100, 100] },
        { ease: 'inCubic', t: 214, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [96, 96, 100] },
      ]),
      shapes: [
        ...orbGroups('Hub', 142, [0, 0], 0),
        ellipseOutlineGroup('Hub orbit', [204, 204], 2, [0, 0], 1, 26),
      ],
    }),
    shapeLayer({
      index: 2,
      name: 'Output panel',
      opacity: loopOpacity(34),
      position: [748, 360, 0],
      scale: revealScale(34),
      shapes: [
        ...panelGroups('Output', [176, 246], [0, 0], 20, { accentSide: 'left', fillOpacity: 8, rimOpacity: 28 }),
      ],
    }),
    shapeLayer({
      index: 3,
      name: 'Hub to output rail',
      opacity: loopOpacity(0, 224, 28),
      position: [626, 360, 0],
      shapes: [rectangleGroup('Rail', [108, 2], 0, [0, 0], 1, 24)],
    }),
  ];

  const queueY = [246, 322, 398, 474];
  queueY.forEach((y, index) => {
    const start = 30 + index * 34;
    const taskOpacity = phaseOpacity(start, start + 34, 20, 100);
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Queued task ${index + 1}`,
      opacity: taskOpacity,
      position: [230, y, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [98, 98, 100] },
        { ease: 'outCubic', t: start, value: [98, 98, 100] },
        { ease: 'outQuart', t: start + 10, value: [100, 100, 100] },
        { ease: 'inCubic', t: start + 34, value: [98, 98, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [98, 98, 100] },
      ]),
      shapes: [
        ...panelGroups('Task', [176, 54], [0, 0], 13, { accentOpacity: 76, accentSide: 'left', fillOpacity: 6 + (index % 2) * 2, rimOpacity: 20 }),
        ellipseGroup('State', [14, 14], 2, [62, 0], 78),
      ],
    }));
    layers.unshift(textLayer(
      40 + index,
      `Task label ${index + 1}`,
      ['Copy', 'Docs', 'UI', 'Release'][index] ?? 'Task',
      [158, y + 6, 0],
      16,
      index === 2 ? 2 : 0,
      500,
      taskOpacity,
    ));
  });

  layers.push(shapeLayer({
    index: 19,
    name: 'Agent input packet',
    opacity: animated([
      { ease: 'linear', t: 0, value: [0] },
      { ease: 'outCubic', t: 36, value: [0] },
      { ease: 'linear', t: 48, value: [100] },
      { ease: 'linear', t: 168, value: [100] },
      { ease: 'inCubic', t: 184, value: [0] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
    ]),
    position: animated([
      { ease: 'linear', t: 0, value: [340, 360, 0] },
      { ease: 'outQuart', t: 48, value: [340, 360, 0] },
      { ease: 'inOutCubic', t: 168, value: [418, 360, 0] },
      { ease: 'linear', t: 184, value: [418, 360, 0] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [340, 360, 0] },
    ]),
    shapes: [rectangleGroup('Input packet', [28, 10], 2, [0, 0], 5, 88)],
  }));

  layers.push(shapeLayer({
    index: 20,
    name: 'Agent result packet',
    opacity: animated([
      { ease: 'linear', t: 0, value: [0] },
      { ease: 'outCubic', t: 154, value: [0] },
      { ease: 'linear', t: 164, value: [100] },
      { ease: 'linear', t: 198, value: [100] },
      { ease: 'inCubic', t: 208, value: [0] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
    ]),
    position: animated([
      { ease: 'linear', t: 0, value: [572, 360, 0] },
      { ease: 'inOutCubic', t: 158, value: [572, 360, 0] },
      { ease: 'outQuart', t: 204, value: [660, 360, 0] },
      { ease: 'linear', t: 214, value: [660, 360, 0] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [572, 360, 0] },
    ]),
    shapes: [rectangleGroup('Result', [42, 18], 2, [0, 0], 9, 88)],
  }));

  layers.unshift(
    sceneDescriptionLayer(50, 'Agent queue'),
    textLayer(51, 'Hub label', 'AGENT', [468, 366, 0], 14, 0, 600, loopOpacity(8), 80),
    textLayer(52, 'Output label', 'OUTPUT', [690, 286, 0], 13, 1, 500, loopOpacity(34), 80),
    textLayer(53, 'Output value', 'Ready', [690, 334, 0], 22, 2, 600, loopOpacity(154, 208)),
  );

  layers.push(sceneBackdrop(90, 'Agent task queue'));

  return baseDocument('Agent task queue', layers);
}

export const LOTTIE_EXAMPLES: readonly LottieExample[] = [
  {
    category: 'Product UI',
    data: dashboardLaunchDocument(),
    description: 'A product shell resolves before metrics and activity settle into place.',
    id: 'dashboard-launch',
    name: 'Dashboard launch',
  },
  {
    category: 'Developer',
    data: apiExchangeDocument(),
    description: 'One request and response exchange with directional endpoint feedback.',
    id: 'api-exchange',
    name: 'API exchange',
  },
  {
    category: 'Global product',
    data: localeMatrixDocument(),
    description: 'Locale tiles activate diagonally as focus moves through the matrix.',
    id: 'locale-matrix',
    name: 'Locale matrix',
  },
  {
    category: 'Release',
    data: releaseStackDocument(),
    description: 'Independent product layers align and lock into one stable release.',
    id: 'release-stack',
    name: 'Release stack',
  },
  {
    category: 'Content',
    data: contentSyncDocument(),
    description: 'Source rows contract while localized rows resolve across a shared axis.',
    id: 'content-sync',
    name: 'Content sync',
  },
  {
    category: 'Onboarding',
    data: conversionFlowDocument(),
    description: 'A restrained three-step flow advances with one continuous focus signal.',
    id: 'conversion-flow',
    name: 'Conversion flow',
  },
  {
    category: 'Agents',
    data: agentQueueDocument(),
    description: 'Queued work converges on an agent hub before a single result resolves.',
    id: 'agent-queue',
    name: 'Agent task queue',
  },
] as const;

function hexToLottieColor(hex: string): LottieColor {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#181818';
  return [
    Number.parseInt(normalized.slice(1, 3), 16) / 255,
    Number.parseInt(normalized.slice(3, 5), 16) / 255,
    Number.parseInt(normalized.slice(5, 7), 16) / 255,
    1,
  ];
}

export function customizeLottieDocument(
  document: LottieDocument,
  appearance: LottieAppearance,
): LottieDocument {
  const colors = appearance.colors.length > 0 ? appearance.colors : ['#181818'];

  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    const next = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, visit(child)]));

    if ((record.ty === 'fl' || record.ty === 'st') && record.c && typeof record.c === 'object') {
      const colorProperty = record.c as Record<string, unknown>;
      if (colorProperty.a === 0 && Array.isArray(colorProperty.k)) {
        const match = typeof record.nm === 'string' ? /Palette (\d+)/.exec(record.nm) : null;
        const slot = Math.max(0, Number(match?.[1] ?? 1) - 1);
        next.c = { ...colorProperty, k: hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818') };
      }
    }

    if (record.ty === 5 && record.t && typeof record.t === 'object') {
      const text = next.t as Record<string, unknown>;
      const documentData = text.d as Record<string, unknown> | undefined;
      const keyframes = Array.isArray(documentData?.k) ? documentData.k : [];
      const match = typeof record.nm === 'string' ? /Palette (\d+) Text/.exec(record.nm) : null;
      const slot = Math.max(0, Number(match?.[1] ?? 1) - 1);
      const color = hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818').slice(0, 3);

      text.d = {
        ...documentData,
        k: keyframes.map((keyframe) => {
          if (!keyframe || typeof keyframe !== 'object') return keyframe;
          const keyframeRecord = keyframe as Record<string, unknown>;
          const style = keyframeRecord.s as Record<string, unknown> | undefined;
          if (!style) return keyframe;
          const currentFont = typeof style.f === 'string' ? style.f : 'GlyphfieldSans-Regular';
          const fontStyle = currentFont.endsWith('Semibold')
            ? 'Semibold'
            : currentFont.endsWith('Medium')
              ? 'Medium'
              : 'Regular';
          return {
            ...keyframeRecord,
            s: {
              ...style,
              f: appearance.fontFamily ? `BrandFont-${fontStyle}` : currentFont,
              fc: color,
            },
          };
        }),
      };
      next.t = text;
    }

    if (record.ty === 'gf' && record.g && typeof record.g === 'object') {
      const gradient = record.g as Record<string, unknown>;
      const colorProperty = gradient.k as Record<string, unknown> | undefined;
      const match = typeof record.nm === 'string'
        ? /Palette Gradient (\d+) (\d+)/.exec(record.nm)
        : null;

      if (colorProperty?.a === 0 && Array.isArray(colorProperty.k) && match) {
        const fromSlot = Math.max(0, Number(match[1]) - 1);
        const toSlot = Math.max(0, Number(match[2]) - 1);
        const fallback = colors[0] ?? '#181818';
        next.g = {
          ...gradient,
          k: {
            ...colorProperty,
            k: lottieGradientStops(
              hexToLottieColor(colors[fromSlot] ?? fallback),
              hexToLottieColor(colors[toSlot] ?? fallback),
            ),
          },
        };
      }
    }

    if (record.ty === 'st' && record.w && typeof record.w === 'object') {
      const widthProperty = record.w as Record<string, unknown>;
      if (widthProperty.a === 0) next.w = { ...widthProperty, k: appearance.strokeWidth };
    }

    if (record.ty === 'rc' && record.r && typeof record.r === 'object') {
      const radiusProperty = record.r as Record<string, unknown>;
      const sizeProperty = record.s as Record<string, unknown> | undefined;
      const size = sizeProperty?.a === 0 && Array.isArray(sizeProperty.k)
        ? sizeProperty.k.filter((entry): entry is number => typeof entry === 'number')
        : [];
      const maximumRadius = size.length >= 2
        ? Math.max(0, Math.min(size[0] ?? 0, size[1] ?? 0) / 2)
        : appearance.cornerRadius;
      if (radiusProperty.a === 0) {
        next.r = { ...radiusProperty, k: Math.min(appearance.cornerRadius, maximumRadius) };
      }
    }

    return next;
  }

  const customized = visit(document) as LottieDocument;
  const fonts = customized.fonts as Record<string, unknown> | undefined;
  const fontList = Array.isArray(fonts?.list) ? fonts.list : [];
  const customizedWithFonts = appearance.fontFamily
    ? {
        ...customized,
        fonts: {
          ...fonts,
          list: fontList.map((font) => {
            if (!font || typeof font !== 'object') return font;
            const fontRecord = font as Record<string, unknown>;
            const fontStyle = typeof fontRecord.fStyle === 'string' ? fontRecord.fStyle : 'Regular';
            return {
              ...fontRecord,
              fFamily: appearance.fontFamily,
              fName: `BrandFont-${fontStyle}`,
            };
          }),
        },
      }
    : customized;

  if (!appearance.brandLogo) return customizedWithFonts;

  const assets = Array.isArray(customizedWithFonts.assets)
    ? customizedWithFonts.assets.filter((asset) => {
        if (!asset || typeof asset !== 'object') return true;
        return (asset as Record<string, unknown>).id !== 'glyphfield-brand-logo';
      })
    : [];
  const layers = Array.isArray(customizedWithFonts.layers)
    ? customizedWithFonts.layers.filter((layer) => {
        if (!layer || typeof layer !== 'object') return true;
        return (layer as Record<string, unknown>).nm !== 'Brand logo';
      })
    : [];
  const maximumLayerIndex = layers.reduce((maximum, layer) => {
    if (!layer || typeof layer !== 'object') return maximum;
    const index = (layer as Record<string, unknown>).ind;
    return typeof index === 'number' ? Math.max(maximum, index) : maximum;
  }, 0);
  const logoWidth = Math.max(1, appearance.brandLogo.width);
  const logoHeight = Math.max(1, appearance.brandLogo.height);

  return {
    ...customizedWithFonts,
    assets: [
      ...assets,
      {
        e: 1,
        h: logoHeight,
        id: 'glyphfield-brand-logo',
        nm: appearance.brandLogo.label,
        p: appearance.brandLogo.dataUrl,
        u: '',
        w: logoWidth,
      },
    ],
    layers: [
      brandLogoLayer(maximumLayerIndex + 1, logoWidth, logoHeight),
      ...layers,
    ],
  };
}

export function recolorLottieDocument(document: LottieDocument, hex: string): LottieDocument {
  return customizeLottieDocument(document, {
    colors: [hex],
    cornerRadius: 8,
    strokeWidth: 2,
  });
}
