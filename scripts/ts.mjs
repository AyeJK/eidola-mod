// Lets a script import the hooks' pure TypeScript modules (validate.ts,
// check-plugin.ts) as Node runs them: type stripping (Node 22.18 or later)
// reads the .ts file as it is, and this resolves the extensionless relative
// imports the engine's bundler takes (`from './engram-types'`) to the .ts
// file beside it. Only modules with no JSX and nothing from 'claude-code'
// can be imported this way.

import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Node warns that a .ts file's module type is unset; it is ESM, and says so by its syntax.
process.removeAllListeners('warning')

/** The mod's folder. */
export const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let isHooked = false

/** Imports `path` (from the mod's folder), a .ts module, with its relative imports resolved as the bundler does. */
export async function importTs(path) {
  if (!isHooked) {
    isHooked = true
    registerHooks({
      resolve(specifier, context, next) {
        if (/^\.\.?\//.test(specifier) && !/\.[cm]?[jt]sx?$/.test(specifier) && context.parentURL?.startsWith('file:')) {
          for (const ext of ['.ts', '/index.ts']) {
            const url = new URL(specifier + ext, context.parentURL)
            if (existsSync(fileURLToPath(url))) {
              return next(url.href, context)
            }
          }
        }
        return next(specifier, context)
      },
    })
  }
  return import(pathToFileURL(join(root, path)).href)
}
