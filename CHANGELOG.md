# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.1] - 2026-03-03

### Added

- Added `route` parameter to `Router.bindRequestToInstance` for improved route context handling.
- Added `route` property to `ClearRequest` for enhanced route context access.

## [2.1.0] - 2026-03-03

### Added

- Added new core abstractions `src/Controller.ts` and `src/Route.ts` for shared request-state and route metadata handling across Express and H3 routers.
- Added `ClearRequest` as a first-class request wrapper in route/controller binding flow, with per-request hydration of `body`, `query`, and `params`.
- Added callback route handler context binding so `this` points to the current route instance during execution (Express and H3).
- Added controller instance context binding so `this.ctx` and `this.clearRequest` are populated before controller method execution.
- Added route instance request hydration for callback handlers with `ctx`, `body`, `query`, `params`, and `clearRequest` on `this`.
- Added shared request-to-instance binding flow for both controller instances and callback route instances.
- Added normalized handler invocation contract where route handlers receive `ctx` as first argument and `req` (`ClearRequest`) as second argument.
- Added TypeScript tests validating callback handler `this` binding for both Express and H3.
- Added TypeScript tests validating controller instance hydration and handler argument behavior.
- Added TypeScript tests validating callback route `this` hydration (`ctx/body/query/params/clearRequest`) in Express and H3.

### Changed

- Updated import statements to use single quotes consistently.
- Removed unnecessary semicolons and adjusted line endings for consistency.
- Refactored router classes in both Express and H3 to improve readability.
- Enhanced error handling and logging in route definitions.
- Updated tests to align with new formatting and ensure consistency.
- Added ESLint configuration for improved code quality and style enforcement.
- Changed internal route storage from plain object/array-style entries to `Route` class instances.
- Updated router application pipeline to bind request data through a shared instance-binding step for controller and callback handlers.
- Updated API documentation to explicitly describe callback handler `this` binding and hydrated route instance fields.
- Updated README, Express, H3, and testing docs with handler argument and `clearRequest` behavior details.

## [2.0.8] - 2026-02-20

### Changed

- Change `HttpContext` from type to interface for better extensibility

## [2.0.7] - 2026-02-16

### Changed

- Updated package.json to change router exports from "router" to "index" for express and h3.
- Modified tsconfig.json paths to reflect new index file structure for express and h3.
- Changed tsdown.config.ts entry points to use index files instead of router files.

### Added

- Added comprehensive API documentation in API.md covering static properties, methods, and types.
- Created usage guides for Express and H3 in EXPRESS.md and H3.md respectively.
- Introduced a detailed testing guide in TESTING.md, including setup, running tests, and best practices.
- Added index.ts files for express and h3 to re-export router functionalities.

## [2.0.6] - 2026-02-15

### Changed

- Adjust exports and entry points in configuration

## [2.0.5] - 2026-02-15

### Changed

- Add UserController example with CRUD operations

### Fixed

- Fix failing API resource router integration

## [2.0.4] - 2026-02-15

### Changed

- Changed all instances of `Routes` to `Router` in test files for Express and H3.
- Updated the routing logic to use a new `Router` class for both Express and H3.
- Refactored the structure of the router to improve clarity and maintainability.
- Adjusted TypeScript definitions and paths in `tsconfig.json` and `tsdown.config.ts` to reflect the new router structure.

### Added

- Added new router implementation files for Express and H3.
- Ensured all tests pass with the new router structure.

## [2.0.3] - 2026-02-15

### Changed

- Removed jest as a testing framework
- Remove all CJS tests

### Added

- Added routing functionality for Express.js in src/express/routes.ts
- Added routing functionality for H3 in src/h3/routes.ts
- Created tests for both Express and H3 routing in tests/express.test.ts and tests/h3.test.ts
- Introduced types for routing in types/basic.ts, types/express.ts, and types/h3.ts
- Configured `tsdown` for building both ESM and CommonJS formats
- Set up Vitest for testing with coverage reporting

## [2.0.2] - 2026-01-09

### Fixed

