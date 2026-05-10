/**
 * Controller method reference
 */
export type ControllerHandler = [any, string];

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/**
 * Common controller action names
 */
export type ControllerAction = 'index' | 'show' | 'create' | 'update' | 'destroy';

/**
 * Generic Object type for request data
 */
export type RequestData = Record<string, any>;

export type ApiResourceMiddleware<M = any> =
    | M
    | M[]
    | { [K in ControllerAction]?: M | M[] }


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
