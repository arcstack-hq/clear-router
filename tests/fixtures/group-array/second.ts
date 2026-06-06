import Router from '../../../src/express/router'

Router.get('/second', () => ({ source: 'second-file' }))
