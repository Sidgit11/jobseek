#!/usr/bin/env node
/**
 * Extension build helper.
 *
 *   node scripts/ext-build.mjs dev   → swap in manifest.dev.json  (for unpacked dev loads)
 *   node scripts/ext-build.mjs prod  → swap in the prod manifest  (for Chrome Web Store zip)
 *   node scripts/ext-build.mjs zip   → package extension/ into extension-<version>.zip
 *                                      (assumes prod manifest is currently active)
 *
 * Dev vs prod differs in two ways:
 *   1. name: "Jobseek" vs "Jobseek (Dev) – ..."
 *   2. dev manifest has a `key` field that pins the extension ID. The prod
 *      manifest MUST NOT include `key` — Chrome Web Store assigns its own.
 *
 * The canonical manifest files live next to the extension:
 *   extension/manifest.json       ← active manifest (edited freely)
 *   extension/manifest.dev.json   ← dev template
 *   extension/manifest.prod.json  ← prod template
 *
 * Switching copies the chosen template over manifest.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, createWriteStream, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const EXT_DIR = join(ROOT, 'extension')
const MANIFEST = join(EXT_DIR, 'manifest.json')
const DEV_TPL = join(EXT_DIR, 'manifest.dev.json')
const PROD_TPL = join(EXT_DIR, 'manifest.prod.json')

const cmd = process.argv[2]

if (!cmd || !['dev', 'prod', 'zip'].includes(cmd)) {
  console.error('Usage: node scripts/ext-build.mjs <dev|prod|zip>')
  process.exit(1)
}

function swapManifest(sourcePath, label) {
  if (!existsSync(sourcePath)) {
    console.error(`Missing template: ${sourcePath}`)
    process.exit(1)
  }
  const content = readFileSync(sourcePath, 'utf8')
  writeFileSync(MANIFEST, content)
  const parsed = JSON.parse(content)
  console.log(`Swapped manifest → ${label}: "${parsed.name}" v${parsed.version}`)
  if (label === 'dev' && !parsed.key) {
    console.warn('WARNING: dev manifest has no `key` field — extension ID will change on every reload')
  }
  if (label === 'prod' && parsed.key) {
    console.error('ERROR: prod manifest must NOT contain a `key` field — Chrome Web Store rejects it')
    process.exit(1)
  }
}

function walk(dir, out = [], base = dir) {
  for (const entry of readdirSync(dir)) {
    // Exclude dev artifacts, templates, and test files — nothing the Web
    // Store needs, and shipping unused code is a review risk.
    if (entry === '.dev-key') continue
    if (entry === 'manifest.dev.json') continue
    if (entry === 'manifest.prod.json') continue
    if (entry === 'generate-icons.js') continue
    if (entry === '__tests__') continue
    if (entry === 'README.md') continue
    if (entry === '.DS_Store') continue
    const full = join(dir, entry)
    const rel = relative(base, full)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out, base)
    else out.push({ full, rel })
  }
  return out
}

async function zip() {
  // Sanity: ensure the live manifest is the prod one (no `key` field)
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  if (manifest.key) {
    console.error('ERROR: extension/manifest.json contains a `key` field — that is the dev manifest.')
    console.error('       Run `npm run ext:prod` first, then retry `npm run ext:zip`.')
    process.exit(1)
  }
  const version = manifest.version
  const distDir = join(ROOT, 'dist')
  if (!existsSync(distDir)) mkdirSync(distDir)
  const zipPath = join(distDir, `jobseek-extension-${version}.zip`)
  if (existsSync(zipPath)) rmSync(zipPath)

  // Use the system `zip` binary — avoids pulling in a JS zip dep.
  const files = walk(EXT_DIR).map(f => f.rel)
  const result = spawnSync('zip', ['-r', zipPath, ...files], { cwd: EXT_DIR, stdio: 'inherit' })
  if (result.status !== 0) {
    console.error('zip command failed')
    process.exit(result.status ?? 1)
  }
  console.log(`\nCreated: ${relative(ROOT, zipPath)}`)
  console.log(`Upload this to chrome.google.com/webstore/devconsole → Package → Upload new package`)
}

if (cmd === 'dev') swapManifest(DEV_TPL, 'dev')
else if (cmd === 'prod') swapManifest(PROD_TPL, 'prod')
else if (cmd === 'zip') await zip()
