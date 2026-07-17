import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanKo, scanIdentifier, scanString } from '../src/game/vocab.ts'
import { BODIES, PARTS } from '../src/game/parts.ts'
import { MORPH_PARAMS } from '../src/game/morph.ts'

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
