import { ClearRequest } from "src/ClearRequest";
import { ControllerAction, HttpMethod, RouteInfo } from "types/basic";
import { H3App, Handler, HttpContext, Middleware, RouteHandler } from "types/h3";

import { getQuery, getRouterParams, readBody, type H3 } from "h3";
import { Controller } from "src/Controller";
import { Route } from "src/Route";

/**
 * @class clear-router
 * @description Laravel-style routing system for Express.js and H3 with support for CommonJS, ESM, and TypeScript
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router {
    /**
     * All registered routes
     */
    static routes: Array<Route<HttpContext, Middleware>> = [];

    /**
     * Current route prefix
     */
    static prefix: string = '';

    /**
     * Group-level middlewares
     */
    static groupMiddlewares: Middleware[] = [];

    /**
     * Global-level middlewares
     */
    static globalMiddlewares: Middleware[] = [];

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
        middlewares?: Middleware[]
    ): void {
        const methodArray = Array.isArray(methods) ? methods : [methods]
        const fullPath = this.normalizePath(`${this.prefix}/${path}`)

        this.routes.push(new Route(
            methodArray,
            fullPath,
            handler,
            [...this.globalMiddlewares, ...this.groupMiddlewares, ...(middlewares || [])]
        ))
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
        options?: { only?: ControllerAction[], except?: ControllerAction[] }
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
                this.add(method as HttpMethod, `${basePath}${path}`, [controller, action])
            }
        }
    }

    /**
     * Register a GET route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static get (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('get', path, handler, middlewares)
    }

    /**
     * Register a POST route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static post (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('post', path, handler, middlewares)
    }

    /**
     * Register a PUT route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static put (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('put', path, handler, middlewares)
    }

    /**
     * Register a DELETE route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static delete (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('delete', path, handler, middlewares)
    }

    /**
     * Register a PATCH route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static patch (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('patch', path, handler, middlewares)
    }

    /**
     * Register an OPTIONS route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static options (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('options', path, handler, middlewares)
    }

    /**
     * Register a HEAD route
     * @param path - Route path
     * @param handler - Route handler
     * @param middlewares - Middleware functions
     */
    static head (path: string, handler: Handler, middlewares?: Middleware[]): void {
        this.add('head', path, handler, middlewares)
    }

    /**
     * Group routes with a common prefix and middlewares
     * @param prefix - URL prefix for grouped routes
     * @param callback - Function containing route definitions
     * @param middlewares - Middleware functions applied to all routes in group
     */
    static group (prefix: string, callback: () => void, middlewares?: Middleware[]): void {
        const previousPrefix = this.prefix
        const previousMiddlewares = this.groupMiddlewares

        const fullPrefix = [previousPrefix, prefix]
            .filter(Boolean)
            .join('/')

        this.prefix = this.normalizePath(fullPrefix)
        this.groupMiddlewares = [...previousMiddlewares, ...(middlewares || [])]

        callback()

        this.prefix = previousPrefix
        this.groupMiddlewares = previousMiddlewares
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
    static allRoutes (): RouteInfo[] {
        return this.routes.map(route => ({
            methods: route.methods,
            path: route.path,
            middlewareCount: route.middlewares.length,
            handlerType: typeof route.handler === 'function' ? 'function' : 'controller'
        }))
    }

    /**
     * Apply all registered routes to the provided H3 Router instance
     * Handles controller-method binding and middleware application
     * All errors are thrown to H3 error handling middleware
     * 
     * @param app - H3 app instance
     */
    static apply (app: H3): H3App {
        for (const route of this.routes) {
            let handlerFunction: RouteHandler | null = null
            let instance: Controller<HttpContext> | null = null

            try {
                if (typeof route.handler === 'function') {
                    /** 
                     * Since we do not have a controller instance, we will call the handler function directly and the route instance will be the this argument. This allows for both controller-based and function-based handlers to work seamlessly.
                     */
                    handlerFunction = route.handler.bind(route)
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
                    }
                    else if (typeof Controller === 'function') {
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

                if (!allowedMethods.includes(method)) {
                    const error = new Error(
                        `Invalid HTTP method: ${method} for route: ${route.path}`
                    )
                    console.error(`[ROUTES]`, error.message)
                    throw error
                }

                app[method](route.path, async (event) => {
                    try {
                        const ctx: HttpContext = event
                        await Router.bindRequestToInstance(ctx, instance ?? route)
                        const result = handlerFunction(ctx, instance?.clearRequest!)
                        return await Promise.resolve(result)
                    } catch (error: any) {
                        return error
                    }
                }, {
                    middleware: route.middlewares,
                })
            }
        }

        return app as never
    }

    private static async bindRequestToInstance (
        ctx: HttpContext,
        instance: Controller<HttpContext> | Route<HttpContext, Middleware> | null
    ): Promise<void> {
        if (!instance) return

        instance.ctx = ctx
        instance.body = await readBody(ctx) ?? {}
        instance.query = getQuery(ctx)
        instance.params = getRouterParams(ctx, { decode: true })
        instance.clearRequest = new ClearRequest({
            ctx,
            body: instance.body,
            query: instance.query,
            params: instance.params,
        })
    }
}

export default Router