import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const srcRoot = join(root, 'src')
const errors = []

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...files(path))
    else if (name.endsWith('.ts')) out.push(path)
  }
  return out
}

function matchingBrace(source, open) {
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return i
    }
  }
  return -1
}

const hotName = /\b(?:function\s+)?((?:tick|update|animate)[A-Za-z0-9_]*)\s*\([^)]*\)\s*(?::\s*[^\{]+)?\{/g
for (const path of files(srcRoot)) {
  const source = readFileSync(path, 'utf8')
  for (const match of source.matchAll(hotName)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf('{')
    const close = matchingBrace(source, open)
    if (close < 0) continue
    const body = source.slice(open, close + 1)
    if (/new\s+THREE\./.test(body)) {
      errors.push(`${relative(root, path)}:${match[1]}: 핫패스에서 new THREE.* 할당`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('hotpath allocation gate ok')
