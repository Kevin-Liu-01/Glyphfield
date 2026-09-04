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
  [0.97, 0.98, 0.99, 1],
  [0.49, 0.53, 0.61, 1],
  [0.49, 0.36, 0.99, 1],
];

const EASINGS = {
  inCubic: { i: { x: [0.67], y: [0] }, o: { x: [0.32], y: [0] } },
  inOutCubic: { i: { x: [0.2], y: [1] }, o: { x: [0.4], y: [0] } },
  linear: { i: { x: [0.667], y: [0.667] }, o: { x: [0.333], y: [0.333] } },
  outCubic: { i: { x: [0.68], y: [1] }, o: { x: [0.33], y: [1] } },
  outQuart: { i: { x: [0.1], y: [1] }, o: { x: [0.05], y: [0.7] } },
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
  if (start === 0) {
    return animated([
      { ease: 'linear', t: 0, value: [peak] },
      { ease: 'linear', t: end, value: [peak] },
      { ease: 'linear', t: COMPOSITION_FRAMES, value: [peak] },
    ]);
  }
  return animated([
    { ease: 'linear', t: 0, value: [0] },
    { ease: 'outQuart', t: start, value: [0] },
    { ease: 'linear', t: start + 14, value: [peak] },
    { ease: 'inCubic', t: end, value: [peak] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [0] },
  ]);
}

function phaseOpacity(start: number, end: number, idle = 0, peak = 100) {
  return animated([
    { ease: 'linear', t: 0, value: [idle] },
    { ease: 'outQuart', t: start, value: [idle] },
    { ease: 'linear', t: start + 10, value: [peak] },
    { ease: 'inCubic', t: end - 10, value: [peak] },
    { ease: 'linear', t: end, value: [idle] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [idle] },
  ]);
}

function revealScale(start: number, minimum = 94) {
  return animated([
    { ease: 'linear', t: 0, value: [minimum, minimum, 100] },
    { ease: 'outQuart', t: start, value: [minimum, minimum, 100] },
    { ease: 'linear', t: start + 22, value: [100, 100, 100] },
    { ease: 'inCubic', t: FADE_OUT_START, value: [100, 100, 100] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [minimum, minimum, 100] },
  ]);
}

function settlePosition(
  start: number,
  from: Point,
  to: Point,
  end = FADE_OUT_START,
  duration = 24,
) {
  return animated([
    { ease: 'linear', t: 0, value: from },
    { ease: 'outQuart', t: start, value: from },
    { ease: 'linear', t: start + duration, value: to },
    { ease: 'inCubic', t: end, value: to },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: from },
  ]);
}

function travelPosition(start: number, end: number, from: Point, to: Point) {
  const midpoint: Point = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2 - (Math.abs(to[0] - from[0]) > 300 ? 6 : 0),
    (from[2] + to[2]) / 2,
  ];
  return animated([
    { ease: 'linear', t: 0, value: from },
    { ease: 'inOutCubic', t: start, value: from },
    { ease: 'inOutCubic', t: Math.round((start + end) / 2), value: midpoint },
    { ease: 'linear', t: end, value: to },
    { ease: 'linear', t: FADE_OUT_START, value: to },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: from },
  ]);
}

