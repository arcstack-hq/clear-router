# Using with Koa

clear-router supports Koa through `@koa/router`.

## Install

```bash
pnpm add clear-router koa @koa/router
```

## Setup

```ts
import Koa from 'koa';
import KoaRouter from '@koa/router';
import Router from 'clear-router/koa';

const app = new Koa();
const koaRouter = new KoaRouter();

Router.get('/hello', () => 'Hello World');

Router.apply(koaRouter);
app.use(koaRouter.routes());
app.use(koaRouter.allowedMethods());

app.listen(3000);
```

## Koa-Specific Context

Koa handlers receive the Koa context as the first argument.

```ts
Router.get('/users/:id', (ctx) => {
  return {
    id: ctx.params.id,
    query: ctx.query,
  };
});
```

The request body helper is exposed as `ctx.request.getBody()`.

```ts
Router.post('/users', (ctx) => {
  const body = ctx.request.getBody();

  return { created: true, body };
});
```

## Direct Returns

Koa supports the same direct return behavior as the other adapters.

```ts
Router.get('/text', () => 'Hello');
Router.get('/html', () => '<h1>Hello</h1>');
Router.get('/json', () => ({ ok: true }));
Router.post('/users', (ctx) => ({ id: 1, ...ctx.request.getBody() }));
Router.get('/accepted', () => new Response('Accepted', { status: 202 }));
```

Direct `POST` returns default to `201`; other methods default to `200`. HTML-like strings are sent as `text/html`, API/XHR string responses as `text/plain`, and objects/arrays as JSON.

## Method Override

Koa supports the shared method override behavior.

```ts
Router.put('/users/:id', (ctx) => {
  return { id: ctx.params.id, body: ctx.request.getBody() };
});

// POST /users/1 with JSON body { "_method": "PUT" }
```

## Controllers

Controller handlers receive hydrated request state on `this`.

```ts
import { Controller } from 'clear-router';

class UserController extends Controller {
  show() {
    return {
      id: this.params.id,
      query: this.query,
    };
  }
}

Router.get('/users/:id', [UserController, 'show']);
```

## Grouped Routes

Route groups support callbacks, files, directories, and mixed source arrays.

```ts
await Router.group('/api', [
  'routes/users.ts',
  'routes/posts',
  () => Router.get('/status', () => ({ ok: true })),
]);
```

Middleware and conditional registration are chainable:

```ts
await Router
  .group('/secure', 'routes/secure')
  .middleware(authMiddleware)
  .when((source) => Boolean(source) && secureRoutesEnabled);
```

The `when()` callback receives callbacks and direct file paths individually.
For directory groups, it receives each discovered file path before import, so
specific files can be rejected.
