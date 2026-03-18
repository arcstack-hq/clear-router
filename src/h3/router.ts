import { getQuery, getRouterParams, readBody, type H3 } from 'h3'

import { CoreRouter } from 'src/core/router'
import { Route } from 'src/Route'
import { ApiResourceMiddleware, ControllerAction, HttpMethod } from 'types/basic'
import { H3App, Handler, HttpContext, Middleware, RouteHandler } from 'types/h3'

/**
 * @class clear-router H3 Router
 * @description Laravel-style routing system for Express.js and H3 with support for CommonJS, ESM, and TypeScript
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router extends CoreRouter {
    private static readonly bodyCache = new WeakMap<HttpContext, any>()

    private static async readBodyCached (ctx: HttpContext): Promise<Record<string, any>> {
        if (this.bodyCache.has(ctx)) {
            const cached = this.bodyCache.get(ctx)
            ctx.req.getBody = () => cached

            return cached
        }

        let body: Record<string, any> = {}

        if (ctx.req.headers.get('content-type')?.includes('multipart/form-data')) {
            (await ctx.req.formData()).forEach((value, key) => {
                body[key] = value
            })
        } else {
            body = await readBody(ctx) ?? {}
        }

        ctx.req.getBody = () => body
        this.bodyCache.set(ctx, body)

        return body
    }

    /**
     * Adds a new route to the router with the specified HTTP methods, path, handler, and optional middlewares.
     * 
     * @param methods 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static add (
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): void {
        super.add(methods, path, handler, middlewares)
    }

    /**
     * Adds a new API resource route to the router for a given base path and controller, with options 
     * to specify included/excluded actions and middlewares.
     * 
     * @param basePath 
     * @param controller 
     * @param options 
     */
    static apiResource (
        basePath: string,
        controller: any,
        options?: {
            only?: ControllerAction[]
            except?: ControllerAction[]
            middlewares?: ApiResourceMiddleware<Middleware>
        }
    ): void {
        super.apiResource(basePath, controller, options)
    }

    /**
     * Adds a new GET route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static get (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.get(path, handler, middlewares)
    }

    /**
     * Adds a new POST route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.post(path, handler, middlewares)
    }

    /**
     * Adds a new PUT route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.put(path, handler, middlewares)
    }

    /**
     * Adds a new DELETE route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.delete(path, handler, middlewares)
    }

    /**
     * Adds a new PATCH route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.patch(path, handler, middlewares)
    }

    /**
     * Adds a new OPTIONS route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.options(path, handler, middlewares)
    }

    /**
     * Adds a new HEAD route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.head(path, handler, middlewares)
    }

    /**
     * Defines a group of routes with a common prefix and optional middlewares, allowing for better 
     * organization and reuse of route configurations.
     * 
     * @param prefix 
     * @param callback 
     * @param middlewares 
     */
    static async group (
        prefix: string,
        callback: () => void | Promise<void>,
        middlewares?: Middleware[]
    ): Promise<void> {
        await super.group(prefix, callback, middlewares)
    }

    /**
     * Adds global middlewares to the router, which will be applied to all routes.
     * 
     * @param middlewares 
     * @param callback 
     */
    static middleware (middlewares: Middleware[], callback: () => void): void {
        super.middleware(middlewares, callback)
    }

    /** 
     * Retrieves all registered routes in the router, optionally organized by path or method 
     * for easier access and management.
     * 
     * @param type 
     */
    static allRoutes (): Array<Route<HttpContext, Middleware, Handler>>
    static allRoutes (type: 'path'): Record<string, Route<HttpContext, Middleware, Handler>>
    static allRoutes (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware, Handler>> }
    static allRoutes (type?: 'method' | 'path'):
        Array<Route<HttpContext, Middleware, Handler>> |
        Record<string, Route<HttpContext, Middleware, Handler>> |
        Record<string, Array<Route<HttpContext, Middleware, Handler>>> {
        return super.allRoutes(type as any) as any
    }

    /**
     * Applies the registered routes to the given H3 application instance, setting up the 
     * necessary handlers and middlewares for each route.
     * 
     * @param app 
     * @returns 
     */
    static apply (app: H3): H3App {
        for (const route of this.routes) {
            let handlerFunction: RouteHandler | null = null
            let instance = null

            try {
                const resolved = this.resolveHandler(route)
                handlerFunction = resolved.handlerFunction as RouteHandler
                instance = resolved.instance
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

                app[method](route.path, async (event) => {
                    try {
                        const ctx = event as HttpContext
                        const reqBody = await Router.readBodyCached(ctx)
                        const override = Router.resolveMethodOverride(ctx.req.method, ctx.req.headers, reqBody)

                        if (method === 'post' && override && override !== 'post') {
                            return
                        }

                        const inst = instance ?? route
                        Router.bindRequestToInstance(ctx, inst, route, {
                            body: reqBody,
                            query: getQuery(ctx) as Record<string, any>,
                            params: getRouterParams(ctx, { decode: true }) as Record<string, any>,
                        })

                        const result = handlerFunction(ctx, inst.clearRequest)

                        return await Promise.resolve(result)
                    } catch (error: any) {
                        return error
                    }
                }, {
                    middleware: route.middlewares,
                })

                if (['put', 'patch', 'delete'].includes(method)) {
                    app.post(route.path, async (event) => {
                        try {
                            const ctx = event as HttpContext
                            const reqBody = await Router.readBodyCached(ctx)
                            const override = Router.resolveMethodOverride(ctx.req.method, ctx.req.headers, reqBody)

                            if (override !== method) {
                                return
                            }

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: reqBody,
                                query: getQuery(ctx) as Record<string, any>,
                                params: getRouterParams(ctx, { decode: true }) as Record<string, any>,
                            })

                            const result = handlerFunction(ctx, inst.clearRequest)

                            return await Promise.resolve(result)
                        } catch (error: any) {
                            return error
                        }
                    }, {
                        middleware: route.middlewares,
                    })
                }
            }
        }

        return app as never
    }
}

export default Router
