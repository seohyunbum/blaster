import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const assetsDir = join(root, 'dist', 'assets')
const budgets = {
  app: 120_000,
  three: 580_000,
  // three(580) + app(120) 외에 코드 분할된 pvpMode 청크(~30KB)가 별도로 총합에 잡힌다.
  // 폰 터치 조종(조이스틱·쏘기 버튼) 추가로 pvp 청크가 커져 총합을 720KB로 한 단계 올린다.
  totalJs: 720_000,
}

const jsFiles = readdirSync(assetsDir).filter((name) => name.endsWith('.js'))
const sizes = Object.fromEntries(jsFiles.map((name) => [name, statSync(join(assetsDir, name)).size]))
const appEntry = Object.entries(sizes).find(([name]) => name.startsWith('index-'))
const threeEntry = Object.entries(sizes).find(([name]) => name.startsWith('three-'))

if (!appEntry || !threeEntry) {
  throw new Error(`expected split app/three chunks, found: ${jsFiles.join(', ')}`)
}

const totalJs = Object.values(sizes).reduce((sum, size) => sum + size, 0)
assertBudget('app', appEntry[1], budgets.app)
assertBudget('three', threeEntry[1], budgets.three)
assertBudget('total JS', totalJs, budgets.totalJs)

console.log(
  `bundle budget ok: app ${kb(appEntry[1])}/${kb(budgets.app)} KB, three ${kb(threeEntry[1])}/${kb(budgets.three)} KB, total ${kb(totalJs)}/${kb(budgets.totalJs)} KB`,
)

function assertBudget(label, actual, max) {
  if (actual > max) throw new Error(`${label} bundle ${actual} bytes > ${max} bytes`)
}

function kb(bytes) {
  return Math.round(bytes / 100) / 10
}
