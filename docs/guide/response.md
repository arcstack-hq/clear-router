# Response

The `Response` class is clear-router's adapter-agnostic response abstraction. It is always available on the handler context as `ctx.clearResponse`, regardless of which underlying HTTP adapter (Express, Fastify, H3, Hono, or Koa) is in use.

It provides a consistent, chainable API for setting status codes, headers, and response bodies — without needing to know which adapter is running underneath.

---

## Properties

| Property     | Type      | Default         | Description                                             |
| ------------ | --------- | --------------- | ------------------------------------------------------- |
| `statusCode` | `number`  | `200`           | HTTP status code                                        |
| `statusText` | `string`  | `'OK'`          | HTTP status text                                        |
| `headers`    | `Headers` | `new Headers()` | Response headers                                        |
| `body`       | `any`     | `undefined`     | Response body, set by `send()` and its helpers          |
| `sent`       | `boolean` | `false`         | Whether a response body has been committed via `send()` |

---

## Methods

All setter methods return `this`, making the entire API fully chainable.

---

### `status(code: number): this`

Sets the HTTP status code.

```typescript
ctx.clearResponse.status(201);
```

---

### `code(code: number): this`

Alias for `status()`.

```typescript
ctx.clearResponse.code(201);
```

---

### `setStatusText(text: string): this`

Sets the HTTP status text.

```typescript
ctx.clearResponse.status(503).setStatusText('Service Unavailable');
```

---

### `setHeader(name: string, value: string): this`

Sets a response header.

```typescript
ctx.clearResponse.setHeader('X-Request-Id', 'abc-123');
```

---

### `header(name: string, value: string): this`

Alias for `setHeader()`.

```typescript
ctx.clearResponse.header('Cache-Control', 'no-store');
```

---

### `set(name: string, value: string): this`

Alias for `setHeader()`.

```typescript
ctx.clearResponse.set('X-Powered-By', 'clear-router');
```

---

### `type(contentType: string): this`

Sets the `Content-Type` response header.

```typescript
ctx.clearResponse.type('application/xml');
```

---

### `send(body?: any): this`

Sets the response body and marks the response as sent (`sent = true`).

```typescript
ctx.clearResponse.status(200).send({ ok: true });
```

> **Note:** Returning a value directly from a route handler is equivalent to calling `send()`. Use `clearResponse.send()` explicitly when you need to set headers or a status code before sending.

---

### `json(body: any): this`

Sends a JSON response. Sets `Content-Type` to `application/json; charset=utf-8` and calls `send()` internally.

```typescript
Router.get('/users', (ctx) => {
  return ctx.clearResponse.status(200).json({ users: [] });
});
```

---

### `html(body: string): this`

Sends an HTML response. Sets `Content-Type` to `text/html; charset=utf-8`.

```typescript
ctx.clearResponse.html('<h1>Hello</h1>');
```

---

### `text(body: string): this`

Sends a plain text response. Sets `Content-Type` to `text/plain; charset=utf-8`.

```typescript
ctx.clearResponse.text('pong');
```

---

### `noContent(): this`

Sends a `204 No Content` response with a `null` body.

```typescript
Router.delete('/users/{id}', (ctx) => {
  // ... delete logic
  return ctx.clearResponse.noContent();
});
```

---

## Accessing the Response

`ctx.clearResponse` is available in every route handler and middleware, regardless of the adapter.

```typescript
Router.post('/users', (ctx) => {
  const body = ctx.clearRequest.getBody();

  if (!body.name) {
    return ctx.clearResponse
      .status(422)
      .json({ error: 'The name field is required.' });
  }

  return ctx.clearResponse
    .status(201)
    .json({ message: 'User created.', name: body.name });
});
```

---

## Controller Usage

When using a controller class, `ctx` is destructured and passed as the first argument. `clearResponse` is accessible from it directly.

```typescript
class UserController {
  static store({ clearRequest, clearResponse }) {
    const body = clearRequest.getBody();

    if (!body.name) {
      return clearResponse.status(422).json({ error: 'Name is required.' });
    }

    return clearResponse.status(201).json({ name: body.name });
  }
}

Router.post('/users', [UserController, 'store']);
```

---

## Container Injection

When [container binding](./container-binding.md) is enabled, the `Response` instance can be injected directly into controller methods by type.

```typescript
import { Request, Response } from 'clear-router';

class UserController {
  static store(request: Request, response: Response) {
    const { name } = request.getBody();
    return response.status(201).json({ name });
  }
}

Router.post('/users', [UserController, 'store']);
```

---

## Extending Response

You can subclass `Response` and register it as the provider to have your custom class used in place of the default across all routes.

```typescript
import { Response } from 'clear-router';
import { Router } from './router';

class AppResponse extends Response {
  success(data: any) {
    return this.status(200).json({ success: true, data });
  }

  failure(message: string, code = 400) {
    return this.status(code).json({ success: false, message });
  }
}

Router.setResponseProvider(AppResponse);
```

Once registered, every `ctx.clearResponse` across all routes will be an instance of `AppResponse`.

```typescript
Router.post('/users', ({ clearResponse }) => {
  const body = clearResponse.getBody();

  if (!body.name) {
    return clearResponse.failure('Name is required.', 422);
  }

  return clearResponse.success({ name: body.name });
});
```
