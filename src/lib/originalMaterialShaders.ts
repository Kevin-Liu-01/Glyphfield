/**
 * GLSL ES 3.00 sources for Glyphfield's original WebGL2 materials.
 * Palette uniforms arrive in linear light (u_color_*) and OKLab (u_lab_*);
 * writeColor() applies brightness, a highlight shoulder, grain, sRGB encoding and dithering.
 */
import { SEAMLESS_POLAR_GLSL } from './liveMaterialPolar';

export const ORIGINAL_MATERIAL_IDS = [
  'holo-cloth-silk',
  'glyphfield-mesh-gradient',
  'glyphfield-grain-gradient',
  'glyphfield-dither-gradient',
  'shaders-pixel-beams',
  'shaders-soft-register',
  'shaders-spectral-bloom',
  'shaders-pistons',
  'shaders-fluid-chrome',
  'shaders-chroma-flow',
  'shaders-drift',
  'shaders-mosaic',
  'shaders-circuit',
  'study-line-field',
  'study-chrome-glares',
  'study-relief-gradient',
  'study-orbit-gradient',
  'study-radiant-void',
  'study-galactic-rings',
] as const;

export type OriginalMaterialId = (typeof ORIGINAL_MATERIAL_IDS)[number];

export const ORIGINAL_VERTEX_SOURCE = `#version 300 es
in vec2 a_position;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const PRELUDE = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform vec3 u_color_a;
uniform vec3 u_color_b;
uniform vec3 u_color_c;
uniform vec3 u_lab_a;
uniform vec3 u_lab_b;
uniform vec3 u_lab_c;
uniform float u_strength;
uniform float u_detail;
uniform float u_frequency;
uniform float u_grain;
uniform float u_amplitude;
uniform float u_density;
uniform float u_brightness;
uniform float u_rotation;
uniform float u_scale;

out vec4 fragColor;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;
// Patterns are sized in a 900px-tall reference frame so previews and large exports match.
const float REFERENCE_HEIGHT = 900.0;
const mat2 OCTAVE = mat2(1.6, 1.2, -1.2, 1.6);

${SEAMLESS_POLAR_GLSL}

// Hash without sine (Dave Hoskins, MIT): stable across GPUs, unlike fract(sin()).
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.103, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

vec3 hash33(vec3 p3) {
  p3 = fract(p3 * vec3(0.1031, 0.103, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yxx) * p3.zyx);
}

// Quintic gradient noise, roughly -1..1.
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0)) * 2.0 - 1.0, f - vec2(1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.6;
}

float gnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(hash33(i) * 2.0 - 1.0, f);
  float n100 = dot(hash33(i + vec3(1.0, 0.0, 0.0)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(hash33(i + vec3(0.0, 1.0, 0.0)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(hash33(i + vec3(1.0, 1.0, 0.0)) * 2.0 - 1.0, f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(hash33(i + vec3(0.0, 0.0, 1.0)) * 2.0 - 1.0, f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(hash33(i + vec3(1.0, 0.0, 1.0)) * 2.0 - 1.0, f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(hash33(i + vec3(0.0, 1.0, 1.0)) * 2.0 - 1.0, f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(hash33(i + vec3(1.0)) * 2.0 - 1.0, f - vec3(1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  ) * 1.5;
}

float fbm(vec2 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int index = 0; index < 6; index++) {
    if (index >= octaves) break;
    value += amplitude * gnoise(p);
    p = OCTAVE * p + 11.7;
    amplitude *= 0.5;
  }
  return value;
}

// Time is a third noise axis, so fields evolve instead of sliding.
float fbm(vec3 p, int octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int index = 0; index < 6; index++) {
    if (index >= octaves) break;
    value += amplitude * gnoise(p);
    p = vec3(OCTAVE * p.xy, p.z * 1.7) + 7.3;
    amplitude *= 0.5;
  }
  return value;
}

vec2 warp(vec2 p, float time, float amount, int octaves) {
  return p + vec2(fbm(vec3(p, time), octaves), fbm(vec3(p + vec2(5.2, 1.3), time), octaves)) * amount;
}

vec2 studioUvAt(vec2 fragCoord) {
  vec2 p = fragCoord / u_resolution.xy * 2.0 - 1.0;
  p.x *= u_resolution.x / u_resolution.y;
  p /= max(0.1, u_scale);
  float angle = radians(u_rotation);
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
}

vec2 studioUv() {
  return studioUvAt(gl_FragCoord.xy);
}

vec2 referenceCoord() {
  return gl_FragCoord.xy * (REFERENCE_HEIGHT / u_resolution.y);
}

vec2 referenceToFrag(vec2 reference) {
  return reference * (u_resolution.y / REFERENCE_HEIGHT);
}

vec3 oklabToLinear(vec3 lab) {
  float l = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s = lab.x - 0.0894841775 * lab.y - 1.291485548 * lab.z;
  l = l * l * l;
  m = m * m * m;
  s = s * s * s;
  return max(vec3(0.0), vec3(
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ));
}

vec3 paletteLab(float t) {
  t = clamp(t, 0.0, 1.0);
  return t < 0.5 ? mix(u_lab_a, u_lab_b, t * 2.0) : mix(u_lab_b, u_lab_c, t * 2.0 - 1.0);
}

// Perceptual three-stop ramp: no muddy midpoints between palette colors.
vec3 ramp(float t) {
  return oklabToLinear(paletteLab(t));
}

vec3 mixLab(vec3 from, vec3 to, float t) {
  return oklabToLinear(mix(from, to, t));
}

float luma(vec3 color) {
  return dot(color, vec3(0.2126, 0.7152, 0.0722));
}

vec3 spectrum(float phase) {
  vec3 display = 0.5 + 0.5 * cos(TAU * (phase + vec3(0.0, 0.33, 0.67)));
  return display * display;
}

float aastep(float edge, float value) {
  float width = max(fwidth(value), 1e-5) * 0.75;
  return smoothstep(edge - width, edge + width, value);
}

// Coverage of |offset| < halfWidth with a one-pixel soft edge.
float aaband(float offset, float halfWidth) {
  float width = max(fwidth(offset), 1e-5);
  return 1.0 - smoothstep(halfWidth - width, halfWidth + width, abs(offset));
}

int bayerIndex(ivec2 cell) {
  int x = cell.x & 7;
  int y = cell.y & 7;
  int z = x ^ y;
  return ((z & 1) << 5) | ((y & 1) << 4) | ((z & 2) << 2) | ((y & 2) << 1) | ((z & 4) >> 1) | ((y & 4) >> 2);
}

float bayer8(vec2 cell) {
  return (float(bayerIndex(ivec2(floor(cell)))) + 0.5) / 64.0;
}

vec3 linearToSrgb(vec3 color) {
  color = max(color, vec3(0.0));
  return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}

// Untouched below 0.82; brighter values roll off toward white instead of clipping.
vec3 highlightShoulder(vec3 color) {
  float peak = max(max(color.r, color.g), color.b);
  if (peak <= 0.82) return color;
  float mapped = 0.82 + 0.18 * (1.0 - exp(-(peak - 0.82) / 0.18));
  return mix(color * (mapped / peak), vec3(mapped), clamp((peak - 1.0) * 0.3, 0.0, 0.55));
}

void writeColorWithGrain(vec3 color, float grainAmount) {
  // Brightness keeps its display-space meaning from earlier versions.
  color = highlightShoulder(max(color, vec3(0.0)) * pow(max(u_brightness, 0.0), 2.2));
  vec3 display = linearToSrgb(color);
  float grainCell = max(1.0, u_resolution.y / 1100.0);
  vec2 grainCoord = floor(gl_FragCoord.xy / grainCell);
  float frame = mod(floor(u_time * 24.0), 61.0);
  float grain = hash12(grainCoord + frame * vec2(17.0, 59.0)) + hash12(grainCoord.yx + frame * vec2(41.0, 23.0)) - 1.0;
  float tone = luma(display);
  display += grain * (grainAmount / 100.0) * 0.2 * (0.55 + 1.8 * tone * (1.0 - tone));
  // Triangular one-step dither removes 8-bit banding from smooth gradients.
  display += (hash12(gl_FragCoord.xy + 0.37) + hash12(gl_FragCoord.xy * 1.31 + 19.19) - 1.0) / 255.0;
  fragColor = vec4(clamp(display, 0.0, 1.0), 1.0);
}

void writeColor(vec3 color) {
  writeColorWithGrain(color, u_grain);
}
`;

