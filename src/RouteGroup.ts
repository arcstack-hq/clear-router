import { RouteGroupCondition, RouteGroupContext, RouteGroupEntry, RouteGroupOptions } from './types'
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
    private readonly conditions: RouteGroupCondition[] = []
    private readonly registration: Promise<void>
    private readonly routes = new Set<Route<X, M, H>>()
    private readonly unfilteredSources = new Set<RouteGroupEntry>()

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
        this.conditions.push(condition)
        const unfilteredSources = Array.from(this.unfilteredSources)

        if (unfilteredSources.length) {
            this.checks.push(this.registration.then(async () => {
                for (const source of unfilteredSources) {
                    if (!await condition(source)) {
                        this.rollback()
                        break
                    }
                }
            }))
        }

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
                    if (!this.conditions.length) {
                        this.unfilteredSources.add(entry)
                    } else if (!await this.accepts(entry)) {
                        continue
                    }

                    await Promise.resolve(entry())
                    continue
                }

                const resolved = await this.resolveFiles(entry)
                if (!resolved.directory && !await this.accepts(entry)) continue

                for (const file of resolved.files) {
                    if (resolved.directory && !await this.accepts(file)) continue

                    await importFile(file)
                }
            }
        })
    }

    /**
    * Rollback the route registration
    */
    private rollback (): void {
        for (const route of this.routes) {
            this.options.removeRoute(route)
        }
    }

    /**
     * Check whether a callback or path should be registered.
     * 
     * @param source 
     * @returns 
     */
    private async accepts (source: RouteGroupEntry): Promise<boolean> {
        for (const condition of this.conditions) {
            if (!await condition(source)) return false
        }

        return true
    }

    /**
     * Resolve files from the group path
     * 
     * @param source 
     * @returns 
     */
    private async resolveFiles (source: string): Promise<{
        directory: boolean
        files: string[]
    }> {
        const resolved = isAbsolute(source) ? source : resolve(process.cwd(), source)
        let sourceStat

        try {
            sourceStat = await stat(resolved)
        } catch {
            throw new Error(`Route group source not found: ${source}`)
        }

        if (sourceStat.isFile()) {
            return {
                directory: false,
                files: [resolved],
            }
        }

        if (!sourceStat.isDirectory()) {
            throw new Error(`Route group source must be a file or directory: ${source}`)
        }

        return {
            directory: true,
            files: await this.readDirectory(resolved),
        }
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
