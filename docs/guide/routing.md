# Routing

## Overview

`CoreRouter` is the base class that powers Clear Router's routing engine. You do not use it directly — instead, import the framework-specific `Router` that matches your environment. Each framework router extends `CoreRouter` and inherits all of its functionality.

```ts
// ✅ Correct — use the framework-specific router
import { Router } from 'clear-router/express';
import { Router } from 'clear-router/h3';
import { Router } from 'clear-router/fastify';

// ❌ Incorrect — do not use CoreRouter directly
import { CoreRouter } from 'clear-router';
```

## Configuration

### `Router.configure(options?)`

Configures the router with runtime options. Call once before registering routes.

```ts
Router.configure({
  inferParamName: true,
  methodOverride: {
    enabled: true,
    headerKeys: ['X-HTTP-Method-Override'],
    bodyKeys: ['_method'],
  },
  container: {
    enabled: true,
    autoDiscover: false,
  },
});
```

> All config options are optional and can be safely omited to use the set defaults.

### `Router.configureDefaults(options?)`

Sets the base default config that persists across resets.

```ts
Router.configureDefaults({
  inferParamName: false,
});
```

### Available Config Options (`RouterConfig`)

| Option                      | Type                 | Default | Description                                                                                    |
| --------------------------- | -------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `inferParamName`            | `boolean`            | `false` | Infer route param names from base path (e.g. `/books` → `:book`). Requires `@h3ravel/support`. |
| `methodOverride.enabled`    | `boolean`            | `false` | Enable HTTP method override via header or body.                                                |
| `methodOverride.bodyKeys`   | `string \| string[]` | —       | Body parameter keys to check for method override.                                              |
| `methodOverride.headerKeys` | `string \| string[]` | —       | Header keys to check for method override.                                                      |
| `container.enabled`         | `boolean`            | `false` | Enable decorated handler parameter binding via a DI container.                                 |
| `container.autoDiscover`    | `boolean`            | `false` | Automatically instantiate unknown constructor tokens when resolving dependencies.              |

## Registering Routes

### HTTP Method Helpers

```ts
Router.get(path, handler, middlewares?)
Router.post(path, handler, middlewares?)
Router.put(path, handler, middlewares?)
Router.patch(path, handler, middlewares?)
Router.delete(path, handler, middlewares?)
Router.options(path, handler, middlewares?)
Router.head(path, handler, middlewares?)
```

**Example:**

```ts
import { Router } from 'clear-router/express';

Router.get('/users', UserController, [AuthMiddleware]);
Router.post('/users', UserController);
```

### `Router.add(methods, path, handler, middlewares?)`

Register a route for one or multiple HTTP methods at once.

```ts
Router.add(['get', 'post'], '/auth/login', loginHandler);
```

## Route Handlers

Handlers can be controller classes, controller methods, or plain callable functions. When using a callable, the framework's `HttpContext` is passed as the first argument, giving you direct access to the request, response, and Clear Router's own request/response wrappers.

### Callable Handlers

```ts
Router.get('/users', (ctx) => {
  // ctx is the framework-specific HttpContext
});
```

The shape of `ctx` depends on which framework router you are using.

**Express** — `clear-router/express`

```ts
import { HttpContext } from 'clear-router/express';

Router.get(
  '/users',
  ({ req, res, next, clearRequest, clearResponse }: HttpContext) => {
    res.json({ users: [] });
  },
);
```

| Property        | Type                 | Description                                |
| --------------- | -------------------- | ------------------------------------------ |
| `req`           | `RequestWithGetBody` | Express request, extended with `getBody()` |
| `res`           | `Response`           | Express response                           |
| `next`          | `NextFunction`       | Express next function                      |
| `clearRequest`  | `CoreRequest`        | Clear Router's normalised request wrapper  |
| `clearResponse` | `CoreResponse`       | Clear Router's normalised response wrapper |

**Fastify** — `clear-router/fastify`

```ts
import { HttpContext } from 'clear-router/fastify';

Router.get(
  '/users',
  ({ req, reply, clearRequest, clearResponse }: HttpContext) => {
    reply.send({ users: [] });
  },
);
```

| Property        | Type                 | Description                                |
| --------------- | -------------------- | ------------------------------------------ |
| `req`           | `RequestWithGetBody` | Fastify request, extended with `getBody()` |
| `reply`         | `FastifyReply`       | Fastify reply instance                     |
| `clearRequest`  | `CoreRequest`        | Clear Router's normalised request wrapper  |
| `clearResponse` | `CoreResponse`       | Clear Router's normalised response wrapper |