const BODIES: Record<OriginalMaterialId, string> = {
  'holo-cloth-silk': `
float clothFolds(vec2 p, float time) {
  float drift = fbm(vec3(p * 0.4, time * 0.1), 3);
  vec2 q = p + vec2(drift, drift * 0.4) * (0.7 + u_strength * 1.1);
  float frequency = 1.0 + u_frequency * 0.16;
  float height = sin(q.x * frequency + sin(q.y * 0.8 + time * 0.2) * 1.5 + time * 0.15);
  height += 0.5 * sin(q.x * frequency * 2.1 - q.y * 0.7 - time * 0.11 + 1.7);
  height += 0.18 * sin((q.x + q.y) * frequency * 3.6 + time * 0.09);
  return height * (0.16 + u_amplitude * 0.03);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.8;
  float epsilon = 0.005;
  float height = clothFolds(p, time);
  vec2 slope = vec2(clothFolds(p + vec2(epsilon, 0.0), time) - height, clothFolds(p + vec2(0.0, epsilon), time) - height) / epsilon;

  // Plain weave: warp and weft alternate over and under, faded out before it can alias.
  vec2 weave = referenceCoord() * (0.16 + u_density * 0.08);
  vec2 cell = floor(weave);
  vec2 local = fract(weave);
  bool warpOnTop = mod(cell.x + cell.y, 2.0) < 1.0;
  float across = warpOnTop ? local.x : local.y;
  float thread = sin(across * PI);
  float weaveVisible = 1.0 - smoothstep(0.35, 0.75, max(fwidth(weave.x), fwidth(weave.y)));
  vec2 threadTilt = (warpOnTop ? vec2(cos(across * PI), 0.0) : vec2(0.0, cos(across * PI))) * 0.3 * weaveVisible;

  vec3 normal = normalize(vec3(-slope + threadTilt, 1.0));
  vec2 pointer = (u_pointer * 2.0 - 1.0) * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec3 light = normalize(vec3(pointer - p * 0.5 + vec2(-0.3, 0.45), 1.0));
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float diffuse = max(dot(normal, light), 0.0);
  float cavity = smoothstep(-0.9, 0.7, height / (0.16 + u_amplitude * 0.03));

  // Kajiya-Kay sheen along the visible thread direction.
  vec3 tangent = normalize(warpOnTop ? vec3(0.0, 1.0, slope.y) : vec3(1.0, 0.0, slope.x));
  float alongHalf = dot(tangent, halfway);
  float sheen = pow(sqrt(max(0.0, 1.0 - alongHalf * alongHalf)), 64.0);
  float fresnel = pow(1.0 - max(normal.z, 0.0), 1.5);

  float phase = (1.0 - normal.z) * (4.0 + u_strength * 3.0) + height * 2.4 + p.x * 0.25 + u_time * 0.03;
  vec3 foil = spectrum(phase);
  vec3 base = ramp(diffuse * diffuse * 0.85 + cavity * 0.15);
  vec3 color = base * (0.18 + diffuse * 0.9) * (0.45 + cavity * 0.55);
  color *= mix(1.0, 0.84 + thread * 0.26, weaveVisible);
  color = mix(color, foil * (0.25 + diffuse * 0.9), (0.18 + u_strength * 0.35) * (0.3 + fresnel * 1.6));
  color += sheen * mix(u_color_c, foil, 0.6) * (0.35 + u_strength * 0.5) * cavity;
  writeColor(color);
}`,
  'glyphfield-mesh-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.22;
  vec2 q = warp(p * 0.55, time * 0.6, 0.45 + u_strength * 1.0, 3) / 0.55;
  vec3 labs[6] = vec3[6](
    u_lab_a,
    u_lab_b,
    u_lab_c,
    mix(u_lab_a, u_lab_b, 0.6),
    u_lab_a,
    mix(u_lab_b, u_lab_c, 0.45)
  );
  // Soft-max of moving color bodies: distinct regions, smooth seams.
  float radius = 0.4 + u_amplitude * 0.05;
  float sharpness = 0.45 + u_frequency * 0.06;
  vec3 lab = vec3(0.0);
  float total = 0.0;
  for (int index = 0; index < 6; index++) {
    float seed = float(index);
    vec2 center = vec2(
      cos(time * (0.7 + seed * 0.13) + seed * 2.1),
      sin(time * (0.6 + seed * 0.11) + seed * 1.3)
    ) * vec2(1.2, 0.85);
    vec2 delta = q - center;
    float weight = exp(-dot(delta, delta) / (radius * radius) * sharpness);
    lab += labs[index] * weight;
    total += weight;
  }
  lab /= max(total, 1e-4);
  // Slight chroma lift keeps blended regions vivid instead of grey.
  lab.yz *= 1.18;
  writeColor(oklabToLinear(lab));
}`,
  'glyphfield-grain-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.2;
  vec2 q = warp(p * (0.4 + u_detail * 0.05), time, 0.6 + u_strength * 1.2, 4);
  float field = fbm(vec3(q * 0.8, time * 0.7), 4) * 1.9 + 0.5;
  field += sin((p.x * 0.6 + p.y) * (0.5 + u_frequency * 0.1) + time * 1.4) * 0.22;
  // Grain dithers the gradient position itself, giving speckled, tactile transitions.
  vec2 cell = floor(gl_FragCoord.xy / max(1.0, u_resolution.y / 1000.0));
  float jitter = (hash12(cell) + hash12(cell + 71.3) - 1.0) * (0.05 + u_grain / 100.0 * 0.34);
  vec3 color = ramp(smoothstep(0.04, 0.96, field + jitter));
  writeColorWithGrain(color, u_grain * 0.45);
}`,
  'glyphfield-dither-gradient': `
void main() {
  float cellSize = mix(2.0, 9.0, clamp(u_grain / 100.0, 0.0, 1.0));
  vec2 cell = floor(referenceCoord() / cellSize);
  vec2 p = studioUvAt(referenceToFrag((cell + 0.5) * cellSize));
  float time = u_time * 0.3;
  vec2 q = warp(p * max(0.45, u_detail * 0.2), time, 0.4 + u_strength * 1.1, 3);
  float flow = 0.5 + 0.5 * sin((q.x + q.y * 0.38) * (0.6 + u_frequency * 0.22) + time);
  flow = mix(flow, fbm(vec3(q * 1.2, time * 0.5), 4) * 1.8 + 0.5, 0.4);
  float level = clamp(smoothstep(0.18, 0.95, flow), 0.0, 0.999) * 2.0;
  float index = floor(level) + step(bayer8(cell), fract(level));
  vec3 color = index < 0.5 ? u_color_a : index < 1.5 ? u_color_b : u_color_c;
  writeColorWithGrain(color, 0.0);
}`,
  'shaders-pixel-beams': `
void main() {
  float cellSize = mix(6.0, 26.0, clamp(u_grain / 100.0, 0.0, 1.0));
  vec2 reference = referenceCoord() / cellSize;
  vec2 cell = floor(reference);
  vec2 local = reference - cell;
  vec2 p = studioUvAt(referenceToFrag((cell + 0.5) * cellSize));
  float time = u_time;

  float plasma = sin(p.x * (0.8 + u_frequency * 0.2) + time * 0.9)
    + sin((p.y * 1.3 + p.x * 0.4) * (0.8 + u_detail * 0.16) - time * 0.7)
    + sin(length(p * vec2(1.0, 1.4)) * (1.6 + u_frequency * 0.25) - time * 1.3);
  plasma = smoothstep(0.1, 0.9, plasma / 6.0 + 0.5);

  // Broad light beams sweep across the plasma and resolve into dithered steps.
  float beams = 0.0;
  for (int index = 0; index < 3; index++) {
    float seed = float(index);
    float axis = dot(p, normalize(vec2(0.55 + seed * 0.2, 1.0)));
    float position = sin(time * (0.35 + seed * 0.12) + seed * 2.4) * 1.3;
    float width = 0.08 + u_amplitude * 0.02 + seed * 0.04;
    beams += exp(-pow((axis - position) / width, 2.0)) * (1.0 - seed * 0.25);
  }
  float value = clamp(plasma * (0.7 - u_strength * 0.2) + beams * (0.45 + u_strength * 0.45), 0.0, 1.0);

  float levels = 5.0;
  float quantized = floor(value * (levels - 1.0) + bayer8(cell)) / (levels - 1.0);
  vec3 lamp = ramp(quantized) * (0.55 + quantized * 0.75);

  vec2 edge = abs(local - 0.5);
  float pixelWidth = fwidth(reference.x);
  float shape = 1.0 - smoothstep(0.41 - pixelWidth, 0.41 + pixelWidth, max(edge.x, edge.y));
  shape = mix(shape, 0.92, smoothstep(0.2, 0.45, pixelWidth));
  vec3 color = mix(u_color_a * 0.4, lamp, shape);
  color += lamp * quantized * quantized * (1.0 - shape) * 0.45;
  writeColorWithGrain(color, 8.0);
}`,
  'shaders-soft-register': `
float screenDots(vec2 reference, float angle, float spacing, float tone) {
  vec2 rotated = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * reference / spacing;
  float dotDistance = length(fract(rotated) - 0.5);
  float radius = sqrt(clamp(tone, 0.0, 1.0)) * 0.66;
  float width = max(fwidth(rotated.x), 1e-4);
  float dots = 1.0 - smoothstep(radius - width, radius + width, dotDistance);
  return mix(dots, tone * 0.8, smoothstep(0.25, 0.5, width));
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.2;
  vec2 q = warp(p * 0.6 * max(0.7, u_detail * 0.32), time, 0.6 + u_strength * 1.4, 4) / 0.6;
  float flow = 0.5 + 0.5 * sin((q.x + q.y * 0.42) * (0.7 + u_frequency * 0.22) + time);
  float counter = 0.5 + 0.5 * sin((q.y - q.x * 0.3) * (0.6 + u_frequency * 0.18) - time * 0.8 + 1.3);

  // Risograph print: two halftone inks multiplied onto light paper, softly misregistered.
  vec2 reference = referenceCoord();
  float spacing = mix(26.0, 12.0, clamp(u_density / 1.5, 0.0, 1.0));
  vec2 registration = vec2(1.6, -1.1) * (0.8 + u_amplitude * 0.15);
  float inkB = screenDots(reference + registration, 0.26, spacing, smoothstep(0.1, 0.95, flow));
  float inkA = screenDots(reference, 1.31, spacing, smoothstep(0.25, 1.0, counter) * 0.85);
  vec3 paper = mixLab(u_lab_c, vec3(0.98, 0.0, 0.0), 0.5);
  vec3 color = paper;
  color *= mix(vec3(1.0), oklabToLinear(u_lab_b) / max(paper, vec3(0.02)), inkB * 0.92);
  color *= mix(vec3(1.0), oklabToLinear(mix(u_lab_a, u_lab_b, 0.25)) / max(paper, vec3(0.02)), inkA * 0.88);
  // Soft underlying wash keeps the tone continuous between dots.
  color = mix(color, ramp(0.3 + flow * 0.6), 0.12 + clamp(u_grain / 100.0, 0.0, 1.0) * 0.1);
  writeColorWithGrain(color, u_grain * 0.35);
}`,
  'shaders-spectral-bloom': `
float currents(vec2 p, float time) {
  vec2 q = p;
  for (int index = 0; index < 3; index++) {
    float seed = float(index);
    q += vec2(
      sin(q.y * (1.1 + seed * 0.35) + time * (0.5 + seed * 0.15) + seed),
      cos(q.x * (1.3 + seed * 0.3) - time * (0.4 + seed * 0.1) + seed * 2.0)
    ) * (0.22 + u_strength * 0.18) / (1.0 + seed);
  }
  float drift = fbm(vec3(q * (0.55 + u_detail * 0.07), time * 0.25), 4);
  return sin((q.x * 0.8 + q.y) * (0.9 + u_frequency * 0.12) + drift * 2.6);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.5;
  float dispersion = 0.016 + u_amplitude * 0.004;
  vec3 ribbons = vec3(currents(p + vec2(dispersion, 0.0), time), currents(p, time), currents(p - vec2(dispersion, 0.0), time));
  float width = 5.0 + u_density * 7.0;
  vec3 channelCore = exp(-ribbons * ribbons * width);
  float core = channelCore.g;
  float body = exp(-abs(ribbons.g) * 2.1);

  vec3 color = u_color_a * (0.55 + 0.45 * exp(-dot(p, p) * 0.18));
  color += u_color_b * (body * 0.5 + core * 0.85) * (0.75 + u_strength * 0.5);
  color += u_color_c * core * core * core * 1.8;
  // Channel-separated cores leave spectral fringes on either side of each current.
  color += (channelCore - vec3(core)) * mix(u_color_c, vec3(1.0), 0.5) * 1.1;
  color *= 1.0 - smoothstep(0.9, 2.1, length(p)) * 0.55;
  writeColor(color);
}`,
  'shaders-pistons': `
void main() {
  vec2 p = studioUv();
  float time = u_time;
  vec2 focus = vec2(-1.15, -0.85);
  vec2 delta = p - focus;
  float radius = length(delta);
  float rays = max(6.0, floor(u_frequency * 2.6));
  float spoke = atan(delta.y, delta.x) / (PI * 0.5) * rays;
  float id = floor(spoke);
  float across = fract(spoke) - 0.5;
  float seed = hash12(vec2(id, 7.0));
  float halfWidth = 0.08 + seed * 0.24 * (0.6 + u_density * 0.5);
  float ray = aaband(across, halfWidth);

  float stroke = 0.5 + 0.5 * sin(time * (0.6 + seed * 1.4) + seed * TAU);
  float reach = 0.9 + stroke * (1.5 + u_amplitude * 0.14);
  ray *= 1.0 - aastep(reach, radius);
  float tip = exp(-abs(radius - reach) * 9.0) * ray;

  // Paper tooth breaks the ink like a dry press.
  vec2 reference = referenceCoord();
  float fiber = fbm(reference * vec2(0.012, 0.05), 4) + fbm(reference * 0.11, 3) * 0.5;
  float tooth = smoothstep(-0.32 - u_strength * 0.25, 0.28, fiber + 0.15);
  vec3 paper = u_color_a * (1.0 + fiber * 0.18);
  vec3 ink = mixLab(u_lab_b, u_lab_c, seed * 0.8 + stroke * 0.2);
  vec3 color = mix(paper, ink, ray * tooth);
  color += u_color_c * tip * 0.35 * tooth;
  writeColor(color);
}`,
  'shaders-fluid-chrome': `
vec3 studioEnvironment(vec3 direction, vec2 p) {
  float y = direction.y + p.y * 0.28;
  float x = direction.x + p.x * 0.12;
  vec3 floorTone = mix(vec3(0.003), u_color_a, 0.3);
  vec3 skyTone = mix(vec3(0.42), u_color_b, 0.3);
  vec3 environment = mix(floorTone, skyTone, smoothstep(-0.45, 0.85, y));
  float card = exp(-pow((y + 0.04) / 0.16, 2.0));
  environment *= 1.0 - card * 0.92;
  float stripA = exp(-pow((y - 0.24 + x * 0.12) / 0.03, 2.0));
  float stripB = exp(-pow((y + 0.46 - x * 0.08) / 0.018, 2.0));
  float stripC = exp(-pow((x - 0.62) / 0.05, 2.0)) * smoothstep(-0.7, 0.3, y);
  environment += (stripA * 3.6 + stripB * 2.2 + stripC * 2.4) * mix(vec3(1.0), u_color_c, 0.12);
  return environment;
}

float chromeSurface(vec2 p, float time) {
  vec2 q = warp(p * (0.32 + u_detail * 0.03), time, 0.3 + u_strength * 0.6, 2);
  return fbm(vec3(q * 0.75, time * 0.6), 3) * (0.3 + u_amplitude * 0.035);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.12;
  float epsilon = 0.008;
  float height = chromeSurface(p, time);
  vec2 slope = vec2(chromeSurface(p + vec2(epsilon, 0.0), time) - height, chromeSurface(p + vec2(0.0, epsilon), time) - height) / epsilon;
  vec3 normal = normalize(vec3(-slope * 1.1, 1.0));
  vec3 reflected = reflect(vec3(0.0, 0.0, -1.0), normal);
  float fresnel = 0.6 + 0.4 * pow(1.0 - max(normal.z, 0.0), 5.0);
  vec3 color = studioEnvironment(reflected, p) * fresnel * mix(vec3(1.0), u_color_b, 0.18);
  // Fine brushed grain in reference units.
  vec2 reference = referenceCoord();
  color *= 1.0 + (hash12(vec2(floor(reference.y * 0.9), floor(reference.x * 0.02))) - 0.5) * 0.05;
  writeColor(color);
}`,
  'shaders-chroma-flow': `
vec3 chromaField(vec2 p, float time) {
  vec2 q = warp(p * 0.5, time, 0.7 + u_strength * 1.3, 3);
  float band = 0.5 + 0.5 * sin(q.y * (1.4 + u_detail * 0.2) + q.x * 0.9 + time * 1.2);
  return ramp(smoothstep(0.05, 0.95, band));
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.25;
  float flutes = 3.0 + u_frequency * 0.9;
  float flute = p.x * flutes * 0.5;
  float across = fract(flute) - 0.5;
  // Each flute is a cylindrical lens: a compressed, shifted copy of the field behind it.
  float lens = across * (0.5 + u_amplitude * 0.06) / flutes;
  float dispersion = 1.0 + 0.18 * (0.4 + u_strength);
  vec2 samplePoint = p + vec2(lens * 2.0, 0.0);
  vec3 color = vec3(
    chromaField(samplePoint + vec2(lens * (dispersion - 1.0) * 6.0, 0.0), time).r,
    chromaField(samplePoint, time).g,
    chromaField(samplePoint - vec2(lens * (dispersion - 1.0) * 6.0, 0.0), time).b
  );
  float shade = 0.82 + 0.3 * cos(across * PI * 1.6);
  float edgeDistance = 0.5 - abs(across);
  float edge = 1.0 - smoothstep(0.0, fwidth(flute) * 1.5, edgeDistance);
  float highlight = exp(-pow((across + 0.28) / 0.07, 2.0));
  color *= shade;
  color += highlight * mix(vec3(1.0), u_color_c, 0.4) * 0.22;
  color = mix(color, color * 0.45, edge * 0.7);
  writeColor(color);
}`,
  'shaders-drift': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.35;
  vec2 q = p + vec2(0.0, 0.95);
  float rise = q.y;
  vec2 smoke = vec2(q.x * (1.2 + u_detail * 0.12), q.y * 0.9 - time);
  vec2 curl = vec2(fbm(vec3(smoke * 0.8, time * 0.4), 4), fbm(vec3(smoke * 0.8 + 4.0, time * 0.4), 4));
  smoke += curl * (0.6 + u_strength * 1.0) * smoothstep(0.0, 1.2, rise);
  float density = fbm(vec3(smoke * 1.4, time * 0.3), 5) * 0.9 + 0.5;
  float width = 0.2 + rise * (0.32 + u_amplitude * 0.03);
  float column = exp(-pow((q.x + curl.x * 0.5 * rise) / width, 2.0));
  float body = smoothstep(0.3, 0.85, density) * column;
  body *= smoothstep(-0.05, 0.3, rise) * (1.0 - smoothstep(1.7, 2.8, rise));
  float shadowed = fbm(vec3((smoke + vec2(-0.07, 0.09)) * 1.4, time * 0.3), 5) * 0.9 + 0.5;
  float light = clamp(0.55 + (density - shadowed) * 3.5, 0.0, 1.0);
  vec3 background = u_color_a * (0.75 + 0.25 * exp(-dot(p, p) * 0.3));
  vec3 plume = mixLab(u_lab_b, u_lab_c, light);
  vec3 color = mix(background, plume, body * (0.55 + u_density * 0.45));
  color += u_color_c * body * light * light * 0.25;
  writeColor(color);
}`,
  'shaders-mosaic': `
