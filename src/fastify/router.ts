import { ApiResourceMiddleware, ControllerAction, HttpMethod } from 'types/basic'
import { FastifyApp, Handler, HttpContext, Middleware, RouteHandler } from 'types/fastify'

import { CoreRouter } from 'src/core/router'
import { Route } from 'src/Route'

/**
 * @class clear-router Fastify Router
 * @description Laravel-style routing system for Fastify using shared clear-router core
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export class Router extends CoreRouter {
    protected static routerStateNamespace = 'clear-router:fastify'

    private static ensureRequestBodyAccessor (req: any): void {
        if (typeof req.getBody !== 'function') {
            req.getBody = () => req.body ?? {}
        }
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
    ): void {
        super.add(methods, path, handler, middlewares)
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
    static allRoutes (type?: 'method' | 'path'):
        Array<Route<HttpContext, Middleware, Handler>> |
        Record<string, Route<HttpContext, Middleware, Handler>> |
        Record<string, Array<Route<HttpContext, Middleware, Handler>>> {
        return super.allRoutes(type as any) as any
    }

    /**
     * Apply the defined routes to a Fastify application instance
     * 
     * @param app  - The Fastify application instance
     * @returns    The Fastify application instance with the applied routes
     */
    static apply (app: FastifyApp): FastifyApp {
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

                app.route({
                    method: method.toUpperCase() as any,
                    url: route.path,
                    preHandler: route.middlewares as any,
                    handler: async (req, reply) => {
                        Router.ensureRequestBodyAccessor(req)
                        const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)
                        if (method === 'post' && override && override !== 'post') {
                            return reply.code(404).send()
                        }

                        const ctx: HttpContext = {
                            req: req as HttpContext['req'],
                            reply,
                        }

                        const inst = instance ?? route
                        Router.bindRequestToInstance(ctx, inst, route, {
                            body: ctx.req.getBody(),
                            query: (ctx.req.query as Record<string, any>) ?? {},
                            params: (ctx.req.params as Record<string, any>) ?? {},
                        })

                        const result = handlerFunction(ctx, inst.clearRequest)

                        return await Promise.resolve(result)
                    },
                })

                if (['put', 'patch', 'delete'].includes(method)) {
                    app.route({
                        method: 'POST',
                        url: route.path,
                        preHandler: route.middlewares as any,
                        handler: async (req, reply) => {
                            Router.ensureRequestBodyAccessor(req)
                            const override = Router.resolveMethodOverride(req.method, req.headers as Record<string, any>, req.body)
                            if (override !== method) {
                                return reply.code(404).send()
                            }

                            const ctx: HttpContext = {
                                req: req as HttpContext['req'],
                                reply,
                            }

                            const inst = instance ?? route
                            Router.bindRequestToInstance(ctx, inst, route, {
                                body: ctx.req.getBody(),
                                query: (ctx.req.query as Record<string, any>) ?? {},
                                params: (ctx.req.params as Record<string, any>) ?? {},
                            })

                            const result = handlerFunction(ctx, inst.clearRequest)

                            return await Promise.resolve(result)
                        },
                    })
                }
            }
        }

        return app
    }
}

export default Router
