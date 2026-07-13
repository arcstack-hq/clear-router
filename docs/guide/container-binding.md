# Container Binding

Clear Router can optionally resolve handler arguments from a small built-in container. This is disabled by default, so existing handlers keep the normal signature:

```ts
Router.get('/users/:id', (ctx, clearRequest) => {
  return clearRequest.param('id');
});
```

Enable binding when you want decorated controller methods to receive resolved arguments directly.

## Enable Binding

Manual setup:

```ts
Router.configure({
  container: {
    enabled: true,
    autoDiscover: true,
    strict: true,
  },
});
```

- `enabled` turns decorated method binding on.
- `autoDiscover` allows unknown constructor tokens and their declared dependencies to be instantiated when no explicit binding exists.
- `strict` throws a resolution error with the dependency path instead of falling back to the default handler arguments.

When `strict` is disabled, an unresolved decorated method falls back to the default `(ctx, clearRequest)` behavior for compatibility.

## One Import Setup

For legacy decorator metadata inference, import the setup entry once before your controllers are loaded:

```ts
import 'clear-router/decorators/setup';
```

This imports `reflect-metadata` and applies:

```ts
Router.configure({
  container: {
    enabled: true,
    autoDiscover: true,
  },
});
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
import { Request, Response } from 'clear-router/core';
import { Bind } from 'clear-router/decorators';

class UsersController {
  @Bind(Request, Response)
  update(request: Request, response: Response) {
    return response.status(202).json({
      id: request.param('id'),
      name: request.input('name'),
    });
  }
}

Router.put('/api/users/:id', [UsersController, 'update']);
```

The core `Request` exposes normalized data across all adapters:

```ts
request.body;
request.query;
request.params;
request.param('id');
request.input('name');
request.header('accept');
request.is('put');
```

The core `Response` can be returned or used as a side effect:

```ts
class UsersController {
  @Bind(Request, Response)
  store(request: Request, response: Response) {
    response.status(201).json({ name: request.input('name') });
  }
}
```

## Binding Services

Use `Container.bind()` for explicit service bindings:

```ts
import { Bind, Container } from 'clear-router/decorators';
import { Request } from 'clear-router/core';

class AuditService {
  label() {
    return 'audit';
  }
}

Container.bind(AuditService, () => new AuditService());

class UsersController {
  @Bind(Request, AuditService)
  show(request: Request, audit: AuditService) {
    return {
      id: request.param('id'),
      source: audit.label(),
    };
  }
}
```

Bindings can use the shorthand value, factory, or class syntax. Structured providers make the binding behavior explicit:

```ts
Container.bind(AuditService, {
  useClass: AuditService,
  scope: 'request',
});
```

Available providers are:

- `useValue`: provide an existing value.
- `useClass`: construct a class, optionally with `dependencies`.
- `useFactory`: call a synchronous or asynchronous factory.
- `useExisting`: alias another token.

## Binding Lifetimes

Every adapter owns an application container and creates a child container for each request. Providers support three lifetimes:

| Scope       | Behavior                                                              |
| ----------- | --------------------------------------------------------------------- |
| `singleton` | One instance for the adapter container.                               |
| `request`   | One instance per request, shared by every resolution in that request. |
| `transient` | A new instance for every resolution. This is the default.             |

Concurrent resolutions of the same singleton or request-scoped asynchronous provider share the same pending factory result.

Plugin bindings accept the same scope as their third argument:

```ts
setup({ bind }) {
  bind(AuditService, ({ request }) => {
    return new AuditService(request.param('id'));
  }, { scope: 'request' });
}
```

## Constructor Dependencies

Class providers can resolve their constructor dependencies recursively. Use `static inject` with standard TypeScript decorators:

```ts
class AuditService {
  static inject = [AuditRepository];

  constructor(readonly repository: AuditRepository) {}
}

Container.bind(AuditRepository, {
  useClass: AuditRepository,
  scope: 'singleton',
});
Container.bind(AuditService, { useClass: AuditService });
```

You can also declare dependencies on the provider:

```ts
Container.bind(AuditService, {
  useClass: AuditService,
  dependencies: [AuditRepository],
});
```

When legacy decorator metadata is enabled, constructor parameter metadata is used when no explicit dependency list exists.

## Injection Tokens

Use `InjectionToken<T>` for interfaces, configuration, and primitive values:

```ts
import { Container, InjectionToken } from 'clear-router/core';

const AuditConfig = new InjectionToken<{ enabled: boolean }>('audit-config');

Container.bind(AuditConfig, {
  useValue: { enabled: true },
});
```

Symbols are also accepted as tokens. `InjectionToken<T>` preserves the resolved value type in TypeScript and produces clearer diagnostics.

## Auto Discovery

When `autoDiscover` is enabled, Clear Router tries to instantiate unknown class tokens before falling back:

```ts
class AuditService {
  label() {
    return 'discovered';
  }
}

class UsersController {
  @Bind(Request, AuditService)
  show(request: Request, audit: AuditService) {
    return { id: request.param('id'), source: audit.label() };
  }
}
```

Auto-discovered classes may declare constructor dependencies with `static inject` or legacy parameter metadata. Use `Container.bind()` when you need configuration, aliases, or a non-transient lifetime.

## Resolution Errors

Strict mode reports missing and circular dependencies with their full resolution path. You can also request this behavior directly with `container.resolveOrFail(token)`.

## TypeScript 5.2+ Decorators

Clear Router supports standard decorators and TypeScript 5.2+ decorator metadata without `reflect-metadata`, `experimentalDecorators`, or `emitDecoratorMetadata`.

Use explicit tokens with `@Bind(...)`:

```ts
import { Bind } from 'clear-router/decorators';
import { Request, Response } from 'clear-router/core';

class UsersController {
  @Bind(Request, Response)
  index(request: Request, response: Response) {
    return response.json({ params: request.params });
  }
}
```

Standard decorators do not expose runtime parameter types, so Clear Router cannot infer `Request` from this method by itself:

```ts
class UsersController {
  @Bind()
  index(request: Request) {
    return request.params;
  }
}
```

Use explicit tokens for the no-setup TS 5.2+ path.

## Legacy Type Metadata

If your app imports `clear-router/decorators/setup`, or otherwise imports `reflect-metadata` before controllers load, `@Bind()` can read TypeScript design-time parameter metadata:

```ts
import 'clear-router/decorators/setup';
import { Bind } from 'clear-router/decorators';
import { Request } from 'clear-router/core';

class UsersController {
  @Bind()
  index(request: Request) {
    return request.params;
  }
}
```

You can also decorate the whole controller class.

```ts
@Bind()
class UsersController {
  index(request: Request) {
    return request.params;
  }

  show(audit: AuditService, request: Request) {
    return { id: request.param('id'), source: audit.label() };
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
