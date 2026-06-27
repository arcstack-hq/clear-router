import type { RouteGroup } from './RouteGroup'
import type { RouteGroupSource } from './types/basic'

/**
 * Factory used by the registrar to build a route group while carrying the
 * accumulated attributes (domain, prefix, middlewares).
 */
export type RouteRegistrarGroupFactory = (
    prefix: string,
    source: RouteGroupSource,
    middlewares: any[] | undefined,
    extra: { domain?: string }
) => RouteGroup<any, any, any, any>

/**
 * @class clear-router RouteRegistrar
 * @description Fluent builder returned by `Router.domain()` that lets routes be
 * grouped under a shared host pattern (and optionally a prefix/middlewares),
 * mirroring Laravel's route attribute registrar.
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-hq/clear-router
 */
export class RouteRegistrar {
    private attributes: {
        domain?: string
        prefix: string
        middlewares: any[]
    }

    constructor(
        private readonly makeGroup: RouteRegistrarGroupFactory,
        attributes: { domain?: string; prefix?: string; middlewares?: any[] } = {}
    ) {
        this.attributes = {
            domain: attributes.domain,
            prefix: attributes.prefix ?? '',
            middlewares: attributes.middlewares ?? [],
        }
    }

    /**
     * Constrain the grouped routes to a host pattern such as `{account}.example.com`.
     *
     * @param pattern
     * @returns
     */
    domain (pattern: string): this {
        this.attributes.domain = pattern

        return this
    }

    /**
     * Prepend a path prefix to the grouped routes.
     *
     * @param prefix
     * @returns
     */
    prefix (prefix: string): this {
        this.attributes.prefix = prefix

        return this
    }

    /**
     * Register one or more middleware shared by the grouped routes.
     *
     * @param middlewares
     * @returns
     */
    middleware (middlewares: any[] | any): this {
        this.attributes.middlewares = [
            ...this.attributes.middlewares,
            ...(Array.isArray(middlewares) ? middlewares : [middlewares]),
        ]

        return this
    }

    /**
     * Register the grouped routes. A leading string is treated as a path prefix
     * (matching `Router.group(prefix, source, middlewares?)`); otherwise the first
     * argument is the source and the registrar's own prefix is used.
     *
     * @param source
     * @param middlewares
     * @returns
     */
    group<S extends RouteGroupSource = RouteGroupSource> (
        source: S,
        middlewares?: any[]
    ): RouteGroup<any, any, any, S>
    group<S extends RouteGroupSource = RouteGroupSource> (
        prefix: string,
        source: S,
        middlewares?: any[]
    ): RouteGroup<any, any, any, S>
    group (
        prefixOrSource: string | RouteGroupSource,
        sourceOrMiddlewares?: RouteGroupSource | any[],
        middlewares?: any[]
    ): RouteGroup<any, any, any, any> {
        let prefix = this.attributes.prefix
        let source: RouteGroupSource
        let extraMiddlewares: any[] | undefined

        if (typeof prefixOrSource === 'string') {
            prefix = prefixOrSource
            source = sourceOrMiddlewares as RouteGroupSource
            extraMiddlewares = middlewares
        } else {
            source = prefixOrSource
            extraMiddlewares = sourceOrMiddlewares as any[] | undefined
        }

        return this.makeGroup(
            prefix,
            source,
            [...this.attributes.middlewares, ...(extraMiddlewares ?? [])],
            { domain: this.attributes.domain }
        )
    }
}
