const config = {
  coverageAnalysis: 'perTest',
  mutate: [
    'src/lib/portableCanvasAssets.ts',
  ],
  plugins: ['@stryker-mutator/vitest-runner'],
  reporters: ['clear-text', 'json', 'progress'],
  testRunner: 'vitest',
  thresholds: {
    break: 100,
    high: 100,
    low: 100,
  },
  vitest: {
    configFile: 'vitest.config.ts',
    related: true,
  },
};

export default config;
