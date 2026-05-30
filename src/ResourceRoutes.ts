import type { HttpMethod, ResourceAction } from './types'

import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import { ResourceRouteSelection } from './ResourceRouteSelection'
import { Route } from './Route'

/**
 * @class clear-router ResourceRoutes
 * @description A ResourceRoutes creates a collection of resourceful routes in a single call
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-tmp/clear-router
 */
export class ResourceRoutes<X = any, M = HMiddleware | EMiddleware, H = any> {
    constructor(
        readonly routes: Partial<Record<ResourceAction, Route<X, M, H>>>
    ) { }

    /**
     * Register one or more middleware that will be executed before the route.
     * 
     * @param middlewares 
     * @returns 
     */
    middleware (middlewares: M[] | M): this {
        for (const route of Object.values(this.routes)) {
            route?.middleware(middlewares)
        }

        return this
    }

    action (action: ResourceAction): Route<X, M, H> | undefined {
        return this.routes[action]
    }

    index (): Route<X, M, H> | undefined {
        return this.routes.index
    }

    show (): Route<X, M, H> | undefined {
        return this.routes.show
    }

    create (): Route<X, M, H> | undefined {
        return this.routes.create
    }

    update (): Route<X, M, H> | undefined {
        return this.routes.update
    }

    destroy (): Route<X, M, H> | undefined {
        return this.routes.destroy
    }

    get (): ResourceRouteSelection<X, M, H> {
        return this.byMethod('get')
    }

    post (): ResourceRouteSelection<X, M, H> {
        return this.byMethod('post')
    }

    put (): ResourceRouteSelection<X, M, H> {
        return this.byMethod('put')
    }

    delete (): ResourceRouteSelection<X, M, H> {
        return this.byMethod('delete')
    }

    protected byMethod (method: HttpMethod): ResourceRouteSelection<X, M, H> {
        return new ResourceRouteSelection(Object.values(this.routes)
            .filter((route): route is Route<X, M, H> => Boolean(route?.methods.includes(method)))
        )
    }
}
