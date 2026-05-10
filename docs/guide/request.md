# Request

The `Request` class is clear-router's adapter-agnostic request abstraction. It is always available on the handler context as `ctx.clearRequest`, regardless of which underlying HTTP adapter (Express, Fastify, H3, Hono, or Koa) is in use.

It normalizes the raw adapter request into a consistent interface, so route handlers and middleware can read the request body, headers, parameters, and metadata without knowing which adapter is running underneath.

---

## Properties

| Property   | Type                             | Default | Description                                             |
| ---------- | -------------------------------- | ------- | ------------------------------------------------------- |
| `body`     | `RequestData`                    | `{}`    | Parsed request body                                     |
| `query`    | `RequestData`                    | `{}`    | Parsed query string parameters                          |
| `params`   | `RequestData`                    | `{}`    | Parsed route parameters                                 |
| `route`    | `Route`                          | —       | The matched route instance                              |
| `method`   | `string`                         | `'GET'` | HTTP method in uppercase (e.g. `'POST'`)                |
| `path`     | `string`                         | `'/'`   | Request pathname (e.g. `'/users/1'`)                    |
| `url`      | `string`                         | `'/'`   | Full request URL, including query string                |
| `headers`  | `Headers \| Record<string, any>` | `{}`    | Request headers                                         |
| `original` | `any`                            | —       | The raw adapter request object (`req`, `request`, etc.) |
| `ctx`      | `any`                            | —       | The full adapter context object                         |

---

## Methods

### `getBody()`

Returns the parsed request body. Always returns an empty object instead of `undefined` when no body is present.

```typescript
Router.post('/users', (ctx) => {
  const body = ctx.clearRequest.getBody();
  // { name: 'Legacy', email: 'legacy@example.com' }
});
```

---

### `header(name: string): string`

Retrieves a single request header by name. Works with both the Web `Headers` API and plain header objects. Returns an empty string if the header is not found.

```typescript
Router.post('/users', (ctx) => {
  const contentType = ctx.clearRequest.header('content-type');
  const auth = ctx.clearRequest.header('Authorization');
});
```

---

### `param(name: string): any`

Retrieves a single route parameter by name.

```typescript
// Route: /users/{id}
Router.get('/users/{id}', (ctx) => {
  const id = ctx.clearRequest.param('id'); // '42'
});
```

---

### `input(name: string): any`

Retrieves a value by key, searching `body`, then `query`, then `params` — in that order. Useful when a value could arrive through any of these channels.

```typescript
Router.get('/search', (ctx) => {
  const term = ctx.clearRequest.input('q');
  // Checks body.q first, then ?q=..., then route params
});
```

---

### `is(method: string): boolean`

Checks whether the request was made with the given HTTP method. Case-insensitive.

```typescript
Router.add(['get', 'post'], '/users', (ctx) => {
  if (ctx.clearRequest.is('post')) {
    // handle creation
  }
});
```

---

## Accessing the Request

`ctx.clearRequest` is available in every route handler and middleware, regardless of the adapter.

```typescript
Router.post('/users', (ctx) => {
  const request = ctx.clearRequest;

  const body = request.getBody();
  const page = request.input('page');
  const id = request.param('id');
  const token = request.header('Authorization');
  const isPost = request.is('post');
});
```

---

## Controller Usage

When using a controller class, `ctx` is destructured and passed as the first argument. `clearRequest` is accessible from it directly.

```typescript
class UserController {
  static store({ clearRequest }) {
    const body = clearRequest.getBody();
    return { name: body.name };
  }
}

Router.post('/users', [UserController, 'store']);
```

---

## Container Injection

When [container binding](./container.md) is enabled, the `Request` instance can be injected directly into controller methods by type.

```typescript
import { Request } from 'clear-router';

class UserController {
  static store(request: Request) {
    const { name } = request.getBody();
    return { name };
  }
}

Router.post('/users', [UserController, 'store']);
```

---

## Extending Request

You can subclass `Request` and register it as the provider to have your custom class used in place of the default across all routes.

```typescript
import { Request } from 'clear-router';
import { Router } from './router';

class AppRequest extends Request {
  get isJson(): boolean {
    return this.header('content-type').includes('application/json');
  }

  get bearerToken(): string | null {
    const auth = this.header('Authorization');
    return auth.startsWith('Bearer ') ? auth.slice(7) : null;
  }
}

Router.setClearRequestProvider(AppRequest);
```

Once registered, every `ctx.clearRequest` across all routes will be an instance of `AppRequest`.

```typescript
Router.post('/login', ({ clearRequest }) => {
  return {
    isJson: clearRequest.isJson,
    bearerToken: clearRequest.bearerToken,
  };
});
```