**H3** — `clear-router/h3`

```ts
import { HttpContext } from 'clear-router/h3';

Router.get('/users', ({ req, clearRequest, clearResponse }: HttpContext) => {
  return { users: [] };
});
```

| Property        | Type           | Description                                |
| --------------- | -------------- | ------------------------------------------ |
| `req`           | `HttpRequest`  | H3 HTTP request                            |
| `clearRequest`  | `CoreRequest`  | Clear Router's normalised request wrapper  |
| `clearResponse` | `CoreResponse` | Clear Router's normalised response wrapper |

> H3's `HttpContext` extends `H3Event`, so all H3 event utilities are available on `ctx` directly.

**Hono** — `clear-router/hono`

```ts
import { HttpContext } from 'clear-router/hono';

Router.get('/users', (ctx: HttpContext) => {
  return ctx.json({ users: [] });
});
```

| Property        | Type                 | Description                                |
| --------------- | -------------------- | ------------------------------------------ |
| `req`           | `RequestWithGetBody` | Hono request, extended with `getBody()`    |
| `clearRequest`  | `CoreRequest`        | Clear Router's normalised request wrapper  |
| `clearResponse` | `CoreResponse`       | Clear Router's normalised response wrapper |

> `HttpContext` extends Hono's native `Context`, so all Hono context methods (e.g. `ctx.json()`, `ctx.text()`) are available directly.

**Koa** — `clear-router/koa`

```ts
import { HttpContext } from 'clear-router/koa';

Router.get(
  '/users',
  ({ request, clearRequest, clearResponse, query, params }: HttpContext) => {
    // ...
  },
);
```

| Property        | Type                  | Description                                |
| --------------- | --------------------- | ------------------------------------------ |
| `request`       | `RequestWithGetBody`  | Koa request, extended with `getBody()`     |
| `clearRequest`  | `CoreRequest`         | Clear Router's normalised request wrapper  |
| `clearResponse` | `CoreResponse`        | Clear Router's normalised response wrapper |
| `params`        | `Record<string, any>` | Parsed route parameters                    |
| `query`         | `Record<string, any>` | Parsed query string parameters             |

> `HttpContext` extends `Koa.Context`, so all standard Koa context properties (`ctx.body`, `ctx.status`, etc.) are available.

## Route Parameters

Dynamic segments are declared with curly braces. They are converted to the
underlying framework's parameter syntax automatically, so the same route
definition works across every adapter.

```ts
Router.get('/users/{id}', UserController);
Router.get('/posts/{post}/comments/{comment}', CommentController);
```

### Optional Parameters

Append `?` to make a parameter optional. The route is registered both with and
without the segment.

```ts
Router.get('/users/{name?}', UserController);
// matches /users and /users/jane
```

### Scoped Parameters

A parameter may declare a binding field with `{param:field}`. The field is
exposed on the route and is used for URL generation and for model binding via
[`@arkormx/plugin-clear-router`](./plugins).

```ts
Router.get('/posts/{post:slug}', PostController);
Router.get('/locations/{location:slug}', LocationController);

Router.url('posts.show', { post: { slug: 'hello-world' } });
// → '/posts/hello-world'
```

### Regular Expression Constraints

Constrain a parameter to a pattern with the fluent `where*` helpers. When a
request value does not satisfy the constraint the route does not match and the
request falls through (resulting in a `404` if nothing else matches).

```ts
Router.get('/users/{id}', UserController).whereNumber('id');
Router.get('/posts/{slug}', PostController).where('slug', '[a-z-]+');
Router.get('/category/{name}', CategoryController).whereIn('name', ['movie', 'song']);
```

| Method                          | Constraint                                   |
| ------------------------------- | -------------------------------------------- |
| `where(name, pattern)`          | Custom regular expression (string or RegExp) |
| `where({ name: pattern, ... })` | Multiple custom constraints at once          |
| `whereNumber(...names)`         | `[0-9]+`                                      |
| `whereAlpha(...names)`          | `[a-zA-Z]+`                                   |
| `whereAlphaNumeric(...names)`   | `[a-zA-Z0-9]+`                               |
| `whereUuid(...names)`           | UUID                                          |
| `whereUlid(...names)`           | ULID                                         |
| `whereIn(name, values)`         | One of the given values                      |

