import type { HttpMethod, RequestData } from './types'

import type { ClearRequest } from './ClearRequest'
import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import { RouteParameter } from './Contracts'

/**
 * Parse the placeholder parameters declared in a domain/host pattern such as
 * `{account}.example.com`. Mirrors the path parameter syntax (supporting the
 * optional `{name?}` form) so domain parameters feel consistent with path ones.
 *
 * @param pattern
 * @returns
 */
export const parseDomainParameters = (pattern?: string): RouteParameter[] => {
    if (!pattern) return []

    const parameters: RouteParameter[] = []
    const seen = new Set<string>()
    const matcher = /\{([^{}]+)\}/g
    let match: RegExpExecArray | null

    while ((match = matcher.exec(pattern)) !== null) {
        const raw = match[1].trim()
        const optional = raw.endsWith('?')
        const withoutOptional = optional ? raw.slice(0, -1) : raw
        const [name, field] = withoutOptional.split(':', 2).map(part => part.trim())

        if (!name || seen.has(name)) continue

        seen.add(name)
        parameters.push({ name, field: field || undefined, optional })
    }

    return parameters
}

/**
 * Resolvers wired up by `CoreRouter` so the `Route` facade can expose the
 * currently dispatching route without depending on the router directly.
 */
interface CurrentRouteResolvers {
    current: () => Route<any, any, any> | undefined
    currentRouteName: () => string
    currentRouteAction: () => string
}

/**
 * @class clear-router Route
 * @description A route describes a single enpoint on clear-router
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-hq/clear-router
 */
export class Route<X = any, M = HMiddleware | EMiddleware, H = any> {
    ctx!: X
    body: RequestData = {}
    query: RequestData = {}
    params: RequestData = {}
    clearRequest!: ClearRequest

    methods: HttpMethod[]
    path: string
    registrationPaths: string[]
    parameters: RouteParameter[]
    routeName?: string
    handler: H
    middlewares: M[]
    controllerName?: string
    actionName?: string
    handlerType: 'function' | 'controller'
    middlewareCount: number
    domainPattern?: string
    domainParameters: RouteParameter[]
    constraints: Record<string, string | RegExp> = {}

    constructor(
        methods: HttpMethod[],
        path: string,
        handler: H,
        middlewares: M[] = [],
        options: {
            registrationPaths?: string[]
            parameters?: RouteParameter[]
            domain?: string
            onName?: (name: string, route: Route<X, M, H>, previousName?: string) => void
            normalizeMiddleware?: (middleware: M) => M
        } = {}
    ) {
        this.methods = methods
        this.path = path
        this.registrationPaths = options.registrationPaths || [path]
        this.parameters = options.parameters || []
        this.handler = handler
        this.middlewares = middlewares
        this.handlerType = Array.isArray(handler) ? 'controller' : 'function'
        this.middlewareCount = middlewares.length
        this.controllerName = Array.isArray(handler) ? handler[0]?.name : undefined
        this.actionName = Array.isArray(handler) ? handler[1] : typeof handler === 'function' ? handler.constructor.name ?? handler.name : undefined
        this.domainPattern = options.domain
        this.domainParameters = parseDomainParameters(options.domain)
        this.onName = options.onName
        this.normalizeMiddleware = options.normalizeMiddleware
    }

    private onName?: (name: string, route: Route<X, M, H>, previousName?: string) => void
    private normalizeMiddleware?: (middleware: M) => M

    private static currentResolvers?: CurrentRouteResolvers

    /**
     * Wire the resolvers used by the static `current*` accessors. Called once by
     * `CoreRouter` so `Route.current()` reflects the active request.
     *
     * @internal
     * @param resolvers
     */
    static bindCurrentResolvers (resolvers: CurrentRouteResolvers): void {
        Route.currentResolvers = resolvers
    }

    /**
     * Get the route currently being dispatched, if any.
     *
     * @returns
     */
    static current (): Route<any, any, any> | undefined {
        return Route.currentResolvers?.current()
    }

    /**
     * Get the name of the route currently being dispatched.
     *
     * @returns
     */
    static currentRouteName (): string {
        return Route.currentResolvers?.currentRouteName() ?? ''
    }

    /**
     * Get the action (controller@method or `Closure`) of the route currently
     * being dispatched.
     *
     * @returns
     */
    static currentRouteAction (): string {
        return Route.currentResolvers?.currentRouteAction() ?? ''
    }

    /**
     * The route action expressed as `Controller@method` for controller routes or
     * `Closure` for callback routes.
     */
    get action (): string {
        if (this.handlerType === 'controller') {
            const method = String(this.actionName ?? '')

            return this.controllerName ? `${this.controllerName}@${method}` : method
        }

        return 'Closure'
    }

