# Middlewares

Clear Router Middlewares lets you run framework-level work before a route handler is called. Use it for authentication, request logging, rate limits, tenant lookup, body checks, or any other cross-cutting request step.

Clear Router accepts both function middleware and class-based middleware with a `handle` method.

```ts
Router.get('/account', [AccountController, 'show'], [AuthMiddleware]);
```

## Function Middlewares

Function middlewares uses the native signature of the adapter you imported.

### Express

```ts
import type { NextFunction, Request, Response } from 'express';

const authMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  req.headers['x-auth-checked'] = 'true';
  next();
};

Router.get('/secure', ({ res }) => res.send('OK'), [authMiddleware]);
```

### Fastify

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { NextFunction } from 'clear-router/types/fastify';

const authMiddleware = (
  req: FastifyRequest,
  _reply: FastifyReply,
  next: NextFunction,
) => {
  req.headers['x-auth-checked'] = 'true';
  next();
};

Router.get('/secure', () => ({ ok: true }), [authMiddleware]);
```

### H3

```ts
import type { H3Event } from 'h3';
import type { NextFunction } from 'clear-router/types/h3';

const authMiddleware = async (event: H3Event, next: NextFunction) => {
  event.context.authChecked = true;
  return next();
};

Router.get('/secure', () => ({ ok: true }), [authMiddleware]);
```

### Hono

```ts
import type { Context } from 'hono';

const authMiddleware = async (ctx: Context, next: () => Promise<void>) => {
  ctx.set('authChecked', true);
  await next();
};

Router.get('/secure', (ctx) => ctx.json({ ok: true }), [authMiddleware]);
```

### Koa

```ts
import type Koa from 'koa';

const authMiddleware: Koa.Middleware = async (ctx, next) => {
  ctx.state.authChecked = true;
  await next();
};

Router.get(
  '/secure',
  (ctx) => {
    ctx.body = { ok: true };
  },
  [authMiddleware],
);
```

## Class-Based Middlewares

Classs middlewares are useful when the middleware has dependencies, configuration, or enough behaviour that a named class is easier to test.

The class must expose a `handle` method. The `handle` method receives the same framework-aware arguments as a function middleware for the adapter you are using.

```ts
import type { NextFunction, Request, Response } from 'express';

class AuthMiddleware {
  handle(req: Request, _res: Response, next: NextFunction): void {
    req.headers['x-auth-checked'] = 'true';
    next();
  }
}

Router.get('/secure', ({ res }) => res.send('OK'), [AuthMiddleware]);
```

Clear Router instantiates middleware classes when routes are registered and binds `handle` to the instance before passing it to the underlying framework.

Middleware instances are supported too:

```ts
class AuditMiddleware {
  constructor(private readonly source: string) {}

  handle(req: Request, _res: Response, next: NextFunction): void {
    req.headers['x-audit-source'] = this.source;
    next();
  }
}

Router.post(
  '/payments',
  [PaymentController, 'create'],
  [new AuditMiddleware('billing')],
);
```

## Framework-Aware Types

Each adapter exports a `Middleware` type that accepts either a function middleware or a class/instance with a compatible `handle` method.

```ts
import type { Middleware } from 'clear-router/types/express';
import type { NextFunction, Request, Response } from 'express';

class AuthMiddleware {
  handle(req: Request, _res: Response, next: NextFunction): void {
    next();
  }
}

const middleware: Middleware = AuthMiddleware;
```

The same pattern works for every adapter:

```ts
import type { Middleware as ExpressMiddleware } from 'clear-router/types/express';
import type { Middleware as FastifyMiddleware } from 'clear-router/types/fastify';
import type { Middleware as H3Middleware } from 'clear-router/types/h3';
import type { Middleware as HonoMiddleware } from 'clear-router/types/hono';
import type { Middleware as KoaMiddleware } from 'clear-router/types/koa';
```

Use the type from the adapter you are registering routes with. That keeps `handle` aligned with the framework's real middleware signature.

## Route Middlewares

Pass middlewares as the third argument to any route helper.

```ts
Router.get('/profile', [ProfileController, 'show'], [AuthMiddleware]);
Router.post(
  '/profile',
  [ProfileController, 'update'],
  [AuthMiddleware, AuditMiddleware],
);
```

You can pass a single middleware or an array:

```ts
Router.get('/me', [UserController, 'show'], AuthMiddleware);
Router.get('/settings', [SettingsController, 'index'], [AuthMiddleware]);
```

Route helpers also return the registered route, so middlewares can be chained after the route is defined:

```ts
Router.get('/profile', [ProfileController, 'show']).middleware(AuthMiddleware);