function phasePosition(start: number, end: number, from: Point, active: Point, exit: Point) {
  return animated([
    { ease: 'linear', t: 0, value: from },
    { ease: 'outQuart', t: start, value: from },
    { ease: 'linear', t: start + 12, value: active },
    { ease: 'inCubic', t: end - 10, value: active },
    { ease: 'linear', t: end, value: exit },
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

function stroke(slot: number, width = 1, opacity = 100) {
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
  return [0, from[0], from[1], from[2], 1, to[0], to[1], to[2]];
}

function gradientFill(fromSlot: number, toSlot: number, opacity = 100) {
  const from = PALETTE[fromSlot] ?? PALETTE[0];
  const to = PALETTE[toSlot] ?? PALETTE[0];
  return {
    e: { a: 0, k: [120, 0] },
    g: { p: 2, k: { a: 0, k: lottieGradientStops(from, to) } },
    h: { a: 0, k: 0 },
    nm: `Palette Gradient ${fromSlot + 1} ${toSlot + 1}`,
    o: { a: 0, k: opacity },
    r: 1,
    s: { a: 0, k: [-120, 0] },
    t: 1,
    ty: 'gf',
  };
}

function rectangleGroup(
  name: string,
  size: Size,
  slot: number,
  position: [number, number] = [0, 0],
  radius = 8,
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
  radius = 8,
  width = 1,
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
  radius = 8,
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
  opacity: AnimatedProperty = loopOpacity(),
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
            lh: fontSize * 1.08,
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

function stageBackdrop(index: number, name: string) {
  return shapeLayer({
    index,
    name: `${name} stage`,
    opacity: loopOpacity(),
    position: [480, 360, 0],
    shapes: [
      rectangleGroup('Stage wash base', [896, 656], 1, [0, 0], 12, 4),
      outlinedRectangleGroup('Stage boundary', [896, 656], 1, [0, 0], 12, 1, 14),
      gradientRectangleGroup('Stage signal base', [896, 2], 1, 2, [0, -208], 1, 72),
    ],
  });
}

function sceneHeaderLayers(
  kicker: string,
  title: string,
  meta: string,
) {
  return [
    textLayer(70, 'Scene kicker', kicker, [208, 80, 0], 12, 2, 600, loopOpacity(4), 86),
    textLayer(71, 'Scene title', title, [208, 120, 0], 32, 0, 600, loopOpacity(8), -8),
    textLayer(72, 'Scene meta', meta, [876, 86, 0], 12, 1, 500, loopOpacity(12), 36, 1),
  ];
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

function brandLogoLayer(index: number, width: number, height: number) {
  const maximumWidth = 96;
  const maximumHeight = 48;
  const scale = Math.min(1, maximumWidth / width, maximumHeight / height);
  const renderedWidth = width * scale;
  const centerX = 64 + renderedWidth / 2;
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
      o: loopOpacity(6),
      p: settlePosition(6, [centerX, centerY - 10, 0], [centerX, centerY, 0], FADE_OUT_START, 36),
      r: { a: 0, k: 0 },
      s: animated([
        { ease: 'linear', t: 0, value: [scalePercent * 0.94, scalePercent * 0.94, 100] },
        { ease: 'outQuart', t: 6, value: [scalePercent * 0.94, scalePercent * 0.94, 100] },
        { ease: 'linear', t: 42, value: [scalePercent, scalePercent, 100] },
        { ease: 'inCubic', t: FADE_OUT_START, value: [scalePercent, scalePercent, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [scalePercent * 0.94, scalePercent * 0.94, 100] },
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
    ...sceneHeaderLayers('PRODUCT / MOTION', 'Dashboard launch', '01 / 07'),
    textLayer(40, 'Coverage label', 'COVERAGE', [96, 322, 0], 13, 1, 600, loopOpacity(18), 96),
    textLayer(41, 'Coverage value', '98%', [88, 464, 0], 126, 0, 600, loopOpacity(22), -42),
    textLayer(42, 'Activity label', 'LIVE ACTIVITY', [544, 286, 0], 13, 1, 600, loopOpacity(30), 88),
    textLayer(43, 'Activity delta', '+14.8%', [880, 286, 0], 18, 2, 600, loopOpacity(44), 4, 1),
    shapeLayer({
      index: 1,
      name: 'Dashboard division',
      opacity: loopOpacity(12, 214, 34),
      position: [480, 420, 0],
      shapes: [rectangleGroup('Dashboard division base', [2, 536], 1, [0, 0], 1, 48)],
    }),
    shapeLayer({
      index: 2,
      name: 'Coverage scan',
      opacity: phaseOpacity(48, 174, 0, 100),
      position: travelPosition(48, 170, [104, 420, 0], [440, 420, 0]),
      shapes: [gradientRectangleGroup('Coverage scan base', [2, 536], 2, 0, [0, 0], 1, 92)],
    }),
    shapeLayer({
      index: 3,
      name: 'Activity baseline',
      opacity: loopOpacity(26, 214, 34),
      position: [704, 540, 0],
      shapes: [rectangleGroup('Activity baseline base', [448, 2], 1, [0, 0], 1, 48)],
    }),
  ];

  const heights = [132, 198, 158, 244, 206];
  heights.forEach((height, index) => {
    const start = 34 + index * 6;
    const slot = index === 3 ? 2 : 0;
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Activity signal ${index + 1}`,
      opacity: loopOpacity(start, 212, slot === 2 ? 100 : 64),
      position: [560 + index * 78, 540 - height / 2, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [100, 2, 100] },
        { ease: 'outQuart', t: start, value: [100, 2, 100] },
        { ease: 'linear', t: start + 30, value: [100, 100, 100] },
        { ease: 'inCubic', t: 212, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [100, 2, 100] },
      ]),
      shapes: [rectangleGroup('Signal base', [28, height], slot, [0, 0], 3, 100)],
    }));
  });
  layers.push(stageBackdrop(90, 'Dashboard launch'));
  return baseDocument('Dashboard launch', layers);
}

function apiExchangeDocument(): LottieDocument {
  const layers: unknown[] = [
    ...sceneHeaderLayers('DEVELOPER / MOTION', 'API exchange', '02 / 07'),
    textLayer(40, 'Client name', 'CLIENT', [80, 314, 0], 13, 1, 600, loopOpacity(18), 90),
    textLayer(41, 'Client request', 'POST', [72, 426, 0], 76, 0, 600, loopOpacity(24), -28),
    textLayer(42, 'API name', 'API', [744, 314, 0], 13, 1, 600, loopOpacity(28), 90),
    textLayer(43, 'API response', '200', [736, 426, 0], 76, 2, 600, phaseOpacity(118, 204, 30, 100), -28),
    textLayer(44, 'Request caption', 'REQUEST', [480, 342, 0], 11, 1, 600, phaseOpacity(40, 110, 10, 100), 92, 2),
    textLayer(45, 'Response caption', 'RESPONSE', [480, 490, 0], 11, 1, 600, phaseOpacity(116, 194, 10, 100), 92, 2),
    shapeLayer({
      index: 1,
      name: 'Client boundary',
      opacity: loopOpacity(14, 214, 34),
      position: [250, 420, 0],
      shapes: [rectangleGroup('Client boundary base', [2, 536], 1, [0, 0], 1, 46)],
    }),
    shapeLayer({
      index: 2,
      name: 'API boundary',
      opacity: loopOpacity(22, 214, 34),
      position: [710, 420, 0],
      shapes: [rectangleGroup('API boundary base', [2, 536], 2, [0, 0], 1, 52)],
    }),
    shapeLayer({
      index: 3,
      name: 'Request path',
      opacity: loopOpacity(24, 214, 36),
      position: [480, 380, 0],
      shapes: [rectangleGroup('Request path base', [460, 2], 1, [0, 0], 1, 48)],
    }),
    shapeLayer({
      index: 4,
      name: 'Response path',
      opacity: loopOpacity(24, 214, 28),
      position: [480, 452, 0],
      shapes: [rectangleGroup('Response path base', [460, 2], 1, [0, 0], 1, 40)],
    }),
    shapeLayer({
      index: 5,
      name: 'Request signal',
      opacity: phaseOpacity(40, 110),
      position: travelPosition(40, 106, [286, 380, 0], [674, 380, 0]),
      shapes: [gradientRectangleGroup('Request signal base', [86, 14], 2, 0, [0, 0], 7, 100)],
    }),
    shapeLayer({
      index: 6,
      name: 'Response signal',
      opacity: phaseOpacity(116, 194),
      position: travelPosition(116, 190, [674, 452, 0], [286, 452, 0]),
      shapes: [rectangleGroup('Response signal base', [62, 10], 0, [0, 0], 5, 86)],
    }),
    shapeLayer({
      index: 7,
      name: 'Endpoint confirmation',
      opacity: phaseOpacity(96, 144),
      position: [710, 420, 0],
      shapes: [gradientRectangleGroup('Confirmation line base', [5, 536], 2, 0, [0, 0], 2, 100)],
    }),
    stageBackdrop(90, 'API exchange'),
  ];
  return baseDocument('API exchange', layers);
}

function localeMatrixDocument(): LottieDocument {
  const words = [
    { code: 'EN', end: 62, start: 18, word: 'HELLO' },
    { code: 'ES', end: 108, start: 64, word: 'HOLA' },
    { code: 'FR', end: 154, start: 110, word: 'BONJOUR' },
    { code: 'DE', end: 202, start: 156, word: 'HALLO' },
  ];
  const layers: unknown[] = [
    ...sceneHeaderLayers('GLOBAL / MOTION', 'Locale cadence', '03 / 07'),
    shapeLayer({
      index: 1,
      name: 'Language axis',
      opacity: loopOpacity(16, 214, 34),
      position: [480, 420, 0],
      shapes: [gradientRectangleGroup('Language axis base', [2, 536], 1, 2, [0, 0], 1, 82)],
    }),
    shapeLayer({
      index: 2,
      name: 'Locale baseline',
      opacity: loopOpacity(18, 214, 28),
      position: [480, 566, 0],
      shapes: [rectangleGroup('Locale baseline base', [896, 2], 1, [0, 0], 1, 42)],
    }),
  ];
  words.forEach(({ code, end, start, word }, index) => {
    layers.push(textLayer(
      40 + index,
      `Language word ${word}`,
      word,
      phasePosition(start, end, [480, 444, 0], [480, 412, 0], [480, 380, 0]),
      word.length > 6 ? 88 : 108,
      index === 1 || index === 3 ? 2 : 0,
      600,
      phaseOpacity(start, end),
      -30,
      2,
    ));
    const x = 204 + index * 184;
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Locale marker ${code}`,
      opacity: phaseOpacity(start, end, 24, 100),
      position: [x, 566, 0],
      scale: revealScale(start, 88),
      shapes: [rectangleGroup('Locale marker base', [42, 4], 2, [0, 0], 2, 100)],
    }));
    layers.push(textLayer(
      50 + index,
      `Locale code ${code}`,
      code,
      [x, 616, 0],
      12,
      index === 1 || index === 3 ? 2 : 1,
      600,
      phaseOpacity(start, end, 32, 100),
      70,
      2,
    ));
  });
  layers.push(stageBackdrop(90, 'Locale cadence'));
  return baseDocument('Locale cadence', layers);
}

function releaseStackDocument(): LottieDocument {
  const labels = ['CODE', 'CONTENT', 'LOCALES'];
  const layers: unknown[] = [
    ...sceneHeaderLayers('RELEASE / MOTION', 'Release assembly', '04 / 07'),
  ];
  labels.forEach((label, index) => {
    const start = 16 + index * 18;
    const y = 286 + index * 124;
    layers.push(shapeLayer({
      index: 1 + index,
      name: `Release plane ${label}`,
      opacity: loopOpacity(start),
      position: settlePosition(start, [480, y + 22, 0], [480, y, 0]),
      shapes: [
        rectangleGroup('Release plane base', [896, 92], index === 2 ? 2 : 1, [0, 0], 0, index === 2 ? 24 : 10 + index * 4),
        rectangleGroup('Release edge base', [6, 92], 2, [-445, 0], 0, 100),
      ],
    }));
    layers.push(textLayer(
      40 + index,
      `Release label ${label}`,
      label,
      [80, y + 8, 0],
      17,
      index === 2 ? 0 : 1,
      600,
      loopOpacity(start + 6),
      76,
    ));
  });
  layers.push(
    shapeLayer({
      index: 10,
      name: 'Release verification sweep',
      opacity: phaseOpacity(92, 184),
      position: travelPosition(92, 180, [104, 420, 0], [856, 420, 0]),
      shapes: [gradientRectangleGroup('Verification sweep base', [4, 536], 2, 0, [0, 0], 2, 100)],
    }),
    shapeLayer({
      index: 11,
      name: 'Release seal',
      opacity: loopOpacity(150, 208),
      position: [856, 534, 0],
      scale: revealScale(150, 82),
      shapes: [
        ellipseGroup('Release seal base', [52, 52], 2, [0, 0], 100),
        ellipseGroup('Release seal center', [12, 12], 0, [0, 0], 100),
      ],
    }),
    textLayer(43, 'Release status', 'READY', [784, 540, 0], 16, 2, 600, loopOpacity(150, 208), 70),
    stageBackdrop(90, 'Release assembly'),
  );
  return baseDocument('Release assembly', layers);
}

function contentSyncDocument(): LottieDocument {
  const layers: unknown[] = [
    ...sceneHeaderLayers('CONTENT / MOTION', 'Content relay', '05 / 07'),
    textLayer(40, 'Source heading', 'SOURCE', [80, 260, 0], 13, 1, 600, loopOpacity(16), 88),
    textLayer(41, 'Source file', 'product.json', [80, 304, 0], 24, 0, 500, loopOpacity(20), -6),
    textLayer(42, 'Output heading', 'LOCALIZED', [656, 260, 0], 13, 1, 600, loopOpacity(24), 88),
    textLayer(43, 'Output file', '4 versions', [656, 304, 0], 24, 2, 600, phaseOpacity(126, 210), -6),
    shapeLayer({
      index: 1,
      name: 'Translation threshold',
      opacity: loopOpacity(20, 214, 34),
      position: [480, 420, 0],
      shapes: [gradientRectangleGroup('Translation threshold base', [2, 536], 1, 2, [0, 0], 1, 88)],
    }),
    shapeLayer({
      index: 2,
      name: 'Content row field',
      opacity: loopOpacity(24, 214, 24),
      position: [480, 420, 0],
      shapes: [-90, -20, 50, 120].map((offset, index) => (
        rectangleGroup(`Content row ${index + 1} base`, [896, 2], 1, [0, offset], 1, 34)
      )),
    }),
    shapeLayer({
      index: 3,
      name: 'Content hero signal',
      opacity: phaseOpacity(40, 178, 0, 100),
      position: travelPosition(40, 166, [162, 400, 0], [798, 400, 0]),
      scale: animated([
        { ease: 'linear', t: 0, value: [100, 100, 100] },
        { ease: 'inOutCubic', t: 40, value: [100, 100, 100] },
        { ease: 'inOutCubic', t: 104, value: [72, 100, 100] },
        { ease: 'outQuart', t: 166, value: [118, 100, 100] },
        { ease: 'linear', t: FADE_OUT_START, value: [118, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [100, 100, 100] },
      ]),
      shapes: [gradientRectangleGroup('Content hero base', [260, 12], 0, 2, [0, 0], 6, 100)],
    }),
    shapeLayer({
      index: 4,
      name: 'Content reaction one',
      opacity: loopOpacity(126, 206, 76),
      position: [798, 470, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [0, 100, 100] },
        { ease: 'outQuart', t: 126, value: [0, 100, 100] },
        { ease: 'linear', t: 156, value: [100, 100, 100] },
        { ease: 'inCubic', t: 206, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0, 100, 100] },
      ]),
      shapes: [rectangleGroup('Content reaction one base', [210, 8], 2, [0, 0], 4, 86)],
    }),
    shapeLayer({
      index: 5,
      name: 'Content reaction two',
      opacity: loopOpacity(136, 210, 58),
      position: [798, 540, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [0, 100, 100] },
        { ease: 'outQuart', t: 136, value: [0, 100, 100] },
        { ease: 'linear', t: 166, value: [100, 100, 100] },
        { ease: 'inCubic', t: 210, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0, 100, 100] },
      ]),
      shapes: [rectangleGroup('Content reaction two base', [168, 8], 0, [0, 0], 4, 72)],
    }),
    stageBackdrop(90, 'Content relay'),
  ];
  return baseDocument('Content relay', layers);
}

