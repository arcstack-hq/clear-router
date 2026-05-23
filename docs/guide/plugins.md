# Plugins

The plugin API lets packages extend Clear Router's behaviour in a structured way. Plugins can register container bindings, augment the HTTP context, replace controller method arguments, configure the router, and access the active request and response.

```ts
import { definePlugin } from 'clear-router/core';

export const myPlugin = definePlugin({
  name: 'my-plugin',
  setup({ bind, useHttpContext, resolveArguments }) {
    // ...
  },
});
```

Apps install plugins on any router adapter via `Router.use()`:

```ts
import Router from 'clear-router/express';
import { myPlugin } from './my-plugin';

Router.use(myPlugin);
```

Named plugins are installed once per process. Calling `Router.use()` with the same plugin name more than once has no effect.

---

## Defining a Plugin

### `definePlugin(options)`

Creates a plugin definition. The `setup` function receives a `ClearRouterPluginContext` with everything the plugin needs to interact with the router.

```ts
export const auditPlugin = definePlugin({
  name: 'audit',
  setup({ bind }) {
    bind(AuditService, () => new AuditService());
  },
});
```

### Accepting Options

Plugins can declare a typed options interface as the first generic argument to `definePlugin`. Options are passed as the second argument to `Router.use()`.

```ts
export const auditPlugin = definePlugin<{ name: string }>({
  name: 'audit',
  setup({ bind, options }) {
    bind(AuditService, () => new AuditService(options.name));
  },
});

Router.use(auditPlugin, { name: 'app' });
```

### Typing the HTTP Context

The second generic argument to `definePlugin` is the `HttpContext` type — the framework-specific context object passed to `useHttpContext` and `resolveArguments`. Without it, the context defaults to `any`. Pass your driver's context type to get full type safety inside those resolvers.

```ts
import type { H3Event } from 'h3';

export const myPlugin = definePlugin<{ name: string }, H3Event>({
  name: 'my-plugin',
  setup({ useHttpContext }) {
    useHttpContext(({ ctx }) => {
      // ctx is typed as H3Event
      ctx.context.pluginName = 'my-plugin';
    });
  },
});
```

The same `HttpContext` type flows through to `resolveArguments`:

```ts
setup ({ resolveArguments }) {
  resolveArguments(({ ctx, method, request }) => {
    // ctx is typed as H3Event
    if (method !== 'show') return undefined
    return [new BoundUser(request.param('id'), ctx.method)]
  })
}
```

### Async Setup

`setup` can be async. Clear Router waits for all async plugins to complete before resolving container bindings for any request.

```ts
export const auditPlugin = definePlugin({
  name: 'audit',
  async setup({ bind }) {
    await someAsyncInitialisation();
    bind(AuditService, () => new AuditService());
  },
});
```

---

## Plugin Context

The `setup` function receives a `ClearRouterPluginContext` with the following members:

### `bind(token, factory)`

Registers a service with the container. The factory receives a dependency object containing the active `request` and `response` when the binding is resolved during a request.

```ts
setup ({ bind }) {
  bind(AuditService, (d: { request: ClearRouterRequest }) => {
    return new AuditService(d.request.param('id'), d.request.method)
  })
}
```

> Requires `container.enabled: true` in `Router.configure()`.

### `useHttpContext(resolver)`

Runs a callback on every request, giving the plugin access to the active HTTP context. Use this to attach data to `ctx` before it reaches a controller. The `ctx` type is inferred from the `HttpContext` generic on `definePlugin` — see [Typing the HTTP Context](#typing-the-http-context).

```ts
setup ({ useHttpContext }) {
  useHttpContext(({ ctx }) => {
    ctx.pluginName = 'my-plugin'
  })
}
```

The augmented values are then available as controller method arguments:

```ts
class UsersController {
  show(ctx: { pluginName: string }) {
    return { pluginName: ctx.pluginName };
  }
}
```

### `resolveArguments(resolver)`

Replaces the arguments passed to a controller method entirely. The resolver receives `{ ctx, method, request }` and should return an array of arguments, or `undefined` to fall through to the default resolution. Like `useHttpContext`, the `ctx` type is inferred from the `HttpContext` generic on `definePlugin`.

Returning an empty array (`[]`) also falls back to the default handler signature.

```ts
setup ({ resolveArguments }) {
  resolveArguments(({ method, request }) => {
    if (method !== 'show') return undefined

    return [
      new BoundUser(request.param('id'), 'plugin'),
      request,
      { touched: true },
    ]
  })
}
```

### `configure(options)` / `configureDefaults(options)`

Configures the router from within the plugin. `configure` applies options for the current state; `configureDefaults` sets options that are restored every time the router is reset.

```ts
setup ({ configure }) {
  configure({ methodOverride: { enabled: true } })
}
```

### `getRequest()` / `getResponse()`

Returns the active `CoreRequest` or `CoreResponse` instance. Both return `undefined` outside of a request lifecycle — for example, during plugin setup.

```ts
setup ({ getRequest }) {
  // getRequest() is undefined here — no active request yet

  bind(AuditService, () => {
    const request = getRequest()
    return new AuditService(request?.method ?? 'unknown')
  })
}
```

### `container`

Direct access to the service container.

### `bindings`

A record of all currently registered container bindings.

### `options`

The options object passed to `Router.use()`. Only present when the plugin declares a typed options interface via `definePlugin<Options>()`.

---

## Full Example

```ts
import { definePlugin } from 'clear-router/core';
import { ClearRouterRequest } from 'clear-router/express';

class RequestAuditService {
  constructor(
    readonly id: string,
    readonly method: string,
  ) {}
}

export const requestAuditPlugin = definePlugin({
  name: 'request-audit',
  setup({ bind }) {
    bind(RequestAuditService, (d: { request: ClearRouterRequest }) => {
      return new RequestAuditService(d.request.param('id'), d.request.method);
    });
  },
});
```

```ts
// router setup
Router.configure({ container: { enabled: true } });
Router.use(requestAuditPlugin);

// controller
class UsersController {
  @Bind(RequestAuditService)
  show(audit: RequestAuditService) {
    return { id: audit.id, method: audit.method };
  }
}
```
