import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'node_modules/**',
    'test-report/**',
    'test-results/**',
    'playwright-report/**',
    'next-env.d.ts',
  ]),
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      eqeqeq: ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // Operational scripts and the dev-only OTP logger legitimately write to stdout.
    files: ['scripts/**/*.ts', 'src/server/lib/logger.ts', 'src/server/jobs/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
]);
