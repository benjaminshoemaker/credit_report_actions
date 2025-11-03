import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: 'src/setupTests.ts',
    // Avoid worker OOM/hangs by isolating tests in forked processes
    pool: 'forks',
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**']
  },
  resolve: {
    alias: {
      '@shared-schemas': path.resolve(dirname, '../../packages/shared-schemas/src'),
      '@shared-ev': path.resolve(dirname, '../../packages/shared-ev/src')
    }
  }
});
