import { ApiResourceMiddleware, ControllerAction, HttpMethod } from 'types/basic'
import { Handler, HttpContext, Middleware, RouteHandler } from 'types/express'
import { isFetchResponse, resolveResponseMeta, responseWasSent } from 'src/core/responses'

import { CoreRouter } from 'src/core/router'
import { Router as ExpressRouter } from 'express'
import { Route } from 'src/Route'

/**
 * @class clear-router Express Router
 * @description Laravel-style routing system for Express.js and H3 with support for CommonJS, ESM, and TypeScript
 * @author Refkinscallv
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:express'

    private static ensureRequestBodyAccessor (req: any): void {
        if (typeof req.getBody !== 'function') {
            req.getBody = () => req.body ?? {}
        }
    }

    private static async sendReturnValue (
        ctx: HttpContext,
        value: any,
        method: HttpMethod,
        path: string
    ): Promise<void> {
        const { req, res } = ctx

        if (responseWasSent(res) || value === res || responseWasSent(value)) return

        const meta = resolveResponseMeta(value, {
            headers: req.headers,
            method,
            path,
        })

        if (!meta) return

        res.status(meta.status)

        meta.headers?.forEach((headerValue, key) => {
            res.setHeader(key, headerValue)
        })

        if (isFetchResponse(meta.body)) {
            meta.body.headers.forEach((headerValue, key) => {
                res.setHeader(key, headerValue)
            })

            res.status(meta.body.status)
            const body = Buffer.from(await meta.body.arrayBuffer())
            res.send(body)

            return
        }

        if (meta.contentType && !res.getHeader('Content-Type')) {
            res.setHeader('Content-Type', meta.contentType)
        }

        if (meta.isEmpty) {
            res.sendStatus(meta.status)

            return
        }

        res.send(meta.body)
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
     * Adds a new GET route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static get (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.get(path, handler, middlewares)
    }

    /**
     * Adds a new POST route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.post(path, handler, middlewares)
    }

    /**
     * Adds a new PUT route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.put(path, handler, middlewares)
    }

    /**
     * Adds a new DELETE route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.delete(path, handler, middlewares)
    }

    /**
     * Adds a new PATCH route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (path: string, handler: Handler, middlewares?: Middleware[] | Middleware): void {
        super.patch(path, handler, middlewares)
    }

    /**
     * Adds a new OPTIONS route to the router.
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
     * Adds global middlewares to the router, which will be applied to all routes.
     * 
     * @param middlewares 
     * @param callback 
     */
    static middleware (middlewares: Middleware[], callback: () => void): void {
        super.middleware(middlewares, callback)
    }

    /**
     * Retrieves all registered routes in the router, optionally organized by path or method.
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
     * Applies the registered routes to the given Express router instance, setting up the necessary 
     * handlers and middlewares for each route.
     * 
     * @param router 
     */
    static apply (router: ExpressRouter): void
    static async apply (router: ExpressRouter): Promise<void>
    static async apply (router: ExpressRouter): Promise<void> {
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

                router[method](
                    route.path,
                    (req, _res, next) => {
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

                            const ctx = {
                                req: req as HttpContext['req'],
                                res,
                                next,
                            } as HttpContext

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: ctx.req.getBody(),
                                query: ctx.req.query as Record<string, any>,
                                params: ctx.req.params as Record<string, any>,
                                method,
                            })

                            const result = handlerFunction(ctx, ctx.clearRequest)
                            const resolved = await Promise.resolve(result)
                            const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                ? ctx.clearResponse
                                : resolved
                            await Router.sendReturnValue(ctx, outgoing, method, route.path)
                        } catch (error: any) {
                            next(error)
                        }
                    }
                )

                if (['put', 'patch', 'delete'].includes(method)) {
                    router.post(
                        route.path,
                        (req, _res, next) => {
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

                                const ctx = {
                                    req: req as HttpContext['req'],
                                    res,
                                    next,
                                } as HttpContext

                                const inst = instance ?? route
                                Router.bindRequestToInstance(ctx, inst, route, {
                                    body: ctx.req.getBody(),
                                    query: ctx.req.query as Record<string, any>,
                                    params: ctx.req.params as Record<string, any>,
                                    method,
                                })

                                const result = handlerFunction(ctx, ctx.clearRequest)
                                const resolved = await Promise.resolve(result)
                                const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                    ? ctx.clearResponse
                                    : resolved
                                await Router.sendReturnValue(ctx, outgoing, method, route.path)
                            } catch (error: any) {
                                next(error)
                            }
                        }
                    )
                }
            }
        }
    }
}

export default Router
