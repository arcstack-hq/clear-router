import { BindToken, BindValue, Container } from './bindings'

import type { Request as CoreRequest } from './Request'
import type { Response as CoreResponse } from './Response'
import type { RouterConfig } from 'types/basic'

export type PluginSetupResult = void | Promise<void>

export interface ClearRouterPluginRequestContext {
    ctx: any
    request: CoreRequest
    response: CoreResponse
    getBindings: () => Record<string, BindValue>,
    [key: string]: any
}

export interface ClearRouterPluginArgumentsContext extends ClearRouterPluginRequestContext {
    target?: object
    method?: PropertyKey
    handler?: object
    metadata?: object
    tokens: BindToken[]
    designTokens: BindToken[]
}

export type PluginBindFactory<T = any> = (ctx: ClearRouterPluginRequestContext) => T | Promise<T>
export type PluginBindValue<T = any> = BindValue<T> | PluginBindFactory<T>
export type PluginBind = <T>(token: BindToken<T>, value: PluginBindValue<T>) => void
export type PluginArgumentsResolver = (
    ctx: ClearRouterPluginArgumentsContext
) => any[] | undefined | Promise<any[] | undefined>

export interface ClearRouterPluginContext<Options = any, _HttpContext = any> {
    /**
     * The service container
     */
    container: typeof Container
    /**
     * Register service container bindings
     */
    bind: PluginBind
    /**
     * Replace all controller method arguments
     * @param resolver 
     * @returns 
     */
    resolveArguments: (resolver: PluginArgumentsResolver) => void
    /**
     * Use the current http context
     */
    useHttpContext: (resolver: PluginArgumentsResolver) => void
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
    | ClearRouterPlugin<Options>
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