- **BREAKING FIX**: CommonJS import no longer requires `.default` property
  - Before: `const Routes = require('clear-router'); Router.default.get()`
  - After: `const Routes = require('clear-router'); Router.get()`
- Improved CommonJS export compatibility for better developer experience
- Added dual export support (`module.exports` and `module.exports.default`) for maximum compatibility

### Changed

- Enhanced CommonJS module exports for direct class access
- Maintained backward compatibility with ESM interop tools

## [2.0.1] - 2026-01-03

### Added

- Full ESM (ES Module) support with dedicated `.mjs` file
- Complete TypeScript definitions with full type safety
- `allRoutes()` method to inspect all registered routes with metadata
- Comprehensive test suites for CommonJS, ESM, and TypeScript environments
- Cross-platform test scripts with Windows support
- Build validation and type checking scripts
- Detailed API documentation (API.md)
- Complete testing guide (TESTING.md)
- Jest configuration for all module formats
- This changelog

### Changed

- **BREAKING**: Upgraded to Express 5.x (minimum version 5.1.0)
- **BREAKING**: Minimum Node.js version now 22.0.0
- All errors now properly thrown to Express error handling middleware
- Improved error messages with better context and stack traces
- Enhanced JSDoc comments throughout source code
- Updated README with examples for all module formats
- Package.json now includes proper module exports configuration
- Test infrastructure completely rewritten for better reliability

### Fixed

- Error handling now correctly delegates to Express instead of console.error
- Controller instantiation errors properly propagated
- Invalid HTTP method errors properly thrown
- Route application timing issues in tests
- Windows compatibility for test scripts
- TypeScript module resolution in Jest

### Documentation

- Complete API reference documentation with examples
- Testing guide covering CommonJS, ESM, and TypeScript
- Updated README with migration guide
- Added best practices and usage patterns
- Improved JSDoc comments for better IDE support

### Development

- Added `cross-env` for cross-platform environment variables
- Integrated `ts-jest` for TypeScript testing
- Improved build scripts with type generation
- Added pre-publish validation

## [1.2.1] - 2024-12-15

### Added

- Basic ESM support (experimental)
- TypeScript type definitions
- Route inspection capability

### Changed

- Error handling improvements
- Documentation updates

### Fixed

- Controller binding issues
- Path normalization edge cases

## [1.1.1] - 2024-12-10

### Fixed

- Controller binding for instance methods
- Path normalization edge cases with trailing slashes

### Changed

- Improved error logging messages
- Better handling of undefined middleware arrays

## [1.1.0] - 2024-12-01

### Added

- Support for multiple HTTP methods in single route via `add()` method
- Instance class controller support
- Enhanced middleware stacking

### Changed

- Improved controller method binding logic
- Better error messages for invalid handlers

### Fixed

- Middleware execution order in nested groups
- Path normalization with empty prefix

## [1.0.5] - 2024-11-15

### Fixed

- Group middleware not properly applied to nested routes
- Route path normalization with double slashes

### Changed

- Optimized route registration performance

## [1.0.0] - 2024-11-01

### Added

- Initial release
- Laravel-style routing for Express.js
- Support for GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD methods
- Route grouping with prefix
- Middleware support (global, group, and route-level)
- Controller binding (static and instance methods)
- HttpContext style handlers
- Path normalization
- Express-compatible error handling

### Features

- Clean route definitions
- Middleware stacking
- Controller-method pair support
- Auto-binding of controller methods
- Fully Express-compatible

## Notes

### Breaking Changes in 2.0.2

#### CommonJS Import (Developer Experience Fix)

In version 2.0.1, CommonJS users had to use:

```javascript
const Routes = require('clear-router');
Router.default.get('/path', handler); // Awkward!
```

Now in 2.0.2, the natural syntax works:

```javascript
const Routes = require('clear-router');
Router.get('/path', handler); // Clean!
```

**Migration**: Simply remove `.default` from your CommonJS imports. Your code will be cleaner and more intuitive.

### Breaking Changes in 2.0.1

#### Express Version

- **Old**: Express 4.x
- **New**: Express 5.x (minimum 5.1.0)

Express 5 includes several breaking changes. Most notably:

