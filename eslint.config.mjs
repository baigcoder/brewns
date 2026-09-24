import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// `next lint` was removed in Next 16; this is the ESLint CLI setup its docs give.
// typescript-eslint cannot load TypeScript 7 (no programmatic API until 7.1), so
// package.json aliases `typescript` to the 6.0 compatibility build and keeps 7 as
// @typescript/native for `tsc`. Drop the alias once typescript-eslint supports 7.
const eslintConfig = defineConfig([
  ...nextVitals,
  {
    // components/brewns/initBrewns.ts is @ts-nocheck, so tsc skips the check that
    // rejects a second `const` of the same name — and Turbopack then fails to
    // compile the module and the page renders blank. This catches it at lint time.
    files: ["**/*.{ts,tsx}"],
    rules: { "@typescript-eslint/no-redeclare": "error" },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    rules: { "no-redeclare": "error" },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Vendored Draco decoder and generated assets, not source.
    'public/**',
    // The kitchen:white tool's own install.
    'tools/**',
  ]),
]);

export default eslintConfig;
