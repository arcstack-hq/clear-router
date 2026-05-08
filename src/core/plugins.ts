import { BindToken, BindValue, Container } from './bindings'
import type { RouterConfig } from 'types/basic'

export type PluginSetupResult = void

export type PluginBind = <T>(token: BindToken<T>, value: BindValue<T>) => void

export interface ClearRouterPluginContext<Options = any> {
    container: typeof Container
    bind: PluginBind
    configure: (options: RouterConfig) => void
    configureDefaults: (options: RouterConfig) => void
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
