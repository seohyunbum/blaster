import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { PERFORMANCE_BUDGETS } from '../src/game/budgets.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const port = 4175
const url = `http://127.0.0.1:${port}`
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js')
const serverLog = []

const server = spawn(
  process.execPath,
  [viteBin, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
)
server.stdout.on('data', (chunk) => serverLog.push(String(chunk)))
server.stderr.on('data', (chunk) => serverLog.push(String(chunk)))

let browser
try {
  await waitForServer(url, server)
  browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' && !process.env.CI ? { channel: 'msedge' } : {}),
  })
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const location = message.location().url
      browserErrors.push(`console: ${message.text()}${location ? ` (${location})` : ''}`)
    }
  })

  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__blasterLab))
  await page.evaluate(() => window.__blasterLab?.step(3))

  assert.equal(await page.title(), '블래스터 공방')
  assert.match(await page.locator('#build-badge').innerText(), /버전 \d+/)
  await assertRenderedCanvas(page)
  const finishDelta = await assertFinishDifference(page)

  const workshop = await page.evaluate(() => ({
    info: window.__blasterLab?.rendererInfo(),
    state: window.__blasterLab?.state(),
  }))
  assert.ok(workshop.info)
  assert.ok(workshop.state)
  assert.equal(workshop.state.station, 'workshop')
  assert.equal(workshop.state.editVisible, true)
  assert.ok(
    workshop.info.calls <= PERFORMANCE_BUDGETS.maxSceneDrawCalls,
    `workshop draw calls ${workshop.info.calls} > ${PERFORMANCE_BUDGETS.maxSceneDrawCalls}`,
  )
  assert.ok(
    workshop.info.visibleMeshes <= PERFORMANCE_BUDGETS.maxVisibleMeshes,
    `workshop visible meshes ${workshop.info.visibleMeshes} > ${PERFORMANCE_BUDGETS.maxVisibleMeshes}`,
  )

  const baselineGeometries = workshop.info.geometries
  for (let i = 0; i < 12; i++) {
    await page.evaluate((t) => {
      window.__blasterLab?.setMorph('body', 'bodyLength', t)
      window.__blasterLab?.step(1)
    }, i % 2)
  }
  const rebuilt = await page.evaluate(() => window.__blasterLab?.rendererInfo())
  assert.ok(rebuilt)
  assert.ok(
    rebuilt.geometries <= baselineGeometries + 2,
    `geometry leak: ${baselineGeometries} -> ${rebuilt.geometries}`,
  )

  const range = await page.evaluate(() => {
    window.__blasterLab?.setStation('range')
    const step = window.__blasterLab?.step(12)
    return { step, state: window.__blasterLab?.state(), info: window.__blasterLab?.rendererInfo() }
  })
  assert.ok(range.step)
  assert.ok(range.state)
  assert.ok(range.info)
  assert.equal(range.state.station, 'range')
  assert.equal(range.state.rangeVisible, true)
  assert.equal(range.state.vmVisible, true)
  assert.ok(
    range.info.calls <= PERFORMANCE_BUDGETS.maxSceneDrawCalls,
    `range draw calls ${range.info.calls} > ${PERFORMANCE_BUDGETS.maxSceneDrawCalls}`,
  )
  assert.ok(
    range.info.visibleMeshes <= PERFORMANCE_BUDGETS.maxVisibleMeshes,
    `range visible meshes ${range.info.visibleMeshes} > ${PERFORMANCE_BUDGETS.maxVisibleMeshes}`,
  )
  assert.ok(
    range.step.averageFrameMs <= PERFORMANCE_BUDGETS.maxAverageFrameMs,
    `range average frame ${range.step.averageFrameMs}ms > ${PERFORMANCE_BUDGETS.maxAverageFrameMs}ms`,
  )

  assert.deepEqual(browserErrors, [])
  console.log(
    `browser smoke ok: workshop ${workshop.info.calls} calls/${workshop.info.visibleMeshes} meshes, range ${range.info.calls} calls/${range.info.visibleMeshes} meshes/${range.step.averageFrameMs.toFixed(2)}ms, geometries ${baselineGeometries}->${rebuilt.geometries}, finish delta ${(finishDelta * 100).toFixed(2)}%`,
  )
} finally {
  await browser?.close()
  server.kill()
}

async function assertRenderedCanvas(page) {
  const canvas = page.locator('canvas').first()
  await canvas.waitFor({ state: 'visible' })
  const png = PNG.sync.read(await canvas.screenshot())
  let brightPixels = 0
  const colors = new Set()
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]
    const g = png.data[i + 1]
    const b = png.data[i + 2]
    if (r + g + b > 48) brightPixels += 1
    colors.add(`${r >> 4},${g >> 4},${b >> 4}`)
  }
  const pixels = png.width * png.height
  assert.ok(brightPixels / pixels > 0.7, 'canvas가 검거나 비어 있다')
  assert.ok(colors.size > 20, `canvas 색상 다양성 부족: ${colors.size}`)
}

async function assertFinishDifference(page) {
  const matte = await captureFinish(page, 'matte')
  const metal = await captureFinish(page, 'metal')
  await setBodyFinish(page, 'matte')
  assert.equal(matte.width, metal.width)
  assert.equal(matte.height, metal.height)
  let difference = 0
  for (let i = 0; i < matte.data.length; i += 4) {
    difference += Math.abs(matte.data[i] - metal.data[i])
    difference += Math.abs(matte.data[i + 1] - metal.data[i + 1])
    difference += Math.abs(matte.data[i + 2] - metal.data[i + 2])
  }
  const normalized = difference / (matte.width * matte.height * 3 * 255)
  assert.ok(normalized > 0.001, `matte/metal 픽셀 차이 부족: ${normalized}`)
  return normalized
}

async function captureFinish(page, finish) {
  await setBodyFinish(page, finish)
  return PNG.sync.read(await page.locator('canvas').first().screenshot())
}

async function setBodyFinish(page, finish) {
  await page.evaluate((nextFinish) => {
    const body = window.__blasterLab?.active.parts.body
    if (!body) throw new Error('active body missing')
    body.paint.primary = { color: 'toySilver', finish: nextFinish }
    window.__blasterLab?.setMorph('body', 'bodyLength', body.morph.bodyLength ?? 0.5)
    window.__blasterLab?.step(2)
  }, finish)
}

async function waitForServer(target, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break
    try {
      const response = await fetch(target)
      if (response.ok) return
    } catch {
      // 서버 부팅 중
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`preview server failed to start\n${serverLog.join('')}`)
}
