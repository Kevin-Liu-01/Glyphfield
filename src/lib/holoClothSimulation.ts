export type HoloClothPhysics = {
  damping: number;
  iterations: number;
  relaxation: number;
  stiffness: number;
};

type Grab = {
  indices: number[];
  offsets: Float32Array;
  target: [number, number, number];
  weights: number[];
};

// A 60 Hz fixed step keeps the sheet deterministic while avoiding two full
// constraint solves for every ordinary display frame.
const FIXED_STEP = 1 / 60;

/** Lightweight Verlet sheet with structural, shear, and bend constraints. */
export class HoloClothSimulation {
  readonly columns: number;
  readonly count: number;
  readonly positions: Float32Array;
  readonly rows: number;
  private accumulator = 0;
  private constraintA: Int32Array;
  private constraintB: Int32Array;
  private constraintMultiplier: Float32Array;
  private constraintRest: Float32Array;
  private grab: Grab | null = null;
  private previous: Float32Array;
  private rest: Float32Array;

  constructor(
    readonly width: number,
    readonly height: number,
    readonly segmentsX: number,
    readonly segmentsY: number,
    drape = 0.62
  ) {
    this.columns = segmentsX + 1;
    this.rows = segmentsY + 1;
    this.count = this.columns * this.rows;
    this.positions = new Float32Array(this.count * 3);
    this.previous = new Float32Array(this.count * 3);
    this.rest = new Float32Array(this.count * 3);
    this.initialize(drape);

    const constraintA: number[] = [];
    const constraintB: number[] = [];
    const multiplier: number[] = [];
    const index = (x: number, y: number) => y * this.columns + x;
    for (let y = 0; y < this.rows; y += 1) {
      for (let x = 0; x < this.columns; x += 1) {
        if (x + 1 < this.columns) { constraintA.push(index(x, y)); constraintB.push(index(x + 1, y)); multiplier.push(1); }
        if (y + 1 < this.rows) { constraintA.push(index(x, y)); constraintB.push(index(x, y + 1)); multiplier.push(1); }
        if (x + 1 < this.columns && y + 1 < this.rows) {
          constraintA.push(index(x, y)); constraintB.push(index(x + 1, y + 1)); multiplier.push(0.84);
          constraintA.push(index(x + 1, y)); constraintB.push(index(x, y + 1)); multiplier.push(0.84);
        }
        if (x + 2 < this.columns) { constraintA.push(index(x, y)); constraintB.push(index(x + 2, y)); multiplier.push(0.34); }
        if (y + 2 < this.rows) { constraintA.push(index(x, y)); constraintB.push(index(x, y + 2)); multiplier.push(0.34); }
      }
    }
    this.constraintA = new Int32Array(constraintA);
    this.constraintB = new Int32Array(constraintB);
    this.constraintMultiplier = new Float32Array(multiplier);
    this.constraintRest = new Float32Array(constraintA.length);
    for (let constraint = 0; constraint < constraintA.length; constraint += 1) {
      const a = constraintA[constraint];
      const b = constraintB[constraint];
      const ax = a % this.columns;
      const ay = Math.floor(a / this.columns);
      const bx = b % this.columns;
      const by = Math.floor(b / this.columns);
      this.constraintRest[constraint] = Math.hypot(
        (ax - bx) * width / segmentsX,
        (ay - by) * height / segmentsY
      );
    }
  }

  private initialize(drape: number) {
    let cursor = 0;
    for (let y = 0; y < this.rows; y += 1) {
      const v = y / this.segmentsY;
      for (let x = 0; x < this.columns; x += 1) {
        const u = x / this.segmentsX;
        const px = (u - 0.5) * this.width;
        const py = (0.5 - v) * this.height;
        const diagonal = Math.sin((u * 2.2 + v * 1.35) * Math.PI) * 0.12;
        const broadFold = Math.sin((u * 0.72 - v * 1.18 + 0.18) * Math.PI * 2) * 0.18;
        const pinch = Math.exp(-((u - 0.78) ** 2 + (v - 0.24) ** 2) * 22) * 0.22;
        this.positions[cursor] = px + Math.sin(v * Math.PI) * drape * 0.08;
        this.positions[cursor + 1] = py + Math.sin(u * Math.PI * 2) * drape * 0.035;
        this.positions[cursor + 2] = (diagonal + broadFold + pinch) * drape;
        cursor += 3;
      }
    }
    this.previous.set(this.positions);
    this.rest.set(this.positions);
  }

