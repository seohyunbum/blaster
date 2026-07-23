import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { toShotProfile } from '../src/game/ballistics.ts'
import { PERFORMANCE_BUDGETS } from '../src/game/budgets.ts'
import { computeStats, validateBlaster } from '../src/game/parts.ts'
import { PvpArena, XorShift32 } from '../src/game/pvpArena.ts'
import { PVP_LOADOUTS } from '../src/game/pvpLoadouts.ts'
import { toPvpProfile } from '../src/game/pvpSession.ts'

test('PVP 라이벌은 서로 다른 안전한 토이 블래스터 3종이다', () => {
  assert.equal(PVP_LOADOUTS.length, 3)
  assert.equal(new Set(PVP_LOADOUTS.map((loadout) => loadout.id)).size, 3)
  for (const loadout of PVP_LOADOUTS) {
    assert.deepEqual(validateBlaster(loadout.blaster), [], loadout.id)
    assert.ok(computeStats(loadout.blaster).power >= 1)
  }
})

test('PVP 난수는 같은 seed에서 같은 순서를 만든다', () => {
  const left = new XorShift32(20260723)
  const right = new XorShift32(20260723)
  for (let i = 0; i < 20; i += 1) {
    assert.equal(left.nextFloat(), right.nextFloat())
  }
})

test('PVP 경기장은 공용 투사체 예산 안에서 전역 난수 없이 갱신된다', () => {
  const loadout = PVP_LOADOUTS[0]!
  const stats = computeStats(loadout.blaster)
  const profile = toPvpProfile(stats, toShotProfile(stats))
  const arena = new PvpArena()
  const playerPosition = new THREE.Vector3(0, 1.45, 0.7)
  const playerDirection = new THREE.Vector3(0, 0, -1)
  const originalRandom = Math.random

  // Three.js는 Object3D UUID 생성에 전역 난수를 사용하므로 무대 조립은 검사 범위 밖이다.
  // 실제 PVP 발사·퍼짐·프레임 갱신만 자체 seed 난수로 동작해야 한다.
  arena.startRound(loadout.blaster, profile, 77)
  Math.random = () => {
    throw new Error('PVP core must not use global random')
  }
  try {
    arena.firePlayer(playerPosition, playerDirection, profile)
    arena.fireRival(playerPosition, profile)
    for (let i = 0; i < 120; i += 1) {
      arena.update(1 / 60, playerPosition, profile)
    }
  } finally {
    Math.random = originalRandom
  }

  assert.equal(arena.projectileCapacity, PERFORMANCE_BUDGETS.projectilePool)
  assert.ok(arena.consumePlayerImpact() >= 0)
  assert.ok(arena.consumeRivalImpact() >= 0)
})
