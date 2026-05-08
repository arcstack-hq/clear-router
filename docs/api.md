# API Documentation

Complete API reference for clear-router

## Table of Contents

- [Static Properties](#static-properties)
- [Static Methods](#static-methods)
- [Types](#types)

## Static Properties

### routes

```javascript
static routes: Array
```

Array containing all registered routes with their configuration.

### prefix

```javascript
static prefix: string
```

Current route prefix used for grouping.

### groupMiddlewares

```javascript
static groupMiddlewares: Array<Function>
```

Middleware functions currently applied at the group level.

### globalMiddlewares

```javascript
static globalMiddlewares: Array<Function>
```

Middleware functions currently applied at the global level.

## Static Methods

## Direct Response Returns

Route handlers may either use the framework response object directly or return a response value.

This works across Express, Fastify, Hono, H3, and Koa adapters.

Supported direct return values include:

- `string`
- `number`
- `boolean`
- plain objects and arrays
- `Response`
- H3 `HTTPResponse`
- framework-native response objects
- thenable response objects such as Resora resources

```javascript
Router.get('/html', () => '<h1>Hello</h1>');
Router.get('/api/users', () => [{ id: 1, name: 'Ada' }]);
Router.post('/users', ({ req }) => ({ id: 1, ...req.getBody() }));
Router.get('/custom', () => new Response('Accepted', { status: 202 }));
```

Default response behavior:

- Returned objects and arrays are sent as JSON.
- HTML-like strings are sent as `text/html` for normal page requests.
- String responses for API/XHR-style requests are sent as `text/plain`.
- Returned numbers and booleans are sent as `text/plain`.
- Direct `POST` returns default to status `201`.
- Other direct returns default to status `200`.
- Native `Response` and H3 `HTTPResponse` values preserve their own status and headers.

Manual framework responses still work:

```javascript
Router.get('/legacy', ({ res }) => {
  res.status(200).send('Hello');
});
```

### normalizePath(path)

Normalize a path by removing duplicate slashes and ensuring a leading slash.

**Parameters:**

- `path` (string): Path to normalize

**Returns:** string - Normalized path

**Example:**

```javascript
Router.normalizePath('/api//users/'); // Returns: '/api/users'
```

### add(methods, path, handler, middlewares)

Register a route with one or more HTTP methods.

**Parameters:**

- `methods` (string | string[]): HTTP method(s) for the route
- `path` (string): Route path
- `handler` (Function | Array): Route handler or [Controller, method]
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.add('get', '/users', ({ res }) => res.send('Users'));
Router.add(['get', 'post'], '/data', handler);
```

### get(path, handler, middlewares)

Register a GET route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.get('/users', ({ res }) => res.json(users));
Router.get('/admin', [AdminController, 'index'], [authMiddleware]);
```

### post(path, handler, middlewares)

Register a POST route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.post('/users', ({ req, res }) => {
  const user = createUser(req.body);
  res.json(user);
});
```

### put(path, handler, middlewares)

Register a PUT route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.put('/users/:id', [UserController, 'update']);
```

### delete(path, handler, middlewares)

Register a DELETE route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.delete('/users/:id', ({ req, res }) => {
  deleteUser(req.params.id);
  res.sendStatus(204);
});
```

### patch(path, handler, middlewares)

Register a PATCH route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.patch('/users/:id', [UserController, 'patch']);
```

### options(path, handler, middlewares)

Register an OPTIONS route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.options('/api/*', ({ res }) => {
  res.set('Allow', 'GET, POST, PUT, DELETE');
  res.sendStatus(200);
});
```

### head(path, handler, middlewares)

Register a HEAD route.

**Parameters:**

- `path` (string): Route path
- `handler` (Function | Array): Route handler
- `middlewares` (Function[]): Optional middleware functions

**Example:**

```javascript
Router.head('/users/:id', [UserController, 'exists']);
```

### group(prefix, callback, middlewares)

Group routes under a common prefix with optional middlewares.

**Parameters:**

- `prefix` (string): URL prefix for all routes in the group
- `callback` (Function): Sync or async function containing route definitions
- `middlewares` (Function[]): Optional middleware functions

**Returns:** `Promise<void>`

**Example:**

```javascript
Router.group(
  '/api',
  () => {
    Router.get('/users', handler); // Becomes: /api/users
    Router.get('/posts', handler); // Becomes: /api/posts
  },
  [apiMiddleware],
);

// Async group callback
await Router.group('/api', async () => {
  await loadRoutes();
  Router.get('/status', handler); // Becomes: /api/status
});

// Nested groups
Router.group('/api', () => {
  Router.group('/v1', () => {
    Router.get('/users', handler); // Becomes: /api/v1/users
  });
});
```

### configure(options)

Configure HTTP method override behavior for POST requests.

**Parameters:**

- `options.methodOverride.enabled` (boolean): Enable/disable method override support
- `options.methodOverride.bodyKeys` (string | string[]): Body key(s) to inspect for method override
- `options.methodOverride.headerKeys` (string | string[]): Header key(s) to inspect for method override
- `options.container.enabled` (boolean): Enable/disable decorated handler argument binding
- `options.container.autoDiscover` (boolean): Instantiate unknown class tokens when no explicit container binding exists

When enabled, a POST request can target `put`, `patch`, `delete`, or `post` route handlers based on configured override keys.

Default keys:

- Body: `_method`
- Header: `x-http-method`

**Example:**

```javascript
Router.configure({
  methodOverride: {
    bodyKeys: ['_method', 'method'],
    headerKeys: ['x-http-method', 'x-method-override'],
  },
});

Router.put('/users/:id', handler);
// POST /users/12 with body { "method": "PUT" } routes to PUT handler
```

```javascript
Router.configure({ methodOverride: { enabled: false } });
```

```javascript
Router.configure({
  container: {
    enabled: true,
    autoDiscover: true,
  },
});
```

See [Container Binding](./guide/container-binding) for decorator and container usage, including TS 5.2+ standard decorators.

```javascript
import 'clear-router/decorators/setup';
```

The setup entry imports `reflect-metadata` and enables container binding defaults for all adapters.

### middleware(middlewares, callback)

Apply global middlewares to all routes defined within the callback.

**Parameters:**

- `middlewares` (Function[]): Middleware functions to apply
- `callback` (Function): Function containing route definitions

**Example:**

```javascript
Router.middleware([authMiddleware, logMiddleware], () => {
  Router.get('/profile', handler);
  Router.get('/settings', handler);
});
```

### allRoutes()

Get information about all registered routes.

**Returns:** `Array<Route>`

**Route Object:**

```javascript
{
  methods: string[],        // HTTP methods
  path: string,             // Full route path
  middlewareCount: number,  // Number of middlewares
  handlerType: string,       // 'function' or 'controller'
  handler: Handler           // Original handler definition
  middlewares: Middleware[]  // Array of middleware functions
  controllerName?: string     // Controller class name (if applicable)
  actionName?: string         // Controller method name (if applicable)
}
```

**Example:**

```javascript
Router.get('/users', handler);
Router.post('/posts', [PostController, 'create'], [authMiddleware]);

const routes = Router.allRoutes();
console.log(routes);
// Output:
// [
//   {
//     methods: ['get'],
//     path: '/users',
//     middlewareCount: 0,
//     handlerType: 'function'
//   },
//   {
//     methods: ['post'],
//     path: '/posts',
//     middlewareCount: 1,
//     handlerType: 'controller'
//   }
// ]
```

### apply(router)

Apply all registered routes to an Express Router instance.

**Parameters:**

- `router` (express.Router): Express Router instance

**Returns:** `Promise<void>`

**Example:**

```javascript
const express = require('express');
const Routes = require('clear-router');

const app = express();
const router = express.Router();

// Define routes
Router.get('/hello', ({ res }) => res.send('Hello'));

// Apply to router
await Router.apply(router);

// Use in app
app.use(router);
```

## Types

### HttpContext

Context object passed to route handlers.

```typescript
interface HttpContext {
  req: express.Request & { getBody: () => Record<string, any> };
  res: express.Response;
  next: express.NextFunction;
}
```

Request body accessor behavior:

- `req.getBody()` is always available in Express handlers.
- `ctx.req.getBody()` is always available in H3 handlers.
- Returns parsed body when present, otherwise `{}`.

**Example:**

```javascript
Router.get('/users', ({ req, res, next }) => {
  try {
    const users = getUsers();
    res.json(users);
  } catch (error) {
    next(error);
  }
});

Router.post('/users', ({ req, res }) => {
  const body = req.getBody();
  res.json({ hasName: Boolean(body.name) });
});
```

### Handler Types

#### Function Handler

```javascript
(ctx, clearRequest?) => any | Promise<any>
```

`ctx` is always the first argument:

- Express: `{ req, res, next }`
- Fastify: `{ req, reply }`
- Hono: Hono context
- H3: `H3Event`
- Koa: Koa context

`clearRequest` is passed as second argument and is guaranteed for controller handlers.

For callback route handlers, `this` is bound to the current route instance. During request execution, this instance is hydrated with:

- `this.ctx`
- `this.body`
- `this.query`
- `this.params`
- `this.clearRequest`

#### Controller Handler

```javascript
[ControllerClass, 'methodName'];
```

For controller instance handlers, the router hydrates request data on `this` before method execution:

- `this.body`
- `this.query`
- `this.params`
- `this.clearRequest`

#### Custom Controller Pattern (Recommended)

You can extend the clear-router `Controller` to create an app-specific base controller and share behavior across feature controllers.

```typescript
class AppController extends Controller<HttpContext> {
  ok(data: any) {
    this.ctx.res.json({ success: true, data });
  }

  get userId() {
    return this.params?.id;
  }
}

class UserController extends AppController {
  show() {
    this.ok({ id: this.userId, query: this.query });
  }
}

Router.get('/users/:id', [UserController, 'show']);
```

#### Benefits

- Shared helpers live in one place.
- Hydrated request state is consistently available on `this`.
- Feature controllers stay small and focused.
- Controller behavior is easier to test and enforce.

**Static Method:**

```javascript
class UserController {
  static index({ res }) {
    res.send('Users');
  }
}

Router.get('/users', [UserController, 'index']);
```

**Instance Method:**

```javascript
class UserController {
  index({ res }) {
    res.send('Users');
  }
}

Router.get('/users', [UserController, 'index']);
```

### Middleware

Standard Express middleware function.

```javascript
(req, res, next) => void | Promise<void>
```

**Example:**

```javascript
const authMiddleware = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};
```

## Error Handling

All errors during route execution are automatically passed to Express error handling middleware.

**Example:**

```javascript
// Route with potential error
Router.get('/users/:id', async ({ req, res }) => {
  const user = await getUserById(req.params.id);
  if (!user) {
    throw new Error('User not found');
  }
  res.json(user);
});

// Express error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message,
  });
});
```

## Middleware Execution Order

Middlewares are executed in the following order:

1. Global middlewares (from `Router.middleware()`)
2. Group middlewares (from `Router.group()`)
3. Route-specific middlewares (passed to individual route methods)

**Example:**

```javascript
const globalMw = (req, res, next) => {
  console.log('Global');
  next();
};
const groupMw = (req, res, next) => {
  console.log('Group');
  next();
};
const routeMw = (req, res, next) => {
  console.log('Route');
  next();
};

