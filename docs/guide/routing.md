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
| `only`        | `ControllerAction[]`    | Whitelist specific actions       |
| `except`      | `ControllerAction[]`    | Blacklist specific actions       |
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

## Groups & Prefixes

### `Router.group(prefix, callback, middlewares?)`

Nests routes under a shared prefix, with optional shared middlewares.

```ts
await Router.group(
  '/api/v1',
  async () => {
    Router.get('/users', UserController);
    Router.get('/books', BookController);
  },
  [AuthMiddleware],
);
```

### `Router.middleware(middlewares, callback)`

Applies middlewares to all routes defined within the callback without adding a prefix.

```ts
Router.middleware([AuthMiddleware], () => {
  Router.get('/dashboard', DashboardController);
  Router.get('/profile', ProfileController);
});
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
