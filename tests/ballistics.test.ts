import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toShotProfile,
  composeProjectileScale,
  solveBallisticPitchRad,
  sweepHitSphere,
  riseRate,
  PROJECTILE_GRAVITY,
} from '../src/game/ballistics.ts'
import { computeStats } from '../src/game/parts.ts'
import { makeInstance } from '../src/game/save.ts'
import type { Blaster, BlasterStats } from '../src/game/types.ts'

function statsOf(bodyId: string, parts: Record<string, string> = {}): BlasterStats {
  const b: Blaster = {
    id: 't',
    name: 't',
    createdAt: 0,
    parts: { body: makeInstance(bodyId) },
  }
  for (const [slot, id] of Object.entries(parts)) {
    b.parts[slot as keyof Blaster['parts']] = makeInstance(id)
  }
  return computeStats(b)
}

test('ShotProfile 는 항상 04 클램프 안에서 태어난다', () => {
  // 극단 조합 여럿을 샘플
  const samples: BlasterStats[] = [
    statsOf('body_popcorn'),
    statsOf('body_bulldog', { barrel: 'barrel_rail', sight: 'sight_dot' }),
    statsOf('body_popcorn', { barrel: 'barrel_snap' }),
  ]
  for (const s of samples) {
    const p = toShotProfile(s)
    assert.ok(p.muzzleVelocity >= 20 && p.muzzleVelocity <= 60, 'muzzle')
    assert.ok(p.spreadDeg >= 0.3 && p.spreadDeg <= 4.0, 'spread')
    assert.ok(p.fireIntervalMs >= 150 && p.fireIntervalMs <= 600, 'interval')
  }
})

test('반동 riseRate ≤ 20 계약 (04 §3)', () => {
  for (let power = 1; power <= 10; power++) {
    for (let hz = 1; hz <= 10; hz++) {
      const s: BlasterStats = {
        power,
        fireRate: hz,
        accuracy: 5,
        weight: 4,
        powerRaw: power,
        fireRateRaw: hz,
        accuracyRaw: 5,
        handling: 6,
        capacity: 0,
        reloadSec: 0,
        overweight: false,
        weightLimit: 9,
        kind: 'dart',
      }
      const p = toShotProfile(s)
      assert.ok(riseRate(p) <= 20 + 1e-6, `power${power} hz${hz} riseRate ${riseRate(p)}`)
    }
  }
})

test('파워↑ → 탄속↑, 정확↑ → 퍼짐↓ (단조)', () => {
  const weak = toShotProfile(statsOf('body_popcorn')) // P2
  const strong = toShotProfile(
    statsOf('body_bulldog', { barrel: 'barrel_rail' }),
  ) // P6, A8
  assert.ok(strong.muzzleVelocity > weak.muzzleVelocity)
  assert.ok(strong.spreadDeg < weak.spreadDeg)
})

test('composeProjectileScale: bore·power 반영 + clamp', () => {
  assert.ok(composeProjectileScale(5.5, 1) === 1)
  assert.ok(composeProjectileScale(10, 1.3) <= 1.35)
  assert.ok(composeProjectileScale(1, 0.9) >= 0.85)
})

test('solveBallisticPitchRad: 사거리 밖은 null, 안은 유효각', () => {
  const g = PROJECTILE_GRAVITY.dart
  assert.equal(solveBallisticPitchRad(1000, 0, 20, g), null) // 너무 멀다
  const pitch = solveBallisticPitchRad(15, 0, 50, g)
  assert.ok(pitch !== null && pitch > 0 && pitch < Math.PI / 4)
})

test('sweepHitSphere: 관통 프레임도 잡는다 (터널링 방지)', () => {
  // prev 앞, cur 뒤 — 그 사이에 타겟. 점 판정이면 놓치지만 스윕은 잡음.
  const prev = { x: 0, y: 0, z: 2 }
  const cur = { x: 0, y: 0, z: -2 }
  const target = { x: 0, y: 0, z: 0 }
  assert.equal(sweepHitSphere(prev, cur, target, 0.35), true)
  // 빗나감
  assert.equal(sweepHitSphere(prev, cur, { x: 5, y: 0, z: 0 }, 0.35), false)
})
