import Router from '../../src/express/router'
import express from 'express'

const app = express()
const router = express.Router()
const PORT = process.env.PORT || 3001

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const authMiddleware = (
    req: express.Request,
    res: express.Response, next: express.NextFunction
) => {
    const token = req.headers.authorization
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
}

Router.get('/', ({ res }: { res: express.Response }) => {
    res.json({
        message: 'ESM Example Server',
        version: '2.0.2',
        module: 'ESM'
    })
})

Router.group('/api', () => {
    Router.get('/hello', ({ res }: { res: express.Response }) => {
        res.json({ message: 'Hello from ESM!' })
    })

    Router.post('/echo', ({ req, res }: { req: express.Request, res: express.Response }) => {
        res.json({ echo: req.body })
    })

    Router.group('/users', () => {
        Router.get('/', ({ res }: { res: express.Response }) => {
            res.json({ users: ['Alice', 'Bob', 'Charlie'] })
        })

        Router.get('/:id', ({ req, res }: { req: express.Request, res: express.Response }) => {
            res.json({ id: req.params.id, name: 'User ' + req.params.id })
        })
    })
})

Router.middleware([authMiddleware], () => {
    Router.get('/protected', ({ res }: { res: express.Response }) => {
        res.json({ message: 'This is protected', access: 'granted' })
    })
})

class DataController {
    static async getData ({ res }: { res: express.Response }) {
        await new Promise(resolve => setTimeout(resolve, 100))
        res.json({
            data: [1, 2, 3, 4, 5],
            timestamp: new Date().toISOString()
        })
    }
}

Router.get('/data', [DataController, 'getData'])

Router.get('/routes', ({ res }: { res: express.Response }) => {
    const allRoutes = Router.allRoutes()
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    })
});

(() => {
    Router.apply(router)
    app.use(router)

    app.use((err: any, req: express.Request, res: express.Response) => {
        console.error('Error:', err.message)
        res.status(err.status || 500).json({
            error: err.message
        })
    })

    app.listen(PORT, () => {
        console.log(`ESM Server running at http://localhost:${PORT}`)
        console.log('\nAvailable routes:')
        Router.allRoutes().forEach(route => {
            console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`)
        })
    })
})()