Router.middleware([globalMw], () => {
  Router.group(
    '/api',
    () => {
      Router.get('/users', handler, [routeMw]);
    },
    [groupMw],
  );
});

// Execution: Global -> Group -> Route
```

## Best Practices

### 1. Route Organization

```javascript
// routes/users.js
export default (Routes) => {
  Router.group('/users', () => {
    Router.get('/', [UserController, 'index']);
    Router.post('/', [UserController, 'create']);
    Router.get('/:id', [UserController, 'show']);
    Router.put('/:id', [UserController, 'update']);
    Router.delete('/:id', [UserController, 'destroy']);
  });
};

// main.js
require('./routes/users')(Routes);
```

### 2. Middleware Composition

```javascript
const authenticate = (req, res, next) => {
  /* ... */ next();
};
const authorize = (role) => (req, res, next) => {
  /* ... */ next();
};
const validate = (schema) => (req, res, next) => {
  /* ... */ next();
};

Router.post(
  '/admin/users',
  [AdminController, 'create'],
  [authenticate, authorize('admin'), validate(userSchema)],
);
```

### 3. Error Handling

```javascript
// Always use try-catch in async handlers
Router.get('/users/:id', async ({ req, res, next }) => {
  try {
    const user = await User.findById(req.params.id);
    res.json(user);
  } catch (error) {
    next(error); // Pass to Express error handler
  }
});
```

### 4. Controller Organization

```javascript
class UserController {
  static async index({ res }) {
    const users = await User.findAll();
    res.json(users);
  }

  static async show({ req, res }) {
    const user = await User.findById(req.params.id);
    res.json(user);
  }

  static async create({ req, res }) {
    const user = await User.create(req.body);
    res.status(201).json(user);
  }

  static async update({ req, res }) {
    const user = await User.update(req.params.id, req.body);
    res.json(user);
  }

  static async destroy({ req, res }) {
    await User.delete(req.params.id);
    res.sendStatus(204);
  }
}
```