function conversionFlowDocument(): LottieDocument {
  const steps = [
    { end: 88, label: 'CONNECT', number: '01', start: 18 },
    { end: 154, label: 'CONFIGURE', number: '02', start: 74 },
    { end: 210, label: 'SHIP', number: '03', start: 140 },
  ];
  const layers: unknown[] = [
    ...sceneHeaderLayers('ONBOARDING / MOTION', 'Activation path', '06 / 07'),
    shapeLayer({
      index: 1,
      name: 'Activation axis',
      opacity: loopOpacity(14, 214, 34),
      position: [480, 420, 0],
      shapes: [gradientRectangleGroup('Activation axis base', [2, 536], 1, 2, [0, 0], 1, 82)],
    }),
    shapeLayer({
      index: 2,
      name: 'Activation crossbar',
      opacity: loopOpacity(18, 214, 28),
      position: [480, 500, 0],
      shapes: [rectangleGroup('Activation crossbar base', [896, 2], 1, [0, 0], 1, 42)],
    }),
    shapeLayer({
      index: 3,
      name: 'Progress path',
      opacity: loopOpacity(18, 214, 34),
      position: [480, 592, 0],
      shapes: [rectangleGroup('Progress path base', [896, 2], 1, [0, 0], 1, 48)],
    }),
    shapeLayer({
      index: 4,
      name: 'Progress signal',
      opacity: loopOpacity(22, 210),
      position: travelPosition(22, 198, [104, 592, 0], [856, 592, 0]),
      shapes: [gradientRectangleGroup('Progress signal base', [132, 6], 2, 0, [0, 0], 3, 100)],
    }),
  ];
  steps.forEach(({ end, label, number, start }, index) => {
    layers.push(textLayer(
      40 + index,
      `Step number ${number}`,
      number,
      phasePosition(start, end, [96, 472, 0], [96, 438, 0], [96, 404, 0]),
      172,
      index === 1 ? 2 : 0,
      600,
      phaseOpacity(start, end),
      -42,
    ));
    layers.push(textLayer(
      50 + index,
      `Step label ${label}`,
      label,
      [552, 428, 0],
      18,
      index === 1 ? 2 : 1,
      600,
      phaseOpacity(start, end),
      96,
    ));
  });
  layers.push(stageBackdrop(90, 'Activation path'));
  return baseDocument('Activation path', layers);
}

