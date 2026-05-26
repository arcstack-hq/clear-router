// import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    exports: true,
    outDir: 'dist',
  },
  {
    dts: true,
    clean: true,
    exports: true,
    entry: [
      'src/core/index.ts',
      'src/decorators/index.ts',
      'src/decorators/setup.ts',
      'src/express/index.ts',
      'src/fastify/index.ts',
      'src/h3/index.ts',
      'src/hono/index.ts',
      'src/koa/index.ts',
    ],
    platform: 'node',
    outDir: 'dist',
    format: ['esm', 'cjs'],
    skipNodeModulesBundle: true,
  },
  {
    clean: true,
    exports: true,
    entry: {
      'types/*': [
        './src/types/*.ts',
        '!./src/types/index.ts',
        // '!./src/index.ts',
        // '!./src/ClearRequest.ts',
        // '!./src/Route.ts',
      ],
    },
    outDir: 'dist',
    format: ['esm'],
    // onSuccess (rsc) {
    //   for (const n of ['ClearRequest', 'Route']) {
    //     cpSync(rsc.outDir + `/src/${n}.d.mts`, rsc.outDir + `/types/${n}.d.mts`)
    //   }
    //   cpSync(rsc.outDir + '/src/core', rsc.outDir + '/types/core', { recursive: true })
    //   for (const d of Object.keys(rsc.entry)) {
    //     const p = d.replace('types', `${rsc.outDir}/types`) + '.d.mts'
    //     const code = readFileSync(p, 'utf-8')
    //     writeFileSync(p, code.replace(/\.\.\/src\//g, './'), 'utf-8')
    //   }
    //   rmSync(rsc.outDir + '/src', { recursive: true })
    // },
  }
])
