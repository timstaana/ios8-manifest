import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['packages/*/test/**/*.test.ts'], environment: 'node' }, define: { __DEV__: 'true' } });
