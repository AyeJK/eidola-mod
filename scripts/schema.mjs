// Writes docs/spec/engram.schema.json from hooks/engram-schema.ts, the schema
// hooks/validate.test.ts holds to the validator. Node reads the .ts file as it
// is (type stripping, Node 22.18 or later).
//
//   node scripts/schema.mjs          write it
//   node scripts/schema.mjs --check  only check the file matches

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Node warns that the .ts file's module type is unset; it is ESM, and says so by its syntax.
process.removeAllListeners('warning')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'docs', 'spec', 'engram.schema.json')

const { ENGRAM_SCHEMA } = await import(pathToFileURL(join(root, 'hooks', 'engram-schema.ts')).href)
const text = `${JSON.stringify(ENGRAM_SCHEMA, null, 2)}\n`

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(out, 'utf8')
  } catch {
    // Missing reads as out of date.
  }
  if (current.replace(/\r\n/g, '\n') !== text) {
    console.error('docs/spec/engram.schema.json is out of date: run node scripts/schema.mjs')
    process.exit(1)
  }
  console.log('ok: docs/spec/engram.schema.json')
} else {
  writeFileSync(out, text)
  console.log('wrote docs/spec/engram.schema.json')
}