Router.post('/profile', [ProfileController, 'update']).middleware([
  AuthMiddleware,
  AuditMiddleware,
]);
```

The chained form is useful when route metadata is easier to read after the handler:

```ts
Router.get('/reports/{report}', [ReportController, 'show'])
  .middleware(AuthMiddleware)
  .name('reports.show');
```

## Group Middlewares

`Router.group()` applies middleware to every route registered inside the group.

```ts
Router.group(
  '/admin',
  () => {
    Router.get('/users', [AdminUserController, 'index']);
    Router.delete('/users/:id', [AdminUserController, 'destroy']);
  },
  [AuthMiddleware, AdminMiddleware],
);
```

The group prefix and middleware are both inherited by the nested routes.

## Global Middleware Scope

`Router.middleware()` applies middleware to routes defined inside the callback without adding a path prefix.

```ts
Router.middleware([AuthMiddleware], () => {
  Router.get('/account', [AccountController, 'show']);
  Router.get('/sessions', [SessionController, 'index']);
});
```

This is useful when several routes need the same middleware but do not share a URL prefix.

## Resource Middlewares

`Router.apiResource()` accepts middlewares for all actions or per action.

```ts
Router.apiResource('/posts', PostController, {
  middlewares: [AuthMiddleware],
});
```

Per-action middlewares use the standard resource action names:

```ts
Router.apiResource('/posts', PostController, {
  middlewares: {
    index: [AuthMiddleware],
    create: [AuthMiddleware],
    destroy: [AuthMiddleware, AdminMiddleware],
  },
});
```

`Router.apiResource()` also returns the generated resource routes, so middlewares can be chained after registration:

```ts
Router.apiResource('/posts', PostController).middleware(AuthMiddleware);
```

Resource filters can be chained from the same collection:

```ts
Router.apiResource('/posts', PostController)
  .only('index', 'show')
  .middleware(AuthMiddleware);

Router.apiResource('/posts', PostController)
  .except('destroy')
  .middleware([AuthMiddleware, AuditMiddleware]);
```

You can target a single resource action:

```ts
const posts = Router.apiResource('/posts', PostController);

posts.index()?.middleware(AuthMiddleware);
posts.destroy()?.middleware([AuthMiddleware, AdminMiddleware]);
```

Or target generated routes by HTTP method:

```ts
const posts = Router.apiResource('/posts', PostController);

posts.get().middleware(AuthMiddleware);
posts.post().middleware([AuthMiddleware, AuditMiddleware]);
```

Method selections can be inspected when needed:

```ts
const getRoutes = posts.get().all();
const firstGetRoute = posts.get().first();
```

## Execution Order

Middlewares runs in the order they were registered:

```txt
Global middleware -> Group middleware -> Route middleware -> Route handler
```

For example:

```ts
Router.middleware([GlobalMiddleware], () => {
  Router.group(
    '/admin',
    () => {
      Router.get('/reports', [ReportController, 'index'], [RouteMiddleware]);
    },
    [GroupMiddleware],
  );
});
```

The `/admin/reports` route runs:

```txt
GlobalMiddleware -> GroupMiddleware -> RouteMiddleware -> ReportController.index
```

## Returning or Stopping Early

Middlewares follow the rules of the adapter underneath. If the framework lets middleware end the response early, Clear Router does not add a second response.

Express example:

```ts
class AuthMiddleware {
  handle(req: Request, res: Response, next: NextFunction): void {
    if (!req.headers.authorization) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }

    next();
  }
}
```

Hono example:

```ts
class AuthMiddleware {
  async handle(ctx: Context, next: () => Promise<void>) {
    if (!ctx.req.header('authorization')) {
      return ctx.json({ message: 'Unauthenticated' }, 401);
    }

    await next();
  }
}
```

## Notes

- Middlewares are normalized when the route is registered.
- Class constructors are created with no arguments. Use an instance when you need constructor arguments.
- `handle` is framework-aware, not route-context-aware. Express middleware receives `(req, res, next)`, Hono middleware receives `(ctx, next)`, and so on.
- Route handlers still receive Clear Router's `HttpContext` after middleware completes.
