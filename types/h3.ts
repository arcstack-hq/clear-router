import type { H3, H3Event, TypedServerRequest } from 'h3'

import { ClearRequest } from 'src/ClearRequest'
import type { ControllerHandler } from './basic'

export type H3App = Omit<H3['fetch'], 'fetch'> & { fetch: (request: TypedServerRequest) => Promise<Response> }

export type MaybePromise<T = unknown> = T | Promise<T>;

export type HttpRequest = H3Event['req'] & {
    getBody: () => Record<string, any>
}

/**
 * HTTP context passed to route handlers
 */
export type HttpContext = Omit<H3Event, 'req'> & {
    req: HttpRequest
}

/**
 * Route handler function type
 */
export type RouteHandler = (
    /**
     * H3 event context
     */
    ctx: HttpContext,
    /**
     * ClearRequest instance
     */
    req: ClearRequest
) => any | Promise<any>;

/**
 * Handler can be either a function or controller reference
 */
export type Handler = RouteHandler | ControllerHandler;

export type NextFunction = () => MaybePromise<unknown | undefined>;

/**
 * Middleware function type
 */
export type { Middleware } from 'h3'