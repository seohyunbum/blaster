import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, validateBlaster } from '../src/game/parts.ts'
import { makeInstance, createStarterBlaster } from '../src/game/save.ts'
import type { Blaster } from '../src/game/types.ts'

function bare(bodyId: string): Blaster {
  return {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: { body: makeInstance(bodyId) },
  }
}

test('맨몸(body 만) = 몸통 base 그대로', () => {
  const s = computeStats(bare('body_popcorn'))
  assert.equal(s.power, 3) // 기본 파워 소폭 상향(2→3)
  assert.equal(s.fireRate, 6)
  assert.equal(s.accuracy, 4)
  assert.equal(s.weight, 2)
  assert.equal(s.kind, 'dart') // 맨몸 기본 = dart
})

test('파츠 델타 합산 + clamp', () => {
  const b: Blaster = {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: {
      body: makeInstance('body_bulldog'), // P5 R4 A5 W4 (기본 파워 상향)
      barrel: makeInstance('barrel_rail'), // +P2 -R1 +A3 +W2
      sight: makeInstance('sight_dot'), // +A2 +W1
    },
  }
  const s = computeStats(b)
  assert.equal(s.power, 7) // 5+2
  assert.equal(s.fireRate, 3) // 4-1
  assert.equal(s.accuracy, 10) // 5+3+2 clamp10
  assert.equal(s.accuracyRaw, 10)
  assert.equal(s.weight, 7) // 4+2+1
})

test('clamp 원값(raw) 보존 — MAX 배지용', () => {
  const b: Blaster = {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: {
      body: makeInstance('body_bulldog'),
      barrel: makeInstance('barrel_rail'),
      sight: makeInstance('sight_dot'),
    },
  }
  // accuracy raw = 10 정확히. morph 로 더 밀어 raw>10 확인
  b.parts.body = makeInstance('body_bulldog', { bodyLength: 1 }) // accuracy +1
  const s = computeStats(b)
  assert.ok(s.accuracyRaw > 10)
  assert.equal(s.accuracy, 10)
})

test('handling 파생 + overweight −2', () => {
  // 팝콘 weightLimit 6. 무게 8 만들면 overweight
  const b: Blaster = {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: {
      body: makeInstance('body_popcorn'), // W2, limit6
      barrel: makeInstance('barrel_rail'), // +W2
      sight: makeInstance('sight_dot'), // +W1
    },
  }
  const s = computeStats(b)
  assert.equal(s.weight, 5)
  assert.equal(s.overweight, false)
  assert.equal(s.handling, 7) // 12-5
})

test('morph 이 스탯을 움직인다 (형태가 성능)', () => {
  const thin = computeStats(bare('body_popcorn'))
  const chubby = computeStats({
    ...bare('body_popcorn'),
    parts: { body: makeInstance('body_popcorn', { bodyChub: 1 }) },
  })
  assert.ok(chubby.power > thin.power) // 통통 → 파워↑
  assert.ok(chubby.weight > thin.weight)
})

test('validateBlaster: body 없으면 문제, 정상은 빈 배열', () => {
  assert.deepEqual(validateBlaster(createStarterBlaster(0)), [])
  const noBody: Blaster = { id: 't', name: 't', createdAt: 0, parts: {} }
  assert.ok(validateBlaster(noBody).length > 0)
})

test('다트 팩 없으면 용량 0(무한), 달면 그 파츠의 용량·재장전 반영', () => {
  const none = computeStats(bare('body_bulldog'))
  assert.equal(none.capacity, 0) // 0 = 무한(사격장이 무한으로 해석)
  assert.equal(none.reloadSec, 0)

  const withMag: Blaster = {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: {
      body: makeInstance('body_bulldog'),
      magazine: makeInstance('mag_drum'), // 24발 / 2.5초
    },
  }
  const s = computeStats(withMag)
  assert.equal(s.capacity, 24)
  assert.equal(s.reloadSec, 2.5)
})

test('다트 팩도 무게에 반영된다 (미니 클립 +0 < 젤리 탱크 +2)', () => {
  const light = computeStats({
    ...bare('body_titan'),
    parts: { body: makeInstance('body_titan'), magazine: makeInstance('mag_mini') }, // W+0
  })
  const heavy = computeStats({
    ...bare('body_titan'),
    parts: { body: makeInstance('body_titan'), magazine: makeInstance('mag_jelly') }, // W+2
  })
  assert.ok(heavy.weight > light.weight)
})

test('총구가 많을수록 연사가 빨라진다 (사용자 요청)', () => {
  const one: Blaster = {
    ...bare('body_titan'),
    parts: { body: makeInstance('body_titan'), barrel: makeInstance('barrel_snap', { barrelCount: 0 }) }, // 총구 1개
  }
  const six: Blaster = {
    ...bare('body_titan'),
    parts: { body: makeInstance('body_titan'), barrel: makeInstance('barrel_snap', { barrelCount: 1 }) }, // 총구 6개(미니건)
  }
  const s1 = computeStats(one)
  const s6 = computeStats(six)
  assert.ok(s6.fireRate > s1.fireRate, `연사가 안 올라감: ${s1.fireRate} → ${s6.fireRate}`)
  assert.equal(s6.fireRateRaw - s1.fireRateRaw, 5) // 총구 6개 = 1개 초과분 5 × +1
})
