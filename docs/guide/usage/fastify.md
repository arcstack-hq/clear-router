# Using with Fastify

## Quick Start

### ESM

```javascript
import Fastify from 'fastify';
import Router from 'clear-router/fastify';

const app = Fastify();

Router.get('/hello', () => {
  return 'Hello World';
});

Router.apply(app);

await app.listen({ port: 3000 });
```

### TypeScript

```typescript
import Fastify from 'fastify';
import Router from 'clear-router/fastify';

const app = Fastify();

Router.get('/hello', () => {
  return 'Hello World';
});

Router.apply(app);

await app.listen({ port: 3000 });
```

## Usage Examples

### Basic Route

```javascript
Router.get('/hello', () => {
  return 'Hello World';
});
```

### Direct Return Values

Fastify handlers can return response values directly. You can still use `reply.send()`, `reply.code()`, and other Fastify reply methods when you need explicit control.

```javascript
Router.get('/hello', () => 'Hello World');
Router.get('/page', () => '<h1>Hello</h1>');
Router.get('/users', () => [{ id: 1, name: 'Ada' }]);
Router.post('/users', ({ req }) => ({ id: 1, ...req.getBody() }));
Router.get('/accepted', () => new Response('Accepted', { status: 202 }));
```

Direct `POST` returns default to `201`; other methods default to `200`. HTML-like strings are sent as `text/html`, API/XHR string responses as `text/plain`, and objects/arrays as JSON.

### With Middleware

```javascript
const authMiddleware = async (req, reply) => {
  // auth logic
};

Router.post('/secure', () => ({ ok: true }), [authMiddleware]);
```

### Method Override

clear-router supports HTTP method override for POST requests using body keys or headers.

Default override keys:

- Body: `_method`
- Header: `X-HTTP-Method`

```javascript
Router.put('/users/:id', ({ req }) => {
  return { method: req.method, id: req.params.id };
});

// POST /users/12 with body { "_method": "PUT" }
```

Custom keys are supported:

```javascript
Router.configure({
  methodOverride: {
    bodyKeys: ['_method', 'method'],
    headerKeys: ['x-http-method', 'x-method-override'],
  },
});
```

Disable override behavior:

```javascript
Router.configure({ methodOverride: { enabled: false } });
```

### Request Body Access via `req.getBody()`

clear-router patches Fastify requests with `req.getBody()` for consistent body access in handlers and controllers.

- Always available in route handlers.
- Returns parsed request body when present.
- Returns `{}` when the request has no body.

```javascript
Router.post('/users', ({ req }) => {
  const body = req.getBody();
  return { hasName: Boolean(body.name) };
});

Router.get('/status', ({ req }) => {
  return { body: req.getBody() }; // {}
});
```

### Controller Binding

```javascript
class UserController {
  index() {
    return 'User List';
  }
}

Router.get('/users', [UserController, 'index']);
```

### Handler Arguments and ClearRequest

Fastify handlers are invoked with:

1. `ctx`: `{ req, reply }`
2. `clearRequest`: `ClearRequest | undefined`

```javascript
Router.post('/users', ({ req }, clearRequest) => {
  return {
    hasReq: Boolean(req),
    hasClearRequest: Boolean(clearRequest),
  };
});
```

For controller instance handlers (`[ControllerClass, 'method']`), router hydration includes:

- `this.body` (from `req.getBody()`)
- `this.query` (query params)
- `this.params` (route params)
- `this.clearRequest` (normalized request wrapper)

### API Resource Binding

```javascript
class UserController {
  index() {
    return [{ name: 'User 1' }, { name: 'User 2' }];
  }
  show() {
    return { name: 'User 1' };
  }
  create() {
    return 'User created';
  }
  update() {
    return 'User updated';
  }
  destroy() {
    return 'User deleted';
  }
}

Router.apiResource('/users', UserController);
```

### Grouped Routes

```javascript
Router.group('/admin', () => {
  Router.get('/dashboard', () => 'Admin Panel');
});
```

With middleware:

```javascript
Router.group(
  '/secure',
  () => {
    Router.get('/data', () => 'Secure Data');
  },
  [authMiddleware],
);
```

### Global Middleware Scope

```javascript
Router.middleware([authMiddleware], () => {
  Router.get('/profile', () => 'My Profile');
});
```

### Multiple HTTP Methods

```javascript
Router.add(['get', 'post'], '/handle', ({ req }) => {
  return `Method: ${req.method}`;
});
```

### Inspecting Routes

```javascript
Router.get('/hello', () => 'Hello');
Router.post('/world', () => 'World');

const allRoutes = Router.allRoutes();
console.log(allRoutes);
```

## API Reference

See [API](../api) for complete API documentation.

## Testing

```bash
npm test
npm run test:ts
```

See [Testing](../testing) for detailed testing guide.
