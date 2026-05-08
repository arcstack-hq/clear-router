import { ApiResourceMiddleware, ControllerAction, HttpMethod } from 'types/basic'
import { Handler, HttpContext, KoaRouterApp, Middleware, RouteHandler } from 'types/koa'
import { isFetchResponse, resolveResponseMeta } from 'src/core/responses'

import { CoreRouter } from 'src/core/router'
import { Route } from 'src/Route'

/**
 * @class clear-router Koa Router
 * @description Laravel-style routing system for Koa using @koa/router and shared clear-router core
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:koa'

    private static readonly bodyCache = new WeakMap<HttpContext, Record<string, any>>()

    private static async readBodyCached (ctx: HttpContext): Promise<Record<string, any>> {
        if (this.bodyCache.has(ctx)) {
            const cached = this.bodyCache.get(ctx) || {}
            ctx.request.getBody = () => cached

            return cached
        }

        let body = ctx.request.body && typeof ctx.request.body === 'object'
            ? ctx.request.body as Record<string, any>
            : {}

        if (!Object.keys(body).length && !['GET', 'HEAD'].includes(ctx.method.toUpperCase())) {
            body = await this.readBody(ctx)
        }

        ctx.request.getBody = () => body
        this.bodyCache.set(ctx, body)

        return body
    }

    private static async readBody (ctx: HttpContext): Promise<Record<string, any>> {
        const contentType = String(ctx.get('content-type') || '').toLowerCase()
        const chunks: Buffer[] = []

        for await (const chunk of ctx.req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        }

        const raw = Buffer.concat(chunks).toString('utf8')
        if (!raw) return {}

        if (contentType.includes('application/json')) {
            return JSON.parse(raw)
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
            return Object.fromEntries(new URLSearchParams(raw))
        }

        return {}
    }

    private static async sendReturnValue (ctx: HttpContext, value: any, method: HttpMethod, path: string): Promise<any> {
        if (ctx.respond === false || ctx.headerSent) return value

        const meta = resolveResponseMeta(value, {
            headers: ctx.headers as Record<string, any>,
            method,
            path,
            status: ctx.status && ctx.status !== 404 ? ctx.status : undefined,
        })

        if (!meta) return undefined

        ctx.status = meta.status

        meta.headers?.forEach((headerValue, key) => {
            ctx.set(key, headerValue)
        })

        if (isFetchResponse(meta.body)) {
            meta.body.headers.forEach((headerValue, key) => {
                ctx.set(key, headerValue)
            })

            ctx.status = meta.body.status
            ctx.body = Buffer.from(await meta.body.arrayBuffer())

            return ctx.body
        }

        if (meta.contentType) {
            ctx.type = meta.contentType
        }

        ctx.body = meta.isEmpty ? null : meta.body

        return ctx.body
    }

    /**
     * Adds a new route to the router.
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
     * Adds a new HEAD route to the router.
     *
     * @param this
     * @param path
     * @param handler
     * @param middlewares
     */
    static head (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.head(path, handler, middlewares)
    }

    /**
     * Defines a group of routes with a common prefix.
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
     * Apply the defined routes to a @koa/router instance
     * 
     * @param router  @koa/router instance
     * @returns    The  @koa/router instance with the applied routes
     */
    static apply (router: KoaRouterApp): KoaRouterApp {
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

                ; (router[method] as any)(
                    route.path,
                    ...(route.middlewares || []),
                    async (context: any, next: any) => {
                        const ctx = context as HttpContext
                        const reqBody = await Router.readBodyCached(ctx)
                        const override = Router.resolveMethodOverride(ctx.method, ctx.headers as Record<string, any>, reqBody)

                        if (method === 'post' && override && override !== 'post') {
                            return next()
                        }

                        const inst = instance ?? route
                        Router.bindRequestToInstance(ctx, inst, route, {
                            body: reqBody,
                            query: ctx.query as Record<string, any>,
                            params: (ctx.params as Record<string, any>) ?? {},
                            method,
                        })

                        const result = handlerFunction(ctx, ctx.clearRequest)
                        const resolved = await Promise.resolve(result)
                        const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                            ? ctx.clearResponse
                            : resolved

                        return Router.sendReturnValue(ctx, outgoing, method, route.path)
                    }
                )

                if (['put', 'patch', 'delete'].includes(method)) {
                    router.post(
                        route.path,
                        ...(route.middlewares || []),
                        async (context: any, next: any) => {
                            const ctx = context as HttpContext
                            const reqBody = await Router.readBodyCached(ctx)
                            const override = Router.resolveMethodOverride(ctx.method, ctx.headers as Record<string, any>, reqBody)

                            if (override !== method) {
                                return next()
                            }

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: reqBody,
                                query: ctx.query as Record<string, any>,
                                params: (ctx.params as Record<string, any>) ?? {},
                                method,
                            })

                            const result = handlerFunction(ctx, ctx.clearRequest)
                            const resolved = await Promise.resolve(result)
                            const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                ? ctx.clearResponse
                                : resolved

                            return Router.sendReturnValue(ctx, outgoing, method, route.path)
                        }
                    )
                }
            }
        }

        return router
    }
}

export default Router
