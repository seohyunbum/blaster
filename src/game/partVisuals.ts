// src/game/partVisuals.ts — 파라메트릭 메시 빌더 (정본 지오메트리 레시피 03, morph 사양 09).
// buildPart(partId, {morph}) → {group, zones, anchors, dispose}. 순수 팩토리: 같은 입력 → 같은 형태.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { MorphState, PartId, SocketId, ZoneId } from './types.ts'
import { morphLerp, resolveMorph } from './morph.ts'
import { fixedMaterial, glowMaterial } from './materials.ts'

export interface BuildOpts {
  morph: MorphState
  lod?: 'drag' | 'full'
}

export interface BuiltPart {
  group: THREE.Group
  zones: Partial<Record<ZoneId, THREE.Mesh[]>>
  anchors: Partial<Record<SocketId, THREE.Object3D>>
  dispose(): void
}

const PLACEHOLDER = 0xcfd3da // 색칠 전 임시색 (recomposeBlaster 가 덮어씀)

interface BodyDims {
  w: number
  h: number
  d: number
}
const BODY_DIMS: Record<string, BodyDims> = {
  body_popcorn: { w: 0.14, h: 0.16, d: 0.44 },
  body_bulldog: { w: 0.17, h: 0.19, d: 0.5 },
  body_titan: { w: 0.2, h: 0.22, d: 0.58 },
  body_jelly: { w: 0.16, h: 0.18, d: 0.4 },
}
interface BarrelDims {
  r: number
  l: number
}
const BARREL_DIMS: Record<string, BarrelDims> = {
  barrel_snap: { r: 0.035, l: 0.18 },
  barrel_rail: { r: 0.038, l: 0.4 },
  barrel_stub: { r: 0.05, l: 0.16 },
  barrel_spiral: { r: 0.04, l: 0.32 },
  barrel_wide: { r: 0.058, l: 0.22 },
}

function segFor(lod: 'drag' | 'full' | undefined, full: number, drag: number): number {
  return lod === 'drag' ? drag : full
}

