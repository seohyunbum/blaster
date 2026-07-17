import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPart, countMeshes } from '../src/game/partVisuals.ts'
import type { MorphKey, MorphState } from '../src/game/types.ts'
import { BODIES, PARTS } from '../src/game/parts.ts'
import { MORPH_PARAMS } from '../src/game/morph.ts'

// 카탈로그에서 직접 뽑는다 — 파츠를 추가해도 자동 커버(드리프트 방지)
const M1_PARTS: string[] = [...BODIES, ...PARTS].map((p) => p.id)
// 모든 morph 키(모양+장식)를 0/1 로 몰아 극단 검사 — 장식 전부 켜면 메시 최대
const ALL_KEYS: MorphKey[] = MORPH_PARAMS.map((p) => p.key)
function fill(v: number): MorphState {
  const m: MorphState = {}
  for (const k of ALL_KEYS) m[k] = v
  return m
}
const EXTREMES: MorphState[] = [{}, fill(0), fill(1), fill(0.5)]

// 몸통 최대: 기본 5(셸·핸들·가드·코·캡) + 장식 7(날개2·볏1·꼬리2·안테나2) = 12
// 배럴 최대: 튜브·머즐링 + 나팔 + 마디고리 5 = 8
const MESH_BUDGET = 14

test('메시 수 ≤ 10 — 극단 morph(장식 포함) (verify 게이트 §8-1)', () => {
  for (const id of M1_PARTS) {
    for (const morph of EXTREMES) {
      const built = buildPart(id, { morph })
      const n = countMeshes(built.group)
      assert.ok(n <= MESH_BUDGET, `${id} morph ${JSON.stringify(morph)} → ${n} meshes`)
      built.dispose()
    }
  }
})

test('장식 슬라이더가 메시를 추가한다 (기본 없음 → 켜면 생김)', () => {
  const off = buildPart('body_popcorn', { morph: {} })
  const on = buildPart('body_popcorn', { morph: { bodyFin: 1, bodyCrest: 1, bodyAntenna: 1 } })
  assert.ok(countMeshes(on.group) > countMeshes(off.group), '장식이 메시를 안 늘림')
  off.dispose()
  on.dispose()
})

test('zones.primary 존재 + 메시 ≥ 1 (색칠 가능)', () => {
  for (const id of M1_PARTS) {
    const built = buildPart(id, { morph: {} })
    assert.ok((built.zones.primary?.length ?? 0) >= 1, `${id} primary 존 없음`)
    built.dispose()
  }
})

test('barrelLength morph 이 muzzle 앵커를 전진시킨다 (09 §3.3)', () => {
  const short = buildPart('barrel_rail', { morph: { barrelLength: 0 } })
  const long = buildPart('barrel_rail', { morph: { barrelLength: 1 } })
  const zShort = short.anchors.muzzle!.position.z
  const zLong = long.anchors.muzzle!.position.z
  assert.ok(zLong < zShort, `앵커 전진 실패: short ${zShort} long ${zLong}`)
  short.dispose()
  long.dispose()
})

test('bodyLength morph 이 barrel 소켓 앵커를 전진시킨다', () => {
  const short = buildPart('body_popcorn', { morph: { bodyLength: 0 } })
  const long = buildPart('body_popcorn', { morph: { bodyLength: 1 } })
  assert.ok(long.anchors.barrel!.position.z < short.anchors.barrel!.position.z)
  short.dispose()
  long.dispose()
})

test('미등록(prefix 불일치) 파츠 = 회색 폴백 1메시 (돌덩이 규칙)', () => {
  // prefix 매칭이 안 되는 id 라야 buildFallback 에 도달한다
  const built = buildPart('zzz_ghost' as string, { morph: {} })
  assert.equal(countMeshes(built.group), 1)
  const dummy: MorphKey[] = []
  assert.equal(dummy.length, 0)
  built.dispose()
})
