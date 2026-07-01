import type { ApiResourceMiddleware, HttpMethod, ResourceAction, RouteGroupContext, RouteGroupSource, RouterConfig } from '../types/basic'
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
import { Controller } from '../Controller'
import { Request as CoreRequest } from './Request'
import { Response as CoreResponse } from './Response'
import { ResourceRoutes } from '../ResourceRoutes'
import { Route } from '../Route'
import { RouteGroup } from '../RouteGroup'
import { RouteRegistrar } from '../RouteRegistrar'
import { createRequire } from 'node:module'
import { getControllerMiddlewares } from '../decorators/middleware'

/**
 * @class clear-router CoreRouter
 * @description Core routing logic for clear-router, shared between all supported adapters (Express.js, H3, etc.)
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-hq/clear-router
 */
export abstract class CoreRouter {
    protected static routerStateNamespace = 'clear-router:core'

    private static readonly stateStoreKey = Symbol.for('clear-router:router-state')
    private static readonly stateBoundKey = Symbol.for('clear-router:router-state-bound')
    private static readonly defaultConfigKey = Symbol.for('clear-router:default-config')
    private static readonly pluginStoreKey = Symbol.for('clear-router:plugins')
    private static readonly pluginPendingKey = Symbol.for('clear-router:plugin-promises')
    private static readonly pluginHttpCtxResolversKey = Symbol.for('clear-router:plugin-http-ctx')
    private static readonly pluginArgumentResolversKey = Symbol.for('clear-router:plugin-argument-resolvers')
    private static requestProvider?: typeof CoreRequest
    private static responseProvider?: typeof CoreResponse
    private static readonly domainMatcherCache = new Map<string, { regex: RegExp; params: string[] }>()
    private static readonly constraintRegexCache = new Map<string, RegExp>()
    static routePatterns = new Map<string, string | RegExp>()

