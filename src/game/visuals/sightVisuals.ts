import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PartId } from '../types.ts'
import { morphLerp, resolveMorph } from '../morph.ts'
import { fixedMaterial, glowMaterial } from '../materials.ts'
import { PLACEHOLDER, segFor, type BuildOpts, type BuiltPart } from './types.ts'

export function buildSight(partId: PartId, opts: BuildOpts): BuiltPart {
  const group = new THREE.Group()
  const geos: THREE.BufferGeometry[] = []
  const primary: THREE.Mesh[] = []
  const secondary: THREE.Mesh[] = []
  const seg = segFor(opts.lod, 12, 8)
  const sz = morphLerp('sightSize', resolveMorph(opts.morph, 'sightSize'))
  const hi = morphLerp('sightHeight', resolveMorph(opts.morph, 'sightHeight'))
  // 마운트 윗면(yTop) 위에 각 부품 밑면이 닿게 배치 — 높이 슬라이더로 떠오르던 버그 방지
  const yTop = 0.015 * hi

  const mountGeo = new THREE.BoxGeometry(0.045 * sz, 0.02 * hi, 0.06 * sz)
  geos.push(mountGeo)
  const mount = new THREE.Mesh(mountGeo, fixedMaterial(PLACEHOLDER))
  mount.position.set(0, 0.005 * hi, 0)
  secondary.push(mount)
  group.add(mount)

  if (partId === 'sight_comet') {
    // 코멧 뷰어 — 둥근 긴 관측관 + 앞뒤 빛구슬
    const tubeGeo = new THREE.CapsuleGeometry(0.017 * sz, 0.12 * sz, 3, seg)
    tubeGeo.rotateX(Math.PI / 2)
    geos.push(tubeGeo)
    const tubeY = yTop + 0.018 * sz
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(0, tubeY, -0.012)
    primary.push(tube)
    group.add(tube)
    const orbGeo = new THREE.SphereGeometry(0.011 * sz, seg, Math.max(6, seg - 2))
    geos.push(orbGeo)
    for (const z of [-0.082 * sz, 0.058 * sz]) {
      const orb = new THREE.Mesh(orbGeo, glowMaterial(0x7fd4ff))
      orb.position.set(0, tubeY, z - 0.012)
      group.add(orb)
    }
  } else if (partId === 'sight_bridge') {
    // 브리지 뷰어 — 두 둥근 기둥과 가로 다리
    const postGeo = new THREE.CapsuleGeometry(0.006 * sz, 0.045 * hi, 3, seg)
    geos.push(postGeo)
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
      post.position.set(sx * 0.028 * sz, yTop + 0.025 * hi, 0)
      primary.push(post)
      group.add(post)
    }
    const bridgeGeo = new THREE.CapsuleGeometry(0.007 * sz, 0.056 * sz, 3, seg)
    bridgeGeo.rotateZ(Math.PI / 2)
    geos.push(bridgeGeo)
    const bridge = new THREE.Mesh(bridgeGeo, fixedMaterial(PLACEHOLDER))
    bridge.position.set(0, yTop + 0.052 * hi, 0)
    primary.push(bridge)
    group.add(bridge)
    const beadGeo = new THREE.SphereGeometry(0.007 * sz, seg, Math.max(6, seg - 2))
    geos.push(beadGeo)
    const bead = new THREE.Mesh(beadGeo, glowMaterial(0xffd15c))
    bead.position.set(0, yTop + 0.052 * hi, -0.008)
    group.add(bead)
  } else if (partId === 'sight_bubble') {
    // 버블 뷰어 — 짧은 목 위에 발광 방울
    const bubbleGeo = new THREE.SphereGeometry(0.025 * sz, seg, Math.max(6, seg - 2))
    geos.push(bubbleGeo)
    const bubble = new THREE.Mesh(bubbleGeo, fixedMaterial(PLACEHOLDER))
    bubble.scale.y = 1.2 * hi
    bubble.position.set(0, yTop + 0.025 * sz, 0)
    primary.push(bubble)
    group.add(bubble)
    const dotGeo = new THREE.SphereGeometry(0.008 * sz, seg, Math.max(6, seg - 2))
    geos.push(dotGeo)
    const dot = new THREE.Mesh(dotGeo, glowMaterial(0x74f0c5))
    dot.position.set(0, yTop + 0.027 * sz, -0.022 * sz)
    group.add(dot)
  } else if (partId === 'sight_fin') {
    // 핀 뷰어 — 낮고 넓은 삼각 지느러미
    const finGeo = new THREE.ConeGeometry(0.035 * sz, 0.055 * hi, 3)
    geos.push(finGeo)
    const fin = new THREE.Mesh(finGeo, fixedMaterial(PLACEHOLDER))
    fin.scale.z = 1.6
    fin.position.set(0, yTop + 0.027 * hi, 0)
    fin.rotation.y = Math.PI / 2
    primary.push(fin)
    group.add(fin)
  } else if (partId === 'sight_pin') {
    // 가늠 핀 — 얇은 기둥
    const postGeo = new THREE.CylinderGeometry(0.005 * sz, 0.007 * sz, 0.05 * hi, seg)
    geos.push(postGeo)
    const post = new THREE.Mesh(postGeo, fixedMaterial(PLACEHOLDER))
    post.position.set(0, yTop + 0.025 * hi, -0.02)
    primary.push(post)
    group.add(post)
  } else if (partId === 'sight_ring') {
    // 링 사이트 — 고리
    const ringGeo = new THREE.TorusGeometry(0.022 * sz, 0.005 * sz, 8, seg)
    geos.push(ringGeo)
    const ring = new THREE.Mesh(ringGeo, fixedMaterial(PLACEHOLDER))
    ring.position.set(0, yTop + 0.022 * sz, 0)
    primary.push(ring)
    group.add(ring)
  } else if (partId === 'sight_scope') {
    // 망원 경통 — 긴 원통 + 렌즈
    const tubeGeo = new THREE.CylinderGeometry(0.016 * sz, 0.016 * sz, 0.12 * sz, seg)
    tubeGeo.rotateX(Math.PI / 2)
    geos.push(tubeGeo)
    const tubeY = yTop + 0.016 * sz
    const tube = new THREE.Mesh(tubeGeo, fixedMaterial(PLACEHOLDER))
    tube.position.set(0, tubeY, -0.01)
    primary.push(tube)
    group.add(tube)
    const lensGeo = new THREE.CylinderGeometry(0.017 * sz, 0.017 * sz, 0.008, seg)
    lensGeo.rotateX(Math.PI / 2)
    geos.push(lensGeo)
    const lens = new THREE.Mesh(lensGeo, glowMaterial(0x7fd4ff))
    // 렌즈는 항상 경통 앞면 바깥에 (작은 sz 에서 묻히던 버그 방지)
    lens.position.set(0, tubeY, -0.01 - 0.06 * sz - 0.004)
    group.add(lens)
  } else {
    // 도트 사이트 — 박스 + 발광 점(고정 비색칠)
    const boxGeo = new RoundedBoxGeometry(0.05 * sz, 0.05 * sz, 0.05 * sz, 2, 0.012)
    geos.push(boxGeo)
    const boxY = yTop + 0.025 * sz
    const box = new THREE.Mesh(boxGeo, fixedMaterial(PLACEHOLDER))
    box.position.set(0, boxY, 0)
    primary.push(box)
    group.add(box)
    const dotGeo = new THREE.SphereGeometry(0.008 * sz, seg, seg)
    geos.push(dotGeo)
    const dot = new THREE.Mesh(dotGeo, glowMaterial(0xff3b3b))
    dot.position.set(0, boxY, -0.026 * sz)
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
