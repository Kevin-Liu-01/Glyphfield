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
  [0.15, 0.16, 0.14, 1],
  [0.48, 0.47, 0.43, 1],
  [0.75, 0.29, 0.18, 1],
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
    nm: `Palette ${slot + 1} / weight=${width}`,
    o: { a: 0, k: opacity },
    ty: 'st',
    w: { a: 0, k: width },
  };
}

function lottieGradientStops(from: LottieColor, to: LottieColor) {
  return [0, from[0], from[1], from[2], 1, to[0], to[1], to[2]];
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

// A complete composition stays on screen. Only the explanatory gesture moves.
// Spatial samples use linear time; settled transforms use a restrained sine arc.
function breathe(values: number[][]): AnimatedProperty {
  return animated(values.map((value, index) => ({ t: index * COMPOSITION_FRAMES / (values.length - 1), value })));
}

function sampledMotion(point: (phase: number) => Point): AnimatedProperty {
  return animated(Array.from({ length: 61 }, (_, index) => ({
    ease: 'linear' as const, t: index * 5, value: point(index === 60 ? 0 : index / 60),
  })));
}

function curvePoint(points: readonly Vertex[], t: number): Point {
  const [a, b, c, d] = points;
  const u = 1 - t;
  return [0, 1].map((axis) => u ** 3 * a[axis] + 3 * u ** 2 * t * b[axis] + 3 * u * t ** 2 * c[axis] + t ** 3 * d[axis]).concat(0) as Point;
}

function curveGroup(name: string, points: readonly Vertex[], slot = 0, opacity = 100, width = 1) {
  const [a, b, c, d] = points;
  return {
    ty: 'gr', nm: name,
    it: [
      { ty: 'sh', nm: name, ks: { a: 0, k: { c: false, v: [a, d], i: [[0, 0], [c[0] - d[0], c[1] - d[1]]], o: [[b[0] - a[0], b[1] - a[1]], [0, 0]] } } },
      stroke(slot, width, opacity), groupTransform(),
    ],
  };
}

function orbitGroup(name: string, radiusX: number, radiusY: number, angle: number, slot = 0, opacity = 100) {
  const group = ellipseGroup(name, [radiusX * 2, radiusY * 2], slot, [0, 0], opacity, true);
  group.it[group.it.length - 1] = { ...groupTransform(), r: { a: 0, k: angle } };
  return group;
}

function particle(index: number, name: string, points: readonly Vertex[], offset = 0, size = 8) {
  const phase = (t: number) => ((t + offset) % 1 + 1) % 1;
  const position = sampledMotion((t) => curvePoint(points, phase(t)));
  const opacity = animated(Array.from({ length: 61 }, (_, i) => ({
    ease: 'linear' as const, t: i * 5, value: [Math.min(1, phase(i === 60 ? 0 : i / 60) * 12, (1 - phase(i === 60 ? 0 : i / 60)) * 12) * 100],
  })));
  return shapeLayer({ index, name, position, opacity, shapes: [ellipseGroup(name, [size, size], 2)] });
}

function editorialLabel(title: string, category: string, number: string, caption: string) {
  return [
    textLayer(90, 'Scene eyebrow', category.toUpperCase(), [176, 66, 0], 12, 1, 500, loopOpacity(), 100),
    textLayer(91, 'Scene title', title, [76, 138, 0], 44, 0, 400, loopOpacity(), -25),
    textLayer(92, 'Scene number', number, [884, 66, 0], 12, 1, 500, loopOpacity(), 40, 1),
    textLayer(93, 'Scene caption', caption, [76, 652, 0], 15, 1, 400),
    shapeLayer({ index: 94, name: 'Editorial rule', position: [480, 612, 0], shapes: [pathGroup('Fine baseline', [[-404, 0], [404, 0]], 1, 38)] }),
  ];
}

function signalRelayDocument(): LottieDocument {
  const layers: unknown[] = [...editorialLabel('A thought becomes a system.', 'Signal / Relay', '01', 'One intention. Many possibilities.')];
  const paths = Array.from({ length: 9 }, (_, i) => [[200, 384], [470, 384], [480, 232 + i * 38], [796, 232 + i * 38]] as Vertex[]);
  layers.push(shapeLayer({ index: 1, name: 'Signal fan', position: [480, 384, 0], shapes: paths.map((points, i) => curveGroup(`Signal filament ${i}`, points.map(([x, y]) => [x - 480, y - 384]), i === 4 ? 2 : 0, i === 4 ? 100 : 58, i === 4 ? 2 : 1)) }));
  layers.push(shapeLayer({ index: 2, name: 'Origin disc', position: [200, 384, 0], scale: breathe([[100, 100, 100], [108, 108, 100], [100, 100, 100]]), shapes: [ellipseGroup('Origin ring', [96, 96], 0, [0, 0], 100, true), ellipseGroup('Origin core', [28, 28], 2)] }));
  layers.push(shapeLayer({ index: 3, name: 'Terminal marks', position: [796, 384, 0], shapes: paths.map((_, i) => ellipseGroup(`Terminal ${i}`, [6, 6], i === 4 ? 2 : 0, [0, (i - 4) * 38])) }));
  for (let i = 0; i < 3; i++) layers.push(particle(10 + i, `Signal in transit ${i}`, paths[2 + i * 2], i / 3, 10));
  layers.push(textLayer(40, 'Origin caption', 'INTENT', [200, 472, 0], 12, 1, 500, loopOpacity(), 100, 2));
  return baseDocument('Signal relay', layers);
}

function decisionRouterDocument(): LottieDocument {
  const upper: Vertex[] = [[176, 388], [492, 388], [492, 240], [790, 240]];
  const lower: Vertex[] = [[176, 388], [492, 388], [492, 528], [790, 528]];
  const layers: unknown[] = [...editorialLabel('Choose with intention.', 'Logic / Routing', '02', 'Two possibilities. A considered direction.')];
  layers.push(shapeLayer({ index: 1, name: 'Possibility field', position: [480, 388, 0], shapes: Array.from({ length: 11 }, (_, i) => {
    const offset = (i - 5) * 9;
    const points = upper.map(([x, y], n) => [x - 480, y - 388 + (n > 1 ? offset : offset * 0.25)] as Vertex);
    return curveGroup(`Unchosen possibility ${i}`, points, 1, 65);
  }) }));
  layers.push(shapeLayer({ index: 2, name: 'Chosen field', position: [480, 388, 0], shapes: Array.from({ length: 11 }, (_, i) => {
    const offset = (i - 5) * 9;
    return curveGroup(`Chosen possibility ${i}`, lower.map(([x, y], n) => [x - 480, y - 388 + (n > 1 ? offset : offset * 0.25)] as Vertex), i === 5 ? 2 : 0, i === 5 ? 100 : 72, i === 5 ? 2 : 1);
  }) }));
  layers.push(shapeLayer({ index: 3, name: 'Decision origin', position: [176, 388, 0], shapes: [ellipseGroup('Decision disc', [32, 32], 2)] }));
  layers.push(particle(10, 'Committed direction', lower, 0, 12));
  layers.push(particle(11, 'Following direction', lower, 0.5, 7));
  layers.push(textLayer(40, 'Alternative label', '01 / EXPLORE', [792, 184, 0], 12, 1, 500, loopOpacity(), 50, 1));
  layers.push(textLayer(41, 'Chosen label', '02 / REFINE', [792, 596, 0], 12, 2, 500, loopOpacity(), 50, 1));
  return baseDocument('Decision router', layers);
}

function sourceMergeDocument(): LottieDocument {
  const layers: unknown[] = [...editorialLabel('Clarity from complexity.', 'Synthesis / Merge', '03', 'Different perspectives. A shared understanding.')];
  const paths = Array.from({ length: 15 }, (_, i) => [[120, 206 + i * 24], [400, 206 + i * 24], [440, 386], [770, 386]] as Vertex[]);
  layers.push(shapeLayer({ index: 1, name: 'Converging perspectives', position: [480, 386, 0], shapes: paths.map((points, i) => curveGroup(`Perspective ${i}`, points.map(([x, y]) => [x - 480, y - 386]), i === 7 ? 2 : 0, i === 7 ? 100 : 56)) }));
  for (let i = 0; i < 5; i++) layers.push(particle(10 + i, `Converging signal ${i}`, paths[i * 3 + 1], i / 5, 7));
  layers.push(shapeLayer({ index: 2, name: 'Synthesis aperture', position: [784, 386, 0], scale: breathe([[100, 100, 100], [100, 110, 100], [100, 100, 100]]), shapes: [ellipseGroup('Aperture', [72, 176], 2, [0, 0], 100, true), ellipseGroup('Focus', [18, 18], 2)] }));
  layers.push(textLayer(40, 'Input note', 'MANY', [120, 592, 0], 12, 1, 500, loopOpacity(), 100));
  layers.push(textLayer(41, 'Output note', 'ONE', [784, 514, 0], 12, 2, 500, loopOpacity(), 100, 2));
  return baseDocument('Source merge', layers);
}

function layerAssemblyDocument(): LottieDocument {
  const layers: unknown[] = [...editorialLabel('Better, together.', 'Structure / Assembly', '04', 'Independent layers. One coherent whole.')];
  const plane: Vertex[] = [[0, -102], [226, 0], [0, 102], [-226, 0]];
  for (let i = 0; i < 3; i++) {
    const y = 292 + i * 98;
    const delta = i === 0 ? -22 : i === 2 ? 22 : 0;
    layers.push(shapeLayer({ index: 10 + i, name: `Assembly stratum ${i}`, position: breathe([[480, y, 0], [480, y + delta, 0], [480, y, 0]]), shapes: [
      pathGroup('Plane perimeter', plane, i === 1 ? 2 : 0, 100, 1, true, i === 1 ? 8 : 3),
      ...Array.from({ length: 15 }, (_, n) => {
        const t = (n + 1) / 16;
        return pathGroup(`Plane ruling ${n}`, [[-226 * (1 - t), 102 * t], [226 * t, -102 * (1 - t)]], i === 1 ? 2 : 0, i === 1 ? 72 : 28);
      }),
    ] }));
  }
  layers.push(shapeLayer({ index: 1, name: 'Assembly axis', position: [480, 394, 0], shapes: [pathGroup('Alignment axis', [[0, -200], [0, 198]], 1, 44, 1, false, 0, true)] }));
  layers.push(textLayer(40, 'Assembly note top', 'CONTEXT', [780, 296, 0], 12, 1, 500, loopOpacity(), 70));
  layers.push(textLayer(41, 'Assembly note middle', 'INTELLIGENCE', [780, 394, 0], 12, 2, 500, loopOpacity(), 70));
  layers.push(textLayer(42, 'Assembly note base', 'EXPRESSION', [780, 492, 0], 12, 1, 500, loopOpacity(), 70));
  return baseDocument('Layer assembly', layers);
}

function qualityScanDocument(): LottieDocument {
  const layers: unknown[] = [...editorialLabel('Precision is a practice.', 'Quality / Resolve', '05', 'Every detail, brought into focus.')];
  const center: Point = [480, 386, 0];
  for (let column = 0; column < 13; column++) {
    const x = (column - 6) * 32;
    const shapes = Array.from({ length: 11 }, (_, row) => {
      const y = (row - 5) * 32;
      const distance = Math.hypot(x / 210, y / 180);
      return ellipseGroup(`Sample ${column}:${row}`, [distance < 0.6 ? 9 : 5, distance < 0.6 ? 9 : 5], 0, [x, y], distance > 1.05 ? 16 : 75, distance < 0.6);
    });
    layers.push(shapeLayer({ index: 10 + column, name: `Resolved samples ${column}`, position: center, opacity: animated(Array.from({ length: 61 }, (_, i) => {
      const scanX = -220 * Math.cos(i / 60 * 2 * Math.PI);
      return { ease: 'linear' as const, t: i * 5, value: [46 + 54 * Math.exp(-(((scanX - x) / 65) ** 2))] };
    })), shapes }));
  }
  layers.push(shapeLayer({ index: 1, name: 'Focus boundary', position: center, shapes: [
    pathGroup('Focus top left', [[-236, -136], [-236, -192], [-180, -192]], 0, 90),
    pathGroup('Focus bottom right', [[236, 136], [236, 192], [180, 192]], 0, 90),
  ] }));
  layers.unshift(shapeLayer({ index: 2, name: 'Optical scan', position: sampledMotion((t) => [480 - 220 * Math.cos(t * Math.PI * 2), 386, 0]), shapes: [pathGroup('Scanning blade', [[0, -192], [0, 192]], 2, 100, 2), ellipseGroup('Scan locator', [8, 8], 2, [0, -204])] }));
  layers.push(textLayer(40, 'Precision scale', '1 : 1', [800, 584, 0], 16, 1, 400, loopOpacity(), 10, 1));
  return baseDocument('Quality scan', layers);
}

function networkOrbitDocument(): LottieDocument {
  const center: Point = [480, 384, 0];
  const layers: unknown[] = [...editorialLabel('Connected by possibility.', 'Network / Orbit', '06', 'An open system, in continuous conversation.')];
  const grid = [ellipseGroup('World contour', [364, 364], 0, [0, 0], 90, true)];
  for (const width of [96, 208, 308]) grid.push(ellipseGroup(`Meridian ${width}`, [width, 364], 0, [0, 0], 36, true));
  for (const y of [-120, -64, 0, 64, 120]) {
    grid.push(ellipseGroup(`Latitude ${y}`, [2 * Math.sqrt(182 ** 2 - y ** 2), 54], 0, [0, y], 32, true));
  }
  layers.push(shapeLayer({ index: 1, name: 'Connected world', position: center, shapes: grid }));
  layers.unshift(shapeLayer({ index: 2, name: 'Open orbital path', position: center, shapes: [orbitGroup('Exchange orbit', 250, 94, -24, 2, 90)] }));
  for (let i = 0; i < 3; i++) {
    layers.unshift(shapeLayer({ index: 10 + i, name: `Orbiting node ${i}`, position: sampledMotion((phase) => {
      const a = (phase + i / 3) * 2 * Math.PI;
      const rotation = -24 * Math.PI / 180;
      const x = 250 * Math.cos(a); const y = 94 * Math.sin(a);
      return [480 + x * Math.cos(rotation) - y * Math.sin(rotation), 384 + x * Math.sin(rotation) + y * Math.cos(rotation), 0];
    }), shapes: [ellipseGroup('Node halo', [26, 26], 2, [0, 0], 12), ellipseGroup('Node', [10, 10], 2)] }));
  }
  layers.push(textLayer(40, 'Network scale', 'ALWAYS IN EXCHANGE', [480, 592, 0], 12, 1, 500, loopOpacity(), 100, 2));
  return baseDocument('Network orbit', layers);
}

function endpointDeliveryDocument(): LottieDocument {
  const layers: unknown[] = [...editorialLabel('Made to move everywhere.', 'Delivery / Adapt', '07', 'The same idea. A different expression.')];
  const paths = [230, 386, 542].map((y, i) => [[288, 386], [510, 386], [480, y], [[676, 725, 700][i], y]] as Vertex[]);
  layers.push(shapeLayer({ index: 1, name: 'Distribution paths', position: [480, 386, 0], shapes: paths.map((points, i) => curveGroup(`Distribution ${i}`, points.map(([x, y]) => [x - 480, y - 386]), i === 1 ? 2 : 0, 70)) }));
  layers.push(shapeLayer({ index: 2, name: 'Original idea', position: [220, 386, 0], rotation: breathe([[0], [90], [0]]), shapes: [pathGroup('Origin diamond', [[0, -68], [68, 0], [0, 68], [-68, 0]], 0, 100, 1, true, 3), ellipseGroup('Origin seed', [20, 20], 2)] }));
  layers.push(shapeLayer({ index: 3, name: 'Web expression', position: [756, 230, 0], shapes: [outlinedRectangleGroup('Browser', [160, 106], 0, [0, 0], 3, 1, 100), pathGroup('Browser chrome', [[-80, -27], [80, -27]], 0, 60), ellipseGroup('Browser origin', [6, 6], 2, [-62, -40]), pathGroup('Browser sign', [[-12, 0], [10, 12], [-12, 26]], 2, 100, 2)] }));
  layers.push(shapeLayer({ index: 4, name: 'App expression', position: [756, 386, 0], shapes: [outlinedRectangleGroup('Device', [62, 104], 2, [0, 0], 8, 1, 100), pathGroup('Device sign', [[-10, -14], [10, 0], [-10, 14]], 2, 100, 2)] }));
  layers.push(shapeLayer({ index: 5, name: 'API expression', position: [756, 542, 0], shapes: [pathGroup('Left brace', [[-40, -32], [-56, -32], [-56, 32], [-40, 32]], 0, 100), pathGroup('Right brace', [[40, -32], [56, -32], [56, 32], [40, 32]], 0, 100), pathGroup('API sign', [[-10, -14], [10, 0], [-10, 14]], 2, 100, 2)] }));
  paths.forEach((points, i) => layers.unshift(particle(10 + i, `Delivered signal ${i}`, points, i / 3, 8)));
  ['WEB', 'APP', 'API'].forEach((label, i) => layers.push(textLayer(50 + i, `Endpoint label ${label}`, label, [880, 236 + i * 156, 0], 12, 1, 500, loopOpacity(), 60, 1)));
  layers.push(textLayer(40, 'Origin note', 'ORIGINAL', [220, 494, 0], 12, 1, 500, loopOpacity(), 100, 2));
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
    const authoredWeight = typeof record.nm === 'string' ? /weight=([\d.]+)/.exec(record.nm) : null;
    const weight = authoredWeight ? Number(authoredWeight[1]) : 1;
    if (widthProperty.a === 0) next.w = { ...widthProperty, k: appearance.strokeWidth * weight };
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
