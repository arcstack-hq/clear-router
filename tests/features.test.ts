import { beforeEach, describe, expect, it } from 'vitest'
import express, { Router as ExRouter } from 'express'

import { Route } from '../src/Route'
import Router from '../src/express/router'
import request from 'parasito'

describe('Routing features (Express)', () => {
    let app: express.Application
    let router: ExRouter

    beforeEach(() => {
        Router.configure({ container: { enabled: false, autoDiscover: false } })
        Router.reset()

        app = express()
        router = ExRouter()
        app.use(express.json())
    })

    const setupApp = (): void => {
        Router.apply(router)
        app.use(router)
    }

    describe('current route accessors', () => {
        class UserController {
            show ({ res }: any) {
                return res.json({
                    name: Router.currentRouteName(),
                    action: Router.currentRouteAction(),
                    facadeName: Route.currentRouteName(),
                    facadeAction: Route.currentRouteAction(),
                    isRoute: Route.current() instanceof Route,
                })
            }
        }

        it('exposes the current route, name and action for controller routes', async () => {
            Router.get('/users/{id}', [UserController, 'show']).name('users.show')
            setupApp()

            const res = await request(app).get('/users/7')

            expect(res.body).toEqual({
                name: 'users.show',
                action: 'UserController@show',
                facadeName: 'users.show',
                facadeAction: 'UserController@show',
                isRoute: true,
            })
        })

        it('reports Closure as the action for callback routes', async () => {
            Router.get('/ping', ({ res }) => res.json({ action: Route.currentRouteAction() })).name('ping')
            setupApp()

            const res = await request(app).get('/ping')

            expect(res.body).toEqual({ action: 'Closure' })
        })

        it('returns empty/undefined outside of a request', () => {
            expect(Router.current()).toBeUndefined()
            expect(Router.currentRouteName()).toBe('')
            expect(Router.currentRouteAction()).toBe('')
        })
    })

    describe('domain routing', () => {
        it('matches a host pattern and injects the captured parameter', async () => {
            Router.domain('{account}.example.com').group(() => {
                Router.get('/dashboard', ({ req, res }) => res.json({ account: req.params.account })).name('dashboard')
            })
            setupApp()

            const ok = await request(app).get('/dashboard').set('Host', 'acme.example.com')
            expect(ok.statusCode).toBe(200)
            expect(ok.body).toEqual({ account: 'acme' })
        })

        it('does not match a request on a different host', async () => {
            Router.domain('{account}.example.com').group(() => {
                Router.get('/dashboard', ({ res }) => res.send('ok'))
            })
            setupApp()

            const res = await request(app).get('/dashboard').set('Host', 'acme.other.com')
            expect(res.statusCode).toBe(404)
        })

        it('supports a per-route domain and absolute url generation', async () => {
            const route = Router.get('/team', ({ req, res }) => res.json({ account: req.params.account }))
                .domain('{account}.example.com')
                .name('team')
            setupApp()

            const res = await request(app).get('/team').set('Host', 'acme.example.com')
            expect(res.body).toEqual({ account: 'acme' })
            expect(route.domainPattern).toBe('{account}.example.com')
            expect(Router.url('team', { account: 'acme' })).toBe('//acme.example.com/team')
        })
    })

    describe('parameter constraints', () => {
        it('rejects values that do not satisfy whereNumber', async () => {
            Router.get('/users/{id}', ({ req, res }) => res.json({ id: req.params.id }))
                .whereNumber('id')
                .name('users.show')
            setupApp()

            expect((await request(app).get('/users/42')).body).toEqual({ id: '42' })
            expect((await request(app).get('/users/abc')).statusCode).toBe(404)
        })

        it('supports where with an explicit pattern and whereIn', async () => {
            Router.get('/posts/{slug}', ({ req, res }) => res.json({ slug: req.params.slug }))
                .where('slug', '[a-z-]+')
            Router.get('/category/{name}', ({ req, res }) => res.json({ name: req.params.name }))
                .whereIn('name', ['movie', 'song'])
            setupApp()

            expect((await request(app).get('/posts/hello-world')).statusCode).toBe(200)
            expect((await request(app).get('/posts/Hello123')).statusCode).toBe(404)
            expect((await request(app).get('/category/movie')).statusCode).toBe(200)
            expect((await request(app).get('/category/book')).statusCode).toBe(404)
        })

        it('honours a global Router.pattern', async () => {
            Router.pattern('id', '[0-9]+')
            Router.get('/orders/{id}', ({ req, res }) => res.json({ id: req.params.id }))
            setupApp()

            expect((await request(app).get('/orders/9')).statusCode).toBe(200)
            expect((await request(app).get('/orders/nine')).statusCode).toBe(404)
        })
    })

    describe('encoded forward slashes', () => {
        it('allows a parameter constrained with .* to span multiple segments', async () => {
            Router.get('/search/{search}', ({ req, res }) => res.json({ search: req.params.search }))
                .where('search', '.*')
                .name('search')
            setupApp()

            const res = await request(app).get('/search/foo/bar/baz')
            expect(res.statusCode).toBe(200)
            expect(res.body).toEqual({ search: 'foo/bar/baz' })
        })
    })
})
