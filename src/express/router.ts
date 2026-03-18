import { ApiResourceMiddleware, ControllerAction, HttpMethod, RouterConfig } from 'types/basic'
import { Handler, HttpContext, Middleware, RouteHandler } from 'types/express'

import { AsyncLocalStorage } from 'node:async_hooks'
import { ClearRequest } from 'src/ClearRequest'
import { Controller } from 'src/Controller'
import { Router as ExpressRouter } from 'express'
import { Route } from 'src/Route'

/**
 * @class clear-router
 * @description Laravel-style routing system for Express.js and H3 with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router {
    static config: RouterConfig = {
        methodOverride: {
            enabled: true,
            bodyKeys: ['_method'],
            headerKeys: ['x-http-method'],
        }
    }

    private static readonly groupContext = new AsyncLocalStorage<{
        prefix: string
        groupMiddlewares: Middleware[]
    }>()

    /**
     * All registered routes
     */
    static routes: Array<Route<HttpContext, Middleware>> = []

    /**
     * Mapping of routes by path and method for quick lookup.
     */
    static routesByPathMethod: Record<string, Route<HttpContext, Middleware>> = {}

    /**
     * Mapping of routes by method for quick lookup.
     */
    static routesByMethod: { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware>> } = {}

    /**
     * Current route prefix
     */
    static prefix: string = ''

    /**
     * Group-level middlewares
     */
    static groupMiddlewares: Middleware[] = []

    /**
     * Global-level middlewares
     */
    static globalMiddlewares: Middleware[] = []

    /**
     * Normalize path by removing duplicate slashes and ensuring leading slash
     * @param path - Path to normalize
     * @returns Normalized path
     */
    static normalizePath (path: string): string {
        return '/' + path
            .split('/')
            .filter(Boolean)
            .join('/')
    }

    /**
     * Configure router settings to modify behavior.
     * 
     * @param options - Configuration options for the router
     * @returns 
     */
    static configure (options?: RouterConfig): void {
        if (!this.config.methodOverride) {
            this.config.methodOverride = {
                enabled: true,
                bodyKeys: ['_method'],
                headerKeys: ['x-http-method'],
            }
        }

        const override = options?.methodOverride
        if (!override) return

        if (typeof override.enabled === 'boolean') {
            this.config.methodOverride.enabled = override.enabled
        }

        const bodyKeys = override.bodyKeys
        if (typeof bodyKeys !== 'undefined') {
            this.config.methodOverride.bodyKeys = (Array.isArray(bodyKeys)
                ? bodyKeys
                : [bodyKeys])
                .map(e => String(e).trim())
                .filter(Boolean)
        }

        const headerKeys = override.headerKeys
        if (typeof headerKeys !== 'undefined') {
            this.config.methodOverride.headerKeys = (Array.isArray(headerKeys)
                ? headerKeys
                : [headerKeys])
                .map(e => String(e).trim().toLowerCase())
                .filter(Boolean)
        }
    }

    private static ensureRequestBodyAccessor (req: any): void {
        if (typeof req.getBody !== 'function') {
            req.getBody = () => req.body ?? {}
        }
    }

    private static resolveMethodOverride (
        method: string,
        headers: Record<string, any>,
        body: unknown
    ): HttpMethod | null {
        if (!this.config.methodOverride?.enabled || method.toLowerCase() !== 'post') {
            return null
        }

        let override: unknown
        for (const key of this.config.methodOverride?.headerKeys || []) {
            const value = headers?.[key]
            if (Array.isArray(value) ? value[0] : value) {
                override = Array.isArray(value) ? value[0] : value
                break
            }
        }

        if (!override && body && typeof body === 'object') {
            for (const key of this.config.methodOverride?.bodyKeys || []) {
                const value = (body as Record<string, unknown>)[key]
                if (typeof value !== 'undefined' && value !== null && value !== '') {
                    override = value
                    break
                }
            }
        }

        const normalized = String(override || '').trim().toLowerCase()
        if (!normalized) return null
        if (['put', 'patch', 'delete', 'post'].includes(normalized)) {
            return normalized as HttpMethod
        }

        return null
    }

    /**
      * Add a route with specified HTTP methods, path, handler, and middlewares
      * @param methods - HTTP method(s) for the route
      * @param path - Route path
      * @param handler - Route handler function or controller reference
      * @param middlewares - Array of middleware functions
      */
    static add (
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): void {
        const context = this.groupContext.getStore()
        const activePrefix = context?.prefix ?? this.prefix
        const activeGroupMiddlewares = context?.groupMiddlewares ?? this.groupMiddlewares

        methods = Array.isArray(methods) ? methods : [methods]
        middlewares = middlewares
            ? (Array.isArray(middlewares) ? middlewares : [middlewares])
            : undefined

        const fullPath = this.normalizePath(`${activePrefix}/${path}`)

        const route = new Route<HttpContext, Middleware>(
            methods.includes('options') ? methods : methods.concat('options'),
            fullPath,
            handler as never,
            [...this.globalMiddlewares, ...activeGroupMiddlewares, ...(middlewares || [])]
        )

        if (
            !methods.includes('options') &&
            !this.routesByPathMethod[`OPTIONS ${fullPath}`]) {
            this.options(path, ({ res }) => {
                res.set('Allow', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD')
                res.sendStatus(204)
            })
        }

        this.routes.push(route)

        for (const method of methods.map(m => m.toUpperCase() as Uppercase<HttpMethod>)) {
            this.routesByPathMethod[`${method.toUpperCase()} ${fullPath}`] = route
            if (!this.routesByMethod[method]) {
                this.routesByMethod[method] = []
            }
            this.routesByMethod[method].push(route)
        }
    }

    /**
     * Register RESTful API resource routes for a controller with optional action filtering
     * 
     * @param basePath - Base path for the resource
     * @param controller - Controller object containing action methods
     * @param options - Optional filtering options for actions
     */
    static apiResource (
        basePath: string,
        controller: any,
        options?: {
            only?: ControllerAction[],
            except?: ControllerAction[],
            middlewares?: ApiResourceMiddleware<Middleware>,
        }
    ): void {
        const actions = {
            index: { method: 'get', path: '/' },
            show: { method: 'get', path: '/:id' },
            create: { method: 'post', path: '/' },
            update: { method: 'put', path: '/:id' },
            destroy: { method: 'delete', path: '/:id' },
        } as const

        const only = options?.only || Object.keys(actions) as ControllerAction[]
        const except = options?.except || []

        const preController = typeof controller === 'function' ? new controller() : controller

        for (const action of only) {
            if (except.includes(action)) continue
            if (typeof preController[action] === 'function') {
                const { method, path } = actions[action]

                const actionMiddlewares = typeof options?.middlewares === 'object' && !Array.isArray(options.middlewares) ? options.middlewares[action] : options?.middlewares

                this.add(
                    method as HttpMethod,
                    `${basePath}${path}`,
                    [controller, action],
                    Array.isArray(actionMiddlewares)
                        ? actionMiddlewares
                        : actionMiddlewares ? [actionMiddlewares] : undefined
                )
            }
        }
    }

    /**
     * Register a GET route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static get (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('get', path, handler, middlewares)
    }

    /**
     * Register a POST route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static post (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('post', path, handler, middlewares)
    }

    /**
     * Register a PUT route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static put (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('put', path, handler, middlewares)
    }

    /**
     * Register a DELETE route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static delete (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('delete', path, handler, middlewares)
    }

    /**
     * Register a PATCH route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static patch (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('patch', path, handler, middlewares)
    }

    /**
     * Register an OPTIONS route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static options (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('options', path, handler, middlewares)
    }

    /**
     * Register a HEAD route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static head (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        this.add('head', path, handler, middlewares)
    }

    /**
     * Group routes with a common prefix and middlewares
     * @param prefix - URL prefix for grouped routes
     * @param callback - Function containing route definitions
     * @param middlewares - Middleware functions applied to all routes in group
     */
    static async group (
        prefix: string,
        callback: () => void | Promise<void>,
        middlewares?: Middleware[]
    ): Promise<void> {
        const context = this.groupContext.getStore()
        const previousPrefix = context?.prefix ?? this.prefix
        const previousMiddlewares = context?.groupMiddlewares ?? this.groupMiddlewares

        const fullPrefix = [previousPrefix, prefix]
            .filter(Boolean)
            .join('/')

        const nextContext = {
            prefix: this.normalizePath(fullPrefix),
            groupMiddlewares: [...previousMiddlewares, ...(middlewares || [])],
        }

        await this.groupContext.run(nextContext, async () => {
            await Promise.resolve(callback())
        })
    }

    /**
     * Apply global middlewares for the duration of the callback
     * @param middlewares - Middleware functions
     * @param callback - Function containing route definitions
     */
    static middleware (middlewares: Middleware[], callback: () => void): void {
        const prevMiddlewares = this.globalMiddlewares

        this.globalMiddlewares = [...prevMiddlewares, ...(middlewares || [])]

        callback()

        this.globalMiddlewares = prevMiddlewares
    }

    /**
     * Get all registered routes with their information
     * @returns Array of route information objects
     */
    static allRoutes (): Array<Route<HttpContext, Middleware>>
    static allRoutes (type: 'path'): Record<string, Route<HttpContext, Middleware>>
    static allRoutes (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware>> }
    static allRoutes (type?: 'method' | 'path'):
        Array<Route<HttpContext, Middleware>> |
        Record<string, Route<HttpContext, Middleware>> |
        Record<string, Array<Route<HttpContext, Middleware>>> {
        if (type === 'method') {
            return this.routesByMethod
        }

        if (type === 'path') {
            return this.routesByPathMethod
        }

        return this.routes.filter(e => e.methods.length > 1 || e.methods[0] !== 'options')
    }

    /**
     * Apply all registered routes to the provided Express Router instance
     * Handles controller-method binding and middleware application
     * All errors are thrown to Express error handling middleware
     * 
     * @param router - Express Router instance
     */
    static apply (router: ExpressRouter): void
    static async apply (router: ExpressRouter): Promise<void>
    static async apply (router: ExpressRouter): Promise<void> {
        for (const route of this.routes) {
            let handlerFunction: RouteHandler | null = null
            let instance: Controller<HttpContext> | null = null

            try {
                if (typeof route.handler === 'function') {
                    /** 
                     * Since we do not have a controller instance, we will call the handler function directly and the route instance will be the this argument. This allows for both controller-based and function-based handlers to work seamlessly.
                     */
                    handlerFunction = route.handler.bind(route) as never
                } else if (
                    Array.isArray(route.handler) &&
                    route.handler.length === 2
                ) {
                    const [Controller, method] = route.handler

                    if (
                        ['function', 'object'].includes(typeof Controller) &&
                        typeof Controller[method] === 'function'
                    ) {
                        instance = Controller
                        handlerFunction = Controller[method].bind(Controller)
                    } else if (typeof Controller === 'function') {
                        instance = new Controller()
                        if (typeof instance![method] === 'function') {
                            handlerFunction = instance![method].bind(instance)
                        } else {
                            throw new Error(
                                `Method "${method}" not found in controller instance "${Controller.name}"`
                            )
                        }
                    } else {
                        throw new Error(`Invalid controller type for route: ${route.path}`)
                    }
                } else {
                    throw new Error(`Invalid handler format for route: ${route.path}`)
                }
            } catch (error: any) {
                console.error(`[ROUTES] Error setting up route ${route.path}:`, error.message)
                throw error
            }

            if (!handlerFunction) continue

            for (const method of route.methods) {
                const allowedMethods = [
                    'get',
                    'post',
                    'put',
                    'delete',
                    'patch',
                    'options',
                    'head',
                ]

                if (method === 'options' && route.methods.length > 1) continue

                if (!allowedMethods.includes(method)) {
                    const error = new Error(
                        `Invalid HTTP method: ${method} for route: ${route.path}`
                    )
                    console.error('[ROUTES]', error.message)
                    throw error
                }

                router[method](
                    route.path,
                    (req, res, next) => {
                        Router.ensureRequestBodyAccessor(req)
                        const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)

                        if (method === 'post' && override && override !== 'post') {
                            return next('route')
                        }

                        return next()
                    },
                    ...(route.middlewares || []),
                    async (req, res, next) => {
                        try {
                            Router.ensureRequestBodyAccessor(req)
                            const ctx: HttpContext = { req: req as HttpContext['req'], res, next }
                            const inst = instance ?? route
                            await Router.bindRequestToInstance(ctx, inst, route)
                            const result = handlerFunction(ctx, inst.clearRequest)
                            await Promise.resolve(result)
                        } catch (error: any) {
                            next(error)
                        }
                    }
                )

                if (['put', 'patch', 'delete'].includes(method)) {
                    router.post(
                        route.path,
                        (req, res, next) => {
                            Router.ensureRequestBodyAccessor(req)
                            const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)
                            if (override !== method) {
                                return next('route')
                            }

                            req.method = method.toUpperCase()

                            return next()
                        },
                        ...(route.middlewares || []),
                        async (req, res, next) => {
                            try {
                                Router.ensureRequestBodyAccessor(req)
                                const ctx: HttpContext = { req: req as HttpContext['req'], res, next }
                                const inst = instance ?? route
                                await Router.bindRequestToInstance(ctx, inst, route)
                                const result = handlerFunction(ctx, inst.clearRequest)
                                await Promise.resolve(result)
                            } catch (error: any) {
                                next(error)
                            }
                        }
                    )
                }
            }
        }
    }

    private static async bindRequestToInstance (
        ctx: HttpContext,
        instance: Controller<HttpContext> | Route<HttpContext, Middleware> | null,
        route: Route<HttpContext, Middleware>
    ): Promise<void> {
        if (!instance) return

        Router.ensureRequestBodyAccessor(ctx.req)

        instance.ctx = ctx
        instance.body = ctx.req.getBody()
        instance.query = ctx.req.query
        instance.params = ctx.req.params
        instance.clearRequest = new ClearRequest({
            ctx,
            route,
            body: instance.body,
            query: instance.query,
            params: instance.params,
        })
    }
}

export default Router