// ─── 몸통 ──────────────────────────────────────────────────
function buildBody(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BODY_DIMS[partId] ?? BODY_DIMS.body_popcorn!
  const lenScale = morphLerp('bodyLength', resolveMorph(opts.morph, 'bodyLength'))
  const chub = morphLerp('bodyChub', resolveMorph(opts.morph, 'bodyChub'))
  const noseT = resolveMorph(opts.morph, 'bodyNose')

  const w = dims.w * chub
  const h = dims.h * chub
  const d = dims.d * lenScale
  const halfZ = d / 2

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const boxSeg = segFor(opts.lod, 4, 2)
  const minSide = Math.min(w, h)
  const roundFactor = morphLerp('bodyRound', resolveMorph(opts.morph, 'bodyRound'))
  const radius = Math.min(0.49 * minSide, roundFactor * minSide)
  const shellGeo = new RoundedBoxGeometry(w, h, d, boxSeg, radius)
  geos.push(shellGeo)
  const shell = new THREE.Mesh(shellGeo, fixedMaterial(PLACEHOLDER))
  primary.push(shell)
  group.add(shell)

  // 캐리핸들 (위) — secondary
  const handleGeo = new RoundedBoxGeometry(w * 0.5, h * 0.18, d * 0.42, 2, 0.02)
  geos.push(handleGeo)
  const handle = new THREE.Mesh(handleGeo, fixedMaterial(PLACEHOLDER))
  handle.position.set(0, h * 0.5 + h * 0.06, -d * 0.05)
  secondary.push(handle)
  group.add(handle)

  // 방아쇠울 (아래 앞) — accent
  const guardSeg = segFor(opts.lod, 16, 10)
  const guardGeo = new THREE.TorusGeometry(0.045, 0.012, 8, guardSeg, Math.PI * 1.4)
  geos.push(guardGeo)
  const guard = new THREE.Mesh(guardGeo, fixedMaterial(PLACEHOLDER))
  guard.position.set(0, -h * 0.45, -d * 0.12)
  guard.rotation.x = Math.PI * 0.5
  accent.push(guard)
  group.add(guard)

  // 코 (앞) — primary. 단일 패밀리: Cone + Sphere 캡을 동시에 lerp (09 §2.1)
  const noseLen = 0.01 + 0.1 * noseT
  const noseBaseR = Math.max(0.02, h * 0.42)
  const tipR = Math.max(0.02, noseBaseR * (1 - 0.7 * noseT))
  const coneSeg = segFor(opts.lod, 14, 8)
  const noseGeo = new THREE.ConeGeometry(noseBaseR, noseLen, coneSeg)
  geos.push(noseGeo)
  const nose = new THREE.Mesh(noseGeo, fixedMaterial(PLACEHOLDER))
  nose.rotation.x = -Math.PI * 0.5 // 첨단이 -Z(전방)
  nose.position.set(0, 0, -halfZ - noseLen * 0.5)
  primary.push(nose)
  group.add(nose)

  const capGeo = new THREE.SphereGeometry(tipR, coneSeg, Math.max(6, coneSeg / 2))
  geos.push(capGeo)
  const cap = new THREE.Mesh(capGeo, fixedMaterial(PLACEHOLDER))
  cap.position.set(0, 0, -halfZ - noseLen)
  primary.push(cap)
  group.add(cap)

  // ── 장식 (켰을 때만 생성) ──
  const finT = morphLerp('bodyFin', resolveMorph(opts.morph, 'bodyFin'))
  if (finT > 0.02) {
    const finH = h * (0.35 + 0.9 * finT)
    const finGeo = new THREE.BoxGeometry(0.012, finH, d * 0.5)
    geos.push(finGeo)
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(sx * (w * 0.5 + 0.006), -h * 0.05, d * 0.02)
      fin.rotation.z = sx * -0.25
      accent.push(fin)
      group.add(fin)
    }
  }
  const crestT = morphLerp('bodyCrest', resolveMorph(opts.morph, 'bodyCrest'))
  if (crestT > 0.02) {
    const crestH = h * (0.3 + 0.9 * crestT)
    const crestGeo = new THREE.BoxGeometry(0.014, crestH, d * 0.42)
    geos.push(crestGeo)
    const crest = new THREE.Mesh(crestGeo, fixedMaterial(PLACEHOLDER))
    crest.position.set(0, h * 0.5 + crestH * 0.4, d * 0.03)
    crest.rotation.x = -0.12
    accent.push(crest)
    group.add(crest)
  }
  const antT = morphLerp('bodyAntenna', resolveMorph(opts.morph, 'bodyAntenna'))
  if (antT > 0.02) {
    const antLen = 0.03 + 0.11 * antT
    const seg = segFor(opts.lod, 8, 6)
    const poleGeo = new THREE.CylinderGeometry(0.004, 0.006, antLen, seg)
    geos.push(poleGeo)
    const pole = new THREE.Mesh(poleGeo, fixedMaterial(PLACEHOLDER))
    pole.position.set(w * 0.28, h * 0.5 + antLen * 0.5, d * 0.28)
    secondary.push(pole)
    group.add(pole)
    const ballGeo = new THREE.SphereGeometry(0.014, seg, seg)
    geos.push(ballGeo)
    const ball = new THREE.Mesh(ballGeo, fixedMaterial(PLACEHOLDER))
    ball.position.set(w * 0.28, h * 0.5 + antLen, d * 0.28)
    accent.push(ball)
    group.add(ball)
  }

  // 소켓 앵커 — morph 반영 (09 §3.3)
  const barrelAnchor = new THREE.Object3D()
  barrelAnchor.position.set(0, h * 0.08, -halfZ - noseLen)
  group.add(barrelAnchor)
  const sightAnchor = new THREE.Object3D()
  sightAnchor.position.set(0, h * 0.5 + 0.01, -d * 0.08)
  group.add(sightAnchor)
  const gripAnchor = new THREE.Object3D()
  gripAnchor.position.set(0, -h * 0.5, d * 0.1)
  group.add(gripAnchor)
  const stockAnchor = new THREE.Object3D()
  stockAnchor.position.set(0, 0, halfZ)
  group.add(stockAnchor)
  const muzzleAnchor = new THREE.Object3D() // 배럴 없을 때 폴백
  muzzleAnchor.position.set(0, h * 0.08, -halfZ - noseLen)
  group.add(muzzleAnchor)

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: {
      barrel: barrelAnchor,
      sight: sightAnchor,
      grip: gripAnchor,
      stock: stockAnchor,
      muzzle: muzzleAnchor,
    },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 배럴 ──────────────────────────────────────────────────
