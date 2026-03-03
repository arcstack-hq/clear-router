import { H3Event, getQuery, getRouterParams } from 'h3'

import { NextFunction } from 'types/h3'
import Route from '../../src/h3/router'

function pickRequestFields (evt: H3Event) {
    return {
        baseUrl: evt,
        body: evt.req.text(),
        hostname: evt.url.hostname,
        ip: evt.req.ip,
        method: evt.req.method,
        originalUrl: evt.req.url,
        params: getRouterParams(evt),
        path: evt.url.pathname,
        query: getQuery(evt)
    }
}

export class Middleware {
    static unprotected (event: H3Event, next: NextFunction) {
        next()
    }

    static protected (evt: H3Event, next: NextFunction) {
        const id = getQuery(evt).id
        if (!id || id !== '12345678') {
            return {
                status: false,
                code: 403,
                message: 'Forbidden',
            }
        }
        next()
    }
}

const ThisObject = {
    index (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with object',
            request: pickRequestFields(evt),
        }
    },
    protected (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with object + protected middleware',
            request: pickRequestFields(evt),
        }
    },
}

class ThisInstanceClass {
    index (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with instance class',
            request: pickRequestFields(evt),
        }
    }

    protected (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with instance class + protected middleware',
            request: pickRequestFields(evt),
        }
    }
}

class ThisStaticClass {
    static index (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with static class',
            request: pickRequestFields(evt),
        }
    }

    static protected (evt: H3Event) {
        return {
            status: true,
            code: 200,
            message: 'Route handler with static class + protected middleware',
            request: pickRequestFields(evt),
        }
    }
}

Route.middleware([Middleware.unprotected], () => {
    Route.get('directly', (evt: H3Event) => {
        return {
            status: true,
            code: 200,
            message: 'Route handler with directly function',
            request: pickRequestFields(evt),
        }
    })

    Route.get('object', ThisObject.index)
    Route.get('instance', [ThisInstanceClass, 'index'])
    Route.get('static', ThisStaticClass.index)
})

Route.middleware([Middleware.protected], () => {
    Route.group('protected', () => {
        Route.get('directly', (evt: H3Event) => {
            return {
                status: true,
                code: 200,
                message: 'Route handler with directly function + protected middleware',
                request: pickRequestFields(evt),
            }
        })

        Route.get('object', ThisObject.protected)
        Route.get('instance', [ThisInstanceClass, 'protected'])
        Route.get('static', ThisStaticClass.protected)
    })
})

Route.get('routes-info', () => {
    const allRoutes = Route.allRoutes()
    
return {
        total: allRoutes.length,
        routes: allRoutes
    }
})

export const Routes = Route
export default Routes
