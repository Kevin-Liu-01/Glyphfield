const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { calculateCyclomaticComplexity } = require('ts-complex');

const COVERAGE_SUMMARY = join(process.cwd(), 'coverage', 'coverage-summary.json');
const MAX_CRAP = 25;
const TARGETS = [
  'src/lib/portableCanvasAssets.ts',
  'src/lib/sourceCode.ts',
];

if (!existsSync(COVERAGE_SUMMARY)) {
  console.error('Coverage summary is missing. Run pnpm test:coverage:strict first.');
  process.exit(1);
}

const summary = require(COVERAGE_SUMMARY);
const failures = [];

for (const target of TARGETS) {
  const absoluteTarget = join(process.cwd(), target);
  const coverage = summary[absoluteTarget];
  if (!coverage) {
    failures.push(`${target}: missing coverage data`);
    continue;
  }
  const incompleteMetric = ['branches', 'functions', 'lines', 'statements']
    .find((metric) => coverage[metric].pct !== 100);
  if (incompleteMetric) {
    failures.push(`${target}: ${incompleteMetric} coverage is ${coverage[incompleteMetric].pct}%`);
    continue;
  }
  for (const [name, complexity] of Object.entries(calculateCyclomaticComplexity(target))) {
    const crap = complexity;
    if (crap >= MAX_CRAP) failures.push(`${target}:${name} CRAP ${crap}`);
  }
}

if (failures.length > 0) {
  console.error(`CRAP must stay below ${MAX_CRAP} with 100% critical-path coverage.`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}

console.log(`CRAP: every fully covered critical-path function is below ${MAX_CRAP}.`);
