import * as THREE from 'three';

import type { StickerFinishSettings } from '@/lib/surfaceSticker';

const SEGMENTS = 96;
const MAX_DISTANCE = 112;

const PEEL_ANGLES: Record<StickerFinishSettings['peelDirection'], number> = {
  'top-right': (225 * Math.PI) / 180,
  top: (270 * Math.PI) / 180,
  'top-left': (315 * Math.PI) / 180,
  left: 0,
  'bottom-left': (45 * Math.PI) / 180,
  bottom: (90 * Math.PI) / 180,
  'bottom-right': (135 * Math.PI) / 180,
  right: Math.PI,
};

/** Exact Euclidean distance transform using Felzenszwalb's linear-time EDT. */
export function exactDistanceTransform(inside: Uint8Array, width: number, height: number): Float32Array {
  const infinity = 1e20;
  const squared = new Float64Array(width * height);
  for (let index = 0; index < squared.length; index += 1) squared[index] = inside[index] ? 0 : infinity;
  const length = Math.max(width, height);
  const f = new Float64Array(length);
  const distance = new Float64Array(length);
  const sites = new Int32Array(length);
  const boundaries = new Float64Array(length + 1);

  function transformLine(size: number) {
    let siteIndex = 0;
    sites[0] = 0;
    boundaries[0] = -infinity;
    boundaries[1] = infinity;
    for (let q = 1; q < size; q += 1) {
      let boundary = (f[q] + q * q - (f[sites[siteIndex]] + sites[siteIndex] ** 2)) / (2 * q - 2 * sites[siteIndex]);
      while (boundary <= boundaries[siteIndex]) {
        siteIndex -= 1;
        boundary = (f[q] + q * q - (f[sites[siteIndex]] + sites[siteIndex] ** 2)) / (2 * q - 2 * sites[siteIndex]);
      }
      siteIndex += 1;
      sites[siteIndex] = q;
      boundaries[siteIndex] = boundary;
      boundaries[siteIndex + 1] = infinity;
    }
    siteIndex = 0;
    for (let q = 0; q < size; q += 1) {
      while (boundaries[siteIndex + 1] < q) siteIndex += 1;
      const delta = q - sites[siteIndex];
      distance[q] = delta * delta + f[sites[siteIndex]];
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = squared[y * width + x];
    transformLine(height);
    for (let y = 0; y < height; y += 1) squared[y * width + x] = distance[y];
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) f[x] = squared[y * width + x];
    transformLine(width);
    for (let x = 0; x < width; x += 1) squared[y * width + x] = distance[x];
  }

  const result = new Float32Array(width * height);
  for (let index = 0; index < result.length; index += 1) result[index] = Math.sqrt(squared[index]);
  return result;
}

function buildDistanceField(data: Uint8ClampedArray, width: number, height: number, tolerance: number) {
  const pad = MAX_DISTANCE;
  const fieldWidth = width + pad * 2;
  const fieldHeight = height + pad * 2;
  const ink = new Uint8Array(fieldWidth * fieldHeight);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] > 40) ink[(y + pad) * fieldWidth + x + pad] = 1;
    }
  }
  let distance = exactDistanceTransform(ink, fieldWidth, fieldHeight);
  if (tolerance > 0.5) {
    const outsideDilated = new Uint8Array(fieldWidth * fieldHeight);
    for (let index = 0; index < distance.length; index += 1) outsideDilated[index] = distance[index] <= tolerance ? 0 : 1;
    const distanceFromOutside = exactDistanceTransform(outsideDilated, fieldWidth, fieldHeight);
    const closed = new Uint8Array(fieldWidth * fieldHeight);
    for (let index = 0; index < closed.length; index += 1) closed[index] = distanceFromOutside[index] > tolerance ? 1 : 0;
    distance = exactDistanceTransform(closed, fieldWidth, fieldHeight);
  }
  return { distance, fieldWidth, pad };
}

