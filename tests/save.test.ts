import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDefaultSave,
  normalizeSave,
  createStarterBlaster,
  cloneBlaster,
  makeInstance,
  SAVE_VERSION,
} from '../src/game/save.ts'
import type { Blaster } from '../src/game/types.ts'

test('기본 세이브 구조', () => {
  const s = createDefaultSave(1000)
  assert.equal(s.version, SAVE_VERSION)
  assert.equal(s.coins, 0)
  assert.equal(s.blasters.length, 1)
  assert.equal(s.activeBlasterId, s.blasters[0]!.id)
  assert.ok(s.unlockedPartIds.includes('body_popcorn'))
})

test('roundtrip: morph 포함 저장→로드 deepEqual (핵심 필드)', () => {
  const blaster: Blaster = {
    id: 'b1',
    name: '번개팝콘',
    createdAt: 1789000000000,
    parts: {
      body: makeInstance('body_comet', { bodyLength: 0.8, bodyChub: 0.3 }),
      barrel: makeInstance('barrel_turbine', { barrelLength: 1 }),
      magazine: makeInstance('mag_powerbox', { magSize: 0.7 }),
      sight: makeInstance('sight_bridge'),
      grip: makeInstance('grip_hook'),
      stock: makeInstance('stock_wire'),
      muzzle: makeInstance('muzzle_duo'),
      strap: makeInstance('strap_comfy'),
    },
  }
  const save = createDefaultSave(1)
  save.blasters = [blaster]
  save.activeBlasterId = 'b1'

  const json = JSON.stringify(save)
  const loaded = normalizeSave(JSON.parse(json), 2)

  const lb = loaded.blasters[0]!
  assert.equal(lb.id, 'b1')
  assert.equal(lb.name, '번개팝콘')
  assert.equal(lb.parts.body!.partId, 'body_comet')
  assert.deepEqual(lb.parts.body!.morph, { bodyLength: 0.8, bodyChub: 0.3 })
  assert.deepEqual(lb.parts.barrel!.morph, { barrelLength: 1 })
  assert.equal(lb.parts.magazine!.partId, 'mag_powerbox')
  assert.deepEqual(lb.parts.magazine!.morph, { magSize: 0.7 })
  assert.deepEqual(lb.parts.sight!.morph, {})
  assert.equal(lb.parts.grip!.partId, 'grip_hook')
  assert.equal(lb.parts.stock!.partId, 'stock_wire')
  assert.equal(lb.parts.muzzle!.partId, 'muzzle_duo')
  assert.equal(lb.parts.strap!.partId, 'strap_comfy')
})

test('미지 MorphKey 는 조용히 무시(하위 호환)', () => {
  const raw = {
    version: 1,
    blasters: [
      {
        id: 'b1',
        name: 'x',
        createdAt: 1,
        parts: {
          body: {
            partId: 'body_popcorn',
            paint: {},
            morph: { bodyLength: 0.7, futureKnob: 0.9 },
          },
        },
      },
    ],
  }
  const loaded = normalizeSave(raw, 2)
  const m = loaded.blasters[0]!.parts.body!.morph as Record<string, number>
  assert.equal(m.bodyLength, 0.7)
  assert.equal(m.futureKnob, undefined)
})

test('삭제된 PaletteKey 는 존 폴백으로 무소음 대체', () => {
  const raw = {
    blasters: [
      {
        id: 'b1',
        name: 'x',
        createdAt: 1,
        parts: {
          body: {
            partId: 'body_popcorn',
            paint: { primary: { color: 'deletedColor', finish: 'gloss' } },
            morph: {},
          },
        },
      },
    ],
  }
  const loaded = normalizeSave(raw, 2)
  assert.equal(loaded.blasters[0]!.parts.body!.paint.primary!.color, 'blasterBlue')
})

test('손상 입력 → 기본 세이브 폴백', () => {
  assert.equal(normalizeSave(null, 5).blasters.length, 1)
  assert.equal(normalizeSave('garbage', 5).version, SAVE_VERSION)
  assert.equal(normalizeSave(42, 5).coins, 0)
})

test('body 없는 블래스터는 로드에서 제외', () => {
  const raw = {
    blasters: [
      { id: 'bad', name: 'x', createdAt: 1, parts: { barrel: { partId: 'barrel_snap', paint: {}, morph: {} } } },
    ],
  }
  const loaded = normalizeSave(raw, 2)
  // body 없는 블래스터 제거 → 기본 스타터로 대체
  assert.ok(loaded.blasters.every((b) => b.parts.body))
  assert.ok(loaded.blasters.length >= 1)
})

test('cloneBlaster: 깊은 복사 — 새 id·독립 morph/paint', () => {
  const src = createStarterBlaster(1, '내 총')
  src.parts.body!.morph = { bodyLength: 0.8 }
  const copy = cloneBlaster(src, 2)
  assert.notEqual(copy.id, src.id) // 새 id
  assert.equal(copy.name, '내 총 복사')
  assert.equal(copy.createdAt, 2)
  assert.deepEqual(copy.parts.body!.morph, { bodyLength: 0.8 })
  // 독립성: 복사본 변경이 원본에 영향 없음
  copy.parts.body!.morph.bodyLength = 0.2
  copy.parts.body!.paint.primary = { color: 'blasterRed', finish: 'matte' }
  assert.equal(src.parts.body!.morph.bodyLength, 0.8)
  assert.equal(src.parts.body!.paint.primary!.color, 'blasterBlue')
})

test('cloneBlaster: 이름 지정 가능', () => {
  const src = createStarterBlaster(1)
  assert.equal(cloneBlaster(src, 2, '특별판').name, '특별판')
})

test('시작 파츠는 항상 unlocked 에 포함', () => {
  const raw = { blasters: [createStarterBlaster(1)], unlockedPartIds: ['body_popcorn'] }
  const loaded = normalizeSave(raw, 2)
  assert.ok(loaded.unlockedPartIds.includes('barrel_rail'))
})
