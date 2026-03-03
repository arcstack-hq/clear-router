# Using with Express

## Quick Start

### CommonJS

```javascript
const express = require('express');
const Router = require('clear-router/express');

const app = express();
const router = express.Router();

Router.get('/hello', ({ res }) => {
  res.send('Hello World');
});

Router.apply(router);
app.use(router);

app.listen(3000);
```

### ESM

```javascript
import express from 'express';
import Router from 'clear-router/express';

const app = express();
const router = express.Router();

Router.get('/hello', ({ res }) => {
  res.send('Hello World');
});

await Router.apply(router);
app.use(router);

app.listen(3000);
```

### TypeScript

```typescript
import express from 'express';
import Router from 'clear-router/express';

const app = express();
const router = express.Router();

Router.get('/hello', ({ res }) => {
  res.send('Hello World');
});

await Router.apply(router);
app.use(router);

app.listen(3000);
```

## Usage Examples

### Basic Route

```javascript
Router.get('/hello', ({ res }) => {
  res.send('Hello World');
});
```

### With Middleware

```javascript
const authMiddleware = (req, res, next) => {
  // auth logic
  next();
};

Router.post('/secure', ({ res }) => res.send('Protected'), [authMiddleware]);
```

### Controller Binding

```javascript
class UserController {
  static index({ res }) {
    res.send('User List');
  }
}

Router.get('/users', [UserController, 'index']);
```

Class-based handlers will auto-bind to static or instance methods.

### Custom Controllers (Extending the Base Controller)

For advanced use cases, you can create project-specific controller base classes that extend the clear-router `Controller`.

```typescript
// Example app-level base controller
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

- Centralizes shared response helpers and controller utilities.
- Reuses hydrated request data (`this.ctx`, `this.body`, `this.query`, `this.params`, `this.clearRequest`) consistently.
- Reduces repeated boilerplate across controllers.
- Makes controller behavior easier to standardize and test.

### Handler Arguments and ClearRequest

Express handlers are invoked with:

1. `ctx`: `{ req, res, next }`
2. `clearRequest`: `ClearRequest | undefined`

```javascript
Router.post('/users', ({ req, res }, clearRequest) => {
  // clearRequest is available for controller handlers
  // and may be undefined for plain function handlers
  res.json({ hasReq: Boolean(req), hasClearRequest: Boolean(clearRequest) });
});
```

For controller instance handlers (`[ControllerClass, 'method']`), router hydration includes:

- `this.body` (request body)
- `this.query` (request query)
- `this.params` (route params)
- `this.clearRequest` (normalized request wrapper)

### API Resource Binding

You can also bind routes to API resources:

```javascript
class UserController {
  index({ res }) {
    res.send([{ name: 'User 1' }, { name: 'User 2' }]);
  }
  show({ res }) {
    res.send({ name: 'User 1' });
  }
  create({ res }) {
    res.send('User created');
  }
  update({ res }) {
    res.send('User updated');
  }
  destroy({ res }) {
    res.send('User deleted');
  }
}

Router.apiResource('/users', UserController);
```

### Grouped Routes

```javascript
Router.group('/admin', () => {
  Router.get('/dashboard', ({ res }) => res.send('Admin Panel'));
});
```

With middleware:

```javascript
Router.group(
  '/secure',
  () => {
    Router.get('/data', ({ res }) => res.send('Secure Data'));
  },
  [authMiddleware],
);
```

### Global Middleware Scope

```javascript
Router.middleware([authMiddleware], () => {
  Router.get('/profile', ({ res }) => res.send('My Profile'));
});
```

### Multiple HTTP Methods

```javascript
Router.add(['get', 'post'], '/handle', ({ req, res }) => {
  res.send(`Method: ${req.method}`);
});
```

### Inspecting Routes

```javascript
Router.get('/hello', ({ res }) => res.send('Hello'));
Router.post('/world', ({ res }) => res.send('World'));

const allRoutes = Router.allRoutes();
console.log(allRoutes);
// Output:
// [
//   { methods: ['get'], path: '/hello', middlewareCount: 0, handlerType: 'function' },
//   { methods: ['post'], path: '/world', middlewareCount: 0, handlerType: 'function' }
// ]
```

## API Reference

See [API.md](API.md) for complete API documentation.

## Error Handling

All errors during route execution are automatically passed to Express error handling middleware using `next(error)`. You can define your error handler:

```javascript
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});
```

## Middleware Execution Order

```txt
[ Global Middleware ] → [ Group Middleware ] → [ Route Middleware ]
```

## Handler Execution

- If function: executed directly
- If [Controller, 'method']: auto-instantiated (if needed), method is called
- First argument is always `ctx` (`{ req, res, next }`)
- Second argument is `clearRequest` (defined for controller handlers)

## Testing

```bash
npm test              # Run all tests
npm run test:cjs      # Test CommonJS
npm run test:esm      # Test ESM
npm run test:ts       # Test TypeScript
```

See [TESTING.md](./TESTING.md) for detailed testing guide.

## Examples

```bash
npm run example       # CommonJS example
npm run example:esm   # ESM example
npm run example:ts    # TypeScript example
```

Check `example/` directory for full working demos.
