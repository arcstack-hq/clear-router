import { BindingOptions, BindToken, BindValue, Container } from './bindings'

import type { Request as CoreRequest } from './Request'
import type { Response as CoreResponse } from './Response'
import type { RouterConfig } from '../types/basic'

export type PluginSetupResult = void | Promise<void>

export interface ClearRouterPluginRequestContext<HttpContext = any> {
    ctx: HttpContext
    request: CoreRequest
    response: CoreResponse
    getBindings: () => Record<string, BindValue>,
    [key: string]: any
}

export interface ClearRouterPluginArgumentsContext<X = any> extends ClearRouterPluginRequestContext<X> {
    target?: object
    method?: PropertyKey
    handler?: object
    metadata?: object
    tokens: BindToken[]
    designTokens: BindToken[]
}

export type PluginBindFactory<
    T = any,
    X = any> = (ctx: ClearRouterPluginRequestContext<X>) => T | Promise<T>

export type PluginBindValue<T = any, X = any> = BindValue<T> | PluginBindFactory<T, X>
export type PluginBind<X = any> = <T>(
    token: BindToken<T>,
    value: PluginBindValue<T, X>,
    options?: BindingOptions
) => void

export type PluginArgumentsResolver<HttpContext = any> = (
    ctx: ClearRouterPluginArgumentsContext<HttpContext>
) => any[] | undefined | Promise<any[] | undefined>

export interface ClearRouterPluginContext<Options = any, HttpContext = any> {
    /**
     * The service container
     */
    container: Container
    /**
     * Register service container bindings
     */
    bind: PluginBind<HttpContext>
    /**
     * Replace all controller method arguments
     * @param resolver 
     * @returns 
     */
    resolveArguments: (resolver: PluginArgumentsResolver<HttpContext>) => void
    /**
     * Use the current http context
     */
    useHttpContext: (resolver: PluginArgumentsResolver<HttpContext>) => void
    /**
     * All registered service container bindings
     */
    bindings: Record<string, BindValue>,
    /**
     * Configures the router with the given options, such as method override settings
     * 
     * @param options 
     * @returns 
     */
    configure: (options: RouterConfig) => void
    /**
     * Default configuration used for everytime the router is reset
     * 
     * @param options 
     */
    configureDefaults: (options: RouterConfig) => void
    /**
     * The current Request instance
     */
    readonly request?: CoreRequest
    /**
     * The current Response instance
     * @returns 
     */
    readonly response?: CoreResponse
    /**
     * Get the current Request instance
     * @returns 
     */
    getRequest: () => CoreRequest | undefined
    /**
     * Get the current Response instance
     * @returns 
     */
    getResponse: () => CoreResponse | undefined
    /**
     * Plugin configuration options
     */
    options: Options
}

export interface ClearRouterPlugin<Options = any, HttpContext = any> {
    /**
     * The name of the plugin
     */
    name?: string
    /**
     * Plugin setup an implemnetation
     * 
     * @param ctx 
     * @returns 
     */
    setup: (ctx: ClearRouterPluginContext<Options, HttpContext>) => PluginSetupResult
}

export type ClearRouterPluginInput<Options = any, HttpContext = any> =
    | ClearRouterPlugin<Options, HttpContext>
    | ((ctx: ClearRouterPluginContext<Options, HttpContext>) => PluginSetupResult)

/**
 * Creates a new plugin
 * 
 * @param plugin 
 * @returns 
 */
export function definePlugin<Options = any, HttpContext = any> (
    plugin: ClearRouterPlugin<Options, HttpContext>
): ClearRouterPlugin<Options, HttpContext> {
    return plugin
}
