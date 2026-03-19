import { beforeEach, describe, expect, it } from 'vitest'

import { CoreRouter } from 'src/core/router'

class SharedRouterA extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-shared'
}

class SharedRouterB extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-shared'
}

class IsolatedRouter extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:test-isolated'
}

describe('Core Router Shared State', () => {
    beforeEach(() => {
        SharedRouterA.routes = []
        SharedRouterA.routesByPathMethod = {}
        SharedRouterA.routesByMethod = {}
        SharedRouterA.prefix = ''
        SharedRouterA.groupMiddlewares = []
        SharedRouterA.globalMiddlewares = []

        IsolatedRouter.routes = []
        IsolatedRouter.routesByPathMethod = {}
        IsolatedRouter.routesByMethod = {}
        IsolatedRouter.prefix = ''
        IsolatedRouter.groupMiddlewares = []
        IsolatedRouter.globalMiddlewares = []
    })

    it('shares route state across routers with same namespace', () => {
        SharedRouterA.get('/shared-route', () => 'ok')

        const routesA = SharedRouterA.allRoutes()
        const routesB = SharedRouterB.allRoutes()

        expect(routesA).toHaveLength(1)
        expect(routesB).toHaveLength(1)
        expect(routesB[0].path).toBe('/shared-route')
    })

    it('keeps route state isolated across different namespaces', () => {
        SharedRouterA.get('/shared-route', () => 'ok')
        IsolatedRouter.get('/isolated-route', () => 'ok')

        expect(SharedRouterA.allRoutes()).toHaveLength(1)
        expect(SharedRouterA.allRoutes()[0].path).toBe('/shared-route')
        expect(IsolatedRouter.allRoutes()).toHaveLength(1)
        expect(IsolatedRouter.allRoutes()[0].path).toBe('/isolated-route')
    })
})
