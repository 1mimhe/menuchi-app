import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'Menuchi API Unit Test',
    environment: 'node',
    setupFiles: './test/vitest.setup.ts',
    include: ['./test/**/*.test.ts'],
    // Router tests share one Postgres/Redis (see vitest.setup.ts cleanup).
    // Serialise files so one file's afterEach wipe cannot delete another
    // file's in-flight rows. Pure unit tests (test/unit) are unaffected.
    pool: 'forks',
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 70,
        branches: 60,
      },
      exclude: ['build/**', 'src/config/swagger.json', 'src/routes.ts', 'src/types/**', 'test/**'],
    },
  },
});
