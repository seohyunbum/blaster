import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph, barrelCountFromMorph, barrelLayout } from '../morph.ts'
import { fixedMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

interface BarrelDims {
  r: number
  l: number
  style?: 'beads' | 'wheel' | 'bubble' | 'balance' | 'bell' | 'fins'
  baseCount?: number
}
const BARREL_DIMS: Record<string, BarrelDims> = {
  barrel_snap: { r: 0.035, l: 0.18 },
  barrel_rail: { r: 0.038, l: 0.4 },
  barrel_stub: { r: 0.05, l: 0.16 },
  barrel_spiral: { r: 0.04, l: 0.32 },
  barrel_wide: { r: 0.058, l: 0.22 },
  barrel_twin: { r: 0.03, l: 0.3, baseCount: 2 },
  barrel_needle: { r: 0.022, l: 0.44 },
  barrel_comet: { r: 0.032, l: 0.38, style: 'beads' },
  barrel_turbine: { r: 0.052, l: 0.3, style: 'wheel' },
  barrel_buzz: { r: 0.045, l: 0.14, style: 'bubble' },
  barrel_reverse: { r: 0.04, l: 0.23, style: 'balance' },
  barrel_hook: { r: 0.055, l: 0.13, style: 'bell' },
  barrel_racer: { r: 0.03, l: 0.34, style: 'fins' },
}

export function buildBarrel(partId: PartId, opts: BuildOpts): BuiltPart {
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
  const secondary: THREE.Mesh[] = []
  const accent: THREE.Mesh[] = []

  const radial = segFor(opts.lod, 14, 8)
  const count = Math.max(dims.baseCount ?? 1, barrelCountFromMorph(opts.morph))
  // 앞끝이 넓은 뿔 배럴에서도 총열이 안 겹치도록 앞끝 반경 기준으로 간격 산정
  const offsets = barrelLayout(count, Math.max(r, rFront))

  // 총열 count 개 (지오메트리 공유) — 더블배럴·미니건
  const tubeGeo = new THREE.CylinderGeometry(r, rFront, l, radial, 1)
  tubeGeo.rotateX(Math.PI / 2) // 길이축 = Z (03 §1.1)
  geos.push(tubeGeo)
  for (const [ox, oy] of offsets) {
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(ox, oy, -l / 2)
    primary.push(tube)
    group.add(tube)
  }
  // 머즐링 — 단일 총열일 때만 (여러 개면 링끼리 겹쳐 뭉개짐)
  if (count === 1) {
    const ringGeo = new THREE.TorusGeometry(rFront * 1.05, rFront * 0.28, 8, radial)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, 0, -l)
    accent.push(ring)
    group.add(ring)
  }

  // 여러 총열이면 뒤쪽을 묶는 허브(개틀링 몸통)
  if (count > 1) {
    const hubR = (count === 2 ? r * 1.4 : r * 2.9) + 0.006
    const hubGeo = new THREE.CylinderGeometry(hubR, hubR, l * 0.32, radial)
    hubGeo.rotateX(Math.PI / 2)
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(PLACEHOLDER))
    hub.position.set(0, 0, -l * 0.16)
    secondary.push(hub)
    group.add(hub)
  }

  // 파츠별 고유 장식. 자유 장식과 함께 켜져도 14메시 예산 안에서 유지한다.
  const styleR = Math.max(r, rFront)
  if (dims.style === 'beads') {
    const beadGeo = new THREE.TorusGeometry(styleR * 1.35, styleR * 0.22, 6, radial)
    geos.push(beadGeo)
    for (const z of [-l * 0.36, -l * 0.72]) {
      const bead = new THREE.Mesh(beadGeo, fixedMaterial(PLACEHOLDER))
      bead.position.z = z
      accent.push(bead)
      group.add(bead)
    }
  } else if (dims.style === 'wheel') {
    const wheelGeo = new THREE.TorusGeometry(styleR * 1.5, styleR * 0.3, 7, radial)
    geos.push(wheelGeo)
    const wheel = new THREE.Mesh(wheelGeo, fixedMaterial(PLACEHOLDER))
    wheel.position.z = -l * 0.5
    accent.push(wheel)
    group.add(wheel)
    const hubGeo = new THREE.SphereGeometry(styleR * 0.42, radial, Math.max(6, radial - 2))
    geos.push(hubGeo)
    const hub = new THREE.Mesh(hubGeo, fixedMaterial(PLACEHOLDER))
    hub.position.z = -l * 0.5
    secondary.push(hub)
    group.add(hub)
  } else if (dims.style === 'bubble') {
    const bubbleGeo = new THREE.SphereGeometry(styleR * 1.25, radial, Math.max(6, radial - 2))
    bubbleGeo.scale(1, 1, 1.15)
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.position.z = -l * 0.34
    secondary.push(bubble)
    group.add(bubble)
  } else if (dims.style === 'balance') {
    const orbGeo = new THREE.SphereGeometry(styleR * 0.58, radial, Math.max(6, radial - 2))
    geos.push(orbGeo)
    for (const sx of [-1, 1]) {
      const orb = new THREE.Mesh(orbGeo, fixedMaterial(PLACEHOLDER))
      orb.position.set(sx * styleR * 1.55, 0, -l * 0.48)
      accent.push(orb)
      group.add(orb)
    }
  } else if (dims.style === 'bell') {
    const bellGeo = new THREE.TorusGeometry(styleR * 1.32, styleR * 0.28, 7, radial)
    geos.push(bellGeo)
    const bell = new THREE.Mesh(bellGeo, fixedMaterial(PLACEHOLDER))
    bell.position.z = -l * 0.76
    accent.push(bell)
    group.add(bell)
  } else if (dims.style === 'fins') {
    const finGeo = new RoundedBoxGeometry(styleR * 0.42, styleR * 1.6, l * 0.38, 2, styleR * 0.12)
    geos.push(finGeo)
    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
      fin.position.set(sx * styleR * 1.15, 0, -l * 0.5)
      fin.rotation.z = sx * -0.25
      accent.push(fin)
      group.add(fin)
    }
  }

  // 장식 — 나팔 끝 (단일 총열일 때만)
  const flareT = count === 1 ? morphLerp('barrelFlare', resolveMorph(opts.morph, 'barrelFlare')) : 0
  if (flareT > 0.02) {
    const flareLen = 0.03 + 0.06 * flareT
    // 접합부(뒤끝)=rFront(연속), 앞끝=넓게 → 벨 입구가 전방(-Z)으로 벌어지는 나팔
    const flareGeo = new THREE.CylinderGeometry(rFront, rFront + 0.04 * flareT, flareLen, radial, 1, true)
    flareGeo.rotateX(Math.PI / 2)
    geos.push(flareGeo)
    const flare = new THREE.Mesh(flareGeo, fixedMaterial(PLACEHOLDER))
    flare.position.set(0, 0, -l - flareLen * 0.5)
    accent.push(flare)
    group.add(flare)
  }

  // 장식 — 마디 고리 (단일 총열일 때만, 배럴을 따라 링이 여러 개)
  const ribT = count === 1 ? morphLerp('barrelRib', resolveMorph(opts.morph, 'barrelRib')) : 0
  if (ribT > 0.02) {
    const count = Math.max(1, Math.round(1 + 4 * ribT))
    for (let i = 0; i < count; i++) {
      const f = (i + 1) / (count + 1) // 뒤끝(0)→앞끝(1) 비율
      const localR = r + (rFront - r) * f // 그 지점 배럴 실반경 (테이퍼 추종)
      const ribGeo = new THREE.TorusGeometry(localR * 1.12, localR * 0.16, 6, radial)
      geos.push(ribGeo)
      const rib = new THREE.Mesh(ribGeo, fixedMaterial(PLACEHOLDER))
      rib.position.set(0, 0, -l * f)
      accent.push(rib)
      group.add(rib)
    }
  }

  // 총구 끝 앵커 (M2 총구 액세서리 승계용, 09 §3.3)
  const muzzleAnchor = new THREE.Object3D()
  muzzleAnchor.position.set(0, 0, -l)
  group.add(muzzleAnchor)

  return {
    group,
    zones: { primary, secondary, accent },
    anchors: { muzzle: muzzleAnchor },
    dispose: () => geos.forEach((g) => g.dispose()),
  }
}

// ─── 사이트 (morph 없음) ────────────────────────────────────
