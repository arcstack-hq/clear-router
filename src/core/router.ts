import { ApiResourceMiddleware, ControllerAction, HttpMethod, RouterConfig } from 'types/basic'
import type {
    ClearRouterPluginArgumentsContext,
    ClearRouterPluginContext,
    ClearRouterPluginInput,
    ClearRouterPluginRequestContext,
    PluginArgumentsResolver,
    PluginBind,
} from './plugins'
import { Container, getBindingMetadataFromTargets, getDesignParamTypes, getStandardMetadata, isClass } from './bindings'

import { AsyncLocalStorage } from 'node:async_hooks'
import { Controller } from 'src/Controller'
import { Request as CoreRequest } from './Request'
import { Response as CoreResponse } from './Response'
import { Route } from 'src/Route'

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
    private static readonly pluginStoreKey = Symbol.for('clear-router:plugins')
    private static readonly pluginPendingKey = Symbol.for('clear-router:plugin-promises')
    private static readonly pluginArgumentResolversKey = Symbol.for('clear-router:plugin-argument-resolvers')
    private static requestProvider?: typeof CoreRequest
    private static responseProvider?: typeof CoreResponse

    /**
     * Resets the router to it's default state
     */
    static reset () {
        this.routes = []
        this.prefix = ''
        this.groupMiddlewares = []
        this.globalMiddlewares = []
        this.routesByPathMethod = {}
        this.routesByMethod = {}
        this.routesByName = {}

        return this
    }

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

    protected static resolveStateNamespace (): string {
        return String(this.routerStateNamespace || this.name || 'clear-router:core')
    }

    protected static getStateStore (): Record<string, any> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.stateStoreKey]) {
            g[this.stateStoreKey] = Object.create(null)
        }

        return g[this.stateStoreKey] as Record<string, any>
    }

    protected static getPluginStore (): Set<string> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.pluginStoreKey]) {
            g[this.pluginStoreKey] = new Set<string>()
        }

        return g[this.pluginStoreKey] as Set<string>
    }

    protected static getPluginPendingStore (): Set<Promise<void>> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.pluginPendingKey]) {
            g[this.pluginPendingKey] = new Set<Promise<void>>()
        }

        return g[this.pluginPendingKey] as Set<Promise<void>>
    }

    protected static getPluginArgumentResolvers (): Set<PluginArgumentsResolver> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.pluginArgumentResolversKey]) {
            g[this.pluginArgumentResolversKey] = new Set<PluginArgumentsResolver>()
        }

        return g[this.pluginArgumentResolversKey]
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
            routesByName: {} as Record<string, Route<any, any, any>>,
            prefix: '',
            groupMiddlewares: [] as any[],
            globalMiddlewares: [] as any[],
        }
    }

    protected static bindStateAccessors (): void {
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
            'routesByName',
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

    static configureDefaults (options?: RouterConfig): void {
        const g = globalThis as Record<PropertyKey, any>
        const defaults = this.mergeConfig(g[this.defaultConfigKey] || this.createBaseConfig(), options)
        g[this.defaultConfigKey] = defaults

        const store = this.getStateStore()
        for (const state of Object.values(store) as Array<{ config?: RouterConfig }>) {
            state.config = this.mergeConfig(state.config || this.createBaseConfig(), options)
        }
    }

    /**
     * Use a registered plugin
     * 
     * @param this 
     * @param plugin 
     * @param options 
     * @returns 
     */
    static async use<Options = any> (
        plugin: ClearRouterPluginInput<Options>,
        options?: Options
    ): Promise<void> {
        const name = typeof plugin === 'function'
            ? plugin.name
            : plugin.name
        const store = this.getPluginStore()

        if (name && store.has(name)) return

        if (name) {
            store.add(name)
        }

        const setup = async (): Promise<void> => {
            const ctx: ClearRouterPluginContext<Options> = {
                container: Container,
                bind: this.createPluginBind(),
                resolveArguments: (resolver) => {
                    this.getPluginArgumentResolvers().add(resolver)
                },
                bindings: Container.bindings(),
                configure: this.configure.bind(this),
                configureDefaults: this.configureDefaults.bind(this),
                get request () {
                    return this.getRequest()
                },
                get response () {
                    return this.getResponse()
                },
                getRequest: () => this.getCurrentPluginRequestContext()?.request,
                getResponse: () => this.getCurrentPluginRequestContext()?.response,
                options: options as Options,
            }

            if (typeof plugin === 'function') {
                await plugin(ctx)
            } else {
                await plugin.setup(ctx)
            }
        }

        const pending = this.getPluginPendingStore()
        const promise = setup()
        pending.add(promise)

        try {
            await promise
        } catch (error) {
            if (name) {
                store.delete(name)
            }

            throw error
        } finally {
            pending.delete(promise)
        }
    }

    protected static async pluginsReady (): Promise<void> {
        const pending = Array.from(this.getPluginPendingStore())
        if (!pending.length) return

        await Promise.all(pending)
    }

    protected static groupContext = new AsyncLocalStorage<{
        prefix: string
        groupMiddlewares: any[]
    }>()
    protected static pluginRequestContext = new AsyncLocalStorage<ClearRouterPluginRequestContext>()

    static routes: Array<Route<any, any, any>> = []
    static routesByPathMethod: Record<string, Route<any, any, any>> = {}
    static routesByMethod: { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> } = {}
    static routesByName: Record<string, Route<any, any, any>> = {}

    static prefix = ''
    static groupMiddlewares: any[] = []
    static globalMiddlewares: any[] = []

    protected static getCurrentPluginRequestContext (): ClearRouterPluginRequestContext | undefined {
        return this.pluginRequestContext.getStore()
    }

    protected static createPluginRequestContext (ctx: any): ClearRouterPluginRequestContext {
        const request: CoreRequest = ctx.clearRequest
        const response: CoreResponse = ctx.clearResponse

        return {
            ...ctx,
            ctx,
            request,
            response,
            getBindings: () => Container.bindings(),
        }
    }

    protected static createPluginBind (): PluginBind {
        const bind: PluginBind = (token, value): void => {
            if (typeof value === 'function' && !isClass(value)) {
                const factory = value as (ctx: ClearRouterPluginRequestContext) => any
                Container.bind(token, (ctx: any) => factory(this.createPluginRequestContext(ctx)))

                return
            }

            Container.bind(token, value)
        }

        return bind
    }

    protected static async resolvePluginArguments (
        this: any,
        ctx: any,
        routeContext: Omit<ClearRouterPluginArgumentsContext, keyof ClearRouterPluginRequestContext>
    ): Promise<any[] | undefined> {
        const resolvers = Array.from(this.getPluginArgumentResolvers()) as PluginArgumentsResolver[]
        if (!resolvers.length) return undefined

        const requestContext = this.createPluginRequestContext(ctx)
        const pluginContext: ClearRouterPluginArgumentsContext = {
            ...requestContext,
            ...routeContext,
        }

        for (const resolver of resolvers) {
            const args = await resolver(pluginContext)
            if (Array.isArray(args)) {
                return args
            }
        }
    }

    protected static ensureState (): void {
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

        if (!this.routesByName || typeof this.routesByName !== 'object') {
            this.routesByName = {}
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

    protected static parseRouteParameters (path: string): Array<{
        name: string
        field?: string
        optional: boolean
    }> {
        const parameters: Array<{ name: string; field?: string; optional: boolean }> = []
        const seen = new Set<string>()
        const pattern = /\{([^{}]+)\}/g
        let match: RegExpExecArray | null

        while ((match = pattern.exec(path)) !== null) {
            const raw = match[1].trim()
            const optional = raw.endsWith('?')
            const withoutOptional = optional ? raw.slice(0, -1) : raw
            const [name, field] = withoutOptional.split(':', 2).map(part => part.trim())

            if (!name || seen.has(name)) continue

            seen.add(name)
            parameters.push({
                name,
                field: field || undefined,
                optional,
            })
        }

        return parameters
    }

    protected static expandRoutePath (path: string): string[] {
        let paths = ['']
        const segments = this.normalizePath(path).split('/').filter(Boolean)

        for (const segment of segments) {
            const match = segment.match(/^\{([^{}]+)\}$/)

            if (!match) {
                paths = paths.map(current => `${current}/${segment}`)
                continue
            }

            const raw = match[1].trim()
            const optional = raw.endsWith('?')
            const withoutOptional = optional ? raw.slice(0, -1) : raw
            const [rawName] = withoutOptional.split(':', 2)
            const name = rawName.trim()

            if (!name) continue

            const parameterSegment = `/:${name}`
            paths = optional
                ? paths.flatMap(current => [current, `${current}${parameterSegment}`])
                : paths.map(current => `${current}${parameterSegment}`)
        }

        return paths.map(path => path || '/')
    }

    protected static routeRegistrationPaths (path: string): string[] {
        return this.expandRoutePath(path)
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
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: any,
        middlewares?: any[] | any
    ): Route<any, any, any> {
        this.ensureState()

        const context = this.groupContext.getStore()
        const activePrefix = context?.prefix ?? this.prefix
        const activeGroupMiddlewares = context?.groupMiddlewares ?? this.groupMiddlewares

        methods = Array.isArray(methods) ? methods : [methods]
        middlewares = middlewares
            ? (Array.isArray(middlewares) ? middlewares : [middlewares])
            : undefined

        const fullPath = this.normalizePath(`${activePrefix}/${path}`)
        const registrationPaths = this.routeRegistrationPaths(fullPath)
        const parameters = this.parseRouteParameters(fullPath)

        const route = new Route(
            methods.includes('options') ? methods : methods.concat('options'),
            fullPath,
            handler,
            [...this.globalMiddlewares, ...activeGroupMiddlewares, ...(middlewares || [])],
            {
                registrationPaths,
                parameters,
                onName: (name, route, previousName) => {
                    if (previousName && this.routesByName[previousName] === route) {
                        delete this.routesByName[previousName]
                    }

                    this.routesByName[name] = route
                },
            }
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

        return route
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
    static get (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('get', path, handler, middlewares)
    }

    /**
     * Adds a new POST route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static post (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('post', path, handler, middlewares)
    }

    /**
     * Adds a new PUT route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static put (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('put', path, handler, middlewares)
    }

    /**
     * Adds a new DELETE route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static delete (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('delete', path, handler, middlewares)
    }

    /**
     * Adds a new PATCH route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static patch (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('patch', path, handler, middlewares)
    }

    /**
     * Adds a new OPTIONS route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static options (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('options', path, handler, middlewares)
    }

    /**
     * Adds a new HEAD route to the router.
     * 
     * @param this 
     * @param path 
     * @param handler 
     * @param middlewares 
     */
    static head (path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
        return this.add('head', path, handler, middlewares)
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
    static middleware (middlewares: any[], callback: () => void): void {
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
    static allRoutes (): Array<Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'path' to get routes organized by path
     */
    static allRoutes (type: 'path'): Record<string, Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'method' to get routes organized by method
     */
    static allRoutes (type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> }
    static allRoutes (type: 'name'): Record<string, Route<any, any, any>>
    static allRoutes (type?: 'method' | 'path' | 'name'):
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

        if (type === 'name') {
            return this.routesByName
        }

        return this.routes.filter((e: Route<any, any, any>) => e.methods.length > 1 || e.methods[0] !== 'options')
    }

    static route (name: string): Route<any, any, any> | undefined {
        this.ensureState()

        return this.routesByName[name]
    }

    static url (name: string, params?: Record<string, any>): string | undefined {
        return this.route(name)?.toPath(params)
    }

    /**
     * Provide a class that will overide the base Request instance
     * 
     * @param provider 
     */
    static setRequestProvider (provider: typeof CoreRequest) {
        this.requestProvider = provider
    }

    /**
     * Provide a class that will overide the base Response instance
     * 
     * @param provider 
     */
    static setResponseProvider (provider: typeof CoreResponse) {
        this.responseProvider = provider
    }

    /**
     * Provide a class that will overide the base Response instance
     * 
     * @param provider 
     */
    private static initializeInstance<
        Prov extends typeof CoreResponse,
        Args extends ConstructorParameters<Prov>[0]
    > (provider: Prov, args: Args): CoreResponse
    private static initializeInstance<
        Prov extends typeof CoreRequest,
        Args extends ConstructorParameters<Prov>[0]
    > (provider: Prov, args: Args): CoreRequest
    private static initializeInstance (provider: any, args: any) {

        const isRequest = ['CoreRequest', 'Request', 'ClearRequest'].includes(provider.name)
        const isResponse = ['CoreResponse', 'Response', 'ClearResponse'].includes(provider.name)

        if (isRequest && this.requestProvider) {
            return new this.requestProvider(args as never)
        } else if (isResponse && this.responseProvider) {
            return new this.responseProvider(args as never)
        }

        return new provider(args as never)
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
        handlerFunction: (ctx: any, req: CoreRequest) => any | Promise<any>,
        ctx: any,
        bindingTarget?: object,
        bindingMethod?: PropertyKey,
        bindingHandler?: object,
        bindingMetadata?: object
    ): Promise<any> {
        return this.pluginRequestContext.run(this.createPluginRequestContext(ctx), async () => {
            await this.pluginsReady()

            if (!this.config.container?.enabled) {
                return handlerFunction(ctx, ctx.clearRequest)
            }

            const designTokens = [
                ...(bindingTarget ? getDesignParamTypes(bindingTarget, bindingMethod) : []),
                ...(bindingHandler ? getDesignParamTypes(bindingHandler) : []),
            ]
            const metadata = getBindingMetadataFromTargets([
                { target: bindingTarget, propertyKey: bindingMethod },
                { target: bindingHandler },
                { target: bindingTarget, propertyKey: '__class__' },
            ]) ?? getStandardMetadata(bindingMetadata, bindingMethod)
                ?? getStandardMetadata(bindingMetadata, '__class__')
            const tokens = metadata?.tokens?.length ? metadata.tokens : designTokens
            const pluginArgs = await this.resolvePluginArguments(ctx, {
                target: bindingTarget,
                method: bindingMethod,
                handler: bindingHandler,
                metadata: bindingMetadata,
                tokens,
                designTokens,
            })
            if (pluginArgs) {
                return (handlerFunction as any)(...pluginArgs)
            }

            if (!metadata || !tokens.length) {
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
        })
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
            : this.initializeInstance(CoreRequest, {
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
        Container.bind(CoreRequest, ctx.clearRequest)

        if (!(ctx.clearResponse instanceof CoreResponse)) {
            ctx.clearResponse = this.initializeInstance(
                CoreResponse,
                ctx.response ?? ctx.reply ?? ctx.res
            )
            Container.bind(CoreResponse, ctx.clearResponse)
        }

        if (!instance) return

        instance.ctx = ctx
        instance.body = payload.body
        instance.query = payload.query
        instance.params = payload.params
        instance.clearRequest = clearRequest
    }
}
