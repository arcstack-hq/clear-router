# Clear Router

Laravel-style routing system for H3 and Express.js, with clean route definitions, middleware support, controller bindings and full TypeScript support.

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
- Middleware stack: per-route and group-level
- Controller-method pair as route handler
- Supports HttpContext style handlers: { req, res, next }
- Function handlers always receive context as first argument
- Controller handlers receive hydrated `this.body`, `this.query`, `this.params`, and `this.clearRequest`
- `clearRequest` is passed as second handler argument for controller handlers
- Auto-binds controller methods
- Full CommonJS, ESM, and TypeScript support
- Error handling delegated to Express | H3
- Route inspection with the `allRoutes` method
- Fully Express-compatible
- Fully H3-compatible

## Quick Start

### Express JS

See the [Express JS documentation](./docs/EXPRESS.md) for details.

### H3

See the [H3 documentation](./docs/H3.md) for details.

## API Reference

See [API.md](./docs/API.md) for complete API documentation.

## Middleware Execution Order

```txt
[ Global Middleware ] → [ Group Middleware ] → [ Route Middleware ]
```

## Handler Execution

- If function: executed directly
- If [Controller, 'method']: auto-instantiated (if needed), method is called
- First handler arg is always context (`{ req, res, next }` for Express, H3 event for H3)
- Second handler arg is `clearRequest` for controller handlers

## Testing

```bash
npm test              # Run all tests
npm run test:cjs      # Test CommonJS
npm run test:esm      # Test ESM
npm run test:ts       # Test TypeScript
```

See [TESTING.md](./docs/TESTING.md) for a detailed testing guide.

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
- Express >= 5.0.0 | H3 >= 2.0.1

## License

MIT License © 2026 ToneFlix Technologies Limited

## Author

3m1n3nce <3m1n3nce@toneflix.net>

## Repository

https://github.com/toneflix/clear-router
