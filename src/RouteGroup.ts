import { RouteGroupCondition, RouteGroupContext, RouteGroupOptions } from './types'
import { isAbsolute, join, resolve } from 'node:path'
import { readdir, stat } from 'node:fs/promises'

import type { Middleware as EMiddleware } from './types/express'
import type { Middleware as HMiddleware } from './types/h3'
import type { Route } from './Route'
import { importFile } from './core/helpers'

/**
 * @class clear-router RouteGroup
 * @description A route group describes a collection of routes on clear-router
 * @author 3m1n3nc3
 * @repository https://github.com/arkstack-tmp/clear-router
 */
export class RouteGroup<X = any, M = HMiddleware | EMiddleware, H = any> implements PromiseLike<void> {
    private readonly checks: Promise<void>[] = []
    private readonly registration: Promise<void>
    private readonly routes = new Set<Route<X, M, H>>()

    constructor(private readonly options: RouteGroupOptions) {
        this.registration = this.register()
    }

    /**
     * Returning a falsy value will stop route group registration
     * 
     * @param condition 
     * @returns 
     */
    when (condition: RouteGroupCondition): this {
        this.checks.push(this.registration.then(async () => {
            if (!await condition(this.options.source)) {
                this.rollback()
            }
        }))

        return this
    }

    /**
     * Register one or more middleware that will be executed before every route in the group.
     *
     * @param middlewares
     * @returns
     */
    middleware (middlewares: M[] | M): this {
        this.checks.push(this.registration.then(() => {
            for (const route of this.routes) {
                route.middleware(middlewares)
            }
        }))

        return this
    }

    /**
     * Attaches callbacks for the resolution and/or rejection of the RouteGroup.
     * 
     * @param onfulfilled 
     * @param onrejected 
     * @returns 
     */
    then<TResult1 = void, TResult2 = never> (
        onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
        return Promise.all([this.registration, ...this.checks])
            .then(() => undefined)
            .then(onfulfilled, onrejected)
    }

    /**
     * Register the routes
     */
    private async register (): Promise<void> {
        const current = this.options.context.getStore()
        const previousPrefix = current?.prefix ?? this.options.defaultPrefix
        const previousMiddlewares = current?.groupMiddlewares ?? this.options.defaultMiddlewares
        const fullPrefix = [previousPrefix, this.options.prefix]
            .filter(Boolean)
            .join('/')
        const nextContext: RouteGroupContext = {
            prefix: this.options.normalizePath(fullPrefix),
            groupMiddlewares: [
                ...previousMiddlewares,
                ...(this.options.middlewares || []),
            ],
            routeCollectors: [
                ...(current?.routeCollectors ?? []),
                this.routes,
            ],
        }

        await this.options.context.run(nextContext, async () => {
            for (const entry of Array.isArray(this.options.source)
                ? this.options.source
                : [this.options.source]) {
                if (typeof entry === 'function') {
                    await Promise.resolve(entry())
                    continue
                }

                for (const file of await this.resolveFiles(entry)) {
                    await importFile(file)
                }
            }
        })
    }

    /**
     * Rollback the route registrations
     */
    private rollback (): void {
        for (const route of this.routes) {
            this.options.removeRoute(route)
        }
    }

    /**
     * Resolve files from the group path
     * 
     * @param source 
     * @returns 
     */
    private async resolveFiles (source: string): Promise<string[]> {
        const resolved = isAbsolute(source) ? source : resolve(process.cwd(), source)
        let sourceStat

        try {
            sourceStat = await stat(resolved)
        } catch {
            throw new Error(`Route group source not found: ${source}`)
        }

        if (sourceStat.isFile()) {
            return [resolved]
        }

        if (!sourceStat.isDirectory()) {
            throw new Error(`Route group source must be a file or directory: ${source}`)
        }

        return this.readDirectory(resolved)
    }

    /**
     * Read all the files in the configured directory
     * 
     * @param directory 
     * @returns 
     */
    private async readDirectory (directory: string): Promise<string[]> {
        const entries = await readdir(directory, { withFileTypes: true })
        const files: string[] = []

        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
            const path = join(directory, entry.name)

            if (entry.isDirectory()) {
                files.push(...await this.readDirectory(path))
            } else if (
                entry.isFile() &&
                /\.(?:[cm]?ts)$/.test(entry.name) &&
                !entry.name.endsWith('.d.ts')
            ) {
                files.push(path)
            }
        }

        return files
    }
}