#### Global Patterns

Use `Router.pattern()` to apply a constraint to every parameter sharing a name.
Per-route `where*` constraints take precedence over global patterns. Register
global patterns before calling `Router.apply()`.

```ts
Router.pattern('id', '[0-9]+');
Router.patterns({ slug: '[a-z-]+', uuid: '[0-9a-fA-F-]{36}' });
```

### Encoded Forward Slashes

By default a parameter matches a single path segment. Constraining it with a
pattern that allows `/` (for example `.*`) lets it span multiple segments. Clear
Router registers such parameters using each framework's catch-all syntax and
normalizes the captured value to a single string.

```ts
Router.get('/search/{search}', SearchController).where('search', '.*');
// GET /search/foo/bar/baz  →  search === 'foo/bar/baz'
```

> On Hono, the resolved value is available through the injected `clearRequest`
> (`clearRequest.params`) rather than `ctx.req.param()`, because Hono exposes
> params through a method rather than a mutable object.

## Resource Routes

### `Router.apiResource(basePath, controller, options?)`

Registers a standard set of CRUD routes for a controller.

```ts
Router.apiResource('/books', BookController);
```

Generated routes:

| Action    | Method | Path           | Route Name      |
| --------- | ------ | -------------- | --------------- |
| `index`   | GET    | `/books`       | `books.index`   |
| `show`    | GET    | `/books/:book` | `books.show`    |
| `create`  | POST   | `/books`       | `books.create`  |
| `update`  | PUT    | `/books/:book` | `books.update`  |
| `destroy` | DELETE | `/books/:book` | `books.destroy` |

> The param name (`:book`) is only inferred when `inferParamName: true` is set in config. Otherwise defaults to `:id`.

**Options:**

| Option        | Type                    | Description                      |
| ------------- | ----------------------- | -------------------------------- |
| `only`        | `ResourceAction[]`      | Whitelist specific actions       |
| `except`      | `ResourceAction[]`      | Blacklist specific actions       |
| `middlewares` | `ApiResourceMiddleware` | Global or per-action middlewares |

```ts
// Only specific actions
Router.apiResource('/books', BookController, {
  only: ['index', 'show'],
});

// Exclude an action
Router.apiResource('/books', BookController, {
  except: ['destroy'],
});

// Per-action middlewares
Router.apiResource('/books', BookController, {
  middlewares: {
    index: [AuthMiddleware],
    destroy: [AuthMiddleware, AdminMiddleware],
  },
});
```

`apiResource()` returns a `ResourceRoutes` collection. You can filter the generated actions after creation:

```ts
Router.apiResource('/books', BookController)
  .only('index', 'show');

Router.apiResource('/books', BookController)
  .except('destroy');
```

The collection can also be used for resource middleware chaining:

```ts
const books = Router.apiResource('/books', BookController)
  .only('index', 'show')
  .middleware(AuthMiddleware);

books.show()?.name('books.public.show');
```

## Groups & Prefixes

### `Router.group(prefix, source, middlewares?)`

Returns an awaitable `RouteGroup` that registers routes under a shared prefix.
The source may be a callback, file path, directory path, or an array containing
any combination of them.

```ts
await Router.group(
  '/api/v1',
  [
    'routes/users.ts',
    'routes/books',
    async () => {
      await prepareRoutes();
      Router.get('/status', StatusController);
    },
  ],
  [AuthMiddleware],
);
```

Relative paths resolve from `process.cwd()`. Absolute paths are accepted
directly. Directories are loaded recursively in alphabetical order and include
`.ts`, `.mts`, and `.cts` files, excluding declaration files.

Callback-based and nested groups continue to work:

```ts
await Router.group('/api', async () => {
  await Router.group('/v1', () => {
    Router.get('/users', UserController);
    Router.get('/books', BookController);
  });
});
```

Chain middleware onto the returned group:

```ts
await Router
  .group('/account', 'routes/account')
  .middleware(AuthMiddleware);
```

Use `when()` to filter group sources. Callback and direct file sources are
passed to the condition directly. Directory sources are expanded first, then
the condition receives each discovered absolute file path before it is imported.

```ts
await Router
  .group('/api', 'routes')
  .when((source) => {
    return typeof source !== 'string' || !source.endsWith('/api.ts');
  });
```

