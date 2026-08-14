import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const runtime = readFileSync(new URL('../public/studio-ident.js', import.meta.url), 'utf8')

test('approved SEO ident master remains locked', () => {
  assert.match(runtime, /SEO_IDENT_DURATION_MS\s*=\s*4430/)
  assert.match(runtime, /d8940b1f5ebe301157f3cb21872a7693a64d14d9b2c640e2995e6200481689ff/)
  assert.match(runtime, /animation:seo-mark-tail 4\.43s/)
})

test('ordinary launch plays; automation skips unless explicitly forced', () => {
  assert.match(runtime, /mode === "off"/)
  assert.match(runtime, /mode === "force"/)
  assert.match(runtime, /return !automated/)
  assert.match(runtime, /navigator\.webdriver/)
})

test('active ident owns input and cleans every listener on completion', () => {
  assert.match(runtime, /z-index:2147483647/)
  assert.match(runtime, /stopImmediatePropagation/)
  for (const event of ['keydown', 'pointerdown', 'touchstart']) {
    assert.match(runtime, new RegExp(`addEventListener\\("${event}"`))
    assert.match(runtime, new RegExp(`removeEventListener\\("${event}"`))
  }
  assert.match(runtime, /overlay\.remove\(\)/)
  assert.match(runtime, /style\.remove\(\)/)
})
