import type { ClearHttpContext, ControllerHandler } from './basic'
import type { NextFunction, Request, Response } from 'express'

import { Request as CoreRequest } from 'src/core/Request'
import { Response as CoreResponse } from 'src/core/Response'

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
export type Middleware = (req: Request, res: Response, next: NextFunction) => any | Promise<any>;
