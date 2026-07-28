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

const METAL_UTILITIES = `
float metalHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float metalNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(metalHash(i), metalHash(i + vec2(1.0, 0.0)), f.x),
    mix(metalHash(i + vec2(0.0, 1.0)), metalHash(i + vec2(1.0)), f.x),
    f.y
  );
}

float metalFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.54;
  for (int index = 0; index < 5; index++) {
    value += metalNoise(p) * amplitude;
    p = mat2(1.72, 1.11, -1.11, 1.72) * p + 0.19;
    amplitude *= 0.47;
  }
  return value;
}

float metalLobe(float value, float center, float width) {
  float position = (value - center) / max(width, 0.001);
  return exp(-position * position);
}

float metalEnvironment(float reflection, float polish) {
  float broadSky = metalLobe(reflection, -0.68, 0.42) * 0.32;
  float upperStrip = metalLobe(reflection, -0.28, mix(0.17, 0.055, polish)) * 0.88;
  float darkCard = metalLobe(reflection, -0.02, 0.115) * 0.3;
  float lowerRoom = metalLobe(reflection, 0.25, 0.27) * 0.54;
  float edgeStrip = metalLobe(reflection, 0.61, mix(0.14, 0.038, polish)) * 1.08;
  return clamp(0.022 + broadSky + upperStrip - darkCard + lowerRoom + edgeStrip, 0.0, 1.15);
}

vec3 metalTone(float reflection, float polish, float fresnel, float grain) {
  float environment = metalEnvironment(reflection, polish);
  vec3 shadow = mix(vec3(0.008), u_color_a * 0.2, 0.5);
  vec3 silver = mix(vec3(0.72), u_color_b, 0.34);
  vec3 color = mix(shadow, silver, clamp(environment, 0.0, 1.0));
  color += max(0.0, environment - 1.0) * vec3(0.92);
  color += fresnel * mix(vec3(0.2), u_color_b, 0.18);
  color += grain;
  return max(color, vec3(0.0));
}
`;

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
    description: 'Fluid architectural chrome with dark reflection valleys and narrow studio highlights.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float time = u_time * 0.12;
  float field = metalFbm(p * 0.86 + vec2(time, -time * 0.7));
  float fineField = metalFbm(p * 2.4 - vec2(time * 0.6, time));
  float displacement = (field - 0.5) * (0.34 + u_distortion * 0.84);
  float reflection = dot(p, normalize(vec2(0.28, 0.96)));
  reflection += displacement + (fineField - 0.5) * u_distortion * 0.17;
  reflection += sin(p.x * 1.55 - p.y * 0.72 + time) * 0.11 * u_distortion;
  float edgeDistance = length(p * vec2(0.72, 1.0));
  float fresnel = pow(smoothstep(0.42, 1.42, edgeDistance), 3.0) * u_contour * 0.24;
  float brush = (metalHash(vec2(floor(gl_FragCoord.y * 1.7), floor(gl_FragCoord.x * 0.018))) - 0.5) * 0.018;
  float polish = mix(0.7, 0.98, u_softness);
  vec3 color = metalTone(reflection, polish, fresnel, brush);
  color *= 1.0 - smoothstep(0.8, 1.72, edgeDistance) * 0.18;
  color = pow(color, vec3(0.92));
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'liquid-metal',
    name: 'Liquid metal',
  },
  {
    description: 'Calm mirror chrome with crisp black cards, white strip lights, and minimal movement.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float time = u_time * 0.055;
  float surface = (metalFbm(p * 1.15 + vec2(time, 0.0)) - 0.5) * u_distortion * 0.08;
  float reflection = p.y * 0.9 + p.x * 0.08 + surface + sin(p.x * 0.8 + time) * 0.035;
  float fresnel = pow(smoothstep(0.58, 1.55, length(p)), 4.0) * u_contour * 0.2;
  float microBrush = (metalHash(vec2(floor(gl_FragCoord.y * 2.2), floor(gl_FragCoord.x * 0.012))) - 0.5) * 0.009;
  vec3 color = metalTone(reflection, 0.995, fresnel, microBrush);
  color = pow(color, vec3(0.9));
  gl_FragColor = vec4(color, 1.0);
}`),
    id: 'polished-chrome',
    name: 'Polished chrome',
  },
  {
    description: 'Fine directional brushing under a broad, cool aluminum reflection.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float time = u_time * 0.045;
  float longBrush = metalNoise(vec2(p.x * 0.42 + time, gl_FragCoord.y * 0.72));
  float hairline = metalHash(vec2(floor(gl_FragCoord.y * 2.7), floor(gl_FragCoord.x * 0.026))) - 0.5;
  float reflection = p.y * 0.76 + sin(p.x * 0.72 + time) * 0.075 * u_distortion;
  reflection += (longBrush - 0.5) * 0.075;
  float environment = metalEnvironment(reflection, 0.36);
  float grain = hairline * mix(0.035, 0.095, u_contour) + (longBrush - 0.5) * 0.055;
  vec3 aluminum = mix(vec3(0.15, 0.17, 0.18), vec3(0.91, 0.93, 0.94), environment * 0.78 + 0.14);
  aluminum += grain;
  aluminum *= 0.92 + smoothstep(-1.0, 0.7, p.y) * 0.08;
  gl_FragColor = vec4(max(aluminum, vec3(0.0)), 1.0);
}`),
    id: 'brushed-aluminum',
    name: 'Brushed aluminum',
  },
  {
    description: 'Near-black nickel with restrained cool reflections and a precise silver edge.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float time = u_time * 0.07;
  float warp = (metalFbm(p * 1.08 + vec2(time, -time * 0.4)) - 0.5) * u_distortion * 0.24;
  float reflection = p.y * 0.94 + p.x * 0.13 + warp;
  float environment = metalEnvironment(reflection, 0.94);
  float edge = pow(smoothstep(0.52, 1.5, length(p)), 4.5) * (0.12 + u_contour * 0.24);
  float grain = (metalHash(vec2(floor(gl_FragCoord.y * 1.9), floor(gl_FragCoord.x * 0.015))) - 0.5) * 0.012;
  vec3 nickel = mix(vec3(0.006, 0.008, 0.011), vec3(0.42, 0.47, 0.5), environment * 0.7);
  nickel += pow(environment, 7.0) * vec3(0.62, 0.67, 0.7);
  nickel += edge + grain;
  gl_FragColor = vec4(max(nickel, vec3(0.0)), 1.0);
}`),
    id: 'black-nickel',
    name: 'Black nickel',
  },
  {
    description: 'Diffuse satin steel with soft architectural light and a low-contrast micrograin.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float time = u_time * 0.035;
  float brush = metalNoise(vec2(p.x * 0.3 + time, gl_FragCoord.y * 0.34));
  float reflection = p.y * 0.67 + (brush - 0.5) * 0.12 + sin(p.x * 0.55 + time) * 0.045;
  float environment = metalEnvironment(reflection, 0.12);
  float grain = (metalHash(vec2(floor(gl_FragCoord.y), floor(gl_FragCoord.x * 0.02))) - 0.5) * 0.04;
  vec3 steel = mix(vec3(0.2, 0.215, 0.225), vec3(0.79, 0.81, 0.82), environment * 0.58 + 0.2);
  steel += grain * (0.35 + u_contour * 0.45);
  steel = mix(steel, u_color_b, 0.055);
  gl_FragColor = vec4(max(steel, vec3(0.0)), 1.0);
}`),
    id: 'satin-steel',
    name: 'Satin steel',
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
    description: 'Directional brushed steel with multi-scale grain and a broad reflected softbox.',
    fragmentSource: fragment(`
${METAL_UTILITIES}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p *= u_scale;
  float brush = metalNoise(vec2(p.x * 0.34 + u_time * 0.025, gl_FragCoord.y * 0.52));
  float hairline = metalHash(vec2(floor(gl_FragCoord.y * 2.1), floor(gl_FragCoord.x * 0.018))) - 0.5;
  float bend = sin(p.x * 0.68 - u_time * 0.08) * u_distortion * 0.08;
  float reflection = p.y * 0.74 + bend + (brush - 0.5) * 0.12;
  float environment = metalEnvironment(reflection, mix(0.18, 0.52, u_softness));
  float edge = pow(smoothstep(0.58, 1.52, length(p)), 4.0) * u_contour * 0.18;
  vec3 color = mix(vec3(0.08, 0.09, 0.1), mix(vec3(0.7), u_color_b, 0.18), environment * 0.76 + 0.12);
  color += hairline * 0.07 + (brush - 0.5) * 0.045 + edge;
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
