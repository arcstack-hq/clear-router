import { HTTPResponse, getQuery, getRouterParams, readBody, type H3 } from 'h3'

import { CoreRouter } from '../core/CoreRouter'
import type { Route } from '../Route'
import { RouteGroup } from '../RouteGroup'
import type { ResourceRoutes } from '../ResourceRoutes'
import type { ApiResourceMiddleware, ResourceAction, HttpMethod, RouteGroupSource } from '../types/basic'
import type { H3App, Handler, HttpContext, Middleware, RouteHandler } from '../types/h3'
import { resolveResponseMeta } from '../core/responses'

/**
 * @class clear-router H3 Router
 * @description Laravel-style routing system for Express.js and H3 with support for CommonJS, ESM, and TypeScript
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-hq/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:h3'

    private static readonly bodyCache = new WeakMap<HttpContext, any>()

    private static toResponse (ctx: HttpContext, value: any, method: HttpMethod, path: string): any {
        const meta = resolveResponseMeta(value, {
            headers: ctx.req.headers,
            method,
            path,
            status: typeof ctx.res.status === 'number' && ctx.res.status !== 200
                ? ctx.res.status
                : undefined,
        })

        if (!meta) return undefined
        if (meta.isNativeResponse) return meta.body

        const headers = meta.headers
            ? {} as Record<string, string>
            : meta.contentType
                ? { 'Content-Type': meta.contentType }
                : undefined

        meta.headers?.forEach((headerValue, key) => {
            if (headers) headers[key] = headerValue
        })

        return new HTTPResponse(meta.contentType?.startsWith('application/json')
            ? JSON.stringify(meta.body)
            : meta.isEmpty ? null : meta.body, {
            status: meta.status,
            headers,
        })
    }

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
     * Adds a new route to the router.
     * 
     * @param methods 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static add<T = any> (
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.add(methods, path, handler, middlewares)
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
            only?: ResourceAction[]
            except?: ResourceAction[]
            middlewares?: ApiResourceMiddleware<Middleware>
        }
    ): ResourceRoutes<HttpContext, Middleware, Handler> {
        return super.apiResource(basePath, controller, options)
    }

    /**
     * Adds a new GET route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static get<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.get(path, handler, middlewares)
    }

    /**
     * Adds a new POST route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.post(path, handler, middlewares)
    }

    /**
     * Adds a new PUT route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.put(path, handler, middlewares)
    }

    /**
     * Adds a new DELETE route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.delete(path, handler, middlewares)
    }

    /**
     * Adds a new PATCH route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.patch(path, handler, middlewares)
    }

    /**
     * Adds a new OPTIONS route to the router with the specified path, handler, and optional middlewares.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.options(path, handler, middlewares)
    }

    /**
     * Adds a new HEAD route to the router.
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head<T = any> (
        path: string,
        handler: Handler<T>,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler<T>> {
        return super.head(path, handler, middlewares)
    }

    /**
     * Defines a group of routes with a common prefix.
     * 
     * @param prefix 
     * @param callback 
     * @param middlewares 
     */
    static group<T = any, S extends RouteGroupSource = RouteGroupSource> (
        prefix: string,
        source: S,
        middlewares?: Middleware[]
    ): RouteGroup<HttpContext, Middleware, Handler<T>, S> {
        return super.group(prefix, source, middlewares)
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
    static allRoutes<T = any> (): Array<Route<HttpContext, Middleware, Handler<T>>>
    static allRoutes<T = any> (type: 'path'): Record<string, Route<HttpContext, Middleware, Handler<T>>>
    static allRoutes<T = any> (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware, Handler<T>>> }
    static allRoutes<T = any> (type: 'name'): Record<string, Route<HttpContext, Middleware, Handler<T>>>
    static allRoutes<T = any> (type?: 'method' | 'path' | 'name'):
        Array<Route<HttpContext, Middleware, Handler<T>>> |
        Record<string, Route<HttpContext, Middleware, Handler<T>>> |
        Record<string, Array<Route<HttpContext, Middleware, Handler<T>>>> {
        return super.allRoutes(type as any) as any
    }

    static route<T = any> (name: string): Route<HttpContext, Middleware, Handler<T>> | undefined {
        return super.route(name)
    }

    /**
     * Applies the registered routes to the given H3 application instance, setting up the 
     * necessary handlers and middlewares for each route.
     * 
     * @param app 
     * @returns 
     */
    static apply (app: H3): H3App {
        for (const route of this.orderedRoutes()) {
            let handlerFunction: RouteHandler | null = null
            let instance = null
            let bindingTarget: object | undefined
            let bindingMethod: PropertyKey | undefined
            let bindingHandler: object | undefined
            let bindingMetadata: object | undefined

            try {
                const resolved = this.resolveHandler(route)
                handlerFunction = resolved.handlerFunction as RouteHandler
                instance = resolved.instance
                bindingTarget = resolved.bindingTarget
                bindingMethod = resolved.bindingMethod
                bindingHandler = resolved.bindingHandler
                bindingMetadata = resolved.bindingMetadata
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

                for (const registrationPath of route.registrationPaths) {
                    app[method](registrationPath, async (event) => {
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
                                method,
                            })

                            const result = await Router.callHandler(handlerFunction, ctx, bindingTarget, bindingMethod, bindingHandler, bindingMetadata)
                            const resolved = await Promise.resolve(result)
                            const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                ? ctx.clearResponse
                                : resolved

                            return Router.toResponse(ctx, outgoing, method, route.path)
                        } catch (error: any) {
                            return error
                        }
                    }, {
                        middleware: route.middlewares,
                    })
                }

                if (['put', 'patch', 'delete'].includes(method)) {
                    for (const registrationPath of route.registrationPaths) {
                        app.post(registrationPath, async (event) => {
                            try {
                                const ctx = event as HttpContext
                                const reqBody = await Router.readBodyCached(ctx)
                                const override = Router.resolveMethodOverride(ctx.req.method, ctx.req.headers, reqBody)

                                if (override !== method) return Symbol.for('h3.notFound')

                                const inst = instance ?? route
                                Router.bindRequestToInstance(ctx, inst, route, {
                                    body: reqBody,
                                    query: getQuery(ctx) as Record<string, any>,
                                    params: getRouterParams(ctx, { decode: true }) as Record<string, any>,
                                    method,
                                })

                                const result = await Router.callHandler(handlerFunction, ctx, bindingTarget, bindingMethod, bindingHandler, bindingMetadata)
                                const resolved = await Promise.resolve(result)
                                const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                    ? ctx.clearResponse
                                    : resolved

                                return Router.toResponse(ctx, outgoing, method, route.path)
                            } catch (error: any) {
                                return error
                            }
                        }, {
                            middleware: route.middlewares,
                        })
                    }
                }
            }
        }

        return app as never
    }
}

export default Router