void main() {
  float tile = mix(14.0, 64.0, clamp(u_grain / 100.0, 0.0, 1.0));
  vec2 reference = referenceCoord() / tile;
  vec2 cell = floor(reference);
  vec2 local = reference - cell;
  vec2 p = studioUvAt(referenceToFrag((cell + 0.5) * tile));
  float time = u_time * 0.2;
  float swirl = fbm(vec3(p * (0.6 + u_detail * 0.1), time), 4);
  float tone = 0.5 + 0.5 * sin((p.x + p.y + swirl * (1.5 + u_strength * 3.0)) * (0.6 + u_frequency * 0.15) + time * 2.0);
  vec3 glass = ramp(smoothstep(0.08, 0.92, tone));

  vec2 edge = abs(local - 0.5);
  float pixelWidth = fwidth(reference.x);
  float inside = 1.0 - smoothstep(0.44 - pixelWidth, 0.44 + pixelWidth, max(edge.x, edge.y));
  vec2 bevel = sign(local - 0.5) * smoothstep(0.28, 0.44, edge);
  float bevelVisible = 1.0 - smoothstep(0.08, 0.2, pixelWidth);
  vec3 color = glass * (1.0 + dot(bevel, vec2(-0.6, 0.7)) * 0.4 * bevelVisible);
  float gloss = pow(max(0.0, 1.0 - length(local - vec2(0.32, 0.7)) * 2.4), 3.0);
  color += gloss * mix(vec3(1.0), u_color_c, 0.4) * 0.14 * bevelVisible;
  color = mix(u_color_a * 0.3, color, mix(inside, 1.0, 1.0 - bevelVisible));
  writeColorWithGrain(color, 8.0);
}`,
  'shaders-circuit': `
