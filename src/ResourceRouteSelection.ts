import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import { Route } from './Route'

export class ResourceRouteSelection<X = any, M = HMiddleware | EMiddleware, H = any> {
    constructor(readonly routes: Array<Route<X, M, H>>) { }

    middleware (middlewares: M[] | M): this {
        for (const route of this.routes) {
            route.middleware(middlewares)
        }

        return this
    }

    all (): Array<Route<X, M, H>> {
        return this.routes
    }

    first (): Route<X, M, H> | undefined {
        return this.routes[0]
    }
}