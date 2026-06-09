import type { ApiResourceMiddleware, HttpMethod, ResourceAction, ResourceRouteDefinition, ResourceRouteRegistrar, ResourceRouteRemover, ResourceRoutesOptions } from './types'

import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import { ResourceRouteSelection } from './ResourceRouteSelection'
import { Route } from './Route'
import { wrap } from './core'

/**
 * @class clear-router ResourceRoutes
 * @description A ResourceRoutes creates a collection of resourceful routes in a single call
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-hq/clear-router
 */
export class ResourceRoutes<X = any, M = HMiddleware | EMiddleware, H = any> {
    static actions = {
        index: { method: 'get', path: '/' },
        show: { method: 'get', path: '/:{param}' },
        create: { method: 'post', path: '/' },
        update: { method: 'put', path: '/:{param}' },
        destroy: { method: 'delete', path: '/:{param}' },
    } as const satisfies Record<ResourceAction, ResourceRouteDefinition>

    readonly routes: Partial<Record<ResourceAction, Route<X, M, H>>> = {}
    protected options: ResourceRoutesOptions<M>
    protected chainedMiddlewares: Array<M[] | M> = []

    constructor(
        readonly basePath: string,
        readonly controller: any,
        readonly paramName: string,
        options: ResourceRoutesOptions<M> | undefined,
        protected readonly registerRoute: ResourceRouteRegistrar<X, M, H>,
        protected readonly removeRoute: ResourceRouteRemover<X, M, H>
    ) {
        this.options = options ?? {}
    }

    register (): this {
        this.clear()

        const preController = typeof this.controller === 'function'
            ? new this.controller()
            : this.controller

        for (const action of this.selectedActions()) {
            if (typeof preController[action] !== 'function') continue

            const definition = this.definitionFor(action)
            const route = this.registerRoute({
                action,
                method: definition.method,
                path: `${this.basePath}${definition.path}`,
                handler: [this.controller, action],
                middlewares: this.resolveActionMiddlewares(action),
                name: `${this.nameFor(definition.path)}.${action.toLowerCase()}`,
            })

            this.routes[action] = route
        }

        for (const middlewares of this.chainedMiddlewares) {
            this.middleware(middlewares, false)
        }

        return this
    }

    /**
     * Only register routes for the provided actions.
     * 
     * @param action 
     * @param actions 
     * @returns 
     */
    only (action: ResourceAction | ResourceAction[], ...actions: ResourceAction[]): this {
        this.options.only = Array.from(new Set(wrap(action).concat(actions)))

        return this.register()
    }

    /**
     * Register all resource routes except the provided actions.
     * 
     * @param action 
     * @param actions 
     * @returns 
     */
    except (action: ResourceAction | ResourceAction[], ...actions: ResourceAction[]): this {
        this.options.except = Array.from(new Set(wrap(action).concat(actions)))

        return this.register()
    }

    /**
     * Register one or more middleware that will be executed before the route.
     * 
     * @param middlewares 
     * @param remember 
     * @returns 
     */
    middleware (middlewares: M[] | M, remember = true): this {
        if (remember) {
            this.chainedMiddlewares.push(middlewares)
        }

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

    protected selectedActions (): ResourceAction[] {
        const actions = this.options.only?.length
            ? this.options.only
            : Object.keys(ResourceRoutes.actions) as ResourceAction[]
        const except = new Set(this.options.except ?? [])

        return actions.filter(action => !except.has(action))
    }

    protected definitionFor (action: ResourceAction): ResourceRouteDefinition {
        const definition = ResourceRoutes.actions[action]

        return {
            method: definition.method,
            path: definition.path.replace('{param}', this.paramName),
        }
    }

    protected resolveActionMiddlewares (action: ResourceAction): M[] | undefined {
        const middlewares = this.isActionMiddlewareMap(this.options.middlewares)
            ? this.options.middlewares[action]
            : this.options.middlewares

        return Array.isArray(middlewares)
            ? middlewares
            : middlewares ? [middlewares] : undefined
    }

    protected isActionMiddlewareMap (
        middlewares: ApiResourceMiddleware<M> | undefined
    ): middlewares is { [K in ResourceAction]?: M | M[] } {
        if (!middlewares || Array.isArray(middlewares) || typeof middlewares !== 'object') {
            return false
        }

        return Object.keys(ResourceRoutes.actions).some(action => action in middlewares)
    }

    protected nameFor (path: string): string {
        return `${this.basePath}${path}`
            .replace(/\/:[^/]+|\/\{[^}]+\}/g, '')
            .replace(/\{(\w+):[^}]+\}/g, '$1')
            .replace(/\/|:|[{}]/g, '.')
            .replace(/\.{2,}/g, '.')
            .replace(/^\.|\.$/g, '')
    }

    protected byMethod (method: HttpMethod): ResourceRouteSelection<X, M, H> {
        return new ResourceRouteSelection(Object.values(this.routes)
            .filter((route): route is Route<X, M, H> => Boolean(route?.methods.includes(method)))
        )
    }

    protected clear (): void {
        for (const route of Object.values(this.routes)) {
            if (route) this.removeRoute(route)
        }

        for (const key of Object.keys(this.routes) as ResourceAction[]) {
            delete this.routes[key]
        }
    }
}