function buildBarrel(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BARREL_DIMS[partId] ?? BARREL_DIMS.barrel_snap!
  const bore = morphLerp('barrelBore', resolveMorph(opts.morph, 'barrelBore'))
  const lenScale = morphLerp('barrelLength', resolveMorph(opts.morph, 'barrelLength'))
  const taperMul = morphLerp('barrelTaper', resolveMorph(opts.morph, 'barrelTaper'))
  const r = dims.r * bore
  const rFront = Math.max(0.012, r * taperMul) // 앞끝 반경 (뿔 모양)
  const l = dims.l * lenScale

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const radial = segFor(opts.lod, 14, 8)
  // 원기둥 top(+Y→+Z 회전 후 뒤끝)=r, bottom(앞끝)=rFront
  const tubeGeo = new THREE.CylinderGeometry(r, rFront, l, radial, 1)
  tubeGeo.rotateX(Math.PI / 2) // 길이축 = Z (03 §1.1)
  geos.push(tubeGeo)
  const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
  tube.position.set(0, 0, -l / 2) // 원점=뒤끝, 전방(-Z)으로 뻗음
  primary.push(tube)
  group.add(tube)

  // 머즐링 (앞끝) — accent
  const ringGeo = new THREE.TorusGeometry(rFront * 1.05, rFront * 0.28, 8, radial)
  geos.push(ringGeo)
  const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
  ring.position.set(0, 0, -l)
  accent.push(ring)
  group.add(ring)

  // 장식 — 나팔 끝 (켰을 때만)
  const flareT = morphLerp('barrelFlare', resolveMorph(opts.morph, 'barrelFlare'))
  if (flareT > 0.02) {
    const flareLen = 0.03 + 0.06 * flareT
    const flareGeo = new THREE.CylinderGeometry(rFront + 0.04 * flareT, rFront, flareLen, radial, 1, true)
    flareGeo.rotateX(Math.PI / 2)
    geos.push(flareGeo)
    const flare = new THREE.Mesh(flareGeo, fixedMaterial(PLACEHOLDER))
    flare.position.set(0, 0, -l - flareLen * 0.5)
    accent.push(flare)
    group.add(flare)
  }

  // 총구 끝 앵커 (M2 총구 액세서리 승계용, 09 §3.3)
  const muzzleAnchor = new THREE.Object3D()
  muzzleAnchor.position.set(0, 0, -l)
  group.add(muzzleAnchor)

  return {
    group,
    zones: { primary, accent },
    anchors: { muzzle: muzzleAnchor },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 사이트 (morph 없음) ────────────────────────────────────
function buildSight(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 12, 8)

  const mountGeo = new THREE.BoxGeometry(0.045, 0.02, 0.06)
  geos.push(mountGeo)
  const mount = new THREE.Mesh(mountGeo, fixedMaterial(PLACEHOLDER))
  mount.position.set(0, 0.005, 0)
  secondary.push(mount)
  group.add(mount)

  if (partId === 'sight_pin') {
    // 가늠 핀 — 얇은 기둥
    const postGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.05, seg)
    geos.push(postGeo)
    const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
    post.position.set(0, 0.03, -0.02)
    primary.push(post)
    group.add(post)
  } else if (partId === 'sight_ring') {
    // 링 사이트 — 고리
    const ringGeo = new THREE.TorusGeometry(0.022, 0.005, 8, seg)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, 0.035, 0)
    primary.push(ring)
    group.add(ring)
  } else {
    // 도트 사이트 — 박스 + 발광 점(고정 비색칠)
    const boxGeo = new RoundedBoxGeometry(0.05, 0.05, 0.05, 2, 0.012)
    geos.push(boxGeo)
    const box = new THREE.Mesh(boxGeo, fixedMaterial(PLACEHOLDER))
    box.position.set(0, 0.03, 0)
    primary.push(box)
    group.add(box)
    const dotGeo = new THREE.SphereGeometry(0.008, seg, seg)
    geos.push(dotGeo)
    const dot = new THREE.Mesh(dotGeo, glowMaterial(0xff3b3b))
    dot.position.set(0, 0.03, -0.026)
    group.add(dot)
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 그립 (morph 없음) ──────────────────────────────────────
function buildGrip(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 10, 6)
  const banana = partId === 'grip_banana'

  const gripGeo = new THREE.CapsuleGeometry(banana ? 0.026 : 0.024, 0.09, 3, seg)
  geos.push(gripGeo)
  const g = new THREE.Mesh(gripGeo, fixedMaterial(PLACEHOLDER))
  g.rotation.x = (banana ? 0.4 : 0.26) // 아래로 기울임
  g.position.set(0, -0.06, 0.01)
  primary.push(g)
  group.add(g)

  for (let i = 0; i < 2; i++) {
    const kGeo = new THREE.TorusGeometry(0.026, 0.005, 6, seg)
    geos.push(kGeo)
    const k = new THREE.Mesh(kGeo, fixedMaterial(PLACEHOLDER))
    k.rotation.y = Math.PI / 2
    k.position.set(0, -0.04 - i * 0.035, 0.02)
    accent.push(k)
    group.add(k)
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((geo) => geo.dispose()),
  }
}

