import { ApiResourceMiddleware, ControllerAction, HttpMethod, RouterConfig } from 'types/basic'

import { AsyncLocalStorage } from 'node:async_hooks'
import { Controller } from 'src/Controller'
import { Request as CoreRequest } from './Request'
import { Response as CoreResponse } from './Response'
import { Route } from 'src/Route'
import { Container, getBindingMetadataFromTargets, getDesignParamTypes, getStandardMetadata } from './bindings'

/**
 * @class clear-router CoreRouter
 * @description Core routing logic for clear-router, shared between all supported adapters (Express.js, H3, etc.)
 * @author 3m1n3nc3
 * @repository https://github.com/toneflix/clear-router
 */
export abstract class CoreRouter {
    protected static routerStateNamespace = 'clear-router:core'

    private static readonly stateStoreKey = Symbol.for('clear-router:router-state')
    private static readonly stateBoundKey = Symbol.for('clear-router:router-state-bound')
    private static readonly defaultConfigKey = Symbol.for('clear-router:default-config')

    protected static createBaseConfig (): RouterConfig {
        return {
            methodOverride: {
                enabled: true,
                bodyKeys: ['_method'],
                headerKeys: ['x-http-method'],
            },
            container: {
                enabled: false,
                autoDiscover: false,
            },
        }
    }

    protected static mergeConfig (target: RouterConfig, source?: RouterConfig): RouterConfig {
        if (!source) return target

        if (source.methodOverride) {
            target.methodOverride = {
                ...(target.methodOverride || {}),
                ...source.methodOverride,
            }
        }

        if (source.container) {
            target.container = {
                ...(target.container || {}),
                ...source.container,
            }
        }

        return target
    }

