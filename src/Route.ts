import type { HttpMethod, RequestData } from './types'

import type { ClearRequest } from './ClearRequest'
import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import { RouteParameter } from './Contracts'

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

    constructor(
        methods: HttpMethod[],
        path: string,
        handler: H,
        middlewares: M[] = [],
        options: {
            registrationPaths?: string[]
            parameters?: RouteParameter[]
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
        this.onName = options.onName
        this.normalizeMiddleware = options.normalizeMiddleware
    }

    private onName?: (name: string, route: Route<X, M, H>, previousName?: string) => void
    private normalizeMiddleware?: (middleware: M) => M

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

        return path || '/'
    }
}
