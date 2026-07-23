import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const srcRoot = join(root, 'src')
const errors = []

function tsFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...tsFiles(path))
    else if (name.endsWith('.ts')) out.push(path)
  }
  return out
}

for (const layer of ['game', 'ui', 'modes']) {
  for (const path of tsFiles(join(srcRoot, layer))) {
    const source = readFileSync(path, 'utf8')
    if (/from\s+['"][^'"]*main(?:\.ts)?['"]/.test(source)) {
      errors.push(`${relative(root, path)}: leaf 모듈이 main.ts를 import함`)
    }
  }
}

const mainPath = join(srcRoot, 'main.ts')
const mainLines = readFileSync(mainPath, 'utf8').split(/\r?\n/).length
const MAIN_LINE_BUDGET = 850
if (mainLines > MAIN_LINE_BUDGET) {
  errors.push(`src/main.ts: ${mainLines}줄 (지휘자 예산 ${MAIN_LINE_BUDGET}줄 초과)`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`architecture ok: main ${mainLines}/${MAIN_LINE_BUDGET} lines, leaf imports clean`)
