import { ApiResourceMiddleware, ControllerAction, HttpMethod } from 'types/basic'
import { Handler, HonoApp, HttpContext, Middleware, RouteHandler } from 'types/hono'

import { CoreRouter } from 'src/core/router'
import { Route } from 'src/Route'
import { resolveResponseMeta } from 'src/core/responses'

/**
 * @class clear-router Hono Router
 * @description Laravel-style routing system for Hono using shared clear-router core
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:hono'

    private static readonly bodyCache = new WeakMap<HttpContext, Record<string, any>>()

    private static toResponse (ctx: HttpContext, value: any, method: HttpMethod, path: string): Response | undefined {
        const meta = resolveResponseMeta(value, {
            headers: ctx.req.header() as Record<string, any>,
            method,
            path,
        })

        if (!meta) return undefined
        if (meta.isNativeResponse) return meta.body

        if (meta.isEmpty) return ctx.body(null, meta.status as any)

        if (meta.contentType?.startsWith('application/json')) {
            return ctx.json(meta.body, meta.status as any)
        }

        return ctx.body(meta.body, meta.status as any, meta.contentType
            ? { 'Content-Type': meta.contentType }
            : undefined)
    }

    private static getParams (ctx: HttpContext): Record<string, any> {
        try {
            const raw = (ctx.req as any).param?.()

            return raw && typeof raw === 'object' ? raw : {}
        } catch {
            return {}
        }
    }

    private static async readBodyCached (ctx: HttpContext): Promise<Record<string, any>> {
        if (this.bodyCache.has(ctx)) {
            const cached = this.bodyCache.get(ctx) || {}
            ctx.req.getBody = () => cached

            return cached
        }

        let body: Record<string, any> = {}
        const contentType = (ctx.req.header('content-type') || '').toLowerCase()

        if (contentType.includes('application/json')) {
            body = await ctx.req.json().catch(() => ({}))
        } else if (
            contentType.includes('multipart/form-data') ||
            contentType.includes('application/x-www-form-urlencoded')
        ) {
            body = await ctx.req.parseBody().then(v => v as Record<string, any>).catch(() => ({}))
        }

        ctx.req.getBody = () => body
        this.bodyCache.set(ctx, body)

        return body
    }

    /**
     * Resolve method override from query, headers, or body
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
     * Define a resourceful API controller with standard CRUD routes
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
     * Define a GET route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static get (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.get(path, handler, middlewares)
    }

    /**
     * Define a POST route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.post(path, handler, middlewares)
    }

    /**
     * Define a PUT route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.put(path, handler, middlewares)
    }

    /**
     * Define a DELETE route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.delete(path, handler, middlewares)
    }

    /**
     * Define a PATCH route 
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.patch(path, handler, middlewares)
    }

    /**
     * Define an OPTIONS route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.options(path, handler, middlewares)
    }

    /**
     * Define a HEAD route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.head(path, handler, middlewares)
    }

    /**
     * Define a group of routes with a common prefix and optional middlewares
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
     * Apply middlewares to a group of routes defined within the callback
     * 
     * @param middlewares  - Middleware or array of middlewares to apply
     * @param callback     - Function that defines the routes to which the middlewares will be applied
     */
    static middleware (middlewares: Middleware[], callback: () => void): void {
        super.middleware(middlewares, callback)
    }

    /**
     * Get all defined routes, optionally organized by path or method
     */
    static allRoutes (): Array<Route<HttpContext, Middleware, Handler>>
    /**
     * @param type  - 'path' to get routes organized by path
     */
    static allRoutes (type: 'path'): Record<string, Route<HttpContext, Middleware, Handler>>
    /**
     * @param type  - 'method' to get routes organized by method 
     */
    static allRoutes (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware, Handler>> }
    static allRoutes (type?: 'method' | 'path'):
        Array<Route<HttpContext, Middleware, Handler>> |
        Record<string, Route<HttpContext, Middleware, Handler>> |
        Record<string, Array<Route<HttpContext, Middleware, Handler>>> {
        return super.allRoutes(type as any) as any
    }

    /**
     * Apply the defined routes to a Hono application instance
     * 
     * @param app  The Hono application instance
     * @returns    The Hono application instance with the applied routes
     */
    static apply (app: HonoApp): HonoApp {
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
                const allowedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']

                if (method === 'options' && route.methods.length > 1) continue
                if (!allowedMethods.includes(method)) {
                    throw new Error(`Invalid HTTP method: ${method} for route: ${route.path}`)
                }

                app[method](
                    route.path,
                    ...(route.middlewares || []),
                    async (context: any) => {
                        const ctx = context as HttpContext
                        const reqBody = await Router.readBodyCached(ctx)
                        const override = Router.resolveMethodOverride(ctx.req.method, ctx.req.header() as Record<string, any>, reqBody)

                        if (method === 'post' && override && override !== 'post') {
                            return
                        }

                        const inst = instance ?? route
                        Router.bindRequestToInstance(ctx, inst, route, {
                            body: reqBody,
                            query: ctx.req.query() as Record<string, any>,
                            params: Router.getParams(ctx),
                        })

                        const result = handlerFunction(ctx, inst.clearRequest)
                        const resolved = await Promise.resolve(result)

                        return Router.toResponse(ctx, resolved, method, route.path)
                    }
                )

                if (['put', 'patch', 'delete'].includes(method)) {
                    app.post(
                        route.path,
                        ...(route.middlewares || []),
                        async (context: any) => {
                            const ctx = context as HttpContext
                            const reqBody = await Router.readBodyCached(ctx)
                            const override = Router.resolveMethodOverride(ctx.req.method, ctx.req.header() as Record<string, any>, reqBody)

                            if (override !== method) {
                                return
                            }

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: reqBody,
                                query: ctx.req.query() as Record<string, any>,
                                params: Router.getParams(ctx),
                            })

                            const result = handlerFunction(ctx, inst.clearRequest)
                            const resolved = await Promise.resolve(result)

                            return Router.toResponse(ctx, resolved, method, route.path)
                        }
                    )
                }
            }
        }

        return app
    }
}

export default Router
