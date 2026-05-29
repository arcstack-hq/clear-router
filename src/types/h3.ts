import type { EventHandlerRequest, H3, H3Event, Middleware as H3Middleware, TypedServerRequest } from 'h3'

import type { ClearHttpContext } from '../Contracts'
import type { ClassMiddleware, ControllerHandler } from './basic'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'

export type H3App = Omit<H3, 'fetch'> & {
    fetch: (request: TypedServerRequest<EventHandlerRequest>) => Promise<Response>
}

export type MaybePromise<T = unknown> = T | Promise<T>;

export interface HttpRequest extends TypedServerRequest<EventHandlerRequest> {
    getBody: () => Record<string, any>;
};

/**
 * HTTP context passed to route handlers
 */
export interface HttpContext extends Omit<H3Event, 'req'>, ClearHttpContext {
    req: HttpRequest
    clearRequest: CoreRequest
    clearResponse: CoreResponse
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
    req: CoreRequest
) => any | Promise<any>;

/**
 * Handler can be either a function or controller reference
 */
export type Handler = RouteHandler | ControllerHandler;

export type NextFunction = () => MaybePromise<unknown | undefined>;

/**
 * Middleware function type
 */
export type MiddlewareFunction = H3Middleware

export type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>
