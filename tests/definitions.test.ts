import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DIRECT_ATTACH_SLOTS,
  PAINTABLE_SLOTS,
  PROJECTILE_DEFS,
  PROJECTILE_KINDS,
  RANDOMIZABLE_SLOTS,
  SLOT_DEFS,
  SLOT_ORDER,
  STATION_DEFS,
  STATION_ORDER,
  WORKSHOP_SLOTS,
} from '../src/game/definitions.ts'
import { PERFORMANCE_BUDGETS } from '../src/game/budgets.ts'
import { BODIES, PARTS } from '../src/game/parts.ts'
import { VISUAL_RECIPE_IDS } from '../src/game/partVisuals.ts'
import { RangeController } from '../src/game/range.ts'

test('슬롯 정책 배열은 SLOT_DEFS에서 완전하게 파생된다', () => {
  assert.deepEqual(new Set(SLOT_ORDER), new Set(Object.keys(SLOT_DEFS)))
  assert.deepEqual(SLOT_ORDER, ['body', 'barrel', 'magazine', 'sight', 'grip', 'stock', 'strap', 'muzzle'])
  assert.deepEqual(WORKSHOP_SLOTS, SLOT_ORDER.filter((slot) => SLOT_DEFS[slot].workshop))
  assert.deepEqual(PAINTABLE_SLOTS, SLOT_ORDER.filter((slot) => SLOT_DEFS[slot].paintable))
  assert.deepEqual(RANDOMIZABLE_SLOTS, SLOT_ORDER.filter((slot) => SLOT_DEFS[slot].randomizable))
  assert.deepEqual(DIRECT_ATTACH_SLOTS, SLOT_ORDER.filter((slot) => SLOT_DEFS[slot].attachPolicy === 'body'))
})

test('모든 몸통 소켓은 등록 슬롯이며 현재 확장 슬롯을 빠짐없이 제공한다', () => {
  const expected = new Set(SLOT_ORDER.filter((slot) => slot !== 'body'))
  for (const body of BODIES) assert.deepEqual(new Set(body.sockets), expected, body.id)
})

test('스테이션은 명시적 mode와 panel 정책을 가진다', () => {
  assert.deepEqual(STATION_ORDER, Object.keys(STATION_DEFS))
  assert.equal(STATION_DEFS.range.mode, 'range')
  assert.equal(STATION_DEFS.range.panel, null)
  assert.equal(STATION_DEFS.pvp.mode, 'pvp')
  assert.equal(STATION_DEFS.pvp.panel, null)
  for (const id of STATION_ORDER.filter((station) => STATION_DEFS[station].mode === 'edit')) {
    assert.equal(STATION_DEFS[id].mode, 'edit', `${id}가 사격장으로 fallthrough하면 안 됨`)
    assert.ok(STATION_DEFS[id].panel)
  }
})

test('모든 발사체 종류가 카탈로그에서 도달 가능하고 물리·시각 정책을 가진다', () => {
  const reachable = new Set(['dart'])
  for (const part of PARTS) if (part.slot === 'barrel' && part.kind) reachable.add(part.kind)
  assert.deepEqual(reachable, new Set(PROJECTILE_KINDS))
  for (const kind of PROJECTILE_KINDS) {
    const def = PROJECTILE_DEFS[kind]
    assert.ok(def.gravity > 0)
    assert.ok(def.baseRadius > 0)
    assert.ok(def.maxSpeed > 0)
    assert.ok(def.color > 0)
  }
})

test('카탈로그 ID는 중복이 없고 시각 레시피 집합과 정확히 일치한다', () => {
  const catalogIds = [...BODIES, ...PARTS].map((part) => part.id)
  assert.equal(new Set(catalogIds).size, catalogIds.length, '중복 part id')
  assert.deepEqual(new Set(VISUAL_RECIPE_IDS), new Set(catalogIds))
})

test('투사체 풀은 성능 예산 정본과 일치한다', () => {
  const range = new RangeController()
  assert.equal(range.projectileCapacity, PERFORMANCE_BUDGETS.projectilePool)
})
