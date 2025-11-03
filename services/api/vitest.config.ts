import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts', 'test/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@shared-schemas': path.resolve(dirname, '../../packages/shared-schemas/src'),
      '@shared-ev': path.resolve(dirname, '../../packages/shared-ev/src')
    }
  }
});