function agentQueueDocument(): LottieDocument {
  const tasks = ['COPY', 'DOCS', 'UI', 'RELEASE'];
  const layers: unknown[] = [
    ...sceneHeaderLayers('AGENTS / MOTION', 'Agent orchestration', '07 / 07'),
    textLayer(40, 'Queue count', '04', [80, 612, 0], 118, 0, 600, loopOpacity(18), -38),
    textLayer(41, 'Queue label', 'QUEUED', [88, 650, 0], 12, 1, 600, loopOpacity(22), 96),
    textLayer(42, 'Result count', '01', [682, 456, 0], 150, 2, 600, loopOpacity(144, 210), -42),
    textLayer(43, 'Result label', 'READY', [692, 510, 0], 13, 2, 600, loopOpacity(150, 210), 96),
    textLayer(44, 'Agent label', 'ORCHESTRATOR', [522, 286, 0], 13, 1, 600, loopOpacity(32), 82),
    shapeLayer({
      index: 1,
      name: 'Agent spine',
      opacity: loopOpacity(20, 214, 34),
      position: [480, 420, 0],
      shapes: [gradientRectangleGroup('Agent spine base', [2, 536], 1, 2, [0, 0], 1, 86)],
    }),
    shapeLayer({
      index: 2,
      name: 'Task rail field',
      opacity: loopOpacity(24, 214, 26),
      position: [256, 420, 0],
      shapes: [-144, -76, -8, 60].map((offset, index) => (
        rectangleGroup(`Task rail ${index + 1} base`, [448, 2], 1, [0, offset], 1, 40)
      )),
    }),
    shapeLayer({
      index: 3,
      name: 'Result beam',
      opacity: loopOpacity(138, 208),
      position: [480, 412, 0],
      scale: animated([
        { ease: 'linear', t: 0, value: [0, 100, 100] },
        { ease: 'outQuart', t: 138, value: [0, 100, 100] },
        { ease: 'linear', t: 164, value: [100, 100, 100] },
        { ease: 'inCubic', t: 208, value: [100, 100, 100] },
        { ease: 'linear', t: COMPOSITION_FRAMES, value: [0, 100, 100] },
      ]),
      shapes: [gradientRectangleGroup('Result beam base', [448, 6], 2, 0, [224, 0], 3, 100)],
    }),
  ];
  tasks.forEach((task, index) => {
    const start = 34 + index * 24;
    const y = 276 + index * 68;
    layers.push(shapeLayer({
      index: 10 + index,
      name: `Task signal ${task}`,
      opacity: phaseOpacity(start, start + 54, 12, 100),
      position: travelPosition(start, start + 50, [136, y, 0], [438, y, 0]),
      shapes: [rectangleGroup('Task signal base', [92 + index * 10, 6], index === 2 ? 2 : 0, [0, 0], 3, index === 2 ? 100 : 66)],
    }));
    layers.push(textLayer(
      50 + index,
      `Task label ${task}`,
      task,
      [80, y + 5, 0],
      11,
      index === 2 ? 2 : 1,
      600,
      phaseOpacity(start, start + 54, 18, 100),
      72,
    ));
  });
  layers.push(stageBackdrop(90, 'Agent orchestration'));
  return baseDocument('Agent orchestration', layers);
}

