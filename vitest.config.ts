import path from 'path';

export default {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    exclude: ['**/.stryker-tmp/**', '**/node_modules/**'],
  },
};
