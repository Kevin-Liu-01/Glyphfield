const { readdirSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');
const { calculateHalstead } = require('ts-complex');

const SOURCE_ROOT = join(process.cwd(), 'src');
const MAX_DIFFICULTY = 80;

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(path);
    }
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

function analyzedFunctions(file) {
  const analysis = calculateHalstead(file);
  return Object.entries(analysis).flatMap(([name, metric]) => {
    if (!Number.isFinite(metric.difficulty) || metric.length === 0) return [];
    return [{ difficulty: metric.difficulty, file, name }];
  });
}

const failures = [];
for (const file of sourceFiles(SOURCE_ROOT)) {
  if (!statSync(file).isFile()) continue;
  for (const metric of analyzedFunctions(file)) {
    if (metric.difficulty >= MAX_DIFFICULTY) failures.push(metric);
  }
}

failures.sort((left, right) => right.difficulty - left.difficulty);
if (failures.length > 0) {
  console.error(`Halstead difficulty must stay below ${MAX_DIFFICULTY}.`);
  for (const failure of failures) {
    console.error(`${failure.difficulty.toFixed(2)}\t${relative(process.cwd(), failure.file)}\t${failure.name}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Halstead difficulty: every production function is below ${MAX_DIFFICULTY}.`);
}