This allows a route entry file to load its surrounding directory without
importing itself. When the condition returns a falsy value, that callback or
file is rejected. Nested group conditions only affect their own routes.

### `Router.middleware(middlewares, callback)`

Applies middlewares to all routes defined within the callback without adding a prefix.

```ts
Router.middleware([AuthMiddleware], () => {
  Router.get('/dashboard', DashboardController);
  Router.get('/profile', ProfileController);
});
```

## Route Domains

Routes can be constrained to a host pattern. Placeholders in the pattern are
captured and merged into the route parameters, alongside any path parameters.
Host matching is performed for every adapter; a request whose host does not match
falls through (resulting in a `404` if nothing else matches).

### `Router.domain(pattern)`

Returns a registrar that scopes a group of routes to a host pattern.

```ts
Router.domain('{account}.example.com').group(() => {
  Router.get('/dashboard', ({ req, res }) => {
    res.json({ account: req.params.account });
  });
});
```

The registrar mirrors `Router.group`, so you can pass a prefix and middlewares,
and chain `.prefix()` / `.middleware()`:

```ts
Router
  .domain('{account}.example.com')
  .middleware([AuthMiddleware])
  .group('/admin', 'routes/admin');
```

### `route.domain(pattern)`

Constrain a single route to a host pattern.

```ts
Router
  .get('/team', TeamController)
  .domain('{account}.example.com')
  .name('team');
```

Domain parameters participate in URL generation. When a route has a domain,
`Router.url()` returns a protocol-relative absolute URL:

```ts
Router.url('team', { account: 'acme' });
// → '//acme.example.com/team'
```

## Named Routes & URL Generation

Every registered route can be assigned a name for later reference. Resource routes are named automatically (e.g. `books.index`, `books.show`).

### `Router.route(name)`

Look up a registered route by name.

```ts
const route = Router.route('books.show');
```

### `Router.url(name, params?)`

Generate a URL from a named route, substituting any dynamic segments.

```ts
Router.url('books.show', { book: '42' });
// → '/books/42'
```

For routes constrained to a [domain](#route-domains), the generated value is a
protocol-relative absolute URL that includes the resolved host.

```ts
Router.url('team', { account: 'acme' });
// → '//acme.example.com/team'
```

## Current Route

While a request is being handled, the matched route is available through the
router as well as the `Route` facade. Both read from the active request context,
so they return `undefined`/`''` when called outside of a request.

```ts
import { Router } from 'clear-router/express';
import { Route } from 'clear-router';

Router.get('/users/{id}', [UserController, 'show']).name('users.show');

// Inside the handler / a controller method:
Router.current();            // the matched Route instance
Router.currentRouteName();   // 'users.show'
Router.currentRouteAction(); // 'UserController@show' (or 'Closure' for callbacks)

// The same accessors exist on the Route facade:
Route.current();
Route.currentRouteName();
Route.currentRouteAction();
```

| Accessor                | Returns                                                       |
| ----------------------- | ------------------------------------------------------------ |
| `current()`             | The matched `Route` instance, or `undefined`                 |
| `currentRouteName()`    | The route name, or `''`                                      |
| `currentRouteAction()`  | `Controller@method`, `'Closure'`, or `''`                   |

## Accessing Routes

### `Router.allRoutes()`

```ts
// Array of all routes
Router.allRoutes();

// Keyed by path
Router.allRoutes('path');

// Keyed by HTTP method
Router.allRoutes('method');

// Keyed by name
Router.allRoutes('name');
```

## Providers

### `Router.setRequestProvider(provider)`

Override the base `Request` class with a custom implementation.

```ts
Router.setRequestProvider(CustomRequest);
```

### `Router.setResponseProvider(provider)`

Override the base `Response` class with a custom implementation.

```ts
Router.setResponseProvider(CustomResponse);
```

## Plugins

### `Router.use(plugin, options?)`

Register a plugin to extend router behaviour.

```ts
await Router.use(MyPlugin, {
  /* plugin options */
});
```

## Utilities

### `Router.normalizePath(path)`

Normalizes a path — ensures a leading slash, no trailing slash, and preserves dynamic segments.

```ts
Router.normalizePath('//books/:id/'); // → '/books/:id'
```

### `Router.reset()`

Resets the router to its default state. Useful in tests.

```ts
Router.reset();
```