- `res.json()` and `res.send()` now work asynchronously
- Error handling is more strict
- Some deprecated methods removed

**Migration**: Update your Express installation:

```bash
npm install express@^5.1.0
```

#### Node.js Version

- **Old**: Node.js 14.x or higher
- **New**: Node.js 22.0.0 or higher

**Migration**: Upgrade your Node.js version to 22 or higher.

#### No Other Breaking Changes

All routing APIs remain backward compatible. Your existing route definitions will work without modification.

### Deprecations

None at this time.

### Security

No known security issues. Please report any security vulnerabilities to oss@toneflix.net.

## Migration Guide

### From 2.0.1 to 2.0.2

This is a minor fix release that improves the CommonJS import experience.

#### If You Were Using `.default` in CommonJS

**Before (2.0.1):**

```javascript
const Routes = require('clear-router');
Router.default.get('/users', handler);
```

**After (2.0.2):**

```javascript
const Routes = require('clear-router');
Router.get('/users', handler); // Much better!
```

#### No Changes Needed for ESM or TypeScript

ESM and TypeScript imports continue to work exactly the same:

```javascript
// ESM - No changes
import Router from 'clear-router';
Router.get('/users', handler);
```

```typescript
// TypeScript - No changes
import Router from 'clear-router';
Router.get('/users', handler);
```

### From 1.x to 2.0.x

#### 1. Update Dependencies

```bash
npm install clear-router@latest express@^5.1.0
```

#### 2. Update Node.js

Ensure you're running Node.js 22.0.0 or higher:

```bash
node --version  # Should be v22.0.0 or higher
```

#### 3. Review Express 5 Changes

Check the [Express 5 migration guide](https://expressjs.com/en/guide/migrating-5.html) for any Express-specific changes that might affect your application.

#### 4. No Route Code Changes Needed

Your existing route definitions work without modification:

```javascript
// This still works exactly the same
Router.get('/users', ({ res }) => {
  res.json({ users: [] });
});

Router.group('/api', () => {
  Router.post('/data', handler);
});
```

### Module Format Examples

#### CommonJS (Default)

```javascript
const Routes = require('clear-router');

Router.get('/test', ({ res }) => {
  res.json({ message: 'CommonJS works!' });
});
```

#### ESM

```javascript
import Router from 'clear-router';

Router.get('/test', ({ res }) => {
  res.json({ message: 'ESM works!' });
});
```

#### TypeScript

```typescript
import Router from 'clear-router';
import type { HttpContext } from 'clear-router';

Router.get('/test', ({ res }: HttpContext) => {
  res.json({ message: 'TypeScript works!' });
});
```

### New Features in 2.0.x

#### Route Inspection (Added in 2.0.1)

```javascript
Router.get('/users', handler);
Router.post('/users', handler);

const routes = Router.allRoutes();
console.log(routes);
// [
//   {
//     methods: ['get'],
//     path: '/users',
//     middlewareCount: 0,
//     handlerType: 'function'
//   },
//   {
//     methods: ['post'],
//     path: '/users',
//     middlewareCount: 0,
//     handlerType: 'function'
//   }
// ]
```

## Roadmap

### Planned for 2.1.0

- Route naming with `name()` method
- URL generation from named routes
- Route parameter constraints (regex patterns)
- Resource routing helpers (`Router.resource()`)
- Route prefixes for API versioning

### Planned for 2.2.0

- Route caching for production performance
- Route middleware groups (named middleware sets)
- Rate limiting integration
- CORS helper methods

### Planned for 3.0.0

- Plugin system for extensibility
- Advanced middleware features
- Route documentation auto-generation
- OpenAPI/Swagger integration
- Performance monitoring hooks

## Support

For questions, issues, or feature requests:

- **GitHub Issues**: https://github.com/toneflix/clear-router/issues
- **Email**: oss@toneflix.net
- **Documentation**: See API.md and TESTING.md

## Contributors

- **Refkinscallv** - Creator and maintainer of (express-router)[https://github.com/refkinscallv/express-routing]
- **3m1n3nc3** - Creator and maintainer

## License

MIT License - see LICENSE file for details
