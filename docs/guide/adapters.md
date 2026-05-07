# Adapter Authoring Guide

This guide shows how to add support for a new framework by building an adapter on top of the shared `CoreRouter`.

## Architecture

clear-router is split into:

- Core: shared route registration, grouping, method override resolution, and controller binding.
- Adapter: framework-specific request lifecycle and context extraction.

Use the core from `clear-router/core` (or `src/core/router` inside this repo).

## Adapter Checklist

1. Define framework types for context, middleware, and handler.
2. Extend `CoreRouter` with a framework `Router` class.
3. Add typed wrapper methods (`get`, `post`, `group`, `apiResource`, `allRoutes`) to preserve TypeScript inference.
4. Implement `apply(...)` to register routes into your framework.
5. Convert framework request data to `{ body, query, params }` and call `bindRequestToInstance(...)`.
6. Export adapter entrypoint and add package subpath export (if publishing).

## Minimal Adapter Skeleton

```ts
import { CoreRouter } from 'clear-router/core';
import { Route } from 'src/Route';
import type { HttpMethod } from 'types/basic';

export type FrameworkContext = {
  req: any;
  res?: any;
  next?: () => void;
};

export type FrameworkMiddleware = (...args: any[]) => any;

export type FrameworkHandler = (
  ctx: FrameworkContext,
  clearRequest: any,
) => any | Promise<any>;

export class Router extends CoreRouter {
  static add(
    methods: HttpMethod | HttpMethod[],
    path: string,
    handler: FrameworkHandler | [any, string],
    middlewares?: FrameworkMiddleware[] | FrameworkMiddleware,
  ): void {
    super.add(methods, path, handler, middlewares);
  }

  static get(
    path: string,
    handler: FrameworkHandler,
    middlewares?: FrameworkMiddleware[] | FrameworkMiddleware,
  ): void {
    super.get(path, handler, middlewares);
  }

  static post(
    path: string,
    handler: FrameworkHandler,
    middlewares?: FrameworkMiddleware[] | FrameworkMiddleware,
  ): void {
    super.post(path, handler, middlewares);
  }

  static allRoutes(): Array<
    Route<
      FrameworkContext,
      FrameworkMiddleware,
      FrameworkHandler | [any, string]
    >
  >;
  static allRoutes(
    type: 'path',
  ): Record<
    string,
    Route<
      FrameworkContext,
      FrameworkMiddleware,
      FrameworkHandler | [any, string]
    >
  >;
  static allRoutes(type: 'method'): {
    [method in Uppercase<HttpMethod>]?: Array<
      Route<
        FrameworkContext,
        FrameworkMiddleware,
        FrameworkHandler | [any, string]
      >
    >;
  };
  static allRoutes(type?: 'method' | 'path') {
    return super.allRoutes(type as any) as any;
  }

  static apply(app: any): any {
    for (const route of this.routes) {
      let handlerFunction: FrameworkHandler | null = null;
      let instance = null;

      const resolved = this.resolveHandler(route);
      handlerFunction = resolved.handlerFunction as FrameworkHandler;
      instance = resolved.instance;

      if (!handlerFunction) continue;

      for (const method of route.methods) {
        app[method](route.path, async (ctx: FrameworkContext) => {
          const inst = instance ?? route;

          this.bindRequestToInstance(ctx, inst, route, {
            body: {},
            query: {},
            params: {},
          });

          return await Promise.resolve(
            handlerFunction!(ctx, inst.clearRequest),
          );
        });
      }
    }

    return app;
  }
}
```

## Framework-Specific Responsibilities

Adapters should handle:

- Registering route handlers in the target framework (`apply`).
- Request body access strategy (`req.getBody`, body parser, or cached read).
- Mapping request data into core payload:
  - `body`
  - `query`
  - `params`
- Framework-specific error flow:
  - Express: `next(error)`
  - H3: return/throw compatible values

## Type Inference Notes

If you only inherit `CoreRouter` methods, handler arguments may become `any` in user code.

To keep strong typing, add typed wrappers in your adapter:

- `add`
- `get`, `post`, `put`, `delete`, `patch`, `options`, `head`
- `group`
- `apiResource`
- `allRoutes` overloads

## Publish Wiring

If this adapter is published as a subpath:

1. Add `src/<adapter>/index.ts` exporting router.
2. Add package `exports` entry (for example `./my-framework`).
3. Add build entry in bundler config (for example `tsdown.config.ts`).
4. Add tsconfig `paths` aliases for local development.

## Existing Examples

Use these adapters as references:

- Express adapter: `src/express/router.ts`
- Fastify adapter: `src/fastify/router.ts`
- H3 adapter: `src/h3/router.ts`
- Hono adapter: `src/hono/router.ts`
- Koa adapter: `src/koa/router.ts`
- Core implementation: `src/core/router.ts`