    protected static getDefaultConfig (): RouterConfig {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.defaultConfigKey]) {
            g[this.defaultConfigKey] = this.createBaseConfig()
        }

        return {
            methodOverride: { ...g[this.defaultConfigKey].methodOverride },
            container: { ...g[this.defaultConfigKey].container },
        }
    }

    protected static resolveStateNamespace (this: any): string {
        return String(this.routerStateNamespace || this.name || 'clear-router:core')
    }

    protected static getStateStore (): Record<string, any> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.stateStoreKey]) {
            g[this.stateStoreKey] = Object.create(null)
        }

        return g[this.stateStoreKey] as Record<string, any>
    }

    protected static createDefaultState () {
        return {
            config: this.getDefaultConfig(),
            groupContext: new AsyncLocalStorage<{
                prefix: string
                groupMiddlewares: any[]
            }>(),
            routes: [] as Array<Route<any, any, any>>,
            routesByPathMethod: {} as Record<string, Route<any, any, any>>,
            routesByMethod: {} as { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> },
            prefix: '',
            groupMiddlewares: [] as any[],
            globalMiddlewares: [] as any[],
        }
    }

    protected static bindStateAccessors (this: any): void {
        if (Object.prototype.hasOwnProperty.call(this, this.stateBoundKey)) {
            return
        }

        const namespace = this.resolveStateNamespace()
        const store = this.getStateStore()

        if (!store[namespace]) {
            store[namespace] = this.createDefaultState()
        }

        for (const key of [
            'config',
            'groupContext',
            'routes',
            'routesByPathMethod',
            'routesByMethod',
            'prefix',
            'groupMiddlewares',
            'globalMiddlewares',
        ]) {
            Object.defineProperty(this, key, {
                get () {
                    const ns = this.resolveStateNamespace()
                    const registry = this.getStateStore()

                    if (!registry[ns]) {
                        registry[ns] = this.createDefaultState()
                    }

                    return registry[ns][key]
                },
                set (value) {
                    const ns = this.resolveStateNamespace()
                    const registry = this.getStateStore()

                    if (!registry[ns]) {
                        registry[ns] = this.createDefaultState()
                    }

                    registry[ns][key] = value
                },
                configurable: true,
                enumerable: true,
            })
        }

        Object.defineProperty(this, this.stateBoundKey, {
            value: true,
            configurable: false,
            enumerable: false,
            writable: false,
        })
    }

    protected static createDefaultOptionsHandler (): any {
        return (ctx: any) => {
            const allow = 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD'

            if (ctx?.header && ctx?.status && ctx?.body) {
                ctx.header('Allow', allow)
                ctx.status(204)

                return ctx.body(null)
            }

            if (ctx?.res?.headers?.set) {
                ctx.res.headers.set('Allow', allow)
                ctx.res.status = 204

                return
            }

            if (ctx?.res?.set) {
                ctx.res.set('Allow', allow)
                ctx.res.sendStatus(204)

                return
            }

            if (ctx?.reply?.header) {
                ctx.reply.header('Allow', allow)
                ctx.reply.code(204).send()

                return
            }

            if (ctx?.set && 'status' in ctx) {
                ctx.set('Allow', allow)
                ctx.status = 204
                ctx.body = null
            }
        }
    }

    static config: RouterConfig = {
        methodOverride: {
            enabled: true,
            bodyKeys: ['_method'],
            headerKeys: ['x-http-method'],
        },
        container: {
            enabled: false,
            autoDiscover: false,
        },
    }

    static configureDefaults (this: any, options?: RouterConfig): void {
        const g = globalThis as Record<PropertyKey, any>
        const defaults = this.mergeConfig(g[this.defaultConfigKey] || this.createBaseConfig(), options)
        g[this.defaultConfigKey] = defaults

        const store = this.getStateStore()
        for (const state of Object.values(store) as Array<{ config?: RouterConfig }>) {
            state.config = this.mergeConfig(state.config || this.createBaseConfig(), options)
        }
    }

    protected static groupContext = new AsyncLocalStorage<{
        prefix: string
        groupMiddlewares: any[]
    }>()

    static routes: Array<Route<any, any, any>> = []
    static routesByPathMethod: Record<string, Route<any, any, any>> = {}
    static routesByMethod: { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> } = {}

    static prefix = ''
    static groupMiddlewares: any[] = []
    static globalMiddlewares: any[] = []

    protected static ensureState (this: any): void {
        this.bindStateAccessors()

        if (!this.config) {
            this.config = {
                methodOverride: {
                    enabled: true,
                    bodyKeys: ['_method'],
                    headerKeys: ['x-http-method'],
                },
            }
        }

        if (!this.groupContext) {
            this.groupContext = new AsyncLocalStorage<{
                prefix: string
                groupMiddlewares: any[]
            }>()
        }

        if (!Array.isArray(this.routes)) {
            this.routes = []
        }

        if (!this.routesByPathMethod || typeof this.routesByPathMethod !== 'object') {
            this.routesByPathMethod = {}
        }

        if (!this.routesByMethod || typeof this.routesByMethod !== 'object') {
            this.routesByMethod = {}
        }

        if (typeof this.prefix !== 'string') {
            this.prefix = ''
        }

        if (!Array.isArray(this.groupMiddlewares)) {
            this.groupMiddlewares = []
        }

        if (!Array.isArray(this.globalMiddlewares)) {
            this.globalMiddlewares = []
        }
    }

    /**
     * Normalizes a path by ensuring it starts with a single slash and does not have trailing 
     * slashes, while preserving dynamic segments and parameters.
     * 
     * @param path  The path to normalize.
     * @returns     The normalized path.
     */
    static normalizePath (path: string): string {
        return '/' + path
            .split('/')
            .filter(Boolean)
            .join('/')
    }

    /**
     * Configures the router with the given options, such as method override settings.
     * 
     * @param this 
     * @param options 
     * @returns 
     */
    static configure (this: any, options?: RouterConfig): void {
        this.ensureState()

        this.config = this.mergeConfig(this.getDefaultConfig(), this.config)

        const container = options?.container
        if (container) {
            if (typeof container.enabled === 'boolean') {
                this.config.container.enabled = container.enabled
            }

            if (typeof container.autoDiscover === 'boolean') {
                this.config.container.autoDiscover = container.autoDiscover
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

    protected static resolveMethodOverride (
        this: any,
        method: string,
        headers: Headers | Record<string, any>,
        body: unknown
    ): HttpMethod | null {
        this.ensureState()

        if (!this.config.methodOverride?.enabled || method.toLowerCase() !== 'post') {
            return null
        }

        let override: unknown

        const headerValueFor = (key: string): unknown => {
            if (typeof (headers as Headers).get === 'function') {
                return (headers as Headers).get(key)
            }

            const value = (headers as Record<string, any>)?.[key]

            return Array.isArray(value) ? value[0] : value
        }

        for (const key of this.config.methodOverride?.headerKeys || []) {
            const value = headerValueFor(key)
            if (value) {
                override = value
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
     * Adds a new route to the router.
     * 
     * @param this 
     * @param methods 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static add (
        this: any,
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: any,
        middlewares?: any[] | any
    ): void {
        this.ensureState()

        const context = this.groupContext.getStore()
        const activePrefix = context?.prefix ?? this.prefix
        const activeGroupMiddlewares = context?.groupMiddlewares ?? this.groupMiddlewares

        methods = Array.isArray(methods) ? methods : [methods]
        middlewares = middlewares
            ? (Array.isArray(middlewares) ? middlewares : [middlewares])
            : undefined

        const fullPath = this.normalizePath(`${activePrefix}/${path}`)

        const route = new Route(
            methods.includes('options') ? methods : methods.concat('options'),
            fullPath,
            handler,
            [...this.globalMiddlewares, ...activeGroupMiddlewares, ...(middlewares || [])]
        )

        if (
            !methods.includes('options') &&
            !this.routesByPathMethod[`OPTIONS ${fullPath}`]
        ) {
            this.options(path, this.createDefaultOptionsHandler())
        }

        this.routes.push(route)

        for (const method of methods.map(m => m.toUpperCase() as Uppercase<HttpMethod>)) {
            this.routesByPathMethod[`${method} ${fullPath}`] = route
            if (!this.routesByMethod[method]) {
                this.routesByMethod[method] = []
            }
            this.routesByMethod[method].push(route)
        }
    }

    /**
     * Define a resourceful API controller with standard CRUD routes.
     * 
     * @param this 
     * @param basePath 
     * @param controller 
     * @param options 
     */
    static apiResource (
        this: any,
        basePath: string,
        controller: any,
        options?: {
            only?: ControllerAction[]
            except?: ControllerAction[]
            middlewares?: ApiResourceMiddleware<any>
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
                const actionMiddlewares = typeof options?.middlewares === 'object' && !Array.isArray(options.middlewares)
                    ? options.middlewares[action]
                    : options?.middlewares

                this.add(
                    method,
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
     * Adds a new GET route to the router.
     * 
     * @param this          The router instance.
     * @param path          The path for the GET route.
     * @param handler       The handler function for the GET route.
     * @param middlewares   Optional middlewares to apply to the GET route.
     */
    static get (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('get', path, handler, middlewares)
    }

    /**
     * Adds a new POST route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('post', path, handler, middlewares)
    }

    /**
     * Adds a new PUT route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('put', path, handler, middlewares)
    }

    /**
     * Adds a new DELETE route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('delete', path, handler, middlewares)
    }

    /**
     * Adds a new PATCH route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('patch', path, handler, middlewares)
    }

    /**
     * Adds a new OPTIONS route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('options', path, handler, middlewares)
    }

    /**
     * Adds a new HEAD route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head (this: any, path: string, handler: any, middlewares?: any[] | any): void {
        this.add('head', path, handler, middlewares)
    }

    /**
     * Defines a group of routes with a common prefix.
     * 
     * @param this 
     * @param prefix 
     * @param callback 
     * @param middlewares 
     */
    static async group (
        this: any,
        prefix: string,
        callback: () => void | Promise<void>,
        middlewares?: any[]
    ): Promise<void> {
        this.ensureState()

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
     * Adds global middlewares to the router, which will be applied to all routes.
     * 
     * @param this 
     * @param middlewares 
     * @param callback 
     */
    static middleware (this: any, middlewares: any[], callback: () => void): void {
        this.ensureState()

        const prevMiddlewares = this.globalMiddlewares
        this.globalMiddlewares = [...prevMiddlewares, ...(middlewares || [])]

        callback()

        this.globalMiddlewares = prevMiddlewares
    }

    /**
     * Retrieves all registered routes in the router, optionally organized by path or method 
     * for easier access and management.
     * 
     * @param this 
     */
    static allRoutes (this: any): Array<Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'path' to get routes organized by path
     */
    static allRoutes (this: any, type: 'path'): Record<string, Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'method' to get routes organized by method
     */
    static allRoutes (this: any, type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> }
    static allRoutes (this: any, type?: 'method' | 'path'):
        Array<Route<any, any, any>> |
        Record<string, Route<any, any, any>> |
        Record<string, Array<Route<any, any, any>>> {
        this.ensureState()

        if (type === 'method') {
            return this.routesByMethod
        }

        if (type === 'path') {
            return this.routesByPathMethod
        }

        return this.routes.filter((e: Route<any, any, any>) => e.methods.length > 1 || e.methods[0] !== 'options')
    }

    protected static resolveHandler (route: Route<any, any, any>): {
        handlerFunction: ((ctx: any, req: CoreRequest) => any | Promise<any>) | null
        instance: Controller<any> | null
        bindingTarget?: object
        bindingMethod?: PropertyKey
        bindingHandler?: object
        bindingMetadata?: object
    } {
        let handlerFunction: ((ctx: any, req: CoreRequest) => any | Promise<any>) | null
        let instance: Controller<any> | null = null
        let bindingTarget: object | undefined
        let bindingMethod: PropertyKey | undefined
        let bindingHandler: object | undefined
        let bindingMetadata: object | undefined

        if (typeof route.handler === 'function') {
            handlerFunction = route.handler.bind(route)
            bindingTarget = route.handler
            bindingHandler = route.handler
        } else if (
            Array.isArray(route.handler) &&
            route.handler.length === 2
        ) {
            const [ControllerType, method] = route.handler

            if (
                ['function', 'object'].includes(typeof ControllerType) &&
                typeof ControllerType[method] === 'function'
            ) {
                instance = ControllerType
                handlerFunction = ControllerType[method].bind(ControllerType)
                bindingTarget = ControllerType
                bindingMethod = method
                bindingHandler = ControllerType[method]
                bindingMetadata = ControllerType[(Symbol as any).metadata]
            } else if (typeof ControllerType === 'function') {
                instance = new ControllerType()
                if (typeof instance![method] === 'function') {
                    handlerFunction = instance![method].bind(instance)
                    bindingTarget = ControllerType.prototype
                    bindingMethod = method
                    bindingHandler = instance![method]
                    bindingMetadata = ControllerType[(Symbol as any).metadata]
                } else {
                    throw new Error(
                        `Method "${method}" not found in controller instance "${ControllerType.name}"`
                    )
                }
            } else {
                throw new Error(`Invalid controller type for route: ${route.path}`)
            }
        } else {
            throw new Error(`Invalid handler format for route: ${route.path}`)
        }

        return { handlerFunction, instance, bindingTarget, bindingMethod, bindingHandler, bindingMetadata }
    }

    protected static async callHandler (
        this: any,
        handlerFunction: (ctx: any, req: CoreRequest) => any | Promise<any>,
        ctx: any,
        bindingTarget?: object,
        bindingMethod?: PropertyKey,
        bindingHandler?: object,
        bindingMetadata?: object
    ): Promise<any> {
        if (!this.config.container?.enabled) {
            return handlerFunction(ctx, ctx.clearRequest)
        }

        const metadata = getBindingMetadataFromTargets([
            { target: bindingTarget, propertyKey: bindingMethod },
            { target: bindingHandler },
            { target: bindingTarget, propertyKey: '__class__' },
        ]) ?? getStandardMetadata(bindingMetadata, bindingMethod)
            ?? getStandardMetadata(bindingMetadata, '__class__')
        if (!metadata) {
            return handlerFunction(ctx, ctx.clearRequest)
        }

        const designTokens = [
            ...(bindingTarget ? getDesignParamTypes(bindingTarget, bindingMethod) : []),
            ...(bindingHandler ? getDesignParamTypes(bindingHandler) : []),
        ]
        const tokens = metadata.tokens?.length ? metadata.tokens : designTokens
        if (!tokens.length) {
            return handlerFunction(ctx, ctx.clearRequest)
        }

        const args = []
        for (const token of tokens) {
            const resolved = await Container.resolve(token, ctx, Boolean(this.config.container?.autoDiscover))
            if (typeof resolved === 'undefined') {
                return handlerFunction(ctx, ctx.clearRequest)
            }

            args.push(resolved)
        }

        return (handlerFunction as any)(...args)
    }

    protected static bindRequestToInstance (
        ctx: any,
        instance: Controller<any> | Route<any, any, any> | null,
        route: Route<any, any, any>,
        payload: {
            body: Record<string, any>
            query: Record<string, any>
            params: Record<string, any>
            method?: HttpMethod | string
        }
    ): void {
        const clearRequest = ctx.clearRequest instanceof CoreRequest
            ? ctx.clearRequest
            : new CoreRequest({
                ctx,
                route,
                body: payload.body,
                query: payload.query,
                params: payload.params,
                method: String(payload.method || ctx.req?.method || ctx.method || 'GET').toUpperCase(),
                path: String(ctx.path || ctx.req?.path || ctx.req?.url || route.path),
                url: String(ctx.url || ctx.req?.url || ctx.req?.originalUrl || route.path),
                headers: ctx.req?.headers || ctx.headers || {},
                original: ctx.req || ctx.request || ctx,
            })

        clearRequest.ctx = ctx
        clearRequest.route = route
        clearRequest.body = payload.body
        clearRequest.query = payload.query
        clearRequest.params = payload.params

        ctx.clearRequest = clearRequest

        if (!(ctx.clearResponse instanceof CoreResponse)) {
            ctx.clearResponse = new CoreResponse()
        }

        if (!instance) return

        instance.ctx = ctx
        instance.body = payload.body
        instance.query = payload.query
        instance.params = payload.params
        instance.clearRequest = clearRequest
    }
}
