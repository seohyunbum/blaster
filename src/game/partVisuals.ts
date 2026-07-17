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
}
interface BarrelDims {
  r: number
  l: number
}
const BARREL_DIMS: Record<string, BarrelDims> = {
  barrel_snap: { r: 0.035, l: 0.18 },
  barrel_rail: { r: 0.038, l: 0.4 },
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
  const radius = Math.min(0.045, 0.25 * Math.min(w, h))
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

  // 소켓 앵커 — morph 반영 (09 §3.3)
  const barrelAnchor = new THREE.Object3D()
  barrelAnchor.position.set(0, h * 0.08, -halfZ - noseLen)
  group.add(barrelAnchor)
  const sightAnchor = new THREE.Object3D()
  sightAnchor.position.set(0, h * 0.5 + 0.01, -d * 0.08)
  group.add(sightAnchor)

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: { barrel: barrelAnchor, sight: sightAnchor },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 배럴 ──────────────────────────────────────────────────
function buildBarrel(partId: PartId, opts: BuildOpts): BuiltPart {
  const dims = BARREL_DIMS[partId] ?? BARREL_DIMS.barrel_snap!
  const bore = morphLerp('barrelBore', resolveMorph(opts.morph, 'barrelBore'))
  const lenScale = morphLerp('barrelLength', resolveMorph(opts.morph, 'barrelLength'))
  const r = dims.r * bore
  const l = dims.l * lenScale

  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const radial = segFor(opts.lod, 14, 8)
  const tubeGeo = new THREE.CylinderGeometry(r, r, l, radial, 1)
  tubeGeo.rotateX(Math.PI / 2) // 길이축 = Z (03 §1.1)
  geos.push(tubeGeo)
  const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
  tube.position.set(0, 0, -l / 2) // 원점=뒤끝, 전방(-Z)으로 뻗음
  primary.push(tube)
  group.add(tube)

  // 머즐링 (앞끝) — accent
  const ringGeo = new THREE.TorusGeometry(r * 1.05, r * 0.28, 8, radial)
  geos.push(ringGeo)
  const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
  ring.position.set(0, 0, -l)
  accent.push(ring)
  group.add(ring)

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
function buildSight(_partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []

  const bodyGeo = new RoundedBoxGeometry(0.05, 0.05, 0.05, 2, 0.012)
  geos.push(bodyGeo)
  const box = new THREE.Mesh(bodyGeo, fixedMaterial(PLACEHOLDER))
  box.position.set(0, 0.03, 0)
  primary.push(box)
  group.add(box)

  const mountGeo = new THREE.BoxGeometry(0.045, 0.02, 0.06)
  geos.push(mountGeo)
  const mount = new THREE.Mesh(mountGeo, fixedMaterial(PLACEHOLDER))
  mount.position.set(0, 0.005, 0)
  secondary.push(mount)
  group.add(mount)

  // 발광 dot — 고정(비색칠)
  const seg = segFor(opts.lod, 12, 8)
  const dotGeo = new THREE.SphereGeometry(0.008, seg, seg)
  geos.push(dotGeo)
  const dot = new THREE.Mesh(dotGeo, glowMaterial(0xff3b3b))
  dot.position.set(0, 0.03, -0.026)
  group.add(dot)

  return {
    group,
    zones: { primary, secondary },
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
