/**
 * GLSL ES 3.00 passes for Fluid Energy: a stable-fluids solver after Pavel Dobryakov's
 * MIT-licensed WebGL Fluid Simulation (curl, vorticity, pressure projection, advection).
 */
export const FLUID_VERTEX_SOURCE = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec2 u_texel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;

void main() {
  vUv = a_position * 0.5 + 0.5;
  vL = vUv - vec2(u_texel.x, 0.0);
  vR = vUv + vec2(u_texel.x, 0.0);
  vT = vUv + vec2(0.0, u_texel.y);
  vB = vUv - vec2(0.0, u_texel.y);
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const HEADER = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

export const FLUID_CURL_SOURCE = `${HEADER}
uniform sampler2D u_velocity;

void main() {
  float left = texture(u_velocity, vL).y;
  float right = texture(u_velocity, vR).y;
  float top = texture(u_velocity, vT).x;
  float bottom = texture(u_velocity, vB).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}
`;

export const FLUID_VORTICITY_SOURCE = `${HEADER}
uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform float u_curl_strength;
uniform float u_dt;

void main() {
  float left = texture(u_curl, vL).x;
  float right = texture(u_curl, vR).x;
  float top = texture(u_curl, vT).x;
  float bottom = texture(u_curl, vB).x;
  float center = texture(u_curl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force /= length(force) + 0.0001;
  force *= u_curl_strength * center;
  force.y *= -1.0;
  vec2 velocity = texture(u_velocity, vUv).xy + force * u_dt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

export const FLUID_DIVERGENCE_SOURCE = `${HEADER}
uniform sampler2D u_velocity;

void main() {
  float left = texture(u_velocity, vL).x;
  float right = texture(u_velocity, vR).x;
  float top = texture(u_velocity, vT).y;
  float bottom = texture(u_velocity, vB).y;
  vec2 center = texture(u_velocity, vUv).xy;
  if (vL.x < 0.0) left = -center.x;
  if (vR.x > 1.0) right = -center.x;
  if (vT.y > 1.0) top = -center.y;
  if (vB.y < 0.0) bottom = -center.y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

export const FLUID_CLEAR_SOURCE = `${HEADER}
uniform sampler2D u_source;
uniform float u_value;

void main() {
  fragColor = u_value * texture(u_source, vUv);
}
`;

export const FLUID_PRESSURE_SOURCE = `${HEADER}
uniform sampler2D u_pressure;
uniform sampler2D u_divergence;

void main() {
  float left = texture(u_pressure, vL).x;
  float right = texture(u_pressure, vR).x;
  float top = texture(u_pressure, vT).x;
  float bottom = texture(u_pressure, vB).x;
  float divergence = texture(u_divergence, vUv).x;
  fragColor = vec4((left + right + bottom + top - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

export const FLUID_GRADIENT_SOURCE = `${HEADER}
uniform sampler2D u_pressure;
uniform sampler2D u_velocity;

void main() {
  float left = texture(u_pressure, vL).x;
  float right = texture(u_pressure, vR).x;
  float top = texture(u_pressure, vT).x;
  float bottom = texture(u_pressure, vB).x;
  vec2 velocity = texture(u_velocity, vUv).xy - vec2(right - left, top - bottom);
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

export const FLUID_ADVECTION_SOURCE = `${HEADER}
uniform sampler2D u_velocity;
uniform sampler2D u_source;
uniform vec2 u_velocity_texel;
uniform float u_dt;
uniform float u_dissipation;
uniform float u_edge_fade;

void main() {
  vec2 coord = vUv - u_dt * texture(u_velocity, vUv).xy * u_velocity_texel;
  // Extra decay near the walls stops dye from pooling along the frame.
  vec2 edge = min(vUv, 1.0 - vUv);
  float wall = 1.0 - smoothstep(0.0, 0.06, min(edge.x, edge.y));
  fragColor = texture(u_source, coord) / (1.0 + (u_dissipation + wall * u_edge_fade) * u_dt);
}
`;

export const FLUID_EMITTER_COUNT = 4;

export const FLUID_EMIT_SOURCE = `${HEADER}
uniform sampler2D u_target;
uniform float u_aspect;
uniform int u_count;
uniform vec2 u_points[${FLUID_EMITTER_COUNT}];
uniform vec3 u_values[${FLUID_EMITTER_COUNT}];
uniform float u_radii[${FLUID_EMITTER_COUNT}];

void main() {
  vec3 value = texture(u_target, vUv).xyz;
  for (int index = 0; index < ${FLUID_EMITTER_COUNT}; index++) {
    if (index >= u_count) break;
    vec2 delta = vUv - u_points[index];
    delta.x *= u_aspect;
    value += exp(-dot(delta, delta) / u_radii[index]) * u_values[index];
  }
  fragColor = vec4(value, 1.0);
}
`;

export const FLUID_DISPLAY_SOURCE = `${HEADER}
uniform sampler2D u_dye;
uniform vec2 u_texel;
uniform vec3 u_background;
uniform vec2 u_resolution;
uniform float u_brightness;
uniform float u_grain;
uniform float u_time;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 linearToSrgb(vec3 color) {
  color = max(color, vec3(0.0));
  return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), color));
}

vec3 highlightShoulder(vec3 color) {
  float peak = max(max(color.r, color.g), color.b);
  if (peak <= 0.82) return color;
  float mapped = 0.82 + 0.18 * (1.0 - exp(-(peak - 0.82) / 0.18));
  return mix(color * (mapped / peak), vec3(mapped), clamp((peak - 1.0) * 0.3, 0.0, 0.55));
}

void main() {
  vec3 dye = max(texture(u_dye, vUv).rgb, vec3(0.0));
  // Shade the dye as a surface: its brightness gradient becomes a soft normal.
  float left = length(texture(u_dye, vL).rgb);
  float right = length(texture(u_dye, vR).rgb);
  float top = length(texture(u_dye, vT).rgb);
  float bottom = length(texture(u_dye, vB).rgb);
  vec3 normal = normalize(vec3(right - left, top - bottom, length(u_texel) * 18.0));
  float shading = clamp(dot(normal, normalize(vec3(-0.35, 0.45, 1.0))) + 0.18, 0.55, 1.15);
  vec3 color = u_background + dye * shading * 1.45;
  color = highlightShoulder(color * pow(max(u_brightness, 0.0), 2.2));
  vec3 display = linearToSrgb(color);
  float frame = mod(floor(u_time * 24.0), 61.0);
  vec2 cell = floor(gl_FragCoord.xy / max(1.0, u_resolution.y / 1100.0));
  float grain = hash12(cell + frame * vec2(17.0, 59.0)) + hash12(cell.yx + frame * vec2(41.0, 23.0)) - 1.0;
  display += grain * (u_grain / 100.0) * 0.14;
  display += (hash12(gl_FragCoord.xy + 0.37) + hash12(gl_FragCoord.xy * 1.31 + 19.19) - 1.0) / 255.0;
  fragColor = vec4(clamp(display, 0.0, 1.0), 1.0);
}
`;

export type FluidEmitter = { color: 0 | 1 | 2; dx: number; dy: number; x: number; y: number };

/** Three slow orbiting jets; positions and directions are pure functions of time. */
export function fluidEmitters(time: number, frequency: number): FluidEmitter[] {
  const motion = time * (0.42 + frequency * 0.025);
  const orbit = (phase: number, rateX: number, rateY: number, radiusX: number, radiusY: number, centerX: number, centerY: number) => {
    const x = centerX + Math.sin(motion * rateX + phase) * radiusX;
    const y = centerY + Math.cos(motion * rateY + phase) * radiusY;
    const dx = Math.cos(motion * rateX + phase) * radiusX * rateX;
    const dy = -Math.sin(motion * rateY + phase) * radiusY * rateY;
    const length = Math.hypot(dx, dy) || 1;
    return { dx: dx / length, dy: dy / length, x, y };
  };
  return [
    { color: 1, ...orbit(0, 0.83, 0.71, 0.24, 0.22, 0.32, 0.4) },
    { color: 2, ...orbit(2.1, 0.64, 0.77, 0.22, 0.2, 0.68, 0.6) },
    { color: 1, ...orbit(4.2, 0.39, 0.48, 0.3, 0.28, 0.5, 0.5) },
  ];
}
