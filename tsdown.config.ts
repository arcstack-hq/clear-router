import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    exports: true,
    tsconfig: 'tsconfig.json',
    entry: ['src/express/index.ts', 'src/h3/index.ts'],
    platform: 'node',
    outDir: 'dist',
    format: ['esm', 'cjs'],
    skipNodeModulesBundle: true,
  },
  {
    exports: true,
    unbundle: true,
    entry: {
      'types/*': ['./types/*.ts', '!./types/index.ts'],
    },
    outDir: 'dist',
    format: ['esm'],
  }
])
