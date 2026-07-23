import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toShotProfile } from '../src/game/ballistics.ts'
import {
  PVP_ROUND_COUNT,
  PVP_STARTING_HEALTH,
  PvpSession,
  toPvpProfile,
  type PvpProfile,
} from '../src/game/pvpSession.ts'
import type { BlasterStats } from '../src/game/types.ts'

function stats(overrides: Partial<BlasterStats> = {}): BlasterStats {
  return {
    power: 5,
    fireRate: 5,
    accuracy: 5,
    weight: 4,
    powerRaw: 5,
    fireRateRaw: 5,
    accuracyRaw: 5,
    handling: 6,
    capacity: 0,
    reloadSec: 0,
    overweight: false,
    weightLimit: 8,
    kind: 'dart',
    ...overrides,
  }
}

function profile(overrides: Partial<BlasterStats> = {}): PvpProfile {
  const computed = stats(overrides)
  return toPvpProfile(computed, toShotProfile(computed))
}

function threeRivals(rival: PvpProfile): readonly PvpProfile[] {
  return Array.from({ length: PVP_ROUND_COUNT }, () => rival)
}

test('PVP 프로필은 파워·연사·정확·다루기를 단조롭게 반영한다', () => {
  const lowPower = profile({ power: 1 })
  const highPower = profile({ power: 10 })
  assert.equal(lowPower.popPower, 0.75)
  assert.equal(highPower.popPower, 1.5)

  const lowRate = profile({ fireRate: 1 })
  const highRate = profile({ fireRate: 10 })
  assert.ok(highRate.fireIntervalMs < lowRate.fireIntervalMs)

  const lowAccuracy = profile({ accuracy: 1 })
  const highAccuracy = profile({ accuracy: 10 })
  assert.ok(highAccuracy.spreadDeg < lowAccuracy.spreadDeg)

  const lowHandling = profile({ handling: 1 })
  const highHandling = profile({ handling: 10 })
  assert.ok(highHandling.aimFollowPerSec > lowHandling.aimFollowPerSec)
  assert.ok(highHandling.strafeSpeed > lowHandling.strafeSpeed)
})

test('양측은 로비와 모든 라운드를 정확히 체력 10으로 시작한다', () => {
  const p = profile()
  const session = new PvpSession(p, threeRivals(p))
  assert.equal(session.playerHealth, PVP_STARTING_HEALTH)
  assert.equal(session.rivalHealth, PVP_STARTING_HEALTH)

  assert.equal(session.start(100), true)
  session.resolveFrame({ playerPopPower: 1.25, rivalPopPower: 0.75 })
  assert.equal(session.playerHealth, 9.25)
  assert.equal(session.rivalHealth, 8.75)

  session.resolveFrame({ playerPopPower: 20, rivalPopPower: 0 })
  assert.equal(session.phase, 'round-complete')
  assert.equal(session.advance(500), true)
  assert.equal(session.playerHealth, 10)
  assert.equal(session.rivalHealth, 10)
})

test('연사 게이트는 느린 600ms와 빠른 150ms 경계를 포함해 판정한다', () => {
  const slow = profile({ fireRate: 1 })
  const fast = profile({ fireRate: 10 })
  const session = new PvpSession(slow, threeRivals(fast))
  session.start(0)

  assert.equal(session.tryPop('player', 0), true)
  assert.equal(session.tryPop('player', 599), false)
  assert.equal(session.tryPop('player', 600), true)

  assert.equal(session.tryPop('rival', 0), true)
  assert.equal(session.tryPop('rival', 149), false)
  assert.equal(session.tryPop('rival', 150), true)
})

test('같은 프레임에 양측 체력이 0이면 순서와 무관하게 draw가 된다', () => {
  const p = profile()
  const session = new PvpSession(p, threeRivals(p))
  session.start()

  assert.equal(
    session.resolveFrame({ playerPopPower: 10, rivalPopPower: 10 }),
    'draw',
  )
  assert.equal(session.playerHealth, 0)
  assert.equal(session.rivalHealth, 0)
})

test('retry 뒤 같은 라운드부터 다시 시작해 세 라이벌을 모두 넘으면 victory다', () => {
  const p = profile()
  const session = new PvpSession(p, threeRivals(p))
  session.start(0)

  session.resolveFrame({ playerPopPower: 0, rivalPopPower: 10 })
  assert.equal(session.phase, 'retry')
  assert.equal(session.roundIndex, 0)
  assert.equal(session.retry(100), true)
  assert.equal(session.phase, 'playing')
  assert.equal(session.roundIndex, 0)
  assert.equal(session.playerHealth, 10)
  assert.equal(session.rivalHealth, 10)

  for (let round = 0; round < PVP_ROUND_COUNT; round += 1) {
    session.resolveFrame({ playerPopPower: 10, rivalPopPower: 0 })
    if (round < PVP_ROUND_COUNT - 1) {
      assert.equal(session.phase, 'round-complete')
      assert.equal(session.advance(200 + round), true)
      assert.equal(session.roundIndex, round + 1)
    }
  }
  assert.equal(session.phase, 'victory')
  assert.equal(session.roundIndex, PVP_ROUND_COUNT - 1)
})