float gridLine(float gap, float pixel, float halfWidth) {
  return 1.0 - smoothstep(halfWidth - pixel, halfWidth + pixel, gap);
}

float packet(float along, float lane, float time) {
  float speed = 0.35 + hash12(vec2(lane, 4.0)) * 0.7;
  float position = fract(along * 0.16 - time * speed + hash12(vec2(lane, 1.7)));
  return pow(1.0 - abs(position * 2.0 - 1.0), 16.0) * step(0.45, hash12(vec2(lane, 9.1)));
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.3;
  vec2 w = warp(p * 0.6 * max(0.7, u_detail * 0.3), time, 0.15 + u_strength * 0.5, 3) / 0.6;
  vec2 grid = w * max(3.0, u_frequency * 0.9);
  vec2 local = fract(grid) - 0.5;
  vec2 gap = 0.5 - abs(local);
  vec2 pixel = max(fwidth(grid), vec2(1e-4));
  float halfWidth = 0.014 + u_amplitude * 0.002;
  float vertical = gridLine(gap.x, pixel.x, halfWidth);
  float horizontal = gridLine(gap.y, pixel.y, halfWidth);
  float lines = max(vertical, horizontal);
  float glow = exp(-min(gap.x, gap.y) * 16.0);
  float energy = horizontal * packet(grid.x, floor(grid.y + 0.5), time)
    + vertical * packet(grid.y, floor(grid.x + 0.5) + 31.0, time);
  float node = gridLine(length(gap), max(pixel.x, pixel.y), 0.05);
  float field = 0.5 + 0.5 * sin((w.x - w.y) * 1.4 + time * 2.0 + fbm(vec3(w, time), 3) * 2.0);
  vec3 color = mix(u_color_a, mixLab(u_lab_a, u_lab_b, 0.4), field * 0.55);
  color += u_color_b * (lines * 0.55 + glow * 0.2);
  color += u_color_c * (energy * 3.2 + node * 0.9 + glow * energy * 1.5);
  writeColor(color);
}`,
  'study-line-field': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.3;
  vec2 q = warp(p * 0.55 * max(0.7, u_detail * 0.3), time, 0.5 + u_strength * 1.0, 4) / 0.55;
  float field = fbm(vec3(q * 0.5, time * 0.5), 4) * 1.4 + q.y * 0.35;
  float bands = field * (2.0 + u_frequency * 0.6);
  float pixel = max(fwidth(bands), 1e-4);
  float gap = abs(fract(bands + 0.5) - 0.5);
  float core = (1.0 - smoothstep(pixel * 0.45, pixel * 1.4, gap)) * (1.0 - smoothstep(0.22, 0.5, pixel));
  float halo = exp(-gap / pixel / (5.0 + u_amplitude));
  float level = floor(bands + 0.5);
  vec3 lineColor = ramp(0.45 + 0.55 * fract(level * 0.27 + 0.13));
  vec3 color = u_color_a * (0.7 + 0.3 * exp(-dot(p, p) * 0.25));
  color += lineColor * (core * 1.5 + halo * (0.22 + u_strength * 0.2));
  writeColor(color);
}`,
  'study-chrome-glares': `
vec3 glareEnvironment(vec3 direction, vec2 p, float time) {
  float y = direction.y + p.y * 0.22;
  float x = direction.x;
  vec3 environment = mix(mix(vec3(0.004), u_color_a, 0.3), mix(vec3(0.5), u_color_b, 0.3), smoothstep(-0.7, 0.8, y));
  float sweep = sin(time * 0.6) * 0.35;
  float cardA = exp(-pow((y - 0.32 - sweep) / 0.06, 2.0));
  float cardB = exp(-pow((y + 0.2 - sweep * 0.6) / 0.035, 2.0));
  float cardC = exp(-pow((y + 0.55 + sweep * 0.4) / 0.08, 2.0)) * 0.6;
  float glare = exp(-pow((x + y * 0.4 - 0.3 + sweep) / 0.08, 2.0));
  float dark = exp(-pow((y - 0.05) / 0.1, 2.0));
  environment *= 1.0 - dark * 0.85;
  environment += (cardA * 2.6 + cardB * 2.2 + cardC) * mix(vec3(1.0), u_color_c, 0.18);
  environment += glare * mix(vec3(1.0), u_color_c, 0.35) * 1.8;
  return environment;
}

float ribbons(vec2 p, float time) {
  float folds = sin(p.x * (0.7 + u_frequency * 0.08) + sin(p.y * 0.6 + time) * 0.9 + time * 0.5) * 0.5;
  folds += sin(p.y * 1.1 - p.x * 0.35 - time * 0.4) * 0.3;
  folds += fbm(vec3(p * (0.35 + u_detail * 0.03), time * 0.5), 2) * (0.25 + u_strength * 0.35);
  return folds * (0.16 + u_amplitude * 0.02);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.12;
  float epsilon = 0.008;
  float height = ribbons(p, time);
  vec2 slope = vec2(ribbons(p + vec2(epsilon, 0.0), time) - height, ribbons(p + vec2(0.0, epsilon), time) - height) / epsilon;
  vec3 normal = normalize(vec3(-slope * 1.6, 1.0));
  vec3 reflected = reflect(vec3(0.0, 0.0, -1.0), normal);
  float fresnel = 0.62 + 0.38 * pow(1.0 - max(normal.z, 0.0), 5.0);
  vec3 color = glareEnvironment(reflected, p, u_time * 0.12) * fresnel * mix(vec3(1.0), u_color_b, 0.15);
  writeColor(color);
}`,
  'study-relief-gradient': `
float relief(vec2 p, float time) {
  vec2 q = warp(p * (0.4 + u_detail * 0.04), time, 0.35 + u_strength * 0.6, 2);
  float phase = (q.x * 0.7 + q.y * 0.42) * (1.4 + u_frequency * 0.28) + fbm(vec3(q, time * 0.7), 3) * 2.4;
  // Rounded ridges with soft valleys, like pressed paper.
  return 1.0 - pow(abs(sin(phase)), 0.7);
}

void main() {
  vec2 p = studioUv();
  float time = u_time * 0.18;
  float epsilon = 0.003;
  float height = relief(p, time);
  vec2 slope = vec2(relief(p + vec2(epsilon, 0.0), time) - height, relief(p + vec2(0.0, epsilon), time) - height) / epsilon;
  vec3 normal = normalize(vec3(-slope * (0.05 + u_amplitude * 0.012), 1.0));
  vec3 light = normalize(vec3(-0.65, 0.7, 0.42));
  float diffuse = max(dot(normal, light), 0.0);
  float specular = pow(max(dot(reflect(-light, normal), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float tint = fbm(vec3(p * 0.35, time * 0.4), 3) * 1.6 + 0.5;
  vec3 albedo = ramp(clamp(tint * 0.7 + height * 0.3, 0.0, 1.0));
  float occlusion = 0.55 + 0.45 * height;
  vec3 color = albedo * (0.1 + 1.15 * diffuse) * occlusion;
  color += specular * mix(vec3(1.0), u_color_c, 0.5) * 0.4 * height;
  writeColor(color);
}`,
  'study-orbit-gradient': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.25;
  vec2 q = warp(p * 0.7, time * 0.5, 0.22 + u_strength * 0.35, 3) / 0.7;
  float orbit = 0.42 + u_amplitude * 0.04;
  vec3 labs[4] = vec3[4](u_lab_b, u_lab_c, mix(u_lab_b, u_lab_c, 0.5), mix(u_lab_a, u_lab_b, 0.7));
  float softness = 0.07 + u_density * 0.05;
  vec3 color = u_color_a * 0.8;
  for (int index = 0; index < 4; index++) {
    float seed = float(index);
    float angle = time * (0.9 - seed * 0.17) * (mod(seed, 2.0) < 1.0 ? 1.0 : -1.0) + seed * 1.7;
    vec2 center = vec2(cos(angle), sin(angle * 0.9)) * orbit * (0.75 + seed * 0.25);
    vec2 delta = q - center;
    float body = exp(-dot(delta, delta) / softness);
    // Bodies composite like light passing through tinted glass: blend, then add a soft core.
    color = mix(color, oklabToLinear(labs[index]), body * 0.85);
    color += oklabToLinear(labs[index]) * body * body * (0.1 + u_strength * 0.25);
  }
  writeColor(color);
}`,
  'study-radiant-void': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.2;
  float radius = length(p);
  vec2 direction = p / max(radius, 1e-4);
  float rim = 0.5 + u_amplitude * 0.018;
  // Sampling noise on the unit circle keeps the corona seamless around the angle.
  float streaks = fbm(vec3(direction * (1.4 + u_frequency * 0.22), time * 0.5), 4) * 0.9 + 0.5;
  float fine = gnoise(vec3(direction * 9.0, time * 0.3 - radius * 0.6)) * 0.5 + 0.5;
  float rays = clamp(streaks * 0.75 + fine * 0.35, 0.0, 1.4);
  float outside = max(radius - rim, 0.0);
  float corona = exp(-outside * (3.4 - u_strength * 1.3) / (0.35 + rays * 0.9)) * smoothstep(rim - 0.015, rim + 0.01, radius);
  float ring = exp(-pow((radius - rim) / (0.012 + rays * 0.012), 2.0));
  float aperture = 1.0 - smoothstep(rim - 0.08, rim, radius);
  vec3 color = u_color_a * (0.55 + 0.45 * exp(-outside * 1.6)) * (1.0 - aperture * 0.92);
  color += u_color_b * corona * (0.45 + rays * 0.9);
  color += u_color_c * ring * (1.6 + rays * 1.4);
  // Spectral grain: per-channel speckle in the glowing region only.
  vec2 reference = floor(referenceCoord());
  vec3 speckle = hash33(vec3(reference, mod(floor(u_time * 24.0), 61.0))) - 0.5;
  color += speckle * corona * (u_grain / 100.0) * 0.18;
  writeColor(color);
}`,
  'study-galactic-rings': `
void main() {
  vec2 p = studioUv();
  float time = u_time * 0.2;
  vec2 q = warp(p * 0.7, time, 0.18 + u_strength * 0.35, 4) / 0.7;
  float radius = length(q);
  float angle = atan(q.y, q.x);
  float frequency = 3.0 + u_frequency * 0.5;
  float swirl = seamlessAngularWarp(angle, time * 0.5) * 0.08;
  vec3 radii = radius + swirl + vec3(-1.0, 0.0, 1.0) * (0.01 + u_amplitude * 0.0025);
  vec3 rings = 0.5 + 0.5 * cos(radii * frequency * PI - time * 2.0);
  vec3 crest = pow(rings, vec3(9.0));
  vec3 color = ramp(0.1 + rings.g * 0.65) * (0.45 + 0.4 * rings.g);
  color += crest * mix(vec3(1.0), u_color_c, 0.45) * 1.1;
  color += u_color_b * exp(-radius * 2.4) * 0.25;
  color *= 1.0 - smoothstep(1.0, 1.95, radius) * 0.6;
  vec2 star = floor(referenceCoord() / 1.5);
  float twinkle = 0.6 + 0.4 * sin(u_time * 3.0 + hash12(star) * TAU);
  color += step(0.9984, hash12(star)) * twinkle * mix(vec3(1.0), u_color_c, 0.3) * 0.9;
  writeColor(color);
}`,
};

export function isOriginalMaterialId(id: string): id is OriginalMaterialId {
  return (ORIGINAL_MATERIAL_IDS as readonly string[]).includes(id);
}

export function originalFragmentSource(id: OriginalMaterialId): string {
  return `${PRELUDE}${BODIES[id]}`;
}
