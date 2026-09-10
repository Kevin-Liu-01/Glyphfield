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
type Vertex = [number, number];
type Size = [number, number];
type EaseName = 'inCubic' | 'inOutCubic' | 'linear' | 'outCubic' | 'outQuart';
type TimedValue = {
  ease?: EaseName;
  t: number;
  value: number[];
};

type AnimatedProperty = ReturnType<typeof animated>;

const COMPOSITION_FRAMES = 300;
const FADE_OUT_START = 278;
const PALETTE: readonly LottieColor[] = [
  [0.97, 0.98, 0.99, 1],
  [0.43, 0.47, 0.54, 1],
  [0.30, 0.49, 1, 1],
];

const EASINGS = {
  inCubic: { i: { x: [0.67], y: [0] }, o: { x: [0.32], y: [0] } },
  inOutCubic: { i: { x: [0.83], y: [1] }, o: { x: [0.17], y: [0] } },
  linear: { i: { x: [0.667], y: [0.667] }, o: { x: [0.333], y: [0.333] } },
  outCubic: { i: { x: [0.32], y: [1] }, o: { x: [0.22], y: [1] } },
  outQuart: { i: { x: [0.23], y: [1] }, o: { x: [0.12], y: [1] } },
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
    { ease: 'linear', t: start + 12, value: [peak] },
    { ease: 'inCubic', t: end - 10, value: [peak] },
    { ease: 'linear', t: end, value: [idle] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [idle] },
  ]);
}

function settlePosition(
  start: number,
  from: Point,
  to: Point,
  end = FADE_OUT_START,
  duration = 26,
) {
  return animated([
    { ease: 'linear', t: 0, value: from },
    { ease: 'outQuart', t: start, value: from },
    { ease: 'linear', t: start + duration, value: to },
    { ease: 'inCubic', t: end, value: to },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: from },
  ]);
}

function travelPosition(start: number, end: number, points: readonly Point[]) {
  const first = points[0] ?? [480, 360, 0];
  const last = points.at(-1) ?? first;
  const span = end - start;
  const travel = points.map((point, index) => ({
    ease: index === points.length - 1 ? 'outCubic' as const : 'inOutCubic' as const,
    t: Math.round(start + (span * index) / Math.max(1, points.length - 1)),
    value: point,
  }));
  return animated([
    { ease: 'linear', t: 0, value: first },
    ...travel,
    { ease: 'linear', t: FADE_OUT_START, value: last },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: first },
  ]);
}

function pulseScale(start: number, end: number, minimum = 86, maximum = 112) {
  return animated([
    { ease: 'linear', t: 0, value: [minimum, minimum, 100] },
    { ease: 'outQuart', t: start, value: [minimum, minimum, 100] },
    { ease: 'inOutCubic', t: start + 14, value: [maximum, maximum, 100] },
    { ease: 'outCubic', t: start + 30, value: [100, 100, 100] },
    { ease: 'inCubic', t: end, value: [100, 100, 100] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: [minimum, minimum, 100] },
  ]);
}

