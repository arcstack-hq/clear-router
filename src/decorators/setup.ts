import 'reflect-metadata'

import { CoreRouter } from '../core/router'

CoreRouter.configureDefaults({
    container: {
        enabled: true,
        autoDiscover: true,
    },
})

export * from './index'
