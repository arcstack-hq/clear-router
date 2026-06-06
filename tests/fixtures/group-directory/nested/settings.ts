import Router from '../../../../src/express/router'

Router.get('/settings', () => ({ source: 'nested-directory' }))
