import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/index': 'src/core/index.ts',
    'decorators/index': 'src/decorators/index.ts',
    'decorators/setup': 'src/decorators/setup.ts',
    'express/index': 'src/express/index.ts',
    'fastify/index': 'src/fastify/index.ts',
    'h3/index': 'src/h3/index.ts',
    'hono/index': 'src/hono/index.ts',
    'koa/index': 'src/koa/index.ts',
    'types/basic': 'src/types/basic.ts',
    'types/express': 'src/types/express.ts',
    'types/fastify': 'src/types/fastify.ts',
    'types/h3': 'src/types/h3.ts',
    'types/hono': 'src/types/hono.ts',
    'types/koa': 'src/types/koa.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  exports: true,
  unbundle: true,
  platform: 'node',
  outDir: 'dist',
  skipNodeModulesBundle: true,
})
