import Router from '../../../src/express/router'

Router.get('/profile', () => ({ source: 'directory' }))
