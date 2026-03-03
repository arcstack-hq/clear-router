import express, { Router as ExRouter, NextFunction, Request, Response } from 'express'

import { HttpContext } from 'types/express'
import Router from 'clear-router/express/router'

const app = express()
const router: ExRouter = ExRouter()
const PORT: number = parseInt(process.env.PORT || '3002', 10)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

interface User {
    id: number;
    name: string;
    email: string;
}

const users: User[] = [
    { id: 1, name: 'Alice', email: 'alice@example.com' },
    { id: 2, name: 'Bob', email: 'bob@example.com' }
]

const logMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
    next()
}

const validateId = (req: Request, res: Response, next: NextFunction): void => {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid ID' })

        return
    }
    next()
}

class UserController {
    index ({ res }: HttpContext): void {
        res.json(users)
    }
    show ({ req, res }: HttpContext): void {
        const id = parseInt(req.params.id, 10)
        const user = users.find(u => u.id === id)
        res.json({ user })
    }
    create ({ req, res }: HttpContext): void {
        const newUser: User = {
            id: users.length + 1,
            name: req.body.name,
            email: req.body.email
        }
        users.push(newUser)
        res.status(201).json({ user: newUser })
    }
    update ({ req, res }: HttpContext): void {
        const id = parseInt(req.params.id, 10)
        const user = users.find(u => u.id === id)
        if (!user) {
            res.status(404).json({ error: 'User not found' })

            return
        }
        user.name = req.body.name || user.name
        user.email = req.body.email || user.email
        res.status(202).json({ user })
    }
    destroy ({ req, res }: HttpContext): void {
        const id = parseInt(req.params.id, 10)
        const index = users.findIndex(u => u.id === id)
        if (index === -1) {
            res.status(404).json({ error: 'User not found' })

            return
        }
        users.splice(index, 1)
        res.status(202).send()
    }
}

Router.apiResource('/all/users', UserController)

Router.middleware([logMiddleware], () => {
    Router.get('/', ({ res }): void => {
        res.json({
            message: 'TypeScript Example Server',
            version: '2.0.2',
            language: 'TypeScript'
        })
    })

    Router.group('/api', () => {
        Router.get('/users', ({ res }): void => {
            res.json({ users })
        })

        Router.get('/users/:id', ({ req, res }): void => {
            const id = parseInt(req.params.id, 10)
            const user = users.find(u => u.id === id)

            if (!user) {
                res.status(404).json({ error: 'User not found' })

                return
            }

            res.json({ user })
        }, [validateId])

        Router.post('/users', ({ req, res }): void => {
            const newUser: User = {
                id: users.length + 1,
                name: req.body.name,
                email: req.body.email
            }
            users.push(newUser)
            res.status(201).json({ user: newUser })
        })
    })
})

class StatsController {
    static getStats ({ res }: HttpContext): void {
        res.json({
            totalUsers: users.length,
            totalRoutes: Router.allRoutes().length,
            timestamp: new Date().toISOString()
        })
    }

    static async getAsyncStats ({ res }: HttpContext): Promise<void> {
        await new Promise<void>(resolve => setTimeout(resolve, 100))

        res.json({
            status: 'processed',
            users: users.length,
            routes: Router.allRoutes().length
        })
    }
}

Router.get('/stats', [StatsController, 'getStats'])
Router.get('/stats/async', [StatsController, 'getAsyncStats'])

Router.get('/routes', ({ res }: HttpContext): void => {
    const allRoutes = Router.allRoutes()
    res.json({
        total: allRoutes.length,
        routes: allRoutes
    })
});

(() => {
    Router.apply(router)
    app.use(router)

    app.use((err: Error, req: Request, res: Response) => {
        console.error('Error:', err.message)
        res.status(500).json({
            error: err.message
        })
    })

    app.listen(PORT, () => {
        console.log(`TypeScript Server running at http://localhost:${PORT}`)
        console.log('\nAvailable routes:')
        Router.allRoutes().forEach(route => {
            console.log(`  ${route.methods.join(', ').toUpperCase()} ${route.path}`)
        })
    })
})()