const VERTEX_SHADER = /* glsl */ `
out vec2 vUv;
out vec3 vNormal;
out vec3 vWorldPosition;
out float vLift;
uniform float uCurlHeight;
void main() {
  vUv = uv;
  vNormal = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPosition = world.xyz;
  vLift = clamp(position.z / max(uCurlHeight, 0.0001), 0.0, 1.0);
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

/*
 * Adapted from HoloSticker's MIT-licensed two-layer foil model by Justin
 * Levine: ink-tinted metal, broad diffraction pooling, micro-facets, print
 * relief, and a view-dependent laminate flare. The palette and lighting are
 * tuned for Glyphfield's neutral studio.
 */
const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
in vec2 vUv;
in vec3 vNormal;
in vec3 vWorldPosition;
in float vLift;
out vec4 outColor;

uniform sampler2D uMap;
uniform sampler2D uHeight;
uniform vec3 uCamera;
uniform float uTime;
uniform float uHolo;
uniform float uBands;
uniform float uHue;
uniform float uGrain;
uniform float uPattern;
uniform float uOverlay;
uniform float uInk;
uniform float uRelief;
uniform float uMetalness;
uniform float uRoughness;
uniform float uPeel;
uniform vec2 uLight;

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int i = 0; i < 4; i++) {
    value += noise21(p) * amplitude;
    p = p * 2.07 + vec2(17.7, 31.4);
    amplitude *= 0.46;
  }
  return value;
}
vec3 srgbToLinear(vec3 color) { return pow(color, vec3(2.2)); }
vec3 linearToSrgb(vec3 color) { return pow(max(color, 0.0), vec3(1.0 / 2.2)); }
float stickerLuminance(vec3 color) { return dot(color, vec3(0.2126, 0.7152, 0.0722)); }

vec3 studioReflection(vec3 ray, float roughness) {
  float ceiling = smoothstep(-0.25, 0.88, ray.y);
  float key = pow(max(dot(normalize(ray), normalize(vec3(-0.52, 0.68, 0.52))), 0.0), mix(70.0, 9.0, roughness));
  float rim = pow(max(dot(normalize(ray), normalize(vec3(0.74, 0.22, 0.64))), 0.0), mix(90.0, 12.0, roughness));
  return vec3(0.11, 0.12, 0.15) + ceiling * vec3(0.42, 0.45, 0.52) + key * vec3(2.8) + rim * vec3(0.75, 0.9, 1.35);
}
float patternPhase(vec2 uv) {
  float movement = uTime * 0.025;
  if (uPattern < 0.5) return dot(uv - uLight, normalize(vec2(0.83, 0.56))) * uBands + fbm(uv * 3.8) * 1.6 + movement;
  if (uPattern < 1.5) return length(uv - uLight) * uBands * 1.55 + fbm(uv * 4.2) * 1.25 + movement;
  vec2 warp = vec2(fbm(uv * 3.1), fbm(uv * 3.1 + 8.7));
  return fbm(uv * (uBands * 0.3) + warp * 2.1) * 7.0 + movement;
}
float facetPhase(vec2 uv) {
  if (uOverlay < 0.5) return 0.0;
  if (uOverlay < 1.5) {
    vec2 grid = uv * 9.0;
    vec2 cell = floor(grid);
    float triangle = step(fract(grid.x) + fract(grid.y), 1.0);
    return hash21(cell + triangle * 0.37) * 0.9;
  }
  if (uOverlay < 2.5) return hash21(floor(uv * 8.0)) * 0.9;
  return hash21(vec2(floor(dot(uv, normalize(vec2(1.0, 0.58))) * 18.0), 2.0)) * 0.9;
}
vec3 rainbow(float phase) {
  phase = 6.2831853 * phase;
  return 0.5 + 0.5 * vec3(sin(phase), sin(phase + 2.094), sin(phase + 4.188));
}
vec3 reliefNormal(vec3 normal, vec3 position, vec2 uv) {
  float stepSize = 2.4 / 1024.0;
  float center = textureLod(uHeight, uv, 1.6).r;
  vec2 gradient = vec2(textureLod(uHeight, uv + vec2(stepSize, 0.0), 1.6).r - center, textureLod(uHeight, uv + vec2(0.0, stepSize), 1.6).r - center);
  vec3 dp1 = dFdx(position), dp2 = dFdy(position);
  vec2 duv1 = dFdx(uv), duv2 = dFdy(uv);
  vec3 t = cross(dp2, normal) * duv1.x + cross(normal, dp1) * duv2.x;
  vec3 b = cross(dp2, normal) * duv1.y + cross(normal, dp1) * duv2.y;
  float scale = inversesqrt(max(dot(t, t), dot(b, b)) + 0.0000001);
  return normalize(normal - (t * gradient.x + b * gradient.y) * scale * uRelief * 5.0);
}

void main() {
  vec4 sampled = texture(uMap, vUv);
  if (sampled.a < 0.03) discard;
  vec3 base = srgbToLinear(sampled.rgb);
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(uCamera - vWorldPosition);

  if (!gl_FrontFacing) {
    normal = -normal;
    vec3 reflected = studioReflection(reflect(-view, normal), 0.12);
    float facing = clamp(dot(normal, view), 0.0, 1.0);
    vec3 film = rainbow((1.0 - facing) * 1.3 + patternPhase(vUv) * 0.16 + uHue + (1.0 - vLift) * 0.2);
    outColor = vec4(linearToSrgb(vec3(0.23) + reflected * mix(vec3(0.65), film, uHolo) * 0.78), sampled.a);
    return;
  }

  if (uRelief > 0.005) normal = reliefNormal(normal, vWorldPosition, vUv);
  vec3 reflectedRay = reflect(-view, normal);
  float facing = clamp(dot(normal, view), 0.0, 1.0);
  float brightness = stickerLuminance(base);
  base = mix(base, base * base, max(uInk - 1.0, 0.0) * (1.0 - brightness) * 0.8);

  float fresnel = mix(0.045, 0.88, uMetalness) + (1.0 - mix(0.045, 0.88, uMetalness)) * pow(1.0 - facing, 5.0);
  vec3 environment = studioReflection(reflectedRay, uRoughness);
  vec3 lightDirection = normalize(vec3((uLight.x - 0.5) * 2.4, (uLight.y - 0.5) * 2.4, 1.5));
  float diffuseLight = 0.48 + max(dot(normal, lightDirection), 0.0) * 0.62;
  float key = pow(max(dot(reflectedRay, lightDirection), 0.0), mix(120.0, 18.0, uRoughness));

  float pool = smoothstep(0.34, 0.7, fbm(vUv * (1.4 + uBands * 0.12) + vec2(fbm(vUv * 3.4), fbm(vUv * 3.4 + 9.2)) * 1.7));
  float phase = 0.34 + (1.0 - facing) * 1.18 + patternPhase(vUv) * 0.18 + facetPhase(vUv) + dot(reflectedRay.xy, vec2(0.8, 0.6)) * uBands * 0.12 + uHue;
  vec3 film = rainbow(phase);
  float darkInk = clamp(1.0 - brightness / 0.62, 0.0, 1.0);
  vec3 diffuse = base * (1.0 - uMetalness * 0.42) * diffuseLight;
  vec3 specularTint = mix(vec3(1.0), base * 1.2 + 0.08, darkInk * 0.72);
  vec3 specular = (environment * (1.0 - uRoughness * 0.62) + key * 0.85) * specularTint * fresnel;
  specular += environment * mix(vec3(1.0), film, 0.78) * uHolo * 0.32;
  vec3 flare = environment * film * uHolo * pool * 2.1 * mix(0.56, 1.0, brightness);

  if (uGrain > 0.01) {
    vec2 cell = floor(vUv * 720.0);
    float seed = hash21(cell);
    float mask = smoothstep(1.0 - uGrain * 0.56, 1.0, seed);
    float twinkle = pow(0.5 + 0.5 * sin(seed * 31.0 + facing * 49.0 + uTime * 0.8), 18.0);
    flare += mix(vec3(1.0), film, 0.8) * mask * (0.22 + twinkle * 2.8) * uGrain;
  }

  float inkCover = max(uInk - 1.0, 0.0) * (1.0 - brightness);
  vec3 color = diffuse + (specular + flare) * (1.0 - inkCover * 0.84);
  color *= mix(0.9, 1.0, vLift + (1.0 - uPeel));
  outColor = vec4(linearToSrgb(color), sampled.a);
}`;

