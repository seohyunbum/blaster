import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const srcRoot = join(root, 'src')
const errors = []
const ARRAY_ALLOCATORS = new Set(['concat', 'filter', 'flatMap', 'map', 'slice', 'toReversed', 'toSorted', 'with'])

function files(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) out.push(...files(path))
    else if (name.endsWith('.ts')) out.push(path)
  }
  return out
}

function functionName(node) {
  const name = node.name
  if (!name) return null
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return null
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
}

function isHotpath(node, relPath) {
  const name = functionName(node)
  if (!name) return false
  if (/^(?:tick|animate)/.test(name)) return true
  return relPath.startsWith('src/game/') && /^update/.test(name)
}

function allocationLabel(node, sourceFile) {
  if (ts.isNewExpression(node)) return `new ${node.expression.getText(sourceFile)}`
  if (ts.isObjectLiteralExpression(node)) return '객체 리터럴'
  if (ts.isArrayLiteralExpression(node)) return '배열 리터럴'
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) {
    return '클로저/중첩 함수'
  }
  if (
    ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && ARRAY_ALLOCATORS.has(node.expression.name.text)
  ) {
    return `${node.expression.name.text}() 배열 생성`
  }
  return null
}

function scanHotpath(node, hotNode, sourceFile, relPath, hotName) {
  if (node !== hotNode && isFunctionLike(node)) {
    report(node, '클로저/중첩 함수', sourceFile, relPath, hotName)
    return
  }
  const label = allocationLabel(node, sourceFile)
  if (label) {
    report(node, label, sourceFile, relPath, hotName)
    return
  }
  ts.forEachChild(node, (child) => scanHotpath(child, hotNode, sourceFile, relPath, hotName))
}

function report(node, label, sourceFile, relPath, hotName) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
  errors.push(`${relPath}:${line + 1}:${hotName}: 핫패스에서 ${label} 할당`)
}

for (const path of files(srcRoot)) {
  const source = readFileSync(path, 'utf8')
  const relPath = relative(root, path).replaceAll('\\', '/')
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const visit = (node) => {
    if (isFunctionLike(node) && node.body && ts.isBlock(node.body) && isHotpath(node, relPath)) {
      scanHotpath(node.body, node, sourceFile, relPath, functionName(node))
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log('hotpath allocation gate ok (AST: object/array/closure/new)')
