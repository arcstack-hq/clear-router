import 'reflect-metadata'

import { CoreRouter } from '../core/CoreRouter'

CoreRouter.configureDefaults({
    container: {
        enabled: true,
        autoDiscover: true,
    },
})

export * from './index'
