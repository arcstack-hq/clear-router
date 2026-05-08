# Plugins

Packages can register container bindings through Clear Router's plugin API.

```ts
import { definePlugin } from 'clear-router/core';

class AuditService {
  label() {
    return 'audit';
  }
}

export const auditPlugin = definePlugin({
  name: 'audit',
  setup({ bind }) {
    bind(AuditService, () => new AuditService());
  },
});
```

Apps install the plugin on any router adapter:

```ts
import Router from 'clear-router/express';
import { auditPlugin } from '@acme/clear-router-audit';

Router.configure({
  container: {
    enabled: true,
  },
});

Router.use(auditPlugin);
```

Plugins can accept options:

```ts
export const auditPlugin = definePlugin<{ label: string }>({
  name: 'audit',
  setup({ bind, options }) {
    bind(AuditService, () => new AuditService(options.label));
  },
});

Router.use(auditPlugin, { label: 'app' });
```

Named plugins are installed once per process.
