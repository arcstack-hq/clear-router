import type { ApiResourceMiddleware, HttpMethod, ResourceAction, RouteGroupSource } from '../types/basic'
import type { FastifyApp, Handler, HttpContext, Middleware, RouteHandler } from '../types/fastify'
import { isFetchResponse, resolveResponseMeta, responseWasSent } from '../core/responses'

import { CoreRouter } from '../core/router'
import { RouteGroup } from '../RouteGroup'
import type { ResourceRoutes } from '../ResourceRoutes'
import type { Route } from '../Route'

/**
 * @class clear-router Fastify Router
 * @description Laravel-style routing system for Fastify using shared clear-router core
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-tmp/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:fastify'

    private static ensureRequestBodyAccessor (req: any): void {
        if (typeof req.getBody !== 'function') {
            req.getBody = () => req.body ?? {}
        }
    }

    private static async sendReturnValue (
        req: any,
        reply: any,
        value: any,
        method: HttpMethod,
        path: string
    ): Promise<any> {
        if (responseWasSent(reply) || value === reply || responseWasSent(value)) return value

        const meta = resolveResponseMeta(value, {
            headers: req.headers,
            method,
            path,
        })

        if (!meta) return undefined

        reply.code(meta.status)

        meta.headers?.forEach((headerValue, key) => {
            reply.header(key, headerValue)
        })

        if (isFetchResponse(meta.body)) {
            meta.body.headers.forEach((headerValue, key) => {
                reply.header(key, headerValue)
            })

            reply.code(meta.body.status)

            return reply.send(Buffer.from(await meta.body.arrayBuffer()))
        }

        if (meta.contentType) {
            reply.type(meta.contentType)
        }

        if (meta.isEmpty) {
            return reply.send()
        }

        return reply.send(meta.body)
    }

    /**
     * Add a route to the router
     * 
     * @param methods       HTTP methods for the route
     * @param path          Route path
     * @param handler       Route handler function
     * @param middlewares   Optional middlewares for the route
     */
    static add (
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.add(methods, path, handler, middlewares)
    }

    /**
     * Define a resourceful API controller with standard CRUD routes
     * 
     * @param basePath     Base path for the resource
     * @param controller   Controller class or instance
     * @param options      Optional configuration for the resource
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
     * Define a GET route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static get (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.get(path, handler, middlewares)
    }

    /**
     * Define a POST route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.post(path, handler, middlewares)
    }

    /**
     * Define a PUT route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.put(path, handler, middlewares)
    }

    /**
     * Define a DELETE route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.delete(path, handler, middlewares)
    }

    /**
     * Define a PATCH route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.patch(path, handler, middlewares)
    }

    /**
     * Define an OPTIONS route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.options(path, handler, middlewares)
    }

    /**
     * Define a HEAD route
     * 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head (
        path: string,
        handler: Handler,
        middlewares?: Middleware[] | Middleware
    ): Route<HttpContext, Middleware, Handler> {
        return super.head(path, handler, middlewares)
    }

    /**
     * Define a group of routes with a common prefix and optional middlewares
     * 
     * @param prefix 
     * @param callback 
     * @param middlewares 
     */
    static group (
        prefix: string,
        source: RouteGroupSource,
        middlewares?: Middleware[]
    ): RouteGroup {
        return super.group(prefix, source, middlewares)
    }

    /**
     * Apply middlewares to a group of routes defined within the callback
     * 
     * @param middlewares 
     * @param callback 
     */
    static middleware (middlewares: Middleware[], callback: () => void): void {
        super.middleware(middlewares, callback)
    }

    static allRoutes (): Array<Route<HttpContext, Middleware, Handler>>
    /**
     * @param type  - 'path' to get routes organized by path
     */
    static allRoutes (type: 'path'): Record<string, Route<HttpContext, Middleware, Handler>>
    /**
     * @param type  - 'method' to get routes organized by method 
     */
    static allRoutes (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<HttpContext, Middleware, Handler>> }
    static allRoutes (type: 'name'): Record<string, Route<HttpContext, Middleware, Handler>>
    static allRoutes (type?: 'method' | 'path' | 'name'):
        Array<Route<HttpContext, Middleware, Handler>> |
        Record<string, Route<HttpContext, Middleware, Handler>> |
        Record<string, Array<Route<HttpContext, Middleware, Handler>>> {
        return super.allRoutes(type as any) as any
    }

    static route (name: string): Route<HttpContext, Middleware, Handler> | undefined {
        return super.route(name)
    }

    /**
     * Apply the defined routes to a Fastify application instance
     * 
     * @param app  - The Fastify application instance
     * @returns    The Fastify application instance with the applied routes
     */
    static apply (app: FastifyApp): FastifyApp {
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
                const allowedMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head']

                if (method === 'options' && route.methods.length > 1) continue
                if (!allowedMethods.includes(method)) {
                    throw new Error(`Invalid HTTP method: ${method} for route: ${route.path}`)
                }

                for (const registrationPath of route.registrationPaths) {
                    app.route({
                        method: method.toUpperCase() as any,
                        url: registrationPath,
                        preHandler: route.middlewares as any,
                        handler: async (req, reply) => {
                            Router.ensureRequestBodyAccessor(req)
                            const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)
                            if (method === 'post' && override && override !== 'post') {
                                return reply.code(404).send()
                            }

                            const ctx = {
                                req: req as HttpContext['req'],
                                reply,
                            } as HttpContext

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: ctx.req.getBody(),
                                query: (ctx.req.query as Record<string, any>) ?? {},
                                params: (ctx.req.params as Record<string, any>) ?? {},
                                method,
                            })

                            const result = await Router.callHandler(handlerFunction, ctx, bindingTarget, bindingMethod, bindingHandler, bindingMetadata)
                            const resolved = await Promise.resolve(result)
                            const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                ? ctx.clearResponse
                                : resolved

                            return Router.sendReturnValue(req, reply, outgoing, method, route.path)
                        },
                    })
                }

                if (['put', 'patch', 'delete'].includes(method)) {
                    for (const registrationPath of route.registrationPaths) {
                        app.route({
                            method: 'POST',
                            url: registrationPath,
                            preHandler: route.middlewares as any,
                            handler: async (req, reply) => {
                                Router.ensureRequestBodyAccessor(req)
                                const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)
                                if (override !== method) {
                                    return reply.code(404).send()
                                }

                                const ctx = {
                                    req: req as HttpContext['req'],
                                    reply,
                                } as HttpContext

                                const inst = instance ?? route
                                Router.bindRequestToInstance(ctx, inst, route, {
                                    body: ctx.req.getBody(),
                                    query: (ctx.req.query as Record<string, any>) ?? {},
                                    params: (ctx.req.params as Record<string, any>) ?? {},
                                    method,
                                })

                                const result = await Router.callHandler(handlerFunction, ctx, bindingTarget, bindingMethod, bindingHandler, bindingMetadata)
                                const resolved = await Promise.resolve(result)
                                const outgoing = typeof resolved === 'undefined' && ctx.clearResponse?.sent
                                    ? ctx.clearResponse
                                    : resolved

                                return Router.sendReturnValue(req, reply, outgoing, method, route.path)
                            },
                        })
                    }
                }
            }
        }

        return app
    }
}

export default Router
