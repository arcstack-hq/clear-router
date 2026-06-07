import type { JitiOptions, JitiResolveOptions } from 'jiti'

import type { AsyncLocalStorage } from 'node:async_hooks'
import { Route } from '../Route'

type OwnStatics<T> = Omit<T, keyof Function | 'prototype'>

/**
 * Controller method reference
 */
export type ControllerHandler<T = any> = T extends abstract new (...args: any[]) => infer I
    ? [
        T,
        | { [K in keyof I]: I[K] extends (...args: any[]) => any ? K : never }[keyof I] & string
        | { [K in keyof OwnStatics<T>]: OwnStatics<T>[K] extends (...args: any[]) => any ? K : never }[keyof OwnStatics<T>] & string,
    ]
    : [any, string];

export type MaybePromise<T = any> = T | Promise<T>
export type RouteGroupCallback = () => MaybePromise<any>
export type RouteGroupEntry = RouteGroupCallback | string
export type RouteGroupSource = RouteGroupEntry | RouteGroupEntry[]
export type RouteGroupConditionEntry<S extends RouteGroupEntry> =
    S extends string ? string : S
export type RouteGroupConditionSource<S extends RouteGroupSource> =
    RouteGroupConditionEntry<
        S extends RouteGroupEntry[] ? S[number] : Extract<S, RouteGroupEntry>
    >

export type MiddlewareHandle<Args extends any[] = any[], Return = any> = (
    ...args: Args
) => MaybePromise<Return>

export type MiddlewareClass<M extends MiddlewareHandle = MiddlewareHandle> = new () => {
    handle: M
}

export type MiddlewareInstance<M extends MiddlewareHandle = MiddlewareHandle> = {
    handle: M
}

export type ClassMiddleware<M extends MiddlewareHandle = MiddlewareHandle> =
    | MiddlewareClass<M>
    | MiddlewareInstance<M>

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head'

/**
 * Common resource action names
 */
export type ResourceAction = 'index' | 'show' | 'create' | 'update' | 'destroy'

/**
 * Generic Object type for request data
 */
export type RequestData = Record<string, any>;

export type ApiResourceMiddleware<M = any> =
    | M
    | M[]
    | { [K in ResourceAction]?: M | M[] }

export interface RouterConfig {
    /**
     * When enabled, API param name will be infered from the route path.
     * So instead of getting /api/users/:id, we will now get /api/users/:user
     */
    inferParamName?: boolean
    /**
     * Configuration for method override functionality, allowing clients to use a 
     * specific header or body parameter to override the HTTP method.
     */
    methodOverride?: {
        /** Whether method override is enabled */
        enabled?: boolean
        /** Keys in the request body to check for method override */
        bodyKeys?: string[] | string
        /** Keys in the request headers to check for method override */
        headerKeys?: string[] | string
    }
    /**
     * Optional method binding / container resolution support. Disabled by default.
     */
    container?: {
        /** Whether decorated handler parameter binding is enabled */
        enabled?: boolean
        /** Whether unknown constructor tokens should be instantiated automatically */
        autoDiscover?: boolean
    }
}

export type ResourceRouteDefinition = {
    method: HttpMethod
    path: string
}

export type ResourceRouteRegistrar<X, M, H> = (input: {
    action: ResourceAction
    method: HttpMethod
    path: string
    handler: any
    middlewares?: M[]
    name: string
}) => Route<X, M, H>

export type ResourceRouteRemover<X, M, H> = (route: Route<X, M, H>) => void

export type ResourceRoutesOptions<M = any> = {
    only?: ResourceAction[]
    except?: ResourceAction[]
    middlewares?: ApiResourceMiddleware<M>
}

export interface RouteGroupContext {
    prefix: string
    groupMiddlewares: any[]
    routeCollectors?: Array<Set<Route<any, any, any>>>
}

export interface RouteGroupOptions<S extends RouteGroupSource = RouteGroupSource> {
    prefix: string
    source: S
    middlewares?: any[]
    context: AsyncLocalStorage<RouteGroupContext>
    defaultPrefix: string
    defaultMiddlewares: any[]
    normalizePath: (path: string) => string
    removeRoute: (route: Route<any, any, any>) => void
}

export type RouteGroupCondition<S extends RouteGroupSource = RouteGroupSource> = (
    source: RouteGroupConditionSource<S>
) => MaybePromise<unknown>

export interface FileImporter {
    <T = unknown> (filePath: string): Promise<T>;
    <T = unknown> (filePath: string, userOptions?: JitiOptions | undefined): Promise<T>;
    <T = unknown> (filePath: string, userOptions?: JitiOptions | undefined, resolveOptions?: (JitiResolveOptions & {
        default?: true;
    })): Promise<T>;
}
