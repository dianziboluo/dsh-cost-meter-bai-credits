#!/usr/bin/env node
/**
 * apply-bai-credits.mjs — apply the B.AI Credits balance preset to dsh-cost-meter.
 *
 * Executes the procedure described by `apply.steps` in bai-credits-balance.preset.json: insert (or
 * update) the chosen variant's entry under the array named by `apply.pointer` in the ledger, back the
 * file up first and write atomically.
 *
 * Portable: no personal paths, no dependencies, no API key handling. The shipped entry keeps its
 * `{{VAR}}` placeholder — store the real key through the plugin's Credential input.
 *
 * Usage:
 *   node apply-bai-credits.mjs                          # native Credits variant (default)
 *   node apply-bai-credits.mjs --variant usdEquivalent  # optional derived USD variant
 *   node apply-bai-credits.mjs --dry-run                # show what would change, write nothing
 *   node apply-bai-credits.mjs --preset ./bai-credits-balance.preset.json
 *   node apply-bai-credits.mjs --print-paths            # show absolute paths (default: <DSH_HOME>/...)
 *
 * DSH_HOME resolution: $DSH_HOME, else ~/.dsh  (Windows: %USERPROFILE%\.dsh)
 */
import { copyFileSync, existsSync, readFileSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = name => args.includes(`--${name}`)
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[i + 1] : fallback
}
const fail = message => { console.error(`error: ${message}`); process.exit(1) }

const dryRun = flag('dry-run')
const printPaths = flag('print-paths')
const presetPath = resolve(value('preset', join(HERE, 'bai-credits-balance.preset.json')))
if (!existsSync(presetPath)) fail(`preset not found: ${printPaths ? presetPath : 'bai-credits-balance.preset.json'} (use --preset <path>)`)

const preset = JSON.parse(readFileSync(presetPath, 'utf8'))
const variantName = value('variant', preset.defaultVariant)
const variant = preset.variants?.[variantName]
if (!variant?.entry) fail(`unknown variant "${variantName}"; available: ${Object.keys(preset.variants ?? {}).join(', ')}`)

const apply = preset.apply ?? {}
if ((apply.pathBase ?? 'DSH_HOME') !== 'DSH_HOME') fail(`apply.pathBase "${apply.pathBase}" is not supported; only DSH_HOME-rooted paths are`)
const envHome = process.env.DSH_HOME?.trim()
const dshHome = envHome || join(homedir(), '.dsh')
const showPath = absolute => printPaths ? absolute : `<DSH_HOME>/${apply.path ?? 'storages/cost-meter/ledger.json'}`
const ledgerPath = join(dshHome, apply.path ?? 'storages/cost-meter/ledger.json')
const maxEntries = Number(apply.maxEntries) || 8

// The pointer carries the append token ("-"); everything before it names the target array.
const segments = String(apply.pointer ?? '/config/customBalances/-').split('/').filter(Boolean)
if (segments.at(-1) !== '-' || segments.length < 2) fail(`apply.pointer must be an append-style JSON Pointer ending in "/-", got "${apply.pointer}"`)
const arrayPath = segments.slice(0, -1)

console.log(`preset     : ${printPaths ? presetPath : 'bai-credits-balance.preset.json'}`)
console.log(`dsh home   : ${printPaths ? dshHome : '<DSH_HOME>'}  (${envHome ? 'from $DSH_HOME' : 'default ~/.dsh'})`)
console.log(`ledger     : ${showPath(ledgerPath)}`)
console.log(`variant    : ${variantName}  (${variant.label?.en ?? ''})`)
console.log(`array      : /${arrayPath.join('/')}`)
console.log(`dry run    : ${dryRun}`)
if (envHome) {
  console.log('note       : $DSH_HOME is set in this environment, so this targets THAT home.')
  console.log('             Override DSH_HOME to act on a different install (e.g. a test home).')
}

if (!existsSync(ledgerPath)) fail(`ledger not found — is dsh-cost-meter installed for this DSH_HOME? (${showPath(ledgerPath)})`)

const state = JSON.parse(readFileSync(ledgerPath, 'utf8'))
if (state.version !== 1) fail(`unsupported ledger version: ${String(state.version)}`)

let holder = state
for (const segment of arrayPath.slice(0, -1)) {
  holder[segment] ??= {}
  holder = holder[segment]
  if (holder === null || typeof holder !== 'object') fail(`/${arrayPath.join('/')} is not an object in this ledger`)
}
const arrayKey = arrayPath.at(-1)
holder[arrayKey] ??= []
if (!Array.isArray(holder[arrayKey])) fail(`/${arrayPath.join('/')} is not an array in this ledger`)
const list = holder[arrayKey]

