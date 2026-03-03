# Testing Guide

Comprehensive testing guide for clear-router

## Table of Contents

- [Test Setup](#test-setup)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [CommonJS Tests](#commonjs-tests)
- [ESM Tests](#esm-tests)
- [TypeScript Tests](#typescript-tests)
- [Writing Custom Tests](#writing-custom-tests)

## Test Setup

### Prerequisites

```bash
pnpm install
```

This will install all required dependencies including:

- vitest (test framework)
- supertest (HTTP testing)
- typescript & ts-node (TypeScript support)

### Configuration Files

#### vitest.config.js

```javascript
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],

  test: {
    retry: 10,
    root: './',
    passWithNoTests: true,
    environment: 'node',
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/cypress/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
        '**/.h3ravel/**',
      ],
    },
  },
});
```

#### tsconfig.json

```json
{
  "compilerOptions": {
    "module": "es2022",
    "target": "es2022",
    "lib": ["es2022", "DOM"],
    "esModuleInterop": true,
    "skipLibCheck": true,
    "strict": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./",
    "types": ["node", "vitest", "express"],
    "baseUrl": ".",
    "paths": {
      "clear-router/express": ["src/express/routes.ts"],
      "clear-router/express/*": ["src/express/*"],
      "clear-router/h3": ["src/h3/routes.ts"],
      "clear-router/h3/*": ["src/h3/*"]
    }
  },
  "include": ["tests/**/*", "types/**/*", "example/**/*"],
  "exclude": ["node_modules"]
}
```

## Running Tests

### All Tests

```bash
pnpm test
```

This runs all test suites: CommonJS, ESM, and TypeScript.

### Individual Test Suites

```bash
# ESM only
pnpm run test:esm

# TypeScript only
pnpm run test:ts
```

### Watch Mode

```bash
# Watch ESM tests
npx vitest --watch tests/esm.test.ts

# Watch TypeScript tests
npx vitest --watch tests/typescript.test.ts
```

### Coverage

```bash
npx vitest --coverage
```

## Test Structure

All tests follow a similar structure testing:

1. Basic route registration (GET, POST, PUT, DELETE, PATCH)
2. Route grouping
3. Middleware application (global, group, route-level)
4. Controller bindings (static and instance)
5. Error handling
6. Route inspection with `allRoutes()`
7. Controller instance request hydration (`body`, `query`, `params`, `clearRequest`)
8. Handler argument contract (context as first arg, `clearRequest` as second arg)

## CommonJS Tests

File: `tests/commonjs.test.js`

### Example Test

```javascript
const request = require('supertest');
const express = require('express');
const Routes = require('../src/routes');

describe('Express Routing - CommonJS', () => {
  let app;
  let router;

  beforeEach(() => {
    // Reset routes before each test
    Router.routes = [];
    Router.prefix = '';
    Router.groupMiddlewares = [];
    Router.globalMiddlewares = [];

    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(() => {
    Router.apply(router);
    app.use(router);
  });

  test('should register and handle GET route', async () => {
    Router.get('/test', ({ res }) => {
      res.json({ message: 'success' });
    });

    const response = await request(app).get('/test');
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('success');
  });

  test('should apply middleware correctly', async () => {
    const middleware = (req, res, next) => {
      req.customValue = 'middleware-applied';
      next();
    };

    Router.get(
      '/middleware-test',
      ({ req, res }) => {
        res.json({ value: req.customValue });
      },
      [middleware],
    );

    const response = await request(app).get('/middleware-test');
    expect(response.body.value).toBe('middleware-applied');
  });

  test('should handle route groups', async () => {
    Router.group('/api', () => {
      Router.get('/users', ({ res }) => {
        res.json({ route: 'users' });
      });
    });

    const response = await request(app).get('/api/users');
    expect(response.status).toBe(200);
    expect(response.body.route).toBe('users');
  });

  test('should bind controller methods', async () => {
    class TestController {
      static index({ res }) {
        res.json({ controller: 'static' });
      }
    }

    Router.get('/controller', [TestController, 'index']);

    const response = await request(app).get('/controller');
    expect(response.body.controller).toBe('static');
  });

  test('should handle errors properly', async () => {
    Router.get('/error', () => {
      throw new Error('Test error');
    });

    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Test error');
  });

  test('should return all routes info', () => {
    Router.get('/route1', ({ res }) => res.send('ok'));
    Router.post('/route2', ({ res }) => res.send('ok'));

    const allRoutes = Router.allRoutes();
    expect(allRoutes).toHaveLength(2);
    expect(allRoutes[0].methods).toContain('get');
    expect(allRoutes[0].path).toBe('/route1');
    expect(allRoutes[1].methods).toContain('post');
  });
});
```

## ESM Tests

File: `tests/esm.test.mjs`

### Example Test

```javascript
import request from 'supertest';
import express from 'express';
import Router from '../src/routes.mjs';

describe('Express Routing - ESM', () => {
  let app;
  let router;

  beforeEach(() => {
    Router.routes = [];
    Router.prefix = '';
    Router.groupMiddlewares = [];
    Router.globalMiddlewares = [];

    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(async () => {
    await Router.apply(router);
    app.use(router);
  });

  test('should register GET route with ESM', async () => {
    Router.get('/esm-test', ({ res }) => {
      res.json({ module: 'esm' });
    });

    const response = await request(app).get('/esm-test');
    expect(response.status).toBe(200);
    expect(response.body.module).toBe('esm');
  });

  test('should handle async handlers', async () => {
    Router.get('/async', async ({ res }) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      res.json({ async: true });
    });

    const response = await request(app).get('/async');
    expect(response.body.async).toBe(true);
  });

  test('should support multiple methods', async () => {
    Router.add(['get', 'post'], '/multi', ({ req, res }) => {
      res.json({ method: req.method });
    });

    const getResponse = await request(app).get('/multi');
    expect(getResponse.body.method).toBe('GET');

    const postResponse = await request(app).post('/multi');
    expect(postResponse.body.method).toBe('POST');
  });
});
```

### Running ESM Tests

ESM tests require special Node.js flags:

```bash
NODE_OPTIONS=--experimental-vm-modules npx vitest tests/esm.test.ts
```

Or use the pnpm script:

```bash
pnpm run test:esm
```

## TypeScript Tests

File: `tests/typescript.test.ts`

### Example Test

```typescript
import request from 'supertest';
import express, { Router } from 'express';
import Router, { HttpContext, RouteInfo } from '../types/index';

describe('Express Routing - TypeScript', () => {
  let app: express.Application;
  let router: Router;

  beforeEach(() => {
    Router.routes = [];
    Router.prefix = '';
    Router.groupMiddlewares = [];
    Router.globalMiddlewares = [];

    app = express();
    router = Router();
    app.use(express.json());
  });

  afterEach(async () => {
    await Router.apply(router);
    app.use(router);
  });

  test('should work with TypeScript types', async () => {
    Router.get('/typescript', ({ req, res }: HttpContext) => {
      res.json({ typed: true });
    });

    const response = await request(app).get('/typescript');
    expect(response.body.typed).toBe(true);
  });

  test('should type check route info', () => {
    Router.get('/info', ({ res }: HttpContext) => res.send('ok'));

    const routes: RouteInfo[] = Router.allRoutes();
    expect(routes[0].path).toBe('/info');
    expect(routes[0].handlerType).toBe('function');
  });

  test('should type check controller', async () => {
    class UserController {
      static index({ res }: HttpContext): void {
        res.json({ users: [] });
      }
    }

    Router.get('/users', [UserController, 'index']);

    const response = await request(app).get('/users');
    expect(response.body.users).toEqual([]);
  });

  test('should handle typed middleware', async () => {
    const authMiddleware = (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      req.body.authenticated = true;
      next();
    };

    Router.post(
      '/auth',
      ({ req, res }: HttpContext) => {
        res.json({ auth: req.body.authenticated });
      },
      [authMiddleware],
    );

    const response = await request(app).post('/auth');
    expect(response.body.auth).toBe(true);
  });
});
```

### Running TypeScript Tests

```bash
pnpm run test:ts
```

Or directly:

```bash
npx ts-node tests/typescript.test.ts
```

## Writing Custom Tests

### Test Template

```javascript
const request = require('supertest');
const express = require('express');
const Routes = require('clear-router');

describe('My Custom Tests', () => {
  let app;
  let router;

  beforeEach(() => {
    // Reset Routes state
    Router.routes = [];
    Router.prefix = '';
    Router.groupMiddlewares = [];
    Router.globalMiddlewares = [];

    // Create fresh Express app and router
    app = express();
    router = express.Router();
    app.use(express.json());
  });

  afterEach(async () => {
    // Apply routes after each test
    await Router.apply(router);
    app.use(router);
  });

  test('your test description', async () => {
    // Define routes
    Router.get('/test', ({ res }) => {
      res.json({ success: true });
    });

    // Make request
    const response = await request(app).get('/test');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### Testing Best Practices

1. **Always reset Routes state** before each test to avoid conflicts
2. **Use beforeEach and afterEach** for setup and teardown
3. **Test both success and error cases**
4. **Test middleware execution order**
5. **Test edge cases** (empty paths, invalid handlers, etc.)
6. **Use descriptive test names**

### Example: Testing Middleware Order

```javascript
test('should execute middlewares in correct order', async () => {
  const order = [];

  const mw1 = (req, res, next) => {
    order.push('global');
    next();
  };

  const mw2 = (req, res, next) => {
    order.push('group');
    next();
  };

  const mw3 = (req, res, next) => {
    order.push('route');
    next();
  };

  Router.middleware([mw1], () => {
    Router.group(
      '/api',
      () => {
        Router.get(
          '/test',
          ({ res }) => {
            res.json({ order });
          },
          [mw3],
        );
      },
      [mw2],
    );
  });

  const response = await request(app).get('/api/test');
  expect(response.body.order).toEqual(['global', 'group', 'route']);
});
```

### Example: Testing Error Handling

```javascript
test('should pass errors to Express error handler', async () => {
  Router.get('/error', () => {
    throw new Error('Custom error');
  });

  app.use((err, req, res, next) => {
    res.status(500).json({ error: err.message });
  });

  const response = await request(app).get('/error');
  expect(response.status).toBe(500);
  expect(response.body.error).toBe('Custom error');
});
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [14.x, 16.x, 18.x, 20.x]

    steps:
      - uses: actions/checkout@v3
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      - run: pnpm ci
      - run: pnpm test
      - run: pnpm run build
```

## Troubleshooting

### ESM Tests Not Running

Make sure you're using the correct Node.js flags:

```bash
NODE_OPTIONS=--experimental-vm-modules npx vitest tests/esm.test.ts
```

### TypeScript Type Errors

Ensure you have proper TypeScript configuration:

```bash
pnpm install --save-dev typescript @types/node @types/express
```

### Test Isolation Issues

If tests are affecting each other, make sure you're resetting Routes state:

```javascript
beforeEach(() => {
  Router.routes = [];
  Router.prefix = '';
  Router.groupMiddlewares = [];
  Router.globalMiddlewares = [];
});
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Express Testing Guide](https://expressjs.com/en/guide/testing.html)
- [TypeScript Testing](https://jestjs.io/docs/getting-started#via-ts-node)
