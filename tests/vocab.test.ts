import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { scanKo, scanIdentifier, scanString } from '../src/game/vocab.ts'
import { BODIES, PARTS } from '../src/game/parts.ts'
import { MORPH_PARAMS } from '../src/game/morph.ts'
import { PRESETS } from '../src/game/presets.ts'

test('금칙어 한글 탐지', () => {
  assert.ok(scanKo('저격 모드').length > 0)
  assert.ok(scanKo('탄창 교체').length > 0)
  assert.equal(scanKo('명중! 팝!').length, 0)
})

test('금칙어 영문 토큰 완전일치', () => {
  assert.ok(scanIdentifier('killCount').length > 0)
  assert.ok(scanIdentifier('dealDamage').length > 0)
  assert.equal(scanIdentifier('skillTree').length, 0) // "skill" 은 통과
  assert.equal(scanIdentifier('speakLoud').length, 0) // "ak" 부분매칭 안 됨
})

test('모든 파츠 id·표시명·설명에 금칙어 없음', () => {
  const hits: string[] = []
  for (const p of [...BODIES, ...PARTS]) {
    for (const h of scanIdentifier(p.id)) hits.push(`${p.id}: ${h.term}`)
    for (const h of scanString(p.nameKo)) hits.push(`${p.nameKo}: ${h.term}`)
    for (const h of scanString(p.desc)) hits.push(`${p.desc}: ${h.term}`)
  }
  assert.deepEqual(hits, [], `금칙어 발견: ${hits.join(', ')}`)
})

test('morph 슬라이더 라벨에 금칙어 없음', () => {
  const hits: string[] = []
  for (const p of MORPH_PARAMS) {
    for (const label of [p.labelKo, p.minLabelKo, p.maxLabelKo]) {
      for (const h of scanString(label)) hits.push(`${label}: ${h.term}`)
    }
  }
  assert.deepEqual(hits, [])
})

test('색칠 프리셋 이름에 금칙어 없음', () => {
  const hits: string[] = []
  for (const p of PRESETS) for (const h of scanString(p.name)) hits.push(`${p.name}: ${h.term}`)
  assert.deepEqual(hits, [])
})

test('혼합 스크립트도 EN 토큰까지 검사 (한글 있으면 EN 건너뛰던 사각)', () => {
  assert.ok(scanString('glock 배럴').length > 0, '한글+라틴 실총명이 통과됨')
  assert.ok(scanString('M4 코어').length > 0)
  assert.equal(scanString('숏 스냅').length, 0) // 정상 이름은 통과
})

// ── 소스 전수 스캔: 어떤 파일에 인라인으로 문자열을 새로 써도 자동 커버 (드리프트 방지) ──
function tsFilesUnder(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...tsFilesUnder(p))
    else if (e.name.endsWith('.ts')) out.push(p)
  }
  return out
}

/** 소스에서 한글이 포함된 문자열 리터럴만 뽑는다(주석 제외). */
function koLiterals(src: string): string[] {
  const noLineComments = src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const lits = noLineComments.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) ?? []
  return lits.map((l) => l.slice(1, -1)).filter((s) => /[가-힣]/.test(s))
}

test('전 소스의 한글 문자열 리터럴에 금칙어 없음 (UI 크롬·프리셋·힌트 포함)', () => {
  // 금칙어 사전 자신은 제외 — 목록이 곧 금칙어라 당연히 매칭된다
  const files = tsFilesUnder('src').filter((f) => !f.replace(/\\/g, '/').endsWith('game/vocab.ts'))
  assert.ok(files.length > 10, '소스 파일을 못 찾음')
  const hits: string[] = []
  for (const f of files) {
    for (const lit of koLiterals(readFileSync(f, 'utf8'))) {
      for (const h of scanKo(lit)) hits.push(`${f} → "${lit}": ${h.term}`)
    }
  }
  assert.deepEqual(hits, [], `금칙어 발견:\n${hits.join('\n')}`)
})
