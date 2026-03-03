import { NextFunction, Request, Response } from 'express'

import Route from '../../src/express/router'

function pickRequestFields (req: Request) {
    return {
        baseUrl: req.baseUrl,
        body: req.body,
        hostname: req.hostname,
        ip: req.ip,
        method: req.method,
        originalUrl: req.originalUrl,
        params: req.params,
        path: req.path,
        query: req.query
    }
}

export class Middleware {
    static unprotected (req: Request, res: Response, next: NextFunction) {
        next()
    }

    static protected (req: Request, res: Response, next: NextFunction) {
        const id = req.query.id
        if (!id || id !== '12345678') {
            return res.status(403).json({
                status: false,
                code: 403,
                message: 'Forbidden',
            })
        }
        next()
    }
}

const ThisObject = {
    index ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object',
            request: pickRequestFields(req),
        })
    },
    protected ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with object + protected middleware',
            request: pickRequestFields(req),
        })
    },
}

class ThisInstanceClass {
    index ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class',
            request: pickRequestFields(req),
        })
    }

    protected ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with instance class + protected middleware',
            request: pickRequestFields(req),
        })
    }
}

class ThisStaticClass {
    static index ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class',
            request: pickRequestFields(req),
        })
    }

    static protected ({ req, res }: { req: Request, res: Response }) {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with static class + protected middleware',
            request: pickRequestFields(req),
        })
    }
}

Route.middleware([Middleware.unprotected], () => {
    Route.get('directly', ({ req, res }: { req: Request, res: Response }) => {
        return res.status(200).json({
            status: true,
            code: 200,
            message: 'Route handler with directly function',
            request: pickRequestFields(req),
        })
    })

    Route.get('object', ThisObject.index)
    Route.get('instance', [ThisInstanceClass, 'index'])
    Route.get('static', ThisStaticClass.index)
})

Route.middleware([Middleware.protected], () => {
    Route.group('protected', () => {
        Route.get('directly', ({ req, res }: { req: Request, res: Response }) => {
            return res.status(200).json({
                status: true,
                code: 200,
                message: 'Route handler with directly function + protected middleware',
                request: pickRequestFields(req),
            })
        })

        Route.get('object', ThisObject.protected)
        Route.get('instance', [ThisInstanceClass, 'protected'])
        Route.get('static', ThisStaticClass.protected)
    })
})

Route.get('routes-info', ({ res }: { res: Response }) => {
    const allRoutes = Route.allRoutes()
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    })
})

export const Routes = Route
export default Routes