    static config: RouterConfig = {
        inferParamName: false,
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

    protected static groupContext = new AsyncLocalStorage<RouteGroupContext>()
    protected static pluginRequestContext = new AsyncLocalStorage<ClearRouterPluginRequestContext>()

    static routes = new Set<Route<any, any, any>>([])
    static routesByPathMethod = new Map<string, Route<any, any, any>>()
    static routesByMethod = new Map<Uppercase<HttpMethod>, Array<Route<any, any, any>>>()
    static routesByName = new Map<string, Route<any, any, any>>()

    static prefix = ''
    static groupMiddlewares: any[] = []
    static globalMiddlewares: any[] = []

    /**
     * Resolve middlewares before assigning to adapter
     * 
     * @param middleware 
     * @returns 
     */
    protected static resolveMiddleware(middleware: any): any {
        if (!middleware || typeof middleware === 'function' && !isClass(middleware)) {
            return middleware
        }

        const instance = isClass(middleware) ? new middleware() : middleware

        if (instance && typeof instance.handle === 'function') {
            return instance.handle.bind(instance)
        }

        return middleware
    }

    protected static resolveMiddlewares(middlewares: any[] = []): any[] {
        return middlewares.map(middleware => this.resolveMiddleware(middleware))
    }

    protected static routeSpecificity(route: Route<any, any, any>): [number, number, number] {
        const path = route.registrationPaths
            .slice()
            .sort((left, right) => right.length - left.length)[0] ?? route.path
        const segments = this.normalizePath(path).split('/').filter(Boolean)
        const staticSegments = segments.filter(segment => !segment.startsWith(':')).length

        return [staticSegments, segments.length, path.length]
    }

    protected static orderedRoutes(): Array<Route<any, any, any>> {
        return Array.from(this.routes).sort((left, right) => {
            const leftScore = this.routeSpecificity(left)
            const rightScore = this.routeSpecificity(right)

            for (let index = 0; index < leftScore.length; index++) {
                const difference = rightScore[index] - leftScore[index]
                if (difference !== 0) return difference
            }

            return 0
        })
    }

    protected static removeRouteMethod(route: Route<any, any, any>, method: HttpMethod, path: string): void {
        route.methods = route.methods.filter(existingMethod => existingMethod !== method)
        this.routesByPathMethod.delete(`${method.toUpperCase()} ${path}`)

        const methodKey = method.toUpperCase() as Uppercase<HttpMethod>
        this.routesByMethod.set(
            methodKey,
            (this.routesByMethod.get(methodKey) ?? []).filter(existingRoute => existingRoute !== route)
        )

        if (!route.methods.some(existingMethod => existingMethod !== 'options')) {
            this.routes.delete(route)

            if (route.routeName && this.routesByName.get(route.routeName) === route) {
                this.routesByName.delete(route.routeName)
            }
        }
    }

    protected static removeRoute(route: Route<any, any, any>): void {
        this.routes.delete(route)

        if (route.routeName && this.routesByName.get(route.routeName) === route) {
            this.routesByName.delete(route.routeName)
        }

        for (const method of route.methods) {
            const methodKey = method.toUpperCase() as Uppercase<HttpMethod>
            this.routesByPathMethod.delete(`${methodKey} ${route.path}`)
            this.routesByMethod.set(
                methodKey,
                (this.routesByMethod.get(methodKey) ?? []).filter(existingRoute => existingRoute !== route)
            )
        }
    }

    /**
     * Resets the router to it's default state
     */
    static reset() {
        this.routes.clear()
        this.prefix = ''
        this.groupMiddlewares = []
        this.globalMiddlewares = []
        this.routesByPathMethod.clear()
        this.routesByMethod.clear()
        this.routesByName.clear()
        this.routePatterns.clear()

        return this
    }

    protected static createBaseConfig(): RouterConfig {
        return {
            inferParamName: false,
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

    protected static mergeConfig(target: RouterConfig, source?: RouterConfig): RouterConfig {
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

    protected static getDefaultConfig(): RouterConfig {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.defaultConfigKey]) {
            g[this.defaultConfigKey] = this.createBaseConfig()
        }

        return {
            inferParamName: g[this.defaultConfigKey].inferParamName,
            methodOverride: { ...g[this.defaultConfigKey].methodOverride },
            container: { ...g[this.defaultConfigKey].container },
        }
    }

    protected static resolveStateNamespace(): string {
        return String(this.routerStateNamespace || this.name || 'clear-router:core')
    }

    protected static getStateStore(): Record<string, any> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.stateStoreKey]) {
            g[this.stateStoreKey] = Object.create(null)
        }