function finishParameters(id: StickerFinishSettings['presetId']) {
  if (id === 'mirror-chrome' || id === 'precision-metal-inset') return { metalness: 1, roughness: 0.045 };
  if (id === 'soft-touch') return { metalness: 0.04, roughness: 0.82 };
  if (id === 'clear-frost') return { metalness: 0.12, roughness: 0.62 };
  if (id === 'glitter-flake') return { metalness: 0.72, roughness: 0.3 };
  if (id === 'brushed-metal' || id === 'embossed-foil') return { metalness: 0.86, roughness: 0.34 };
  return { metalness: 0.62, roughness: 0.18 };
}

export class GlyphfieldHoloStickerRenderer {
  private camera: THREE.PerspectiveCamera;
  private geometry: THREE.PlaneGeometry;
  private mapAspect = 1;
  private material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private source: CanvasImageSource | null = null;
  private sourceKey = '';
  private mapKey = '';
  private geometryKey = '';
  private tilt = new THREE.Vector2();
  private tiltTarget = new THREE.Vector2();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas, powerPreference: 'low-power', preserveDrawingBuffer: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(24, 1, 0.1, 20);
    this.camera.position.set(0, 0, 3.2);
    this.geometry = new THREE.PlaneGeometry(1, 1, SEGMENTS, SEGMENTS);
    this.material = new THREE.ShaderMaterial({
      fragmentShader: FRAGMENT_SHADER,
      glslVersion: THREE.GLSL3,
      side: THREE.DoubleSide,
      transparent: true,
      uniforms: {
        uBands: { value: 9 },
        uCamera: { value: this.camera.position },
        uCurlHeight: { value: 0.15 },
        uGrain: { value: 0.2 },
        uHeight: { value: null },
        uHolo: { value: 0.76 },
        uHue: { value: 0 },
        uInk: { value: 1 },
        uLight: { value: new THREE.Vector2(0.68, 0.72) },
        uMap: { value: null },
        uMetalness: { value: 0.62 },
        uOverlay: { value: 0 },
        uPattern: { value: 0 },
        uPeel: { value: 0 },
        uRelief: { value: 0.22 },
        uRoughness: { value: 0.18 },
        uTime: { value: 0 },
      },
      vertexShader: VERTEX_SHADER,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);

    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 256;
    const context = shadowCanvas.getContext('2d');
    if (!context) throw new Error('Unable to create sticker shadow');
    const gradient = context.createRadialGradient(128, 128, 20, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(0,0,0,.82)');
    gradient.addColorStop(0.68, 'rgba(0,0,0,.28)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ depthWrite: false, map: new THREE.CanvasTexture(shadowCanvas), opacity: 0.32, transparent: true })
    );
    this.shadow.position.z = -0.08;
    this.scene.add(this.shadow);
  }

  setArtwork(source: CanvasImageSource, key: string) {
    if (this.sourceKey === key) return;
    this.source = source;
    this.sourceKey = key;
    this.mapKey = '';
  }

  setTilt(x: number, y: number) {
    this.tiltTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  }

  private updateMaps(settings: StickerFinishSettings) {
    if (!this.source) return;
    const key = `${this.sourceKey}|${settings.edgeWidth}|${settings.cutTolerance}|${settings.ink}|${settings.borderColor}`;
    if (key === this.mapKey) return;
    this.mapKey = key;
    const dimensions = this.source as CanvasImageSource & { displayHeight?: number; displayWidth?: number; height?: number; naturalHeight?: number; naturalWidth?: number; width?: number };
    const rawWidth = dimensions.naturalWidth ?? dimensions.displayWidth ?? dimensions.width ?? 1;
    const rawHeight = dimensions.naturalHeight ?? dimensions.displayHeight ?? dimensions.height ?? 1;
    const scale = Math.min(768 / Math.max(Number(rawWidth), Number(rawHeight)), 1);
    const width = Math.max(2, Math.round(Number(rawWidth) * scale));
    const height = Math.max(2, Math.round(Number(rawHeight) * scale));
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!sourceContext) return;
    sourceContext.drawImage(this.source, 0, 0, width, height);
    const image = sourceContext.getImageData(0, 0, width, height);
    const tolerance = (settings.cutTolerance / 100) * width * 0.42;
    const { distance, fieldWidth, pad } = buildDistanceField(image.data, width, height, tolerance);
    const border = Math.max(1, settings.edgeWidth * Math.min(1.4, width / 420));
    const offset = Math.ceil(border + 8);
    const outputWidth = width + offset * 2;
    const outputHeight = height + offset * 2;
    const output = new Uint8ClampedArray(outputWidth * outputHeight * 4);
    const borderColor = new THREE.Color(settings.borderColor);
    const borderRgb = [borderColor.r, borderColor.g, borderColor.b].map((channel) => Math.round(channel * 255));
    const inkStrength = settings.ink / 100;

    for (let y = 0; y < outputHeight; y += 1) {
      for (let x = 0; x < outputWidth; x += 1) {
        const artX = x - offset;
        const artY = y - offset;
        const outputIndex = (y * outputWidth + x) * 4;
        const inArtwork = artX >= 0 && artX < width && artY >= 0 && artY < height;
        const fieldDistance = artX >= -pad && artX < width + pad && artY >= -pad && artY < height + pad
          ? distance[(artY + pad) * fieldWidth + artX + pad]
          : MAX_DISTANCE;
        const shapeAlpha = Math.max(0, Math.min(255, Math.round((border - fieldDistance + 0.5) * 255)));
        let red = borderRgb[0];
        let green = borderRgb[1];
        let blue = borderRgb[2];
        if (inArtwork) {
          const artIndex = (artY * width + artX) * 4;
          const alpha = Math.min(1, inkStrength) * Math.pow(image.data[artIndex + 3] / 255, 1 / Math.max(inkStrength, 1));
          red = Math.round(red * (1 - alpha) + image.data[artIndex] * alpha);
          green = Math.round(green * (1 - alpha) + image.data[artIndex + 1] * alpha);
          blue = Math.round(blue * (1 - alpha) + image.data[artIndex + 2] * alpha);
        }
        output[outputIndex] = red;
        output[outputIndex + 1] = green;
        output[outputIndex + 2] = blue;
        output[outputIndex + 3] = shapeAlpha;
      }
    }

    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = outputWidth;
    mapCanvas.height = outputHeight;
    mapCanvas.getContext('2d')?.putImageData(new ImageData(output, outputWidth, outputHeight), 0, 0);
    const map = new THREE.CanvasTexture(mapCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const oldMap = this.material.uniforms.uMap.value as THREE.Texture | null;
    oldMap?.dispose();
    this.material.uniforms.uMap.value = map;

    const heightData = new Uint8ClampedArray(outputWidth * outputHeight * 4);
    const shoulder = Math.min(9, border * 0.3 + 3);
    for (let y = 0; y < outputHeight; y += 1) {
      for (let x = 0; x < outputWidth; x += 1) {
        const artX = x - offset;
        const artY = y - offset;
        const fieldDistance = artX >= -pad && artX < width + pad && artY >= -pad && artY < height + pad
          ? distance[(artY + pad) * fieldWidth + artX + pad]
          : MAX_DISTANCE;
        const edge = THREE.MathUtils.clamp((border - fieldDistance) / shoulder, 0, 1);
        const smooth = edge * edge * (3 - 2 * edge);
        const index = (y * outputWidth + x) * 4;
        heightData[index] = heightData[index + 1] = heightData[index + 2] = Math.round(smooth * 255);
        heightData[index + 3] = 255;
      }
    }
    const heightCanvas = document.createElement('canvas');
    heightCanvas.width = outputWidth;
    heightCanvas.height = outputHeight;
    heightCanvas.getContext('2d')?.putImageData(new ImageData(heightData, outputWidth, outputHeight), 0, 0);
    const heightMap = new THREE.CanvasTexture(heightCanvas);
    heightMap.colorSpace = THREE.NoColorSpace;
    heightMap.generateMipmaps = true;
    heightMap.minFilter = THREE.LinearMipmapLinearFilter;
    const oldHeight = this.material.uniforms.uHeight.value as THREE.Texture | null;
    oldHeight?.dispose();
    this.material.uniforms.uHeight.value = heightMap;
    this.mapAspect = outputWidth / outputHeight;
    this.geometryKey = '';
  }

  private updateGeometry(settings: StickerFinishSettings) {
    const key = `${settings.peelAmount}|${settings.peelDirection}|${settings.curl}|${this.mapAspect}`;
    if (key === this.geometryKey) return;
    this.geometryKey = key;
    const peel = settings.peelAmount / 100;
    const angle = PEEL_ANGLES[settings.peelDirection];
    const direction = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const perpendicular = new THREE.Vector2(-direction.y, direction.x);
    const scaleX = this.mapAspect >= 1 ? 1 : this.mapAspect;
    const scaleY = this.mapAspect >= 1 ? 1 / this.mapAspect : 1;
    const extent = 0.5 * Math.hypot(scaleX, scaleY);
    const fold = extent - peel * extent * 2;
    const radius = Math.max(settings.curl / 100, 0.02) * 2.2;
    const corner = new THREE.Vector2(Math.sign(-direction.x) * scaleX * 0.5, Math.sign(-direction.y) * scaleY * 0.5);
    const cornerPerpendicular = corner.dot(perpendicular);
    const cone = 2 * Math.abs(direction.x * direction.y);
    const maxAngle = Math.PI * (0.55 + 0.28 * peel);
    const positions = this.geometry.attributes.position;

    for (let index = 0; index < positions.count; index += 1) {
      const x0 = ((index % (SEGMENTS + 1)) / SEGMENTS - 0.5) * scaleX;
      const y0 = (0.5 - Math.floor(index / (SEGMENTS + 1)) / SEGMENTS) * scaleY;
      let x = x0;
      let y = y0;
      let z = 0;
      const coordinate = -(x0 * direction.x + y0 * direction.y);
      const unfolded = coordinate - fold;
      if (peel > 0.001 && unfolded > 0) {
        const lateral = Math.abs(x0 * perpendicular.x + y0 * perpendicular.y - cornerPerpendicular) / extent;
        const effectiveRadius = radius * (0.55 + cone * ((1.15 * lateral * lateral) / (lateral + 0.45)));
        const theta = maxAngle * (1 - Math.exp(-unfolded / effectiveRadius));
        const curled = fold + unfolded * Math.cos(theta);
        z = unfolded * Math.sin(theta);
        const shift = curled - coordinate;
        x -= direction.x * shift;
        y -= direction.y * shift;
      }
      const bowX = (x0 / (scaleX * 0.5)) ** 2;
      const bowY = (y0 / (scaleY * 0.5)) ** 2;
      z += 0.045 * (1 - bowX * 0.5 - bowY * 0.5);
      positions.setXYZ(index, x, y, z);
    }
    positions.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.material.uniforms.uCurlHeight.value = Math.max(0.15, extent * 0.7);
  }

  render(settings: StickerFinishSettings, width: number, height: number, elapsed = 0) {
    this.updateMaps(settings);
    this.updateGeometry(settings);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(Math.max(1, width), Math.max(1, height), false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.tilt.lerp(this.tiltTarget, 0.09);
    this.mesh.rotation.set(-this.tilt.y * 0.34, this.tilt.x * 0.4, 0);
    this.mesh.scale.setScalar(1.18);
    const uniforms = this.material.uniforms;
    const finish = finishParameters(settings.presetId);
    uniforms.uBands.value = settings.bands;
    uniforms.uGrain.value = settings.texture / 100;
    uniforms.uHolo.value = settings.intensity / 100;
    uniforms.uHue.value = settings.hueShift / 100 + settings.glintAngle / 360;
    uniforms.uInk.value = settings.ink / 100;
    uniforms.uMetalness.value = finish.metalness;
    uniforms.uOverlay.value = settings.overlay === 'none' ? 0 : settings.overlay === 'triangles' ? 1 : settings.overlay === 'squares' ? 2 : 3;
    uniforms.uPattern.value = settings.pattern === 'linear' ? 0 : settings.pattern === 'radial' ? 1 : 2;
    uniforms.uPeel.value = settings.peelAmount / 100;
    uniforms.uRelief.value = settings.relief / 100;
    uniforms.uRoughness.value = finish.roughness;
    uniforms.uTime.value = elapsed;
    const baseX = this.mapAspect >= 1 ? 1 : this.mapAspect;
    const baseY = this.mapAspect >= 1 ? 1 / this.mapAspect : 1;
    this.shadow.scale.set(baseX * 1.28, baseY * 1.24, 1);
    this.shadow.position.set(-0.04, -0.055, -0.08);
    this.shadow.material.opacity = settings.shadow / 100 * 0.58;
    this.renderer.render(this.scene, this.camera);
  }

  async exportPng(settings: StickerFinishSettings, size = 2048): Promise<Blob> {
    const previousWidth = this.canvas.clientWidth;
    const previousHeight = this.canvas.clientHeight;
    const previousTilt = this.tilt.clone();
    const previousTarget = this.tiltTarget.clone();
    this.tilt.set(0, 0);
    this.tiltTarget.set(0, 0);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(size, size, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.render(settings, size, size, 0);
    const blob = await new Promise<Blob>((resolve, reject) => this.canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Sticker export failed')), 'image/png'));
    this.tilt.copy(previousTilt);
    this.tiltTarget.copy(previousTarget);
    this.render(settings, previousWidth, previousHeight, 0);
    return blob;
  }

  dispose() {
    (this.material.uniforms.uMap.value as THREE.Texture | null)?.dispose();
    (this.material.uniforms.uHeight.value as THREE.Texture | null)?.dispose();
    this.material.dispose();
    this.geometry.dispose();
    this.shadow.geometry.dispose();
    this.shadow.material.map?.dispose();
    this.shadow.material.dispose();
    this.renderer.dispose();
  }
}