// ─── 스톡 (morph 없음) ──────────────────────────────────────
function buildStock(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 12, 8)

  if (partId === 'stock_balloon') {
    // 풍선 스톡 — 큰 구 (뒤로 매달림)
    const balloonGeo = new THREE.SphereGeometry(0.075, seg, seg)
    geos.push(balloonGeo)
    const b = new THREE.Mesh(balloonGeo, fixedMaterial(PLACEHOLDER))
    b.scale.set(1, 1.1, 1.2)
    b.position.set(0, 0.0, 0.14)
    primary.push(b)
    group.add(b)
  } else {
    const armGeo = new THREE.BoxGeometry(0.05, 0.05, 0.14)
    geos.push(armGeo)
    const arm = new THREE.Mesh(armGeo, fixedMaterial(PLACEHOLDER))
    arm.position.set(0, 0.0, 0.09)
    primary.push(arm)
    group.add(arm)
    const padGeo = new RoundedBoxGeometry(0.055, 0.1, 0.04, 2, 0.015)
    geos.push(padGeo)
    const pad = new THREE.Mesh(padGeo, fixedMaterial(PLACEHOLDER))
    pad.position.set(0, 0.0, 0.17)
    secondary.push(pad)
    group.add(pad)
  }

  return {
    group,
    zones: { primary, secondary },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 머즐 (배럴 끝에 부착, -Z 로 뻗음) ──────────────────────
function buildMuzzle(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 14, 8)

  if (partId === 'muzzle_booster') {
    const coneGeo = new THREE.CylinderGeometry(0.055, 0.04, 0.08, seg)
    coneGeo.rotateX(Math.PI / 2)
    geos.push(coneGeo)
    const cone = new THREE.Mesh(coneGeo, fixedMaterial(PLACEHOLDER))
    cone.position.set(0, 0, -0.04)
    primary.push(cone)
    group.add(cone)
    for (let i = 0; i < 3; i++) {
      const finGeo = new THREE.BoxGeometry(0.012, 0.05, 0.06)
      geos.push(finGeo)
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(0, 0, -0.04)
      fin.rotation.z = (i / 3) * Math.PI * 2
      accent.push(fin)
      group.add(fin)
    }
  } else if (partId === 'muzzle_star') {
    const baseGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.04, seg)
    baseGeo.rotateX(Math.PI / 2)
    geos.push(baseGeo)
    const base = new THREE.Mesh(baseGeo, fixedMaterial(PLACEHOLDER))
    base.position.set(0, 0, -0.02)
    primary.push(base)
    group.add(base)
    const starGeo = new THREE.OctahedronGeometry(0.035, 0)
    geos.push(starGeo)
    const star = new THREE.Mesh(starGeo, fixedMaterial(PLACEHOLDER))
    star.position.set(0, 0, -0.06)
    accent.push(star)
    group.add(star)
  } else {
    // 나팔 팁 — 트럼펫 모양 flare (넓은 벨 입구가 전방 -Z, 립 링과 정렬)
    const hornGeo = new THREE.CylinderGeometry(0.06, 0.035, 0.08, seg, 1, true)
    hornGeo.rotateX(-Math.PI / 2)
    geos.push(hornGeo)
    const horn = new THREE.Mesh(hornGeo, fixedMaterial(PLACEHOLDER))
    horn.position.set(0, 0, -0.04)
    primary.push(horn)
    group.add(horn)
    const lipGeo = new THREE.TorusGeometry(0.06, 0.008, 8, seg)
    geos.push(lipGeo)
    const lip = new THREE.Mesh(lipGeo, fixedMaterial(PLACEHOLDER))
    lip.position.set(0, 0, -0.08)
    accent.push(lip)
    group.add(lip)
  }

  return {
    group,
    zones: { primary, accent },
    anchors: {},
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

const FALLBACK_MAT = fixedMaterial(0x999999)

function buildFallback(): BuiltPart {
  const group = new THREE.Group()
  const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1)
  const mesh = new THREE.Mesh(geo, FALLBACK_MAT)
  group.add(mesh)
  return {
    group,
    zones: { primary: [mesh] },
    anchors: {},
    dispose: () => geo.dispose(),
  }
}

/** 단일 디스패처 (03 §7-2). 미등록 파츠 = 회색 박스 폴백(콘텐츠 테스트가 실패 처리). */
export function buildPart(partId: PartId, opts: BuildOpts): BuiltPart {
  if (partId.startsWith('body_')) return buildBody(partId, opts)
  if (partId.startsWith('barrel_')) return buildBarrel(partId, opts)
  if (partId.startsWith('sight_')) return buildSight(partId, opts)
  if (partId.startsWith('grip_')) return buildGrip(partId, opts)
  if (partId.startsWith('stock_')) return buildStock(partId, opts)
  if (partId.startsWith('muzzle_')) return buildMuzzle(partId, opts)
  return buildFallback()
}

/** 극단 morph 포함 메시 수 (verify 게이트 §8-1). 앵커(Object3D)는 제외, Mesh 만. */
export function countMeshes(group: THREE.Object3D): number {
  let n = 0
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) n += 1
  })
  return n
}
