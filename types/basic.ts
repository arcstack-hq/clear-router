/**
 * Controller method reference
 */
export type ControllerHandler = [any, string];

/**
 * HTTP methods supported by the router
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/**
 * Route information object
 */
export interface RouteInfo {
    methods: HttpMethod[];
    path: string;
    middlewareCount: number;
    handlerType: 'function' | 'controller';
}

/**
 * Common controller action names
 */
export type ControllerAction = 'index' | 'show' | 'create' | 'update' | 'destroy';

/**
 * Generic Object type for request data
 */
export type RequestData = Record<string, any>;