export const LOTTIE_EXAMPLES: readonly LottieExample[] = [
  {
    category: 'Product UI',
    data: dashboardLaunchDocument(),
    description: 'A single coverage signal resolves into a coordinated product pulse.',
    id: 'dashboard-launch',
    name: 'Dashboard launch',
  },
  {
    category: 'Developer',
    data: apiExchangeDocument(),
    description: 'A precise request and response complete one readable exchange.',
    id: 'api-exchange',
    name: 'API exchange',
  },
  {
    category: 'Global product',
    data: localeMatrixDocument(),
    description: 'Language changes through one typographic cadence instead of a tile grid.',
    id: 'locale-matrix',
    name: 'Locale cadence',
  },
  {
    category: 'Release',
    data: releaseStackDocument(),
    description: 'Product layers converge, verify, and resolve into a single release.',
    id: 'release-stack',
    name: 'Release assembly',
  },
  {
    category: 'Content',
    data: contentSyncDocument(),
    description: 'Content crosses one translation threshold and resolves in place.',
    id: 'content-sync',
    name: 'Content relay',
  },
  {
    category: 'Onboarding',
    data: conversionFlowDocument(),
    description: 'One large numbered state advances through the activation sequence.',
    id: 'conversion-flow',
    name: 'Activation path',
  },
  {
    category: 'Agents',
    data: agentQueueDocument(),
    description: 'Four inputs compress into one deliberate, legible agent result.',
    id: 'agent-queue',
    name: 'Agent orchestration',
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

type LottieRecord = Record<string, unknown>;

function paletteSlot(name: unknown, pattern: RegExp, capture = 1): number {
  const match = typeof name === 'string' ? pattern.exec(name) : null;
  return Math.max(0, Number(match?.[capture] ?? 1) - 1);
}

function customizeLottiePaint(
  record: LottieRecord,
  next: LottieRecord,
  colors: readonly string[],
) {
  if (record.ty !== 'fl' && record.ty !== 'st') return;
  if (!record.c || typeof record.c !== 'object') return;
  const colorProperty = record.c as LottieRecord;
  if (colorProperty.a !== 0 || !Array.isArray(colorProperty.k)) return;
  const slot = paletteSlot(record.nm, /Palette (\d+)/);
  next.c = {
    ...colorProperty,
    k: hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818'),
  };
}

function customizedTextKeyframe(
  keyframe: unknown,
  color: number[],
  fontFamily: string | undefined,
) {
  if (!keyframe || typeof keyframe !== 'object') return keyframe;
  const keyframeRecord = keyframe as LottieRecord;
  const style = keyframeRecord.s as LottieRecord | undefined;
  if (!style) return keyframe;
  const currentFont = typeof style.f === 'string' ? style.f : 'GlyphfieldSans-Regular';
  const fontStyle = currentFont.endsWith('Semibold')
    ? 'Semibold'
    : currentFont.endsWith('Medium') ? 'Medium' : 'Regular';
  return {
    ...keyframeRecord,
    s: {
      ...style,
      f: fontFamily ? `BrandFont-${fontStyle}` : currentFont,
      fc: color,
    },
  };
}

function customizeLottieText(
  record: LottieRecord,
  next: LottieRecord,
  appearance: LottieAppearance,
  colors: readonly string[],
) {
  if (record.ty !== 5 || !record.t || typeof record.t !== 'object') return;
  const text = next.t as LottieRecord;
  const documentData = text.d as LottieRecord | undefined;
  const keyframes = Array.isArray(documentData?.k) ? documentData.k : [];
  const slot = paletteSlot(record.nm, /Palette (\d+) Text/);
  const color = hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818').slice(0, 3);
  text.d = {
    ...documentData,
    k: keyframes.map((keyframe) => customizedTextKeyframe(keyframe, color, appearance.fontFamily)),
  };
  next.t = text;
}

function customizeLottieGradient(
  record: LottieRecord,
  next: LottieRecord,
  colors: readonly string[],
) {
  if (record.ty !== 'gf' || !record.g || typeof record.g !== 'object') return;
  const gradient = record.g as LottieRecord;
  const colorProperty = gradient.k as LottieRecord | undefined;
  const match = typeof record.nm === 'string'
    ? /Palette Gradient (\d+) (\d+)/.exec(record.nm)
    : null;
  if (colorProperty?.a !== 0 || !Array.isArray(colorProperty.k) || !match) return;
  const fallback = colors[0] ?? '#181818';
  next.g = {
    ...gradient,
    k: {
      ...colorProperty,
      k: lottieGradientStops(
        hexToLottieColor(colors[paletteSlot(record.nm, /Palette Gradient (\d+) (\d+)/, 1)] ?? fallback),
        hexToLottieColor(colors[paletteSlot(record.nm, /Palette Gradient (\d+) (\d+)/, 2)] ?? fallback),
      ),
    },
  };
}

function customizeLottieGeometry(
  record: LottieRecord,
  next: LottieRecord,
  appearance: LottieAppearance,
) {
  if (record.ty === 'st' && record.w && typeof record.w === 'object') {
    const widthProperty = record.w as LottieRecord;
    if (widthProperty.a === 0) next.w = { ...widthProperty, k: appearance.strokeWidth };
  }
  if (record.ty !== 'rc' || !record.r || typeof record.r !== 'object') return;
  const radiusProperty = record.r as LottieRecord;
  const sizeProperty = record.s as LottieRecord | undefined;
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

export function customizeLottieDocument(
  document: LottieDocument,
  appearance: LottieAppearance,
): LottieDocument {
  const colors = appearance.colors.length > 0 ? appearance.colors : ['#181818'];

  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    const record = value as LottieRecord;
    const next = Object.fromEntries(Object.entries(record).map(([key, child]) => [key, visit(child)]));
    customizeLottiePaint(record, next, colors);
    customizeLottieText(record, next, appearance, colors);
    customizeLottieGradient(record, next, colors);
    customizeLottieGeometry(record, next, appearance);
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

  return {
    ...customizedWithFonts,
    assets: [
      ...assets,
      {
        e: 1,
        h: appearance.brandLogo.height,
        id: 'glyphfield-brand-logo',
        p: appearance.brandLogo.dataUrl,
        u: '',
        w: appearance.brandLogo.width,
      },
    ],
    layers: [
      brandLogoLayer(maximumLayerIndex + 1, appearance.brandLogo.width, appearance.brandLogo.height),
      ...layers,
    ],
  };
}
