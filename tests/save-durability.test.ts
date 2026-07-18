import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeSave,
  exportSaveText,
  importInto,
  createDefaultSave,
  createStarterBlaster,
} from '../src/game/save.ts'

// "업데이트해도 보관함이 절대 날아가면 안 된다" — 세이브 내구성 계약.
// 구버전/미래버전/삭제된 파츠/미지 필드가 섞여도 블래스터는 전부 살아남아야 한다.

/** 실제 저장 JSON 을 흉내낸 "구버전" 세이브 (미니건·신규파츠 도입 前). */
function oldSave() {
  return {
    version: 1,
    coins: 0,
    blasters: [
      {
        id: 'b_alpha',
        name: '알파',
        createdAt: 1000,
        parts: {
          body: {
            partId: 'body_popcorn',
            paint: { primary: { color: 'blasterRed', finish: 'matte' } },
            morph: { bodyLength: 0.8, bodyChub: 0.3 },
          },
          barrel: {
            partId: 'barrel_rail',
            paint: { primary: { color: 'blasterBlue', finish: 'gloss' } },
            morph: { barrelLength: 1 },
          },
          sight: { partId: 'sight_dot', paint: {}, morph: {} },
        },
      },
      {
        id: 'b_beta',
        name: '베타',
        createdAt: 2000,
        parts: { body: { partId: 'body_bulldog', paint: {}, morph: {} } },
      },
    ],
    activeBlasterId: 'b_beta',
  }
}

test('구버전 세이브: 모든 블래스터 보존 (개수·id·이름·morph·paint)', () => {
  const s = normalizeSave(oldSave(), 9999)
  assert.equal(s.blasters.length, 2, '블래스터가 사라짐')
  const alpha = s.blasters.find((b) => b.id === 'b_alpha')!
  assert.equal(alpha.name, '알파')
  assert.equal(alpha.createdAt, 1000) // 원래 생성시각 보존
  assert.deepEqual(alpha.parts.body!.morph, { bodyLength: 0.8, bodyChub: 0.3 })
  assert.equal(alpha.parts.body!.paint.primary!.color, 'blasterRed')
  assert.equal(alpha.parts.barrel!.partId, 'barrel_rail')
  assert.equal(s.activeBlasterId, 'b_beta') // 활성 보존
})

test('미래버전 세이브: 미니건 morph·미지 morph 키·미지 최상위 필드 섞여도 블래스터 생존', () => {
  const future = {
    version: 99, // 미래 버전
    blasters: [
      {
        id: 'b_future',
        name: '미래총',
        createdAt: 3000,
        parts: {
          body: { partId: 'body_orb', paint: {}, morph: { bodyLength: 0.7, warpFactor9000: 0.9 } },
          barrel: { partId: 'barrel_snap', paint: {}, morph: { barrelCount: 1, barrelTaper: 0.2 } },
        },
      },
    ],
    someFutureFeature: { enabled: true }, // 미지 필드
  }
  const s = normalizeSave(future, 9999)
  assert.equal(s.blasters.length, 1)
  const b = s.blasters[0]!
  assert.equal(b.name, '미래총')
  assert.equal(b.parts.barrel!.morph.barrelCount, 1) // 이번에 추가된 키 보존
  assert.equal(b.parts.body!.morph.bodyLength, 0.7)
})

test('삭제·개명된 파츠 id 를 써도 블래스터는 안 사라짐 (파츠만 폴백)', () => {
  const s = normalizeSave(
    {
      blasters: [
        {
          id: 'b_x',
          name: '옛파츠총',
          createdAt: 5,
          parts: {
            body: { partId: 'body_popcorn', paint: {}, morph: {} },
            barrel: { partId: 'barrel_LEGENDARY_REMOVED', paint: {}, morph: {} }, // 존재하지 않는 파츠
          },
        },
      ],
    },
    9999,
  )
  assert.equal(s.blasters.length, 1)
  assert.equal(s.blasters[0]!.name, '옛파츠총')
  assert.equal(s.blasters[0]!.parts.barrel!.partId, 'barrel_LEGENDARY_REMOVED') // id 보존(렌더만 폴백)
})

test('내보내기→불러오기 라운드트립: 블래스터 유실 0', () => {
  const src = createDefaultSave(1)
  src.blasters = [
    createStarterBlaster(1, '하나'),
    createStarterBlaster(2, '둘'),
    createStarterBlaster(3, '셋'),
  ]
  const text = exportSaveText(src)
  // 빈 보관함에 파일을 불러오면 3개 다 들어와야
  const dst = createDefaultSave(100)
  dst.blasters = [] // 빈 상태
  const res = importInto(dst, text, 200)!
  assert.equal(res.added, 3)
  assert.equal(res.save.blasters.length, 3)
  assert.deepEqual(res.save.blasters.map((b) => b.name).sort(), ['둘', '셋', '하나'])
})

test('불러오기는 병합 — 기존 것은 절대 안 사라지고 중복 id 는 건너뜀', () => {
  const cur = createDefaultSave(1)
  const keep = createStarterBlaster(1, '내 소중한 총')
  cur.blasters = [keep]
  // keep 과 같은 id 하나 + 새 id 하나를 담은 백업
  const backup = createDefaultSave(1)
  backup.blasters = [keep, createStarterBlaster(2, '새 총')]
  const res = importInto(cur, exportSaveText(backup), 300)!
  assert.equal(res.added, 1) // 중복(keep)은 건너뛰고 '새 총'만
  assert.ok(res.save.blasters.some((b) => b.name === '내 소중한 총'), '기존 블래스터가 사라짐')
  assert.ok(res.save.blasters.some((b) => b.name === '새 총'))
  assert.equal(res.save.blasters.length, 2)
})

test('불러오기: 형식 불명 파일은 null (기존 보관함 안 건드림)', () => {
  const cur = createDefaultSave(1)
  assert.equal(importInto(cur, 'this is not json', 1), null)
  assert.equal(importInto(cur, '{"random":true}', 1), null)
  assert.equal(cur.blasters.length, 1) // 그대로
})

test('대량 보관함(30개) 전량 보존', () => {
  const many = {
    blasters: Array.from({ length: 30 }, (_, i) => ({
      id: `b${i}`,
      name: `총${i}`,
      createdAt: i,
      parts: { body: { partId: 'body_popcorn', paint: {}, morph: {} } },
    })),
  }
  const s = normalizeSave(many, 9999)
  assert.equal(s.blasters.length, 30)
  assert.deepEqual(
    s.blasters.map((b) => b.name).sort(),
    Array.from({ length: 30 }, (_, i) => `총${i}`).sort(),
  )
})