// Identity: exact, case-insensitive match on the declared fields (URL trailing slash ignored).
const at = (object, path) => path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), object)
const normalize = raw => String(raw ?? '').trim().toLowerCase().replace(/\/+$/, '')
const identityFields = apply.identityFields ?? ['request.url']
const identityOf = entry => identityFields.map(field => normalize(at(entry, field))).join('\u0000')

const entry = structuredClone(variant.entry)
const wanted = identityOf(entry)
const hit = list.findIndex(existing => identityOf(existing) === wanted)

// Never silently re-bind a working credential: carry the existing placeholder over.
const preserved = []
if (hit >= 0 && apply.preserveCredentialBinding !== false) {
  const previous = list[hit]?.request?.headers ?? {}
  entry.request ??= {}
  entry.request.headers ??= {}
  for (const [name, previousValue] of Object.entries(previous)) {
    if (!/authorization|api[-_]?key|token|secret|cookie/i.test(name)) continue
    const next = entry.request.headers[name]
    if (typeof previousValue === 'string' && previousValue.includes('{{') && previousValue !== next) {
      entry.request.headers[name] = previousValue
      preserved.push(name)
    }
  }
}

if (hit >= 0) {
  console.log(`\nexisting entry matched at /${arrayPath.join('/')}/${hit} — updating it in place`)
  if (preserved.length > 0) console.log(`kept the existing credential binding for: ${preserved.join(', ')}`)
  list[hit] = entry
} else {
  if (list.length >= maxEntries) fail(`/${arrayPath.join('/')} already holds ${list.length} entries (plugin limit ${maxEntries}); remove one first.`)
  list.push(entry)
  console.log(`\nappending new entry as /${arrayPath.join('/')}/${list.length - 1}`)
}

// Header values are only ever shown as placeholders; anything else is masked.
const KEYED_HEADER = /^(authorization|api[-_]?key|x-api-key|token|secret|cookie)$/i
const printable = JSON.parse(JSON.stringify(entry, (key, node) =>
  typeof node === 'string' && KEYED_HEADER.test(key) && !node.includes('{{') ? '<redacted: use the Credential input>' : node))

const placeholders = [...new Set([...JSON.stringify(entry).matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)].map(m => m[1]))]

// Report whether each required placeholder already resolves (credential store refs, then environment).
const required = [...new Set([...(apply.requiresCredential ?? []), ...placeholders])]
const storeNames = new Set()
try {
  const store = readFileSync(join(dshHome, '.credentials.yaml'), 'utf8')
  for (const match of store.matchAll(/^\s{2,}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)) storeNames.add(match[1])
} catch { /* no credential store yet — the environment fallback below still applies. */ }

if (dryRun) {
  console.log('\n--- would write this entry ---')
  console.log(JSON.stringify(printable, null, 2))
  console.log(`\ncredential check (dry run): ${required.length === 0 ? 'no placeholders' :
    required.map(name => `${name}: ${storeNames.has(name) ? 'in credential store' : process.env[name] ? 'in environment' : 'NOT FOUND'}`).join(', ')}`)
  console.log('(dry run: nothing was written)')
  process.exit(0)
}

const backup = `${ledgerPath}.bak-bai-credits-${new Date().toISOString().replace(/[:.]/g, '-')}`
copyFileSync(ledgerPath, backup)
console.log(`backup     : ${printPaths ? backup : `<DSH_HOME>/${apply.path}.bak-bai-credits-<timestamp>`}`)

mkdirSync(dirname(ledgerPath), { recursive: true })
const temp = `${ledgerPath}.${process.pid}-${randomUUID()}.tmp`
try {
  writeFileSync(temp, JSON.stringify(state), { encoding: 'utf8', flag: 'wx' })
  renameSync(temp, ledgerPath)
} finally {
  try { unlinkSync(temp) } catch (error) { if (error.code !== 'ENOENT') throw error }
}

console.log('\n--- written entry ---')
console.log(JSON.stringify(printable, null, 2))

console.log('\nNext steps:')
for (const name of required) {
  const where = storeNames.has(name) ? 'already in the DSH credential store' : process.env[name] ? 'already in the environment' : 'NOT configured yet'
  console.log(`  · credential ${name}: ${where}`)
}
console.log('    If it is missing, open Settings -> Cost -> Quota -> Custom provider balance, expand the')
console.log('    entry and use the Credential input box (write-only; stored in the DSH credential store).')
console.log('  · nothing to restart: the plugin merges the on-disk config on its next write')
console.log('    (any model call triggers one; if the card never appears, restart DSH).')
console.log('  · refresh the browser page; the card refreshes every 15 minutes or on click.')
