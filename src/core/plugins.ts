import { BindToken, BindValue, Container } from './bindings'

import type { Request as CoreRequest } from './Request'
import type { Response as CoreResponse } from './Response'
import type { RouterConfig } from 'types/basic'

export type PluginSetupResult = void | Promise<void>

export interface ClearRouterPluginRequestContext {
    ctx: any
    request: CoreRequest
    response: CoreResponse
    [key: string]: any
}

export type PluginBindFactory<T = any> = (ctx: ClearRouterPluginRequestContext) => T | Promise<T>
export type PluginBindValue<T = any> = BindValue<T> | PluginBindFactory<T>
export type PluginBind = <T>(token: BindToken<T>, value: PluginBindValue<T>) => void

export interface ClearRouterPluginContext<Options = any> {
    container: typeof Container
    bind: PluginBind
    configure: (options: RouterConfig) => void
    configureDefaults: (options: RouterConfig) => void
    readonly request?: CoreRequest
    readonly response?: CoreResponse
    getRequest: () => CoreRequest | undefined
    getResponse: () => CoreResponse | undefined
    options: Options
}

export interface ClearRouterPlugin<Options = any> {
    name?: string
    setup: (ctx: ClearRouterPluginContext<Options>) => PluginSetupResult
}

export type ClearRouterPluginInput<Options = any> =
    | ClearRouterPlugin<Options>
    | ((ctx: ClearRouterPluginContext<Options>) => PluginSetupResult)

export function definePlugin<Options = any> (
    plugin: ClearRouterPlugin<Options>
): ClearRouterPlugin<Options> {
    return plugin
}
