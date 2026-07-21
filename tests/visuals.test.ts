import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildPart, countMeshes } from '../src/game/partVisuals.ts'
import { buildBlaster } from '../src/game/assembly.ts'
import { makeInstance } from '../src/game/save.ts'
import type { MorphKey, MorphState } from '../src/game/types.ts'
import { BODIES, PARTS } from '../src/game/parts.ts'
import { MORPH_PARAMS } from '../src/game/morph.ts'

/** 월드 바운딩 박스 부피 (morph 이 실제 크기를 바꾸는지 검증용). */
function boxVolume(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj)
  const s = new THREE.Vector3()
  box.getSize(s)
  return s.x * s.y * s.z
}

// 카탈로그에서 직접 뽑는다 — 파츠를 추가해도 자동 커버(드리프트 방지)
const M1_PARTS: string[] = [...BODIES, ...PARTS].map((p) => p.id)
// 모든 morph 키(모양+장식)를 0/1 로 몰아 극단 검사 — 장식 전부 켜면 메시 최대
const ALL_KEYS: MorphKey[] = MORPH_PARAMS.map((p) => p.key)
function fill(v: number): MorphState {
  const m: MorphState = {}
  for (const k of ALL_KEYS) m[k] = v
  return m
}
// barrelCount 가 장식 키와 값을 공유해 균일 fill 로는 '단일 배럴+장식 만땅'(예산 근거)을 못 만든다 →
// 그 최악 케이스를 비균일 morph 로 명시 추가(예산 테스트가 실제 worst-case 를 통과하게)
const SINGLE_BARREL_DECOR: MorphState = { barrelCount: 0, barrelFlare: 1, barrelRib: 1 }
const EXTREMES: MorphState[] = [{}, fill(0), fill(1), fill(0.5), SINGLE_BARREL_DECOR]

// 몸통 최대: 기본 5(셸·핸들·가드·코·캡) + 장식 7(날개2·볏1·꼬리2·안테나2) = 12
// 배럴 최대: 미니건 6총열 = 튜브6+허브1 = 7 / 단일 = 튜브1·링1·나팔1·마디고리5 = 8
const MESH_BUDGET = 14

