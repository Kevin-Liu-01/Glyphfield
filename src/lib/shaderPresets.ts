export type ShaderPreset = {
  description: string;
  fragmentSource: string;
  id: string;
  name: string;
};

function fragment(body: string): string {
  return `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color_a;
uniform vec3 u_color_b;
uniform float u_scale;
uniform float u_distortion;
uniform float u_softness;
uniform float u_repetition;
uniform float u_contour;

${body}
`;
}

export const SHADER_PRESETS: readonly ShaderPreset[] = [
  {
    description: 'Soft bands of color moving through a deep atmospheric field.',
    fragmentSource: fragment(`
float wave(vec2 p, float offset) {
  return sin(p.x * 3.2 + sin(p.y * 2.0 + u_time * 0.45) + offset) * 0.5 + 0.5;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float a = wave(p, 0.0);
  float b = wave(p.yx * 1.35, 2.4);
  float veil = smoothstep(0.18, 0.9, a * b + 0.18 * sin(u_time + p.y * 4.0));
  vec3 base = mix(u_color_a * 0.16, u_color_b * 0.5, uv.y);
  vec3 color = mix(base, mix(u_color_a, u_color_b, a), veil * 0.82);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'aurora',
    name: 'Aurora',
  },
  {
    description: 'Deep liquid chrome with folded reflections, soft valleys, and controlled contour light.',
    fragmentSource: fragment(`
float metalHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float metalNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(metalHash(i), metalHash(i + vec2(1.0, 0.0)), f.x), mix(metalHash(i + vec2(0.0, 1.0)), metalHash(i + vec2(1.0)), f.x), f.y);
}

float metalFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int index = 0; index < 5; index++) {
    value += metalNoise(p) * amplitude;
    p = mat2(1.62, 1.18, -1.18, 1.62) * p + 0.17;
    amplitude *= 0.48;
  }
  return value;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float t = u_time * 0.34;
  float warp = metalFbm(p * 1.35 + vec2(t, -t * 0.72)) * 2.0 - 1.0;
  vec2 folded = p + vec2(warp, metalFbm(p.yx * 1.8 - t) - 0.5) * u_distortion;
  float direction = dot(folded, normalize(vec2(0.72, 0.44)));
  float flow = direction * u_repetition + warp * (2.0 + u_distortion * 7.0) + t * 4.2;
  float secondary = sin(flow * 0.48 - folded.y * 3.6 + t) * 0.5 + 0.5;
  float band = sin(flow) * 0.5 + 0.5;
  float valley = smoothstep(0.02, 0.96, band);
  float ridge = pow(1.0 - abs(sin(flow + secondary * 1.4)), mix(3.0, 18.0, u_softness));
  float edge = pow(1.0 - abs(sin(flow * 0.5 - 0.7)), 8.0) * u_contour;
  float vignette = 1.0 - smoothstep(0.55, 1.75, length(p));
  vec3 shadow = mix(vec3(0.005), u_color_a * 0.22, 0.65);
  vec3 body = mix(shadow, u_color_b, valley * 0.82 + secondary * 0.18);
  vec3 color = body + (ridge * 1.08 + edge * 0.38) * mix(vec3(0.82), vec3(1.0), vignette);
  color *= 0.78 + vignette * 0.28;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'liquid-metal',
    name: 'Liquid metal',
  },
  {
    description: 'Rounded mercury cells merge and separate under a broad studio reflection.',
    fragmentSource: fragment(`
float mercuryHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale * 1.4;
  vec2 cell = floor(p * 2.4);
  vec2 local = fract(p * 2.4) - 0.5;
  float nearest = 2.0;
  float second = 2.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 id = cell + offset;
      float phase = mercuryHash(id) * 6.28318;
      vec2 point = offset + vec2(sin(u_time * 0.42 + phase), cos(u_time * 0.36 + phase * 1.3)) * 0.28 * u_distortion;
      float distanceToPoint = length(local - point);
      if (distanceToPoint < nearest) {
        second = nearest;
        nearest = distanceToPoint;
      } else if (distanceToPoint < second) {
        second = distanceToPoint;
      }
    }
  }
  float seam = second - nearest;
  float bulb = 1.0 - smoothstep(0.08, 0.7, nearest);
  float rim = pow(1.0 - smoothstep(0.0, 0.22, seam), mix(2.0, 9.0, u_softness));
  float sweep = smoothstep(-0.65, 0.8, p.x * 0.55 - p.y * 0.8 + sin(p.y * 2.0 + u_time * 0.2) * 0.25);
  vec3 color = mix(u_color_a * 0.04, u_color_b * (0.24 + sweep * 0.72), bulb);
  color += rim * (0.35 + u_contour * 0.72);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'mercury',
    name: 'Mercury',
  },
  {
    description: 'Directional brushed steel with restrained grain and a traveling reflected beam.',
    fragmentSource: fragment(`
float steelHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float brush = steelHash(vec2(floor(gl_FragCoord.y * 0.72), floor(u_time * 3.0))) - 0.5;
  float longGrain = sin(p.y * u_repetition * 7.0 + brush * 2.0) * 0.5 + 0.5;
  float bend = sin(p.y * 2.2 - u_time * 0.22) * u_distortion;
  float beam = pow(max(0.0, 1.0 - abs(p.x + bend - sin(u_time * 0.18) * 0.42)), mix(3.0, 14.0, u_softness));
  float edge = 1.0 - smoothstep(0.2, 1.4, length(p));
  vec3 color = mix(u_color_a * 0.1, u_color_b * (0.45 + longGrain * 0.3), 0.72);
  color += beam * (0.52 + u_contour * 0.48) * edge;
  color += brush * 0.055;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'brushed-steel',
    name: 'Brushed steel',
  },
  {
    description: 'Animated contour lines with the precision of a technical map.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float elevation = sin(p.x * 3.2 + u_time * 0.35) + cos(p.y * 4.0 - u_time * 0.28);
  elevation += sin((p.x + p.y) * 5.0 + u_time * 0.2) * 0.45;
  float contours = 1.0 - smoothstep(0.04, 0.14, abs(fract(elevation * 1.35) - 0.5));
  float fine = 1.0 - smoothstep(0.015, 0.06, abs(fract(elevation * 4.0) - 0.5));
  vec3 color = mix(u_color_a * 0.12, u_color_b * 0.34, uv.y);
  color = mix(color, u_color_b, contours * 0.8 + fine * 0.14);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'topographic',
    name: 'Topographic',
  },
  {
    description: 'A luminous, continuously shifting field with generous color depth.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.38;
  float v = sin(p.x * 3.0 + t);
  v += sin((p.x + p.y) * 4.2 - t * 1.4);
  v += sin(length(p + vec2(sin(t), cos(t))) * 5.8 - t * 2.0);
  v = v / 3.0 * 0.5 + 0.5;
  vec3 color = mix(u_color_a, u_color_b, smoothstep(0.05, 0.95, v));
  color += 0.13 * vec3(sin(v * 6.28), cos(v * 4.7), sin(v * 3.9 + 1.0));
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'plasma',
    name: 'Plasma',
  },
  {
    description: 'A graphic rotating beam system that keeps the center optically quiet.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float angle = atan(p.y, p.x) + u_time * 0.2;
  float radius = length(p);
  float beams = smoothstep(0.15, 0.95, sin(angle * 9.0 + sin(radius * 5.0 - u_time)) * 0.5 + 0.5);
  float center = smoothstep(0.18, 0.58, radius);
  vec3 color = mix(u_color_a * 0.16, u_color_b, beams * center);
  color *= 1.0 - radius * 0.18;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'radial-beams',
    name: 'Radial beams',
  },
  {
    description: 'Print-like dots that breathe between two brand colors.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 grid = fract(gl_FragCoord.xy / 14.0) - 0.5;
  float field = sin(uv.x * 7.0 + u_time * 0.6) * cos(uv.y * 6.0 - u_time * 0.42);
  float radius = 0.12 + (field * 0.5 + 0.5) * 0.32;
  float dot = 1.0 - smoothstep(radius, radius + 0.08, length(grid));
  vec3 paper = mix(u_color_a * 0.08, u_color_a * 0.24, uv.y);
  vec3 color = mix(paper, u_color_b, dot);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'halftone',
    name: 'Halftone',
  },
  {
    description: 'Slow warped checks for a modular, system-oriented background.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * vec2(10.0, 7.0);
  p.x += sin(p.y * 0.8 + u_time * 0.45) * 0.65;
  p.y += cos(p.x * 0.6 - u_time * 0.35) * 0.5;
  float checker = mod(floor(p.x) + floor(p.y), 2.0);
  float edge = smoothstep(0.02, 0.13, min(min(fract(p.x), 1.0 - fract(p.x)), min(fract(p.y), 1.0 - fract(p.y))));
  vec3 color = mix(u_color_a, u_color_b, checker * 0.72 + edge * 0.12);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'warped-grid',
    name: 'Warped grid',
  },
  {
    description: 'Layered translucent waves with a calm glass-like finish.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float y1 = 0.5 + sin(uv.x * 5.0 + u_time * 0.42) * 0.16;
  float y2 = 0.5 + cos(uv.x * 4.0 - u_time * 0.3) * 0.24;
  float band1 = 1.0 - smoothstep(0.02, 0.28, abs(uv.y - y1));
  float band2 = 1.0 - smoothstep(0.02, 0.34, abs(uv.y - y2));
  vec3 color = mix(u_color_a * 0.15, u_color_b * 0.36, uv.y);
  color = mix(color, u_color_a, band1 * 0.6);
  color = mix(color, u_color_b, band2 * 0.54);
  color += pow(max(0.0, band1 * band2), 2.0) * 0.2;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'glass-waves',
    name: 'Glass waves',
  },
  {
    description: 'A soft spectral surface built from animated interference patterns.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float interference = sin(length(p - vec2(sin(u_time * 0.25), 0.0)) * 11.0 - u_time);
  interference += cos(length(p + vec2(0.4, cos(u_time * 0.2))) * 9.0 + u_time * 0.7);
  float v = interference * 0.25 + 0.5;
  vec3 spectrum = 0.55 + 0.45 * cos(6.28318 * (v + vec3(0.0, 0.22, 0.45)));
  vec3 brand = mix(u_color_a, u_color_b, smoothstep(0.0, 1.0, uv.y + v * 0.22));
  gl_FragColor = vec4(mix(brand, spectrum, 0.46), 1.0);
}`),
    id: 'iridescent',
    name: 'Iridescent',
  },
  {
    description: 'Thermal color contours that travel through the logo like a live scan.',
    fragmentSource: fragment(`
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  float field = sin(p.x * 4.0 + u_time * 0.8) + cos(p.y * 5.0 - u_time * 0.55);
  field += sin(length(p) * 8.0 - u_time) * 0.7;
  float v = field / 2.7 * 0.5 + 0.5;
  vec3 cold = mix(u_color_a, vec3(0.05, 0.15, 0.8), 0.58);
  vec3 hot = mix(u_color_b, vec3(1.0, 0.15, 0.02), 0.62);
  vec3 color = mix(cold, hot, smoothstep(0.12, 0.88, v));
  color += vec3(1.0, 0.7, 0.1) * pow(v, 9.0) * 0.7;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'heatmap',
    name: 'Heatmap',
  },
  {
    description: 'Faceted light suspended in slow volumetric smoke.',
    fragmentSource: fragment(`
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 3.0;
  float smoke = noise(p + vec2(u_time * 0.12, -u_time * 0.08));
  smoke += noise(p * 2.1 - u_time * 0.1) * 0.5;
  float facets = abs(sin((uv.x + uv.y + smoke * 0.35) * 12.0));
  float gem = pow(1.0 - facets, 5.0);
  vec3 color = mix(u_color_a * 0.08, u_color_b * 0.72, smoke / 1.5);
  color += gem * mix(u_color_b, vec3(1.0), 0.72);
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'gem-smoke',
    name: 'Gem smoke',
  },
  {
    description: 'A restrained mesh field finished with animated film grain.',
    fragmentSource: fragment(`
float random(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  float a = sin(uv.x * 4.0 + u_time * 0.24) * cos(uv.y * 3.0 - u_time * 0.18);
  float b = length(uv - vec2(0.5 + sin(u_time * 0.15) * 0.18, 0.5));
  float mesh = smoothstep(-0.8, 0.8, a - b * 0.7);
  float grain = random(gl_FragCoord.xy + floor(u_time * 24.0)) - 0.5;
  vec3 color = mix(u_color_a, u_color_b, mesh);
  color += grain * 0.1;
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'grain-gradient',
    name: 'Grain gradient',
  },
] as const;