        return g[this.stateStoreKey] as Record<string, any>
    }

    protected static getPluginStore(): Set<string> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.pluginStoreKey]) {
            g[this.pluginStoreKey] = new Set<string>()
        }

        return g[this.pluginStoreKey] as Set<string>
    }

    protected static getPluginPendingStore(): Set<Promise<void>> {
        const g = globalThis as Record<PropertyKey, any>

        if (!g[this.pluginPendingKey]) {
            g[this.pluginPendingKey] = new Set<Promise<void>>()
        }

        return g[this.pluginPendingKey] as Set<Promise<void>>
    }

    protected static getPluginArgumentResolvers(): Set<PluginArgumentsResolver> {
        const g = globalThis as Record<PropertyKey, any>
        if (!g[this.pluginArgumentResolversKey]) {
            g[this.pluginArgumentResolversKey] = new Set<PluginArgumentsResolver>()
        }

        return g[this.pluginArgumentResolversKey]
    }

    protected static getPluginHttpCtxResolvers(): Set<PluginArgumentsResolver> {
        const g = globalThis as Record<PropertyKey, any>
        if (!g[this.pluginHttpCtxResolversKey]) {
            g[this.pluginHttpCtxResolversKey] = new Set<PluginArgumentsResolver>()
        }

        return g[this.pluginHttpCtxResolversKey]
    }

    protected static createDefaultState() {
        return {
            config: this.getDefaultConfig(),
            groupContext: new AsyncLocalStorage<RouteGroupContext>(),
            routes: new Set([]),
            routesByPathMethod: new Map(),
            routesByMethod: new Map(),
            routesByName: new Map(),
            prefix: '',
            groupMiddlewares: [] as any[],
            globalMiddlewares: [] as any[],
        }
    }

    protected static bindStateAccessors(): void {
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
                get() {
                    const ns = this.resolveStateNamespace()
                    const registry = this.getStateStore()

                    if (!registry[ns]) {
                        registry[ns] = this.createDefaultState()
                    }

                    return registry[ns][key]
                },
                set(value) {
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

    protected static createDefaultOptionsHandler(): any {
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

    /**
     * Default configuration used for everytime the router is reset
     * 
     * @param options 
     */
    static configureDefaults(options?: RouterConfig): void {
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
    static async use<Options = any>(
        plugin: ClearRouterPluginInput<Options>,
        options?: Options
    ): Promise<void> {
        const name = typeof plugin === 'function'
            ? plugin.name
            : plugin.name
        const store = this.getPluginStore()

        if (name && store.has(name)) return

        if (name) store.add(name)

        const setup = async (): Promise<void> => {
            const ctx: ClearRouterPluginContext<Options> = {
                container: Container,
                bind: this.createPluginBind(),
                resolveArguments: (resolver) => {
                    this.getPluginArgumentResolvers().add(resolver)
                },
                useHttpContext: (resolver) => {
                    this.getPluginHttpCtxResolvers().add(resolver)
                },
                bindings: Container.bindings(),
                configure: this.configure.bind(this),
                configureDefaults: this.configureDefaults.bind(this),
                get request() {
                    return this.getRequest()
                },
                get response() {
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

    protected static async pluginsReady(): Promise<void> {
        const pending = Array.from(this.getPluginPendingStore())
        if (!pending.length) return

        await Promise.all(pending)
    }

    protected static getCurrentPluginRequestContext(): ClearRouterPluginRequestContext | undefined {
        return this.pluginRequestContext.getStore()
    }

    protected static createPluginRequestContext(ctx: any): ClearRouterPluginRequestContext {
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

    protected static createPluginBind(): PluginBind {
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

    protected static async resolvePluginArguments(
        ctx: any,
        routeContext: Omit<ClearRouterPluginArgumentsContext, keyof ClearRouterPluginRequestContext>
    ): Promise<any[] | undefined> {
        const resolvers = Array.from(this.getPluginArgumentResolvers()) as PluginArgumentsResolver[]
        if (!resolvers.length) return undefined

        const requestContext = this.createPluginRequestContext(ctx)
        const pluginContext: ClearRouterPluginArgumentsContext = {
            ...requestContext,
            ...routeContext,
        } as never

        for (const resolver of resolvers) {
            const args = await resolver(pluginContext)
            if (Array.isArray(args)) {
                return args
            }
        }
    }

    protected static async resolvePluginHttpCtx(
        ctx: any,
    ): Promise<void> {
        const resolvers = Array.from(this.getPluginHttpCtxResolvers()) as PluginArgumentsResolver[]
        if (!resolvers.length) return undefined

        const pluginContext = this.createPluginRequestContext(ctx)
        for (const resolver of resolvers) {
            await resolver(pluginContext as never)
        }
    }

    protected static ensureState(): void {
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
            this.groupContext = new AsyncLocalStorage<RouteGroupContext>()
        }

        if (!this.routes || Array.isArray(this.routes)) {
            this.routes = new Set<Route<any, any, any>>(this.routes ?? [])
        }

        if (!this.routesByPathMethod) {
            this.routesByPathMethod = new Map<string, Route<any, any, any>>()
        }

        if (!this.routesByMethod) {
            this.routesByMethod = new Map()
        }

        if (!this.routesByName) {
            this.routesByName = new Map()
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
    static normalizePath(path: string): string {
        return '/' + path
            .split('/')
            .filter(Boolean)
            .join('/')
    }

    protected static parseRouteParameters(path: string): Array<{
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

    protected static expandRoutePath(path: string): string[] {
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

    protected static routeRegistrationPaths(path: string): string[] {
        return this.expandRoutePath(path)
    }

    /**
     * Compile a host pattern such as `{account}.example.com` into a matcher and
     * the ordered list of placeholder names it captures. Results are memoized.
     *
     * @param pattern
     * @returns
     */
    protected static compileDomain(pattern: string): { regex: RegExp; params: string[] } {
        const cached = this.domainMatcherCache.get(pattern)
        if (cached) return cached

        const cleanPattern = pattern.split(':', 1)[0].trim()
        const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, match => `\\${match}`)
        const placeholder = /\{([^{}]+)\}/g
        const params: string[] = []

        let source = '^'
        let lastIndex = 0
        let match: RegExpExecArray | null

        while ((match = placeholder.exec(cleanPattern)) !== null) {
            source += escape(cleanPattern.slice(lastIndex, match.index))

            const raw = match[1].trim()
            const optional = raw.endsWith('?')
            const name = (optional ? raw.slice(0, -1) : raw).split(':', 1)[0].trim()

            params.push(name)
            source += optional ? '([^.]*)' : '([^.]+)'
            lastIndex = match.index + match[0].length
        }

        source += escape(cleanPattern.slice(lastIndex))
        source += '$'

        const compiled = { regex: new RegExp(source, 'i'), params }
        this.domainMatcherCache.set(pattern, compiled)

        return compiled
    }

    /**
     * Match a host against a domain pattern, returning the captured parameters or
     * `null` when the host does not match.
     *
     * @param pattern
     * @param host
     * @returns
     */
    static matchDomain(pattern: string, host?: string | null): Record<string, string> | null {
        if (!pattern) return null

        const cleanHost = String(host ?? '').split(':', 1)[0].trim().toLowerCase()
        const { regex, params } = this.compileDomain(pattern)
        const match = regex.exec(cleanHost)

        if (!match) return null

        const result: Record<string, string> = {}
        params.forEach((name, index) => {
            const value = match[index + 1]
            if (typeof value !== 'undefined') {
                result[name] = decodeURIComponent(value)
            }
        })

        return result
    }

    /**
     * Best-effort extraction of the request host across every supported adapter
     * context shape (Express/Fastify plain headers, H3 `Headers`, Hono accessor,
     * Koa context).
     *
     * @param ctx
     * @returns
     */
    protected static extractHost(ctx: any): string {
        const headers = ctx?.req?.headers ?? ctx?.headers
        let host: any

        if (headers) {
            host = typeof headers.get === 'function'
                ? headers.get('host') ?? headers.get(':authority')
                : headers.host ?? headers[':authority']
        }

        if (!host && typeof ctx?.req?.header === 'function') {
            host = ctx.req.header('host')
        }

        if (!host && typeof ctx?.host === 'string') {
            host = ctx.host
        }

        if (Array.isArray(host)) host = host[0]

        return String(host ?? '').split(',', 1)[0].trim()
    }

    /**
     * Resolve the domain parameters for a route given the active request context.
     * Returns `null` when the route is not domain-constrained, `false` when it is
     * but the host does not match, or the captured parameters on a match.
     *
     * @param route
     * @param ctx
     * @returns
     */
    protected static matchRouteDomain(
        route: Route<any, any, any>,
        ctx: any
    ): Record<string, string> | null | false {
        if (!route.domainPattern) return null

        return this.matchDomain(route.domainPattern, this.extractHost(ctx)) ?? false
    }

    /**
     * Register a global pattern applied to every route parameter sharing the
     * given name (equivalent to Laravel's `Route::pattern`).
     *
     * @param name
     * @param pattern
     */
    static pattern(name: string, pattern: string | RegExp): void {
        this.ensureState()
        this.routePatterns.set(name, pattern)
    }

    /**
     * Register multiple global parameter patterns at once.
     *
     * @param patterns
     */
    static patterns(patterns: Record<string, string | RegExp>): void {
        for (const [name, pattern] of Object.entries(patterns)) {
            this.pattern(name, pattern)
        }
    }

    /**
     * Merge the global parameter patterns with the route's own constraints. Route
     * level constraints take precedence over global patterns.
     *
     * @param route
     * @returns
     */
    protected static resolveConstraints(route: Route<any, any, any>): Record<string, string | RegExp> {
        if (!this.routePatterns.size && !Object.keys(route.constraints).length) {
            return route.constraints
        }

        return { ...Object.fromEntries(this.routePatterns), ...route.constraints }
    }

    /**
     * Compile a constraint pattern into a fully-anchored regular expression.
     *
     * @param pattern
     * @returns
     */
    protected static toConstraintRegex(pattern: string | RegExp): RegExp {
        if (pattern instanceof RegExp) {
            return new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace('g', ''))
        }

        const cached = this.constraintRegexCache.get(pattern)
        if (cached) return cached

        const regex = new RegExp(`^(?:${pattern})$`)
        this.constraintRegexCache.set(pattern, regex)

        return regex
    }

    /**
     * Determine whether the resolved parameters satisfy the route's constraints.
     * Absent parameters (e.g. optional ones) are ignored.
     *
     * @param route
     * @param params
     * @returns
     */
    protected static satisfiesConstraints(
        route: Route<any, any, any>,
        params: Record<string, any>
    ): boolean {
        const constraints = this.resolveConstraints(route)

        for (const name of Object.keys(constraints)) {
            const value = params[name]
            if (typeof value === 'undefined' || value === null) continue

            const values = Array.isArray(value) ? value : [value]
            const regex = this.toConstraintRegex(constraints[name])

            if (!values.every(entry => regex.test(String(entry)))) {
                return false
            }
        }

        return true
    }

    /**
     * Determine which of a route's parameters are allowed to span multiple path
     * segments (i.e. their constraint matches an encoded forward slash). These are
     * registered with the adapter's catch-all syntax.
     *
     * @param route
     * @returns
     */
    protected static wildcardParameters(route: Route<any, any, any>): Set<string> {
        const wildcards = new Set<string>()
        const constraints = this.resolveConstraints(route)
        const declared = new Set(route.parameters.map(parameter => parameter.name))

        for (const name of Object.keys(constraints)) {
            if (!declared.has(name)) continue
            if (this.toConstraintRegex(constraints[name]).test('a/b')) {
                wildcards.add(name)
            }
        }

        return wildcards
    }

    /**
     * Render a single wildcard (slash-spanning) parameter for the underlying
     * router's registration path. Overridden per adapter; the base form keeps the
     * plain `:name` placeholder.
     *
     * @param name
     * @returns
     */
    protected static formatWildcardParam(name: string): string {
        return `:${name}`
    }

    /**
     * Rewrite a route's registration paths so any wildcard parameters use the
     * adapter's catch-all syntax. Non-wildcard routes are returned unchanged.
     *
     * @param route
     * @returns
     */
    protected static resolveRegistrationPaths(route: Route<any, any, any>): string[] {
        const wildcards = this.wildcardParameters(route)
        if (!wildcards.size) return route.registrationPaths

        return route.registrationPaths.map(path => path
            .split('/')
            .map(segment => {
                const name = segment.startsWith(':') ? segment.slice(1) : ''

                return name && wildcards.has(name) ? this.formatWildcardParam(name) : segment
            })
            .join('/'))
    }

    /**
     * Resolve the final parameters for a dispatched route, applying domain
     * matching and constraint validation. Returns the merged parameters, or
     * `false` when the route should not handle the request (host mismatch or a
     * constraint failure) so the adapter can fall through.
     *
     * @param route
     * @param ctx
     * @param baseParams
     * @returns
     */
    protected static matchRoute(
        route: Route<any, any, any>,
        ctx: any,
        baseParams: Record<string, any> = {}
    ): Record<string, any> | false {
        const params: Record<string, any> = { ...(baseParams ?? {}) }

        if (route.domainPattern) {
            const domainParams = this.matchDomain(route.domainPattern, this.extractHost(ctx))
            if (!domainParams) return false

            Object.assign(params, domainParams)
        }

        this.normalizeWildcardParams(route, params)

        if (!this.satisfiesConstraints(route, params)) return false

        return params
    }

    /**
     * Normalize wildcard (slash-spanning) parameters into a single string keyed by
     * the declared parameter name, smoothing over the differing shapes adapters
     * return (Express yields an array of segments, Fastify keys it under `*`).
     *
     * @param route
     * @param params
     */
    protected static normalizeWildcardParams(
        route: Route<any, any, any>,
        params: Record<string, any>
    ): void {
        const wildcards = this.wildcardParameters(route)
        if (!wildcards.size) return

        for (const name of wildcards) {
            let value = params[name]

            if (typeof value === 'undefined' && typeof params['*'] !== 'undefined') {
                value = params['*']
                delete params['*']
            }

            if (Array.isArray(value)) value = value.join('/')
            if (typeof value !== 'undefined') params[name] = value
        }
    }

    /**
     * Get the route currently being dispatched, if any.
     *
     * @returns
     */
    static current(): Route<any, any, any> | undefined {
        const store = this.pluginRequestContext.getStore() as any

        return store?.request?.route ?? store?.ctx?.clearRequest?.route
    }

    /**
     * Get the name of the route currently being dispatched.
     *
     * @returns
     */
    static currentRouteName(): string {
        return this.current()?.routeName ?? ''
    }

    /**
     * Get the action (`Controller@method` or `Closure`) of the route currently
     * being dispatched.
     *
     * @returns
     */
    static currentRouteAction(): string {
        return this.current()?.action ?? ''
    }

    /**
     * Configures the router with the given options, such as method override settings.
     * 
     * @param this 
     * @param options 
     * @returns 
     */
    static configure(this: any, options?: RouterConfig): void {
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

        const infer = options?.inferParamName
        if (infer) this.config.inferParamName = options?.inferParamName

        const override = options?.methodOverride
        if (override) {

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
    }

    protected static resolveMethodOverride(
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
    static add(
        methods: HttpMethod | HttpMethod[],
        path: string,
        handler: any,
        middlewares?: any[] | any
    ): Route<any, any, any> {
        this.ensureState()

        const context = this.groupContext.getStore()
        const activePrefix = context?.prefix ?? this.prefix
        const activeGroupMiddlewares = context?.groupMiddlewares ?? this.groupMiddlewares
        const activeDomain = context?.domain

        methods = Array.isArray(methods) ? methods : [methods]
        middlewares = middlewares
            ? (Array.isArray(middlewares) ? middlewares : [middlewares])
            : undefined

        const fullPath = this.normalizePath(`${activePrefix}/${path}`)
        const registrationPaths = this.routeRegistrationPaths(fullPath)
        const parameters = this.parseRouteParameters(fullPath)

        for (const method of methods) {
            const existing = this.routesByPathMethod.get(`${method.toUpperCase()} ${fullPath}`)
            if (existing) {
                this.removeRouteMethod(existing, method, fullPath)
            }
        }

        const route = new Route(
            methods.includes('options') ? methods : methods.concat('options'),
            fullPath,
            handler,
            this.resolveMiddlewares([
                ...this.globalMiddlewares,
                ...activeGroupMiddlewares,
                ...getControllerMiddlewares(handler),
                ...(middlewares || []),
            ]),
            {
                registrationPaths,
                parameters,
                domain: activeDomain,
                onName: (name, route, previousName) => {
                    if (previousName && this.routesByName.get(previousName) === route) {
                        this.routesByName.delete(previousName)
                    }

                    this.routesByName.set(name, route)
                },
                normalizeMiddleware: middleware => this.resolveMiddleware(middleware),
            }
        )

        if (
            !methods.includes('options') &&
            !this.routesByPathMethod.get(`OPTIONS ${fullPath}`)
        ) {
            this.options(path, this.createDefaultOptionsHandler())
        }

        this.routes.add(route)
        for (const collector of context?.routeCollectors ?? []) {
            collector.add(route)
        }

        for (const method of methods.map(m => m.toUpperCase() as Uppercase<HttpMethod>)) {
            this.routesByPathMethod.set(`${method} ${fullPath}`, route)
            if (!this.routesByMethod.has(method)) {
                this.routesByMethod.set(method, [])
            }
            this.routesByMethod.get(method)?.push(route)
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
    static apiResource(
        basePath: string,
        controller: any,
        options?: {
            only?: ResourceAction[]
            except?: ResourceAction[]
            middlewares?: ApiResourceMiddleware<any>
        }
    ): ResourceRoutes<any, any, any> {
        let paramName = 'id'

        if (!!this.config.inferParamName && this.hasPackageInstalled('@h3ravel/support')) {
            const require = createRequire(import.meta.url)
            const { str } = require('@h3ravel/support')
            paramName = str(basePath).singular().afterLast('/').toString()
        }

        return new ResourceRoutes(
            basePath,
            controller,
            paramName,
            options,
            ({ method, path, handler, middlewares, name }) => {
                return this.add(method, path, handler, middlewares).name(name)
            },
            route => this.removeRoute(route)
        ).register()
    }

    /**
     * Adds a new GET route to the router.
     * 
     * @param this          The router instance.
     * @param path          The path for the GET route.
     * @param handler       The handler function for the GET route.
     * @param middlewares   Optional middlewares to apply to the GET route.
     */
    static get(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static post(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static put(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static delete(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static patch(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static options(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static head(path: string, handler: any, middlewares?: any[] | any): Route<any, any, any> {
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
    static group<S extends RouteGroupSource>(
        prefix: string,
        source: S,
        middlewares?: any[]
    ): RouteGroup<any, any, any, S> {
        return this.makeGroup(prefix, source, middlewares)
    }

    /**
     * Build a route group, optionally constrained to a host pattern. Shared by
     * `group` and the `domain` registrar.
     *
     * @param prefix
     * @param source
     * @param middlewares
     * @param extra
     */
    protected static makeGroup<S extends RouteGroupSource>(
        prefix: string,
        source: S,
        middlewares?: any[],
        extra?: { domain?: string }
    ): RouteGroup<any, any, any, S> {
        this.ensureState()

        return new RouteGroup({
            prefix,
            source,
            middlewares,
            domain: extra?.domain,
            context: this.groupContext,
            defaultPrefix: this.prefix,
            defaultMiddlewares: this.groupMiddlewares,
            normalizePath: path => this.normalizePath(path),
            removeRoute: route => this.removeRoute(route),
        })
    }

    /**
     * Begin a route registration constrained to a host pattern such as
     * `{account}.example.com`. Returns a registrar whose `.group()` registers the
     * routes under that domain (matched parameters become route parameters).
     *
     * @param pattern
     * @returns
     */
    static domain(pattern: string): RouteRegistrar {
        this.ensureState()

        return new RouteRegistrar(
            (prefix, source, middlewares, extra) => this.makeGroup(prefix, source, middlewares, extra),
            { domain: pattern }
        )
    }

    /**
     * Adds global middlewares to the router, which will be applied to all routes.
     * 
     * @param this 
     * @param middlewares 
     * @param callback 
     */
    static middleware(middlewares: any[], callback: () => void): void {
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
    static allRoutes(): Array<Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'path' to get routes organized by path
     */
    static allRoutes(type: 'path'): Record<string, Route<any, any, any>>
    /**
     * @param this  
     * @param type  - 'method' to get routes organized by method
     */
    static allRoutes(type: 'method'): { [method in Uppercase<HttpMethod>]?: Array<Route<any, any, any>> }
    static allRoutes(type: 'name'): Record<string, Route<any, any, any>>
    static allRoutes(type?: 'method' | 'path' | 'name'):
        Array<Route<any, any, any>> |
        Record<string, Route<any, any, any>> |
        Record<string, Array<Route<any, any, any>>> {
        this.ensureState()
        if (type === 'method') {
            return Object.fromEntries(this.routesByMethod.entries())
        }

        if (type === 'path') {
            return Object.fromEntries(this.routesByPathMethod.entries())
        }

        if (type === 'name') {
            return Object.fromEntries(this.routesByName.entries())
        }

        const routes = Array.from(this.routes)

        return routes.filter(
            (e: Route<any, any, any>) => e.methods.length > 1 || e.methods[0] !== 'options'
        )
    }

    static route(name: string): Route<any, any, any> | undefined {
        this.ensureState()

        return this.routesByName.get(name)
    }

    static url(name: string, params?: Record<string, any>): string | undefined {
        return this.route(name)?.toPath(params)
    }

    /**
     * Provide a class that will overide the base Request instance
     * 
     * @param provider 
     */
    static setRequestProvider(provider: typeof CoreRequest) {
        this.requestProvider = provider
    }

    /**
     * Provide a class that will overide the base Response instance
     * 
     * @param provider 
     */
    static setResponseProvider(provider: typeof CoreResponse) {
        this.responseProvider = provider
    }

    private static hasPackageInstalled(name: string): boolean {
        try {
            const require = createRequire(import.meta.url)
            require.resolve(name, { paths: [process.cwd()] })

            return true
        } catch {
            return false
        }
    }

    /**
     * Provide a class that will overide the base Response instance
     * 
     * @param provider 
     */
    private static initializeInstance<
        Prov extends typeof CoreResponse,
        Args extends ConstructorParameters<Prov>[0]
    >(provider: Prov, args: Args): CoreResponse
    private static initializeInstance<
        Prov extends typeof CoreRequest,
        Args extends ConstructorParameters<Prov>[0]
    >(provider: Prov, args: Args): CoreRequest
    private static initializeInstance(provider: any, args: any) {

        const isRequest = ['CoreRequest', 'Request', 'ClearRequest'].includes(provider.name)
        const isResponse = ['CoreResponse', 'Response', 'ClearResponse'].includes(provider.name)

        if (isRequest && this.requestProvider) {
            return new this.requestProvider(args as never)
        } else if (isResponse && this.responseProvider) {
            return new this.responseProvider(args as never)
        }

        return new provider(args as never)
    }

    protected static resolveHandler(route: Route<any, any, any>): {
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

    protected static async callHandler(
        handlerFunction: (ctx: any, req: CoreRequest) => any | Promise<any>,
        ctx: any,
        bindingTarget?: object,
        bindingMethod?: PropertyKey,
        bindingHandler?: object,
        bindingMetadata?: object
    ): Promise<any> {
        return this.pluginRequestContext.run(this.createPluginRequestContext(ctx), async () => {
            await this.pluginsReady()
            await this.resolvePluginHttpCtx(ctx)

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

            if (pluginArgs?.length) {
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

    protected static bindRequestToInstance(
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

/**
 * Expose the active request's route through the `Route` facade (`Route.current()`,
 * `Route.currentRouteName()`, `Route.currentRouteAction()`) by delegating to the
 * shared router request context.
 */
Route.bindCurrentResolvers({
    current: () => CoreRouter.current(),
    currentRouteName: () => CoreRouter.currentRouteName(),
    currentRouteAction: () => CoreRouter.currentRouteAction(),
})
