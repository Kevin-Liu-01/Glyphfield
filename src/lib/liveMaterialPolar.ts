export function quantizeAngularCycles(frequency: number, minimum = 1): number {
  return Math.max(minimum, Math.round(Math.abs(frequency)));
}

export function seamlessAngularWave(angle: number, frequency: number, phase: number, minimum = 1): number {
  return Math.sin(angle * quantizeAngularCycles(frequency, minimum) + phase);
}

export function seamlessAngularWarp(angle: number, phase: number): number {
  return Math.sin(angle + phase) * 0.34 + Math.sin(angle * 2 - phase * 0.625) * 0.08;
}

export const SEAMLESS_POLAR_GLSL = `
float seamlessAngularWave(float angle, float frequency, float phase, float minimumCycles) {
  float cycles = max(minimumCycles, floor(abs(frequency) + 0.5));
  return sin(angle * cycles + phase);
}

float seamlessAngularWarp(float angle, float phase) {
  return sin(angle + phase) * 0.34 + sin(angle * 2.0 - phase * 0.625) * 0.08;
}
`;
