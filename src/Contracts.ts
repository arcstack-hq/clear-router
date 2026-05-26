/* eslint-disable @typescript-eslint/no-empty-object-type */

/**
 * HTTP context passed to route handlers
 */
export interface ClearHttpContext {
}

export interface RouteParameter {
    name: string
    field?: string
    optional: boolean
}