    /**
     * Set the route name
     *
     * @param name
     * @returns
     */
    name (name: string): this {
        const previousName = this.routeName
        this.routeName = name
        this.onName?.(name, this, previousName)

        return this
    }

    /**
     * Constrain the route to a host pattern such as `{account}.example.com`.
     * Any `{placeholder}` segments are exposed as route parameters once matched.
     *
     * @param pattern
     * @returns
     */
    domain (pattern: string): this {
        this.domainPattern = pattern
        this.domainParameters = parseDomainParameters(pattern)

        return this
    }

    /**
     * Constrain one or more route parameters with a regular expression. Accepts
     * either `where(name, pattern)` or `where({ name: pattern, ... })`.
     *
     * @param name
     * @param pattern
     * @returns
     */
    where (name: string | Record<string, string | RegExp>, pattern?: string | RegExp): this {
        if (typeof name === 'object') {
            Object.assign(this.constraints, name)
        } else if (typeof pattern !== 'undefined') {
            this.constraints[name] = pattern
        }

        return this
    }

    /**
     * Constrain the given parameters to numeric values.
     *
     * @param names
     * @returns
     */
    whereNumber (...names: string[]): this {
        return this.applyConstraint(names, '[0-9]+')
    }

    /**
     * Constrain the given parameters to alphabetic values.
     *
     * @param names
     * @returns
     */
    whereAlpha (...names: string[]): this {
        return this.applyConstraint(names, '[a-zA-Z]+')
    }

    /**
     * Constrain the given parameters to alphanumeric values.
     *
     * @param names
     * @returns
     */
    whereAlphaNumeric (...names: string[]): this {
        return this.applyConstraint(names, '[a-zA-Z0-9]+')
    }

    /**
     * Constrain the given parameters to UUID values.
     *
     * @param names
     * @returns
     */
    whereUuid (...names: string[]): this {
        return this.applyConstraint(names, '[\\da-fA-F]{8}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{4}-[\\da-fA-F]{12}')
    }

    /**
     * Constrain the given parameters to ULID values.
     *
     * @param names
     * @returns
     */
    whereUlid (...names: string[]): this {
        return this.applyConstraint(names, '[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}')
    }

    /**
     * Constrain a parameter to one of the given values.
     *
     * @param name
     * @param values
     * @returns
     */
    whereIn (name: string, values: Array<string | number>): this {
        const escaped = values.map(value => String(value).replace(/[.*+?^${}()|[\]\\]/g, match => `\\${match}`))
        this.constraints[name] = escaped.join('|')

        return this
    }

    private applyConstraint (names: string[], pattern: string): this {
        for (const name of names) {
            this.constraints[name] = pattern
        }

        return this
    }

    /**
     * Register one or more middleware that will be executed before the route.
     *
     * @param middlewares
     * @returns
     */
    middleware (middlewares: M[] | M): this {
        const normalized = (Array.isArray(middlewares) ? middlewares : [middlewares])
            .map(middleware => this.normalizeMiddleware?.(middleware) ?? middleware)

        this.middlewares.push(...normalized)
        this.middlewareCount = this.middlewares.length

        return this
    }

    /**
     * Resolve the route's domain pattern into a concrete host using the given
     * parameters.
     *
     * @param params
     * @returns
     */
    private resolveDomainHost (params: RequestData): string {
        return this.domainPattern!.replace(/\{([^{}]+)\}/g, (_, raw: string) => {
            const optional = raw.endsWith('?')
            const name = (optional ? raw.slice(0, -1) : raw).split(':', 2)[0].trim()
            const value = params[name]

            if (typeof value === 'undefined' || value === null || value === '') {
                if (optional) return ''

                throw new Error(`Missing required route domain parameter: ${name}`)
            }

            return encodeURIComponent(String(value))
        })
    }

    /**
     * Get the path generated and accessible by this route
     *
     * @param params
     * @returns
     */
    toPath (params: RequestData = {}): string {
        const path = this.path.replace(/\/?\{([^{}]+)\}/g, (segment, raw: string) => {
            const optional = raw.endsWith('?')
            const withoutOptional = optional ? raw.slice(0, -1) : raw
            const [rawName, rawField] = withoutOptional.split(':', 2)
            const name = rawName.trim()
            const field = rawField?.trim()
            const value = params[name]
            const resolved = field && value && typeof value === 'object'
                ? value[field]
                : value

            if (typeof resolved === 'undefined' || resolved === null || resolved === '') {
                if (optional) return ''

                throw new Error(`Missing required route parameter: ${name}`)
            }

            const prefix = segment.startsWith('/') ? '/' : ''

            return `${prefix}${encodeURIComponent(String(resolved))}`
        })

        const resolved = path || '/'

        if (!this.domainPattern) return resolved

        return `//${this.resolveDomainHost(params)}${resolved}`
    }
}
