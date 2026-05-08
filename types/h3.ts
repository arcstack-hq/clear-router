import type { EventHandlerRequest, H3, H3Event, TypedServerRequest } from 'h3'

import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'
import type { ControllerHandler } from './basic'

export type H3App = Omit<H3, 'fetch'> & {
    fetch: (request: TypedServerRequest<EventHandlerRequest>) => Promise<Response>
}

export type MaybePromise<T = unknown> = T | Promise<T>;

export interface HttpRequest extends TypedServerRequest<EventHandlerRequest> {
    getBody: () => Record<string, any>;
};

type RequestlessH3Event = Omit<H3Event, 'req'>

/**
 * HTTP context passed to route handlers
 */
export interface HttpContext extends RequestlessH3Event {
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
export type { Middleware } from 'h3'
