import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MORPH_PARAMS,
  morphStatDelta,
  morphStateDelta,
  morphLerp,
  resolveMorph,
  pruneMorph,
  boreScaleFromMorph,
  ENVELOPE,
} from '../src/game/morph.ts'

test('resolveMorph: 모양=기본0.5·장식=기본0, 범위 밖은 clamp', () => {
  assert.equal(resolveMorph({}, 'bodyLength'), 0.5) // 모양
  assert.equal(resolveMorph({}, 'bodyFin'), 0) // 장식 = 기본 없음
  assert.equal(resolveMorph({}, 'bodyAntenna'), 0)
  assert.equal(resolveMorph({}, 'barrelFlare'), 0)
  assert.equal(resolveMorph({ bodyLength: NaN }, 'bodyLength'), 0.5)
  assert.equal(resolveMorph({ bodyFin: NaN }, 'bodyFin'), 0)
  assert.equal(resolveMorph({ bodyLength: -3 }, 'bodyLength'), 0)
  assert.equal(resolveMorph({ bodyLength: 9 }, 'bodyLength'), 1)
  assert.equal(resolveMorph({ bodyLength: 0.8 }, 'bodyLength'), 0.8)
})

test('장식 파라미터는 스탯에 영향 없음 (순수 멋)', () => {
  for (const key of ['bodyFin', 'bodyCrest', 'bodyAntenna', 'barrelFlare'] as const) {
    for (const t of [0, 0.5, 1]) {
      assert.deepEqual(morphStatDelta(key, t), {}, `${key} at ${t}`)
    }
  }
})

test('pruneMorph: 장식 기본값(0)도 생략', () => {
  const p = pruneMorph({ bodyFin: 0, bodyCrest: 0.7, bodyLength: 0.5 })
  assert.equal(p.bodyFin, undefined) // 0 = 장식 기본 → 생략
  assert.equal(p.bodyCrest, 0.7)
  assert.equal(p.bodyLength, undefined) // 0.5 = 모양 기본 → 생략
})

test('morphStatDelta: t=0.5 는 전 파라미터에서 0', () => {
  for (const p of MORPH_PARAMS) {
    const d = morphStatDelta(p.key, 0.5)
    assert.deepEqual(d, {}, `${p.key} at t=0.5 should be empty`)
  }
})

test('morphStatDelta: t=0/1 은 정의된 왼끝·오른끝 델타', () => {
  // bodyChub 오른끝: power +1.5, weight +1.5, fireRate -1.0
  const d1 = morphStatDelta('bodyChub', 1)
  assert.equal(d1.power, 1.5)
  assert.equal(d1.weight, 1.5)
  assert.equal(d1.fireRate, -1.0)
  // bodyChub 왼끝: power -1.5, weight -1.5
  const d0 = morphStatDelta('bodyChub', 0)
  assert.equal(d0.power, -1.5)
  assert.equal(d0.weight, -1.5)
  assert.equal(d0.fireRate ?? 0, 0)
})

test('morphStatDelta: piecewise 중간값 선형 보간', () => {
  // barrelBore t=0.75 → 오른끝 절반: power +0.5, accuracy -0.25
  const d = morphStatDelta('barrelBore', 0.75)
  assert.equal(d.power, 0.5)
  assert.equal(d.accuracy, -0.25)
})

test('bodyNose 는 순수 멋 — 어떤 t 에서도 스탯 0', () => {
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    assert.deepEqual(morphStatDelta('bodyNose', t), {})
  }
})

test('morphStateDelta: 인스턴스 전체 합', () => {
  const d = morphStateDelta({ bodyChub: 1, barrelBore: 1 })
  assert.equal(d.power, 2.5) // 1.5 + 1.0
})

test('morphLerp: min/max 사이 선형', () => {
  // bodyLength min 0.75 max 1.25
  assert.equal(morphLerp('bodyLength', 0), 0.75)
  assert.equal(morphLerp('bodyLength', 1), 1.25)
  assert.ok(Math.abs(morphLerp('bodyLength', 0.5) - 1.0) < 1e-9)
})

test('pruneMorph: 기본값 0.5 키 생략(희소)', () => {
  const p = pruneMorph({ bodyLength: 0.5, bodyChub: 0.8, barrelBore: NaN })
  assert.equal(p.bodyLength, undefined)
  assert.equal(p.bodyChub, 0.8)
  assert.equal(p.barrelBore, undefined)
})

test('boreScaleFromMorph: lerp(0.9,1.3)', () => {
  assert.ok(Math.abs(boreScaleFromMorph({}) - 1.1) < 1e-9)
  assert.ok(Math.abs(boreScaleFromMorph({ barrelBore: 0 }) - 0.9) < 1e-9)
  assert.ok(Math.abs(boreScaleFromMorph({ barrelBore: 1 }) - 1.3) < 1e-9)
})

test('토이 프로포션 봉투 상수 존재 (09 §7)', () => {
  assert.equal(ENVELOPE.bodyAspectMax, 4.2)
  assert.equal(ENVELOPE.barrelLoverRMax, 15)
  assert.equal(ENVELOPE.totalLenMax, 1.1)
})
