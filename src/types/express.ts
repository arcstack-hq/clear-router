import type { NextFunction, Request, Response } from 'express'

import type { ClearHttpContext } from '../Contracts'
import type { ClassMiddleware, ControllerHandler, MiddlewareHandle } from './basic'
import type { Request as CoreRequest } from '../core/Request'
import type { Response as CoreResponse } from '../core/Response'

export interface RequestWithGetBody extends Request {
    getBody: () => Record<string, any>
}

/**
 * HTTP context passed to route handlers
 */
export interface HttpContext extends ClearHttpContext {
    req: RequestWithGetBody;
    res: Response;
    next: NextFunction;
    clearRequest: CoreRequest;
    clearResponse: CoreResponse;
}

/**
 * Route handler function type
 */
export type RouteHandler = (
    /**
     * Express context object containing req, res, and next
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

/**
 * Middleware function type
 */
export type MiddlewareFunction = MiddlewareHandle<[Request, Response, NextFunction]>

/**
 * Middleware class or instance with a framework-aware handle method.
 */
export type Middleware = MiddlewareFunction | ClassMiddleware<MiddlewareFunction>;