test('메시 수 예산(≤14) 준수 — 전 카탈로그 × 극단 morph(장식·미니건 포함)', () => {
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

test('총구 개수(barrelCount)가 총열 메시를 늘린다 — 더블배럴·미니건', () => {
  const one = buildPart('barrel_snap', { morph: { barrelCount: 0 } }) // 1개
  const six = buildPart('barrel_snap', { morph: { barrelCount: 1 } }) // 6개(미니건)
  const n1 = countMeshes(one.group)
  const n6 = countMeshes(six.group)
  assert.ok(n6 > n1 + 4, `미니건이 총열을 안 늘림: ${n1} → ${n6}`)
  assert.ok(n6 <= 14, `메시 예산 초과: ${n6}`)
  one.dispose()
  six.dispose()
})

test('다트 팩이 실제 메시로 지어지고 magSize morph 로 커진다', () => {
  const small = buildPart('mag_spring', { morph: { magSize: 0 } })
  const big = buildPart('mag_spring', { morph: { magSize: 1 } })
  assert.ok(countMeshes(small.group) >= 2, '다트 팩 메시가 없음(폴백 의심)')
  assert.ok((small.zones.primary?.length ?? 0) >= 1, 'primary 존 없음')
  // 크기 morph 로 바운딩 박스 부피가 실제로 커져야
  assert.ok(
    boxVolume(big.group) > boxVolume(small.group),
    `magSize 가 크기를 안 키움: ${boxVolume(small.group)} → ${boxVolume(big.group)}`,
  )
  // 드럼통은 다른 실루엣이라도 메시가 생겨야(폴백 아님)
  const drum = buildPart('mag_drum', { morph: {} })
  assert.ok(countMeshes(drum.group) >= 2, '드럼통 메시 없음')
  small.dispose()
  big.dispose()
  drum.dispose()
})

test('미니건 손잡이는 위(+Y)로 자란다 — 몸통 위 장착용', () => {
  const mg = buildPart('grip_minigun', { morph: {} })
  const normal = buildPart('grip_mini', { morph: {} })
  const mgBox = new THREE.Box3().setFromObject(mg.group)
  const nBox = new THREE.Box3().setFromObject(normal.group)
  // 미니건 손잡이는 앵커(몸통 위) 위로 솟아야: max.y 가 확실히 양수
  assert.ok(mgBox.max.y > 0.05, `미니건 손잡이가 위로 안 자람: ${mgBox.max.y}`)
  // 일반 그립은 아래로(−Y) 자라 몸통 밑에 붙는다: max.y 가 0 근처 이하
  assert.ok(nBox.max.y <= 0.03, `일반 그립이 위로 자람(기대: 아래): ${nBox.max.y}`)
  assert.ok((mg.zones.primary?.length ?? 0) >= 1, 'primary 존 없음(색칠 불가)')
  mg.dispose()
  normal.dispose()
})

test('미니건 손잡이가 조립 시 몸통 위(gripTop)에 붙는다 (일반 그립은 아래)', () => {
  const body = 'body_bulldog'
  const mgBlaster = {
    id: 't', name: 't', createdAt: 0,
    parts: { body: makeInstance(body), grip: makeInstance('grip_minigun') },
  }
  const normalBlaster = {
    id: 't', name: 't', createdAt: 0,
    parts: { body: makeInstance(body), grip: makeInstance('grip_mini') },
  }
  const mgBuilt = buildBlaster(mgBlaster, 'full')
  const nBuilt = buildBlaster(normalBlaster, 'full')
  const bodyOnly = buildBlaster({ id: 't', name: 't', createdAt: 0, parts: { body: makeInstance(body) } }, 'full')
  // 앵커 오프셋(gripTop=몸통 위)이 반영되도록 월드행렬 갱신 (앱은 렌더 때 자동 수행)
  mgBuilt.group.updateWorldMatrix(false, true)
  nBuilt.group.updateWorldMatrix(false, true)
  bodyOnly.group.updateWorldMatrix(false, true)
  const bodyBox = new THREE.Box3().setFromObject(bodyOnly.group)
  const mgGripBox = new THREE.Box3().setFromObject(mgBuilt.parts.grip!.group)
  const nGripBox = new THREE.Box3().setFromObject(nBuilt.parts.grip!.group)
  const bodyMidY = (bodyBox.min.y + bodyBox.max.y) / 2
  // 미니건 손잡이는 몸통 중앙보다 위로 솟아야
  assert.ok(mgGripBox.max.y > bodyBox.max.y, `미니건 손잡이가 몸통 위로 안 나옴: ${mgGripBox.max.y} vs ${bodyBox.max.y}`)
  // 일반 그립은 몸통 아래(중앙 아래)로 내려가야
  assert.ok(nGripBox.min.y < bodyMidY, '일반 그립이 아래로 안 감')
  // 미니건 손잡이 장착 시 몸통 캐리핸들은 생략돼야(관통 방지).
  // 몸통 그룹은 부착된 그립을 자식으로 포함하므로 그립 메시를 빼 몸통 자체 메시만 비교한다.
  const mgBodyOwn = countMeshes(mgBuilt.parts.body!.group) - countMeshes(mgBuilt.parts.grip!.group)
  const nBodyOwn = countMeshes(nBuilt.parts.body!.group) - countMeshes(nBuilt.parts.grip!.group)
  assert.ok(mgBodyOwn < nBodyOwn, '미니건 손잡이인데 캐리핸들이 안 숨겨짐(관통 위험)')
  mgBuilt.dispose()
  nBuilt.dispose()
  bodyOnly.dispose()
})

test('hideCarryHandle 옵션이 캐리핸들 메시를 제거한다', () => {
  const withHandle = buildPart('body_bulldog', { morph: {} })
  const without = buildPart('body_bulldog', { morph: {}, hideCarryHandle: true })
  assert.equal(
    countMeshes(without.group),
    countMeshes(withHandle.group) - 1,
    '캐리핸들 1개가 정확히 제거되지 않음',
  )
  withHandle.dispose()
  without.dispose()
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

test('미니건 풀세트(코어+총구6+손잡이)면 손잡이가 몸통 아래(-Y)에 매달린다', () => {
  function gripBox(barrelsT: number): THREE.Box3 {
    const b = {
      id: 't', name: 't', createdAt: 0,
      parts: {
        body: makeInstance('body_minigun'),
        barrel: makeInstance('barrel_snap', { barrelCount: barrelsT }),
        grip: makeInstance('grip_minigun'),
      },
    }
    const built = buildBlaster(b as never)
    built.group.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(built.parts.grip!.group)
    built.dispose()
    return box
  }
  const full = gripBox(1) // 총구 6개 = 풀세트 → 손잡이 아래로
  const notFull = gripBox(0) // 총구 1개 → 풀세트 아님 → 손잡이 위(기존)
  assert.ok(full.max.y < -0.05, `풀세트 손잡이가 아래에 안 붙음: maxY=${full.max.y}`)
  assert.ok(notFull.min.y > 0.05, `일반 미니건 손잡이가 위에 안 붙음: minY=${notFull.min.y}`)
})
