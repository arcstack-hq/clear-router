# Clear Router

[![NPM Downloads](https://img.shields.io/npm/dt/clear-router.svg)](https://www.npmjs.com/package/clear-router)
[![npm version](https://img.shields.io/npm/v/clear-router.svg)](https://www.npmjs.com/package/clear-router)
[![License](https://img.shields.io/npm/l/clear-router.svg)](https://github.com/toneflix/clear-router/blob/main/LICENSE)
[![Publish to NPM](https://github.com/arkstack-hq/clear-router/actions/workflows/npm-publish.yml/badge.svg)](https://github.com/arkstack-hq/clear-router/actions/workflows/npm-publish.yml)
[![Run Tests](https://github.com/arkstack-hq/clear-router/actions/workflows/ci.yml/badge.svg)](https://github.com/arkstack-hq/clear-router/actions/workflows/ci.yml)

Laravel-style routing for Node.js with support for Express, H3, Fastify, Hono, and Koa, including CommonJS, ESM, and TypeScript support.

## Installation

```sh
npm install clear-router h3

# OR

npm install clear-router express
```

OR

```bash
pnpm add clear-router h3

# OR

pnpm add clear-router express
```

OR

```bash
yarn add clear-router h3

# OR

yarn add clear-router express
```

## Features

- Simple and clean route declarations (get, post, put, delete, patch, options, head)
- Grouped routes with prefix
- Method override support via body or header keys (configurable)
- Middleware stack: per-route and group-level
- Controller-method pair as route handler
- Supports HttpContext style handlers: { req, res, next }
- Function handlers always receive context as first argument
- Controller handlers receive hydrated `this.body`, `this.query`, `this.params`, and `this.clearRequest`
- `clearRequest` is passed as second handler argument for controller handlers
- Route handlers can return response values directly across Express, Fastify, Hono, H3, and Koa
- Optional decorated container binding for controller method arguments
- Plugin API for registering container bindings from external packages
- Supports TS 5.2+ standard decorators with explicit `@Bind(...)` tokens
- Optional `clear-router/decorators/setup` entry imports `reflect-metadata` and enables container binding defaults
- Auto-binds controller methods
- Full CommonJS, ESM, and TypeScript support
- Error handling delegated to Express | H3 | Fastify | Hono | Koa
- Route inspection with the `allRoutes` method
- Fully Express-compatible
- Fully H3-compatible
- Fully Fastify-compatible
- Fully Hono-compatible
- Fully Koa-compatible

## Quick Start

### Express JS

See the [Express JS documentation](https://arkstack-hq.github.io/clear-router/guide/express) for details.

### H3

See the [H3 documentation](https://arkstack-hq.github.io/clear-router/guide/h3) for details.

### Fastify

See the [Fastify documentation](https://arkstack-hq.github.io/clear-router/guide/fastify) for details.

### Hono

See the [Hono documentation](https://arkstack-hq.github.io/clear-router/guide/hono) for details.

### Koa

See the [Koa documentation](https://arkstack-hq.github.io/clear-router/guide/koa) for details.

## API Reference

See [API.md](https://arkstack-hq.github.io/clear-router/api) for complete API documentation.

## Middleware Execution Order

```txt
[ Global Middleware ] → [ Group Middleware ] → [ Route Middleware ]
```

## Handler Execution

- If function: executed directly
- If [Controller, 'method']: auto-instantiated (if needed), method is called
- First handler arg is always context (`{ req, res, next }` for Express, H3 event for H3, Koa context for Koa)
- Second handler arg is `clearRequest` for controller handlers
- Decorated controller methods can opt into resolved arguments with `@Bind(...)`

## Testing

```bash
npm test              # Run all tests
npm run test:cjs      # Test CommonJS
npm run test:esm      # Test ESM
npm run test:ts       # Test TypeScript
```

See [TESTING.md](https://arkstack-hq.github.io/clear-router/testing) for a detailed testing guide.

## Examples

```bash
npm run example       # CommonJS example
npm run example:esm   # ESM example
npm run example:ts    # TypeScript example
```

Check the `example/` directory for full working demos.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## Requirements

- Node.js >= 14.0.0
- Express >= 5.0.0 | H3 >= 2.0.1 | Fastify >= 5.0.0 | Hono >= 4.0.0 | Koa >= 3.0.0

## License

MIT License © 2026 ToneFlix Technologies Limited

## Author

3m1n3nce <3m1n3nce@toneflix.net>

## Repository

https://github.com/toneflix/clear-router
