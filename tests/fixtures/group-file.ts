import Router from '../../src/express/router'

Router.get('/loaded-file', () => ({ source: 'file' }))