  reset(drape = 0.62) {
    this.initialize(drape);
    this.accumulator = 0;
    this.grab = null;
  }

  get isGrabbing() {
    return this.grab !== null;
  }

  startGrab(point: [number, number, number], radius: number) {
    const indices: number[] = [];
    const weights: number[] = [];
    const offsets: number[] = [];
    for (let vertex = 0; vertex < this.count; vertex += 1) {
      const index = vertex * 3;
      const dx = this.positions[index] - point[0];
      const dy = this.positions[index + 1] - point[1];
      const dz = this.positions[index + 2] - point[2];
      const distance = Math.hypot(dx, dy, dz);
      if (distance > radius) continue;
      const amount = 1 - distance / radius;
      indices.push(vertex);
      weights.push(amount * amount * (3 - amount * 2));
      offsets.push(dx, dy, dz);
    }
    if (!indices.length) return false;
    this.grab = { indices, offsets: new Float32Array(offsets), target: [...point], weights };
    return true;
  }

  moveGrab(point: [number, number, number]) {
    if (this.grab) this.grab.target = [...point];
  }

  endGrab() {
    this.grab = null;
  }

  poke(x = 0, y = 0, strength = 0.18) {
    const radius = Math.max(this.width, this.height) * 0.36;
    for (let vertex = 0; vertex < this.count; vertex += 1) {
      const index = vertex * 3;
      const distance = Math.hypot(this.positions[index] - x, this.positions[index + 1] - y);
      if (distance > radius) continue;
      const weight = 1 - distance / radius;
      this.previous[index + 2] -= strength * weight * weight;
    }
  }

  step(delta: number, physics: HoloClothPhysics) {
    this.accumulator += Math.min(delta, 0.05);
    let substeps = 0;
    while (this.accumulator >= FIXED_STEP && substeps < 4) {
      this.substep(physics);
      this.accumulator -= FIXED_STEP;
      substeps += 1;
    }
    if (substeps === 4) this.accumulator = 0;
  }

  private applyGrab() {
    if (!this.grab) return;
    for (let grabbed = 0; grabbed < this.grab.indices.length; grabbed += 1) {
      const index = this.grab.indices[grabbed] * 3;
      const weight = this.grab.weights[grabbed];
      for (let channel = 0; channel < 3; channel += 1) {
        const target = this.grab.target[channel] + this.grab.offsets[grabbed * 3 + channel];
        this.positions[index + channel] += (target - this.positions[index + channel]) * weight;
      }
    }
  }

  private substep(physics: HoloClothPhysics) {
    const damping = Math.pow(1 - Math.min(physics.damping, 0.99), FIXED_STEP * 60);
    for (let index = 0; index < this.positions.length; index += 1) {
      const current = this.positions[index];
      const velocity = (current - this.previous[index]) * damping;
      this.previous[index] = current;
      this.positions[index] = current + velocity + (this.rest[index] - current) * physics.relaxation * 0.008;
    }

    for (let iteration = 0; iteration < Math.max(1, Math.round(physics.iterations)); iteration += 1) {
      for (let constraint = 0; constraint < this.constraintA.length; constraint += 1) {
        const indexA = this.constraintA[constraint] * 3;
        const indexB = this.constraintB[constraint] * 3;
        const dx = this.positions[indexB] - this.positions[indexA];
        const dy = this.positions[indexB + 1] - this.positions[indexA + 1];
        const dz = this.positions[indexB + 2] - this.positions[indexA + 2];
        const distanceSquared = dx * dx + dy * dy + dz * dz;
        if (distanceSquared < 1e-14) continue;
        const distance = Math.sqrt(distanceSquared);
        const correction = ((distance - this.constraintRest[constraint]) / distance) * 0.5 * physics.stiffness * this.constraintMultiplier[constraint];
        this.positions[indexA] += dx * correction;
        this.positions[indexA + 1] += dy * correction;
        this.positions[indexA + 2] += dz * correction;
        this.positions[indexB] -= dx * correction;
        this.positions[indexB + 1] -= dy * correction;
        this.positions[indexB + 2] -= dz * correction;
      }
      this.applyGrab();
    }
  }
}
