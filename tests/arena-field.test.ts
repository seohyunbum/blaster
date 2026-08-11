import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { toShotProfile } from '../src/game/ballistics.ts'
import { computeStats } from '../src/game/parts.ts'
import { ArenaField } from '../src/game/arenaField.ts'
import { PVP_LOADOUTS } from '../src/game/pvpLoadouts.ts'
import { toPvpProfile } from '../src/game/pvpSession.ts'

// ArenaField 는 PVP 모드가 실제로 쓰는 무대다(pvpArena.ts 는 로비 전용이라 여기서 다루지 않는다).
// 스테이지 진행이 '보스 격파' 하나에만 걸려 있으므로, 보스 체력·맵 순환·격파 신호는 계약으로 고정한다.

const SEED = 20260725

function pvpProfile() {
  const stats = computeStats(PVP_LOADOUTS[0]!.blaster)
  return toPvpProfile(stats, toShotProfile(stats))
}

/** 보스 root — 무대에 fodder 다음으로 붙는 마지막 Group. 아래 사격 테스트가 이 식별을 스스로 검증한다. */
function bossRootOf(arena: ArenaField): THREE.Object3D {
  const groups = arena.group.children.filter((child) => child.type === 'Group')
  return groups[groups.length - 1]!
}

/** 보스 정면 3m 에서 계속 쏴서 쓰러뜨린다. 실패하면 프레임 상한에서 멈춘다. */
function shootBossDown(arena: ArenaField, profile: ReturnType<typeof pvpProfile>): number {
  const bossRoot = bossRootOf(arena)
  const origin = new THREE.Vector3()
  const dir = new THREE.Vector3(0, 0, -1)
  const playerPos = new THREE.Vector3(0, 1.45, 9)
  let frames = 0
  while (arena.bossHealth > 0 && frames < 600) {
    frames += 1
    origin.set(bossRoot.position.x, bossRoot.position.y, bossRoot.position.z + 3)
    arena.firePlayer(origin, dir, profile)
    arena.update(1 / 60, playerPos, profile)
  }
  return frames
}

test('보스 체력은 스테이지마다 6 + 3×stage 로 오른다', () => {
  const arena = new ArenaField()
  arena.start(SEED)

  assert.equal(arena.bossMaxHealth, 9, '1스테이지')
  assert.equal(arena.bossHealth, 9, '소환 직후는 만피')

  for (const [stage, hp] of [[2, 12], [3, 15], [4, 18], [5, 21]] as const) {
    arena.setStage(stage)
    assert.equal(arena.bossMaxHealth, hp, `${stage}스테이지 최대 체력`)
    assert.equal(arena.bossHealth, hp, `${stage}스테이지 현재 체력`)
  }
})

test('스테이지 맵은 5종을 순환한다 — 6스테이지는 1스테이지 맵을 다시 쓴다', () => {
  const arena = new ArenaField()
  arena.start(SEED)

  // 맵은 엄폐물 배치로만 드러난다 → 격자점을 밀어내 본 결과를 그 맵의 지문으로 쓴다.
  const fingerprint = (stage: number): string => {
    arena.setStage(stage)
    const marks: string[] = []
    for (let x = -8; x <= 8; x += 2) {
      for (let z = -11; z <= -1; z += 2) {
        arena.resolvePlayer(x, z, 0.45)
        marks.push(`${arena.resolvedX.toFixed(3)},${arena.resolvedZ.toFixed(3)}`)
      }
    }
    return marks.join('|')
  }

  const maps = [1, 2, 3, 4, 5].map(fingerprint)
  assert.equal(new Set(maps).size, 5, '5스테이지 맵은 서로 달라야 한다')

  assert.equal(fingerprint(6), maps[0], '6스테이지 = (6-1)%5 = 0번 맵')
  assert.equal(fingerprint(7), maps[1], '7스테이지 = 1번 맵')
  assert.equal(fingerprint(11), maps[0], '11스테이지도 0번 맵')
})

test('보스를 잡으면 격파 신호가 뜨고 킬에도 반영된다', () => {
  const arena = new ArenaField()
  const profile = pvpProfile()
  arena.start(SEED)

  assert.equal(arena.consumeBossDown(), false, '시작 직후에는 격파 신호가 없다')
  arena.consumeKills()

  const frames = shootBossDown(arena, profile)
  assert.equal(arena.bossHealth, 0, `보스를 쓰러뜨리지 못했다 (${frames}프레임)`)
  assert.ok(arena.consumeKills() >= 1, '보스 격파는 킬로도 잡혀야 한다')
})

test('보스 격파 신호는 한 번만 소비된다', () => {
  const arena = new ArenaField()
  const profile = pvpProfile()
  arena.start(SEED)
  arena.consumeBossDown()

  shootBossDown(arena, profile)

  // 스테이지 진행이 이 신호 하나에 걸려 있다 — 두 번 읽히면 스테이지가 건너뛰어진다.
  assert.equal(arena.consumeBossDown(), true, '격파 직후 한 번은 true')
  assert.equal(arena.consumeBossDown(), false, '소비한 뒤에는 false')
})

test('reset 은 대기 중인 보스 격파 신호를 지운다', () => {
  const arena = new ArenaField()
  const profile = pvpProfile()
  arena.start(SEED)
  arena.consumeBossDown()

  shootBossDown(arena, profile)
  arena.reset() // 소비하지 않은 채 새 판

  assert.equal(arena.consumeBossDown(), false, '지난 판의 격파가 새 판의 스테이지를 올리면 안 된다')
})

test('새 스테이지에 들어가면 보스가 만피로 되살아난다', () => {
  const arena = new ArenaField()
  const profile = pvpProfile()
  arena.start(SEED)

  shootBossDown(arena, profile)
  assert.equal(arena.bossHealth, 0)

  arena.setStage(2)
  assert.equal(arena.bossHealth, 12, '2스테이지 보스는 만피로 등장')
  assert.equal(arena.bossMaxHealth, 12)
  assert.ok(arena.aliveEnemies >= 1, '보스가 살아 있어야 한다')
})
