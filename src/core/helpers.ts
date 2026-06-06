import { JitiOptions, JitiResolveOptions, createJiti } from 'jiti'

import { FileImporter } from 'src/types'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

export const wrap = <T> (value: T | T[] | null | undefined): T[] => {
    if (value === null || value === void 0) return []

    return Array.isArray(value) ? value : [value]
}


/**
* 
* Dynamically imports a file at the given path with full TypeScript support,
* including `tsconfig.json` path aliases. 
*
* @param filePath - The path to the file to import. 
* @returns The imported module typed as `T`.
*
* @example
* const config = await importFile<AppConfig>('./config/app.ts')
*/
export const importFile: FileImporter = async (
    filePath: string,
    userOptions?: JitiOptions | undefined,
    resolveOptions?: (JitiResolveOptions & { default?: true; })
) => {
    const resolvedPath = resolve(filePath)

    return await createJiti(pathToFileURL(resolvedPath).href, {
        ...userOptions,
        interopDefault: false,
        tsconfigPaths: true
    }).import(resolvedPath, resolveOptions)
}