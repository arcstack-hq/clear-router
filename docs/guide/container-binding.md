# Container Binding

Clear Router can optionally resolve handler arguments from a small built-in container. This is disabled by default, so existing handlers keep the normal signature:

```ts
Router.get('/users/:id', (ctx, clearRequest) => {
  return clearRequest.param('id')
})
```

Enable binding when you want decorated controller methods to receive resolved arguments directly.

## Enable Binding

Manual setup:

```ts
Router.configure({
  container: {
    enabled: true,
    autoDiscover: true,
  },
})
```

- `enabled` turns decorated method binding on.
- `autoDiscover` allows unknown constructor tokens to be instantiated with `new Token()` when no container binding exists.

If binding is disabled, or if a decorated method cannot be resolved, Clear Router falls back to the default `(ctx, clearRequest)` behavior.

## One Import Setup

For legacy decorator metadata inference, import the setup entry once before your controllers are loaded:

```ts
import 'clear-router/decorators/setup'
```

This imports `reflect-metadata` and applies:

```ts
Router.configure({
  container: {
    enabled: true,
    autoDiscover: true,
  },
})
```

You still need these TypeScript options for inferred parameter types:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Core Request And Response

```ts
import { Request, Response } from 'clear-router/core'
import { Bind } from 'clear-router/decorators'

class UsersController {
  @Bind(Request, Response)
  update (request: Request, response: Response) {
    return response.status(202).json({
      id: request.param('id'),
      name: request.input('name'),
    })
  }
}

Router.put('/api/users/:id', [UsersController, 'update'])
```

The core `Request` exposes normalized data across all adapters:

```ts
request.body
request.query
request.params
request.param('id')
request.input('name')
request.header('accept')
request.is('put')
```

The core `Response` can be returned or used as a side effect:

```ts
class UsersController {
  @Bind(Request, Response)
  store (request: Request, response: Response) {
    response.status(201).json({ name: request.input('name') })
  }
}
```

## Binding Services

Use `Container.bind()` for explicit service bindings:

```ts
import { Bind, Container } from 'clear-router/decorators'
import { Request } from 'clear-router/core'

class AuditService {
  label () {
    return 'audit'
  }
}

Container.bind(AuditService, () => new AuditService())

class UsersController {
  @Bind(Request, AuditService)
  show (request: Request, audit: AuditService) {
    return {
      id: request.param('id'),
      source: audit.label(),
    }
  }
}
```

Bindings can be values, factories, or classes.

## Auto Discovery

When `autoDiscover` is enabled, Clear Router tries to instantiate unknown class tokens before falling back:

```ts
class AuditService {
  label () {
    return 'discovered'
  }
}

class UsersController {
  @Bind(Request, AuditService)
  show (request: Request, audit: AuditService) {
    return { id: request.param('id'), source: audit.label() }
  }
}
```

Auto-discovered classes should be constructable without arguments. Use `Container.bind()` for classes that need dependencies or configuration.

## TypeScript 5.2+ Decorators

Clear Router supports standard decorators and TypeScript 5.2+ decorator metadata without `reflect-metadata`, `experimentalDecorators`, or `emitDecoratorMetadata`.

Use explicit tokens with `@Bind(...)`:

```ts
import { Bind } from 'clear-router/decorators'
import { Request, Response } from 'clear-router/core'

class UsersController {
  @Bind(Request, Response)
  index (request: Request, response: Response) {
    return response.json({ params: request.params })
  }
}
```

Standard decorators do not expose runtime parameter types, so Clear Router cannot infer `Request` from this method by itself:

```ts
class UsersController {
  @Bind()
  index (request: Request) {
    return request.params
  }
}
```

Use explicit tokens for the no-setup TS 5.2+ path.

## Legacy Type Metadata

If your app imports `clear-router/decorators/setup`, or otherwise imports `reflect-metadata` before controllers load, `@Bind()` can read TypeScript design-time parameter metadata:

```ts
import 'clear-router/decorators/setup'
import { Bind } from 'clear-router/decorators'
import { Request } from 'clear-router/core'

class UsersController {
  @Bind()
  index (request: Request) {
    return request.params
  }
}
```

Enable these compiler options in your app:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

Without legacy `reflect-metadata`, pass tokens explicitly to `@Bind(...)`.