function growScale(start: number, end = FADE_OUT_START, axis: 'x' | 'y' = 'x') {
  const closed = axis === 'x' ? [0, 100, 100] : [100, 0, 100];
  return animated([
    { ease: 'linear', t: 0, value: closed },
    { ease: 'outQuart', t: start, value: closed },
    { ease: 'linear', t: start + 24, value: [100, 100, 100] },
    { ease: 'inCubic', t: end, value: [100, 100, 100] },
    { ease: 'linear', t: COMPOSITION_FRAMES, value: closed },
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

function groupTransform(position: Vertex = [0, 0]) {
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

function stroke(slot: number, width = 1, opacity = 100, dashed = false) {
  return {
    c: { a: 0, k: PALETTE[slot] ?? PALETTE[0] },
    ...(dashed ? { d: [{ n: 'd', nm: 'Dash', v: { a: 0, k: 7 } }, { n: 'g', nm: 'Gap', v: { a: 0, k: 8 } }] } : {}),
    lc: 2,
    lj: 2,
    ml: 4,
    nm: `Palette ${slot + 1}`,
    o: { a: 0, k: opacity },
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

function rectangleGroup(name: string, size: Size, slot: number, position: Vertex = [0, 0], radius = 8, opacity = 100) {
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

function outlinedRectangleGroup(name: string, size: Size, slot: number, position: Vertex = [0, 0], radius = 8, width = 1, opacity = 100) {
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

function gradientRectangleGroup(name: string, size: Size, fromSlot: number, toSlot: number, position: Vertex = [0, 0], radius = 8, opacity = 100) {
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

function ellipseGroup(name: string, size: Size, slot: number, position: Vertex = [0, 0], opacity = 100, outline = false) {
  return {
    it: [
      { d: 1, nm: name, p: { a: 0, k: [0, 0] }, s: { a: 0, k: size }, ty: 'el' },
      outline ? stroke(slot, 1, opacity) : fill(slot, opacity),
      groupTransform(position),
    ],
    nm: name,
    np: 3,
    ty: 'gr',
  };
}

function pathGroup(name: string, vertices: readonly Vertex[], slot: number, opacity = 100, width = 1, closed = false, fillOpacity = 0, dashed = false) {
  const tangents = vertices.map(() => [0, 0]);
  return {
    it: [
      { ks: { a: 0, k: { c: closed, i: tangents, o: tangents, v: vertices } }, nm: name, ty: 'sh' },
      ...(fillOpacity > 0 ? [fill(slot, fillOpacity)] : []),
      stroke(slot, width, opacity, dashed),
      groupTransform(),
    ],
    nm: name,
    np: fillOpacity > 0 ? 4 : 3,
    ty: 'gr',
  };
}

function shapeLayer({ index, name, opacity, position, rotation, scale, shapes }: {
  index: number;
  name: string;
  opacity?: AnimatedProperty;
  position: Point | AnimatedProperty;
  rotation?: AnimatedProperty;
  scale?: AnimatedProperty;
  shapes: unknown[];
}) {
  const staticPosition: Point = Array.isArray(position) ? position as Point : [480, 360, 0];
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

function textLayer(index: number, name: string, text: string, position: Point | AnimatedProperty, fontSize: number, colorSlot = 0, weight: 400 | 500 | 600 = 400, opacity: AnimatedProperty = loopOpacity(), tracking = 0, justification: 0 | 1 | 2 = 0) {
  const fontStyle = weight === 600 ? 'Semibold' : weight === 500 ? 'Medium' : 'Regular';
  const staticPosition: Point = Array.isArray(position) ? position as Point : [480, 360, 0];
  const base = transform(staticPosition);
  return {
    ao: 0,
    bm: 0,
    ddd: 0,
    ind: index,
    ip: 0,
    ks: { ...base, ...(Array.isArray(position) ? {} : { p: position }), o: opacity },
    nm: `Palette ${colorSlot + 1} Text | ${name}`,
    op: COMPOSITION_FRAMES,
    sr: 1,
    st: 0,
    t: {
      a: [],
      d: { k: [{ s: { f: `GlyphfieldSans-${fontStyle}`, fc: (PALETTE[colorSlot] ?? PALETTE[0]).slice(0, 3), j: justification, lh: fontSize * 1.08, ls: 0, s: fontSize, t: text, tr: tracking }, t: 0 }] },
      m: { a: { a: 0, k: [0, 0] }, g: 1 },
      p: {},
    },
    ty: 5,
  };
}

function sceneLabel(index: number, eyebrow: string, title: string, number: string) {
  return [
    textLayer(index, 'Scene eyebrow', eyebrow, [176, 66, 0], 11, 2, 600, loopOpacity(4), 110),
    textLayer(index + 1, 'Scene title', title, [76, 116, 0], 28, 0, 600, loopOpacity(8), -8),
    textLayer(index + 2, 'Scene number', number, [884, 66, 0], 11, 1, 600, loopOpacity(12), 80, 1),
  ];
}

function baseDocument(name: string, layers: unknown[]): LottieDocument {
  return {
    assets: [],
    ddd: 0,
    fonts: { list: [
      { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Regular', fStyle: 'Regular' },
      { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Medium', fStyle: 'Medium' },
      { ascent: 75, fFamily: 'Glyphfield Sans', fName: 'GlyphfieldSans-Semibold', fStyle: 'Semibold' },
    ] },
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
  const maximumWidth = 80;
  const maximumHeight = 36;
  const scale = Math.min(1, maximumWidth / width, maximumHeight / height);
  const renderedWidth = width * scale;
  const centerX = 76 + renderedWidth / 2;
  const centerY = 61;
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
      p: settlePosition(6, [centerX, centerY - 8, 0], [centerX, centerY, 0], FADE_OUT_START, 32),
      r: { a: 0, k: 0 },
      s: animated([
        { ease: 'linear', t: 0, value: [scalePercent * 0.94, scalePercent * 0.94, 100] },
        { ease: 'outQuart', t: 6, value: [scalePercent * 0.94, scalePercent * 0.94, 100] },
        { ease: 'linear', t: 38, value: [scalePercent, scalePercent, 100] },
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

function signalRelayDocument(): LottieDocument {
  const outputs = [
    { label: 'PLAN', slot: 0, start: 92, y: 270 },
    { label: 'BUILD', slot: 2, start: 122, y: 370 },
    { label: 'TEST', slot: 0, start: 152, y: 470 },
    { label: 'SHIP', slot: 0, start: 182, y: 570 },
  ];
  const layers: unknown[] = [
    ...sceneLabel(70, 'FLOW / RELAY', 'One input. Many outcomes.', '01 / 07'),
    shapeLayer({ index: 1, name: 'Source module', opacity: loopOpacity(16), position: settlePosition(16, [214, 436, 0], [214, 420, 0]), scale: pulseScale(16, 250, 94, 103), shapes: [
      rectangleGroup('Source module surface', [256, 156], 1, [0, 0], 12, 8),
      outlinedRectangleGroup('Source module edge', [256, 156], 0, [0, 0], 12, 1, 42),
      rectangleGroup('Source cursor', [3, 44], 2, [72, 8], 1, 100),
    ] }),
    textLayer(40, 'Source label', 'NEW SIGNAL', [118, 376, 0], 11, 1, 600, loopOpacity(22), 86),
    textLayer(41, 'Source value', 'Start here', [118, 438, 0], 34, 0, 600, loopOpacity(30), -12),
    shapeLayer({ index: 2, name: 'Signal trunk', opacity: loopOpacity(38, 266, 72), position: [480, 420, 0], shapes: [pathGroup('Signal trunk path', [[-138, 0], [0, 0]], 2, 86, 2)] }),
    shapeLayer({ index: 3, name: 'Outcome branches', opacity: loopOpacity(48, 266, 64), position: [480, 420, 0], shapes: outputs.map(({ y }, index) => pathGroup(`Outcome branch ${index + 1}`, [[0, 0], [68, 0], [68, y - 420], [142, y - 420]], index === 1 ? 2 : 0, index === 1 ? 88 : 42, index === 1 ? 2 : 1)) }),
    shapeLayer({ index: 4, name: 'Relay signal', opacity: phaseOpacity(52, 224), position: travelPosition(52, 218, [[342, 420, 0], [480, 420, 0], [548, 420, 0], [548, 370, 0], [622, 370, 0]]), scale: pulseScale(52, 224, 84, 116), shapes: [ellipseGroup('Relay signal core', [18, 18], 2), ellipseGroup('Relay signal center', [6, 6], 0)] }),
  ];
  outputs.forEach(({ label, slot, start, y }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Outcome ${label}`, opacity: loopOpacity(start, 266), position: settlePosition(start, [752, y + 10, 0], [752, y, 0]), scale: pulseScale(start, 258, 94, index === 1 ? 108 : 102), shapes: [
      rectangleGroup('Outcome surface', [260, 68], slot, [0, 0], 8, slot === 2 ? 13 : 5),
      outlinedRectangleGroup('Outcome edge', [260, 68], slot === 2 ? 2 : 1, [0, 0], 8, 1, slot === 2 ? 88 : 36),
    ] }));
    layers.push(textLayer(50 + index, `Outcome label ${label}`, label, [646, y + 8, 0], 22, slot, 500, loopOpacity(start + 4, 266)));
  });
  return baseDocument('Signal relay', layers);
}

function decisionRouterDocument(): LottieDocument {
  return baseDocument('Decision router', [
    ...sceneLabel(70, 'LOGIC / ROUTING', 'Intent chooses the path.', '02 / 07'),
    shapeLayer({ index: 1, name: 'Input capsule', opacity: loopOpacity(16), position: settlePosition(16, [480, 218, 0], [480, 204, 0]), scale: pulseScale(16, 258, 92, 105), shapes: [rectangleGroup('Input surface', [210, 78], 0, [0, 0], 10, 8), outlinedRectangleGroup('Input edge', [210, 78], 0, [0, 0], 10, 1, 58)] }),
    textLayer(40, 'Input label', 'Route', [480, 214, 0], 38, 0, 600, loopOpacity(22), -8, 2),
    shapeLayer({ index: 2, name: 'Decision fork rails', opacity: loopOpacity(34, 266, 70), position: [480, 320, 0], shapes: [pathGroup('Direct rail', [[0, -74], [0, -24], [-220, 72], [-220, 130]], 0, 66, 2), pathGroup('Refined rail', [[0, -74], [0, -24], [220, 72], [220, 130]], 2, 92, 2)] }),
    shapeLayer({ index: 3, name: 'Direct outcome module', opacity: loopOpacity(62, 266), position: settlePosition(62, [260, 508, 0], [260, 494, 0]), shapes: [rectangleGroup('Direct outcome surface', [330, 184], 1, [0, 0], 10, 6), outlinedRectangleGroup('Direct outcome edge', [330, 184], 1, [0, 0], 10, 1, 42)] }),
    shapeLayer({ index: 4, name: 'Refined outcome module', opacity: loopOpacity(92, 266), position: settlePosition(92, [700, 508, 0], [700, 494, 0]), scale: pulseScale(126, 258, 96, 106), shapes: [rectangleGroup('Refined outcome surface', [330, 184], 2, [0, 0], 10, 8), outlinedRectangleGroup('Refined outcome edge', [330, 184], 2, [0, 0], 10, 1, 92)] }),
    textLayer(41, 'Direct condition', 'speed = “fast”', [128, 438, 0], 13, 1, 500, loopOpacity(70), 16),
    textLayer(42, 'Direct outcome', 'DIRECT', [128, 510, 0], 34, 0, 600, loopOpacity(76), -12),
    textLayer(43, 'Refined condition', 'quality = “high”', [568, 438, 0], 13, 2, 500, loopOpacity(100), 16),
    textLayer(44, 'Refined outcome', 'REFINED', [568, 510, 0], 34, 0, 600, loopOpacity(110), -12),
    shapeLayer({ index: 5, name: 'Decision signal', opacity: phaseOpacity(84, 204), position: travelPosition(84, 198, [[480, 246, 0], [480, 296, 0], [700, 392, 0], [700, 424, 0]]), shapes: [ellipseGroup('Decision signal core', [16, 16], 2), ellipseGroup('Decision signal center', [5, 5], 0)] }),
  ]);
}

function sourceMergeDocument(): LottieDocument {
  const sources = [{ label: 'FILES', start: 26, y: 246 }, { label: 'EVENTS', start: 50, y: 338 }, { label: 'DATA', start: 74, y: 430 }, { label: 'PEOPLE', start: 98, y: 522 }];
  const layers: unknown[] = [
    ...sceneLabel(70, 'SYNTHESIS / MERGE', 'Many signals. One clear output.', '03 / 07'),
    shapeLayer({ index: 1, name: 'Source rail system', opacity: loopOpacity(18, 266, 52), position: [480, 384, 0], shapes: sources.map(({ y }, index) => pathGroup(`Source rail ${index + 1}`, [[-290, y - 384], [-152, y - 384], [-92, 0], [0, 0]], index === 2 ? 2 : 1, index === 2 ? 92 : 48, index === 2 ? 2 : 1)) }),
    shapeLayer({ index: 2, name: 'Synthesis core', opacity: loopOpacity(30, 266), position: settlePosition(30, [516, 398, 0], [516, 384, 0]), scale: pulseScale(124, 258, 92, 108), shapes: [pathGroup('Synthesis core diamond', [[0, -74], [104, 0], [0, 74], [-104, 0]], 2, 96, 1, true, 12), pathGroup('Synthesis core inset', [[0, -40], [56, 0], [0, 40], [-56, 0]], 0, 72, 1, true, 5)] }),
    textLayer(40, 'Synthesis core label', 'SYNTHESIZE', [516, 392, 0], 15, 0, 600, loopOpacity(40), 80, 2),
    shapeLayer({ index: 3, name: 'Output rail', opacity: loopOpacity(108, 266, 72), position: [480, 384, 0], shapes: [pathGroup('Output rail path', [[140, 0], [300, 0]], 2, 88, 2)] }),
    shapeLayer({ index: 4, name: 'Output artifact', opacity: loopOpacity(152, 262), position: settlePosition(152, [832, 398, 0], [832, 384, 0]), scale: pulseScale(152, 258, 86, 112), shapes: [rectangleGroup('Output artifact surface', [132, 178], 2, [0, 0], 6, 12), outlinedRectangleGroup('Output artifact edge', [132, 178], 2, [0, 0], 6, 1, 94), rectangleGroup('Output artifact line one', [78, 5], 0, [0, -36], 2, 82), rectangleGroup('Output artifact line two', [54, 5], 0, [-12, -14], 2, 52), rectangleGroup('Output artifact line three', [70, 5], 0, [-4, 8], 2, 68)] }),
    textLayer(41, 'Output artifact label', 'CLEAR', [832, 458, 0], 11, 2, 600, loopOpacity(164, 262), 96, 2),
  ];
  sources.forEach(({ label, start, y }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Source module ${label}`, opacity: loopOpacity(start, 266), position: settlePosition(start, [190, y + 10, 0], [190, y, 0]), shapes: [rectangleGroup('Source module surface', [228, 58], 1, [0, 0], 7, 5), outlinedRectangleGroup('Source module edge', [228, 58], index === 2 ? 2 : 1, [0, 0], 7, 1, index === 2 ? 82 : 34)] }));
    layers.push(textLayer(50 + index, `Source label ${label}`, label, [98, y + 6, 0], 14, index === 2 ? 2 : 0, 600, loopOpacity(start + 4, 266), 76));
  });
  return baseDocument('Source merge', layers);
}

function layerAssemblyDocument(): LottieDocument {
  const planes = [{ label: 'PLAN', slot: 1, start: 22, y: 244 }, { label: 'STRUCTURE', slot: 1, start: 52, y: 352 }, { label: 'FINISH', slot: 2, start: 82, y: 460 }];
  const diamond: readonly Vertex[] = [[0, -64], [238, 0], [0, 64], [-238, 0]];
  const layers: unknown[] = [
    ...sceneLabel(70, 'SYSTEM / ASSEMBLY', 'Parts become a system.', '04 / 07'),
    shapeLayer({ index: 1, name: 'Assembly spine', opacity: loopOpacity(18, 266, 54), position: [480, 380, 0], shapes: [pathGroup('Assembly spine path', [[0, -184], [0, 182]], 2, 76, 1, false, 0, true)] }),
    shapeLayer({ index: 2, name: 'System foundation', opacity: loopOpacity(128, 266), position: settlePosition(128, [480, 594, 0], [480, 576, 0]), scale: pulseScale(156, 258, 92, 108), shapes: [pathGroup('System foundation diamond', diamond, 2, 96, 1, true, 16), pathGroup('System foundation inset', [[0, -34], [124, 0], [0, 34], [-124, 0]], 0, 74, 1, true, 5)] }),
    textLayer(40, 'System state', 'SYSTEM READY', [480, 584, 0], 18, 0, 600, loopOpacity(154, 264), 90, 2),
  ];
  planes.forEach(({ label, slot, start, y }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Assembly plane ${label}`, opacity: loopOpacity(start, 266), position: settlePosition(start, [480, y - 36, 0], [480, y, 0], FADE_OUT_START, 34), scale: pulseScale(start, 260, 90, index === 2 ? 106 : 102), shapes: [pathGroup('Assembly plane surface', diamond, slot, slot === 2 ? 96 : 58, 1, true, slot === 2 ? 11 : 5), pathGroup('Assembly plane seam', [[-118, 0], [0, 32], [118, 0]], slot === 2 ? 0 : 1, 46, 1)] }));
    layers.push(textLayer(50 + index, `Assembly label ${label}`, label, [480, y + 7, 0], 15, slot === 2 ? 0 : 1, 600, loopOpacity(start + 6, 266), 100, 2));
  });
  return baseDocument('Layer assembly', layers);
}

function qualityScanDocument(): LottieDocument {
  const rows = [
    { code: '01', start: 64, text: 'Layout aligned', y: 286 },
    { code: '02', start: 96, text: 'Type resolved', y: 374 },
    { code: '03', start: 128, text: 'Motion tuned', y: 462 },
    { code: '04', start: 160, text: 'Export verified', y: 550 },
  ];
  const layers: unknown[] = [
    ...sceneLabel(70, 'QUALITY / SCAN', 'Every detail earns approval.', '05 / 07'),
    textLayer(40, 'Scan target label', 'SYSTEM CHECK', [86, 188, 0], 11, 1, 600, loopOpacity(16), 90),
    textLayer(41, 'Scan target text', 'Ready when every part is clear', [86, 226, 0], 22, 0, 500, loopOpacity(22), -4),
    shapeLayer({ index: 1, name: 'Scan baseline', opacity: loopOpacity(24, 266, 74), position: [480, 244, 0], scale: growScale(24), shapes: [gradientRectangleGroup('Scan baseline fill', [788, 2], 2, 0, [0, 0], 1, 100)] }),
    shapeLayer({ index: 2, name: 'Quality scan line', opacity: phaseOpacity(48, 218, 0, 84), position: travelPosition(48, 212, [[78, 266, 0], [882, 266, 0], [882, 566, 0], [78, 566, 0]]), shapes: [gradientRectangleGroup('Quality scan beam', [3, 330], 2, 0, [0, 0], 1, 100)] }),
  ];
  rows.forEach(({ code, start, text, y }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Quality row ${code}`, opacity: loopOpacity(32 + index * 8, 266), position: [480, y, 0], shapes: [rectangleGroup('Quality row surface', [788, 72], 1, [0, 0], 6, 4), outlinedRectangleGroup('Quality row edge', [788, 72], 1, [0, 0], 6, 1, 30), rectangleGroup('Quality approval rail', [4, 72], 2, [-392, 0], 1, index === 2 ? 100 : 58)] }));
    layers.push(textLayer(50 + index, `Quality code ${code}`, code, [106, y + 5, 0], 12, index === 2 ? 2 : 1, 600, loopOpacity(40 + index * 8, 266), 74));
    layers.push(textLayer(60 + index, `Quality check ${code}`, text, [190, y + 7, 0], 18, 0, 500, loopOpacity(44 + index * 8, 266), -2));
    layers.push(shapeLayer({ index: 20 + index, name: `Approval state ${code}`, opacity: loopOpacity(start, 260), position: [842, y, 0], scale: pulseScale(start, 256, 70, 114), shapes: [ellipseGroup('Approval state ring', [24, 24], 2, [0, 0], 92, true), pathGroup('Approval check', [[-5, 0], [-1, 5], [7, -6]], 2, 100, 2)] }));
  });
  return baseDocument('Quality scan', layers);
}

function networkOrbitDocument(): LottieDocument {
  const nodes = [
    { code: 'A', position: [286, 314, 0] as Point, start: 42 },
    { code: 'B', position: [674, 286, 0] as Point, start: 82 },
    { code: 'C', position: [714, 486, 0] as Point, start: 122 },
    { code: 'D', position: [304, 520, 0] as Point, start: 162 },
  ];
  const layers: unknown[] = [
    ...sceneLabel(70, 'NETWORK / ORBIT', 'A living system of nodes.', '06 / 07'),
    shapeLayer({ index: 1, name: 'Network field', opacity: loopOpacity(18, 266, 78), position: settlePosition(18, [480, 428, 0], [480, 412, 0]), shapes: [ellipseGroup('Network field outer', [420, 420], 0, [0, 0], 72, true), ellipseGroup('Network orbit one', [420, 152], 1, [0, -86], 42, true), ellipseGroup('Network orbit two', [420, 152], 1, [0, 86], 42, true), ellipseGroup('Network meridian', [154, 420], 1, [0, 0], 48, true), pathGroup('Network axis', [[-210, 0], [210, 0]], 1, 42, 1, false, 0, true)] }),
    shapeLayer({ index: 2, name: 'Network route', opacity: loopOpacity(34, 266, 92), position: [480, 412, 0], shapes: [pathGroup('Network route path', [[-194, -98], [0, -10], [194, -126], [234, 74], [0, 18], [-176, 108]], 2, 100, 2)] }),
    shapeLayer({ index: 3, name: 'Network packet', opacity: phaseOpacity(44, 224), position: travelPosition(44, 218, nodes.map(({ position }) => position)), scale: pulseScale(44, 224, 82, 116), shapes: [ellipseGroup('Network packet glow', [26, 26], 2, [0, 0], 24), ellipseGroup('Network packet core', [10, 10], 2)] }),
    textLayer(40, 'Network count', '24', [480, 430, 0], 82, 0, 600, loopOpacity(92), -30, 2),
    textLayer(41, 'Network count label', 'ACTIVE NODES', [480, 478, 0], 12, 1, 600, loopOpacity(102), 110, 2),
  ];
  nodes.forEach(({ code, position, start }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Network node ${code}`, opacity: loopOpacity(start, 260), position, scale: pulseScale(start, 256, 72, 118), shapes: [ellipseGroup('Network node ring', [34, 34], index === 2 ? 2 : 0, [0, 0], index === 2 ? 100 : 72, true), ellipseGroup('Network node core', [8, 8], index === 2 ? 2 : 0)] }));
    layers.push(textLayer(50 + index, `Network code ${code}`, code, [position[0] + 26, position[1] + 5, 0], 11, index === 2 ? 2 : 1, 600, loopOpacity(start + 4, 260), 70));
  });
  return baseDocument('Network orbit', layers);
}

function endpointDeliveryDocument(): LottieDocument {
  const destinations = [
    { code: 'WEB', format: 'HTML', slot: 0, start: 86, y: 246 },
    { code: 'APP', format: 'NATIVE', slot: 2, start: 120, y: 366 },
    { code: 'API', format: 'JSON', slot: 0, start: 154, y: 486 },
  ];
  const layers: unknown[] = [
    ...sceneLabel(70, 'DELIVERY / ENDPOINTS', 'One artifact. Every endpoint.', '07 / 07'),
    shapeLayer({ index: 1, name: 'Origin artifact', opacity: loopOpacity(16, 266), position: settlePosition(16, [190, 390, 0], [190, 374, 0]), scale: pulseScale(16, 258, 92, 104), shapes: [rectangleGroup('Origin artifact surface', [216, 268], 1, [0, 0], 8, 6), outlinedRectangleGroup('Origin artifact edge', [216, 268], 0, [0, 0], 8, 1, 56), rectangleGroup('Origin artifact fold', [52, 3], 2, [66, -102], 1, 100), rectangleGroup('Origin line one', [128, 6], 0, [-18, -46], 2, 82), rectangleGroup('Origin line two', [94, 6], 0, [-35, -16], 2, 48), rectangleGroup('Origin line three', [118, 6], 0, [-23, 14], 2, 62)] }),
    textLayer(40, 'Origin artifact label', 'design.json', [118, 482, 0], 16, 1, 500, loopOpacity(28), 4),
    shapeLayer({ index: 2, name: 'Endpoint routing system', opacity: loopOpacity(34, 266, 64), position: [480, 374, 0], shapes: destinations.map(({ y }, index) => pathGroup(`Endpoint route ${index + 1}`, [[-182, 0], [-48, 0], [40, y - 374], [146, y - 374]], index === 1 ? 2 : 1, index === 1 ? 96 : 48, index === 1 ? 2 : 1)) }),
    shapeLayer({ index: 3, name: 'Delivery packet', opacity: phaseOpacity(54, 214), position: travelPosition(54, 208, [[298, 374, 0], [432, 374, 0], [520, 366, 0], [626, 366, 0]]), scale: pulseScale(54, 214, 84, 118), shapes: [gradientRectangleGroup('Delivery packet core', [54, 14], 2, 0, [0, 0], 7, 100)] }),
    textLayer(41, 'Endpoint count', '3', [824, 594, 0], 54, 0, 600, loopOpacity(176, 264), -22, 1),
    textLayer(42, 'Endpoint count label', 'ENDPOINTS', [824, 626, 0], 10, 1, 600, loopOpacity(182, 264), 104, 1),
  ];
  destinations.forEach(({ code, format, slot, start, y }, index) => {
    layers.push(shapeLayer({ index: 10 + index, name: `Endpoint ${code}`, opacity: loopOpacity(start, 262), position: settlePosition(start, [752, y + 10, 0], [752, y, 0]), scale: pulseScale(start, 256, 88, slot === 2 ? 110 : 102), shapes: [rectangleGroup('Endpoint surface', [252, 76], slot, [0, 0], 8, slot === 2 ? 12 : 5), outlinedRectangleGroup('Endpoint edge', [252, 76], slot === 2 ? 2 : 1, [0, 0], 8, 1, slot === 2 ? 96 : 38), ellipseGroup('Endpoint status', [8, 8], slot === 2 ? 2 : 0, [-94, 0], 100)] }));
    layers.push(textLayer(50 + index, `Endpoint code ${code}`, code, [690, y + 6, 0], 16, slot === 2 ? 2 : 0, 600, loopOpacity(start + 4, 262), 86));
    layers.push(textLayer(60 + index, `Endpoint format ${code}`, format, [852, y + 5, 0], 12, 1, 500, loopOpacity(start + 8, 262), 20, 1));
  });
  return baseDocument('Endpoint delivery', layers);
}

export const LOTTIE_EXAMPLES: readonly LottieExample[] = [
  { category: 'Flow', data: signalRelayDocument(), description: 'One input fans out into four coordinated outcomes.', id: 'signal-relay', name: 'Signal relay' },
  { category: 'Logic', data: decisionRouterDocument(), description: 'Intent selects one of two clearly differentiated paths.', id: 'decision-router', name: 'Decision router' },
  { category: 'Synthesis', data: sourceMergeDocument(), description: 'Independent signals converge into one coherent artifact.', id: 'source-merge', name: 'Source merge' },
  { category: 'Assembly', data: layerAssemblyDocument(), description: 'Separate planes settle into a unified system.', id: 'layer-assembly', name: 'Layer assembly' },
  { category: 'Quality', data: qualityScanDocument(), description: 'A moving scan verifies a sequence of quality checks.', id: 'quality-scan', name: 'Quality scan' },
  { category: 'Network', data: networkOrbitDocument(), description: 'A signal travels through an active field of connected nodes.', id: 'network-orbit', name: 'Network orbit' },
  { category: 'Delivery', data: endpointDeliveryDocument(), description: 'One artifact reaches several endpoints in their native formats.', id: 'endpoint-delivery', name: 'Endpoint delivery' },
] as const;

function hexToLottieColor(hex: string): LottieColor {
  const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#181818';
  return [Number.parseInt(normalized.slice(1, 3), 16) / 255, Number.parseInt(normalized.slice(3, 5), 16) / 255, Number.parseInt(normalized.slice(5, 7), 16) / 255, 1];
}

type LottieRecord = Record<string, unknown>;

function paletteSlot(name: unknown, pattern: RegExp, capture = 1): number {
  const match = typeof name === 'string' ? pattern.exec(name) : null;
  return Math.max(0, Number(match?.[capture] ?? 1) - 1);
}

function customizeLottiePaint(record: LottieRecord, next: LottieRecord, colors: readonly string[]) {
  if (record.ty !== 'fl' && record.ty !== 'st') return;
  if (!record.c || typeof record.c !== 'object') return;
  const colorProperty = record.c as LottieRecord;
  if (colorProperty.a !== 0 || !Array.isArray(colorProperty.k)) return;
  const slot = paletteSlot(record.nm, /Palette (\d+)/);
  next.c = { ...colorProperty, k: hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818') };
}

function customizedTextKeyframe(keyframe: unknown, color: number[], fontFamily: string | undefined) {
  if (!keyframe || typeof keyframe !== 'object') return keyframe;
  const keyframeRecord = keyframe as LottieRecord;
  const style = keyframeRecord.s as LottieRecord | undefined;
  if (!style) return keyframe;
  const currentFont = typeof style.f === 'string' ? style.f : 'GlyphfieldSans-Regular';
  const fontStyle = currentFont.endsWith('Semibold') ? 'Semibold' : currentFont.endsWith('Medium') ? 'Medium' : 'Regular';
  return { ...keyframeRecord, s: { ...style, f: fontFamily ? `BrandFont-${fontStyle}` : currentFont, fc: color } };
}

function customizeLottieText(record: LottieRecord, next: LottieRecord, appearance: LottieAppearance, colors: readonly string[]) {
  if (record.ty !== 5 || !record.t || typeof record.t !== 'object') return;
  const text = next.t as LottieRecord;
  const documentData = text.d as LottieRecord | undefined;
  const keyframes = Array.isArray(documentData?.k) ? documentData.k : [];
  const slot = paletteSlot(record.nm, /Palette (\d+) Text/);
  const color = hexToLottieColor(colors[slot] ?? colors[0] ?? '#181818').slice(0, 3);
  text.d = { ...documentData, k: keyframes.map((keyframe) => customizedTextKeyframe(keyframe, color, appearance.fontFamily)) };
  next.t = text;
}

function customizeLottieGradient(record: LottieRecord, next: LottieRecord, colors: readonly string[]) {
  if (record.ty !== 'gf' || !record.g || typeof record.g !== 'object') return;
  const gradient = record.g as LottieRecord;
  const colorProperty = gradient.k as LottieRecord | undefined;
  const match = typeof record.nm === 'string' ? /Palette Gradient (\d+) (\d+)/.exec(record.nm) : null;
  if (colorProperty?.a !== 0 || !Array.isArray(colorProperty.k) || !match) return;
  const fallback = colors[0] ?? '#181818';
  next.g = { ...gradient, k: { ...colorProperty, k: lottieGradientStops(hexToLottieColor(colors[paletteSlot(record.nm, /Palette Gradient (\d+) (\d+)/, 1)] ?? fallback), hexToLottieColor(colors[paletteSlot(record.nm, /Palette Gradient (\d+) (\d+)/, 2)] ?? fallback)) } };
}

function customizeLottieGeometry(record: LottieRecord, next: LottieRecord, appearance: LottieAppearance) {
  if (record.ty === 'st' && record.w && typeof record.w === 'object') {
    const widthProperty = record.w as LottieRecord;
    if (widthProperty.a === 0) next.w = { ...widthProperty, k: appearance.strokeWidth };
  }
  if (record.ty !== 'rc' || !record.r || typeof record.r !== 'object') return;
  const radiusProperty = record.r as LottieRecord;
  const sizeProperty = record.s as LottieRecord | undefined;
  const size = sizeProperty?.a === 0 && Array.isArray(sizeProperty.k) ? sizeProperty.k.filter((entry): entry is number => typeof entry === 'number') : [];
  const maximumRadius = size.length >= 2 ? Math.max(0, Math.min(size[0] ?? 0, size[1] ?? 0) / 2) : appearance.cornerRadius;
  if (radiusProperty.a === 0) next.r = { ...radiusProperty, k: Math.min(appearance.cornerRadius, maximumRadius) };
}

export function customizeLottieDocument(document: LottieDocument, appearance: LottieAppearance): LottieDocument {
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
  const customizedWithFonts = appearance.fontFamily ? { ...customized, fonts: { ...fonts, list: fontList.map((font) => {
    if (!font || typeof font !== 'object') return font;
    const fontRecord = font as Record<string, unknown>;
    const fontStyle = typeof fontRecord.fStyle === 'string' ? fontRecord.fStyle : 'Regular';
    return { ...fontRecord, fFamily: appearance.fontFamily, fName: `BrandFont-${fontStyle}` };
  }) } } : customized;
  if (!appearance.brandLogo) return customizedWithFonts;
  const assets = Array.isArray(customizedWithFonts.assets) ? customizedWithFonts.assets.filter((asset) => !asset || typeof asset !== 'object' || (asset as Record<string, unknown>).id !== 'glyphfield-brand-logo') : [];
  const layers = Array.isArray(customizedWithFonts.layers) ? customizedWithFonts.layers.filter((layer) => !layer || typeof layer !== 'object' || (layer as Record<string, unknown>).nm !== 'Brand logo') : [];
  const maximumLayerIndex = layers.reduce((maximum, layer) => {
    if (!layer || typeof layer !== 'object') return maximum;
    const index = (layer as Record<string, unknown>).ind;
    return typeof index === 'number' ? Math.max(maximum, index) : maximum;
  }, 0);
  return {
    ...customizedWithFonts,
    assets: [...assets, { e: 1, h: appearance.brandLogo.height, id: 'glyphfield-brand-logo', p: appearance.brandLogo.dataUrl, u: '', w: appearance.brandLogo.width }],
    layers: [brandLogoLayer(maximumLayerIndex + 1, appearance.brandLogo.width, appearance.brandLogo.height), ...layers],
  